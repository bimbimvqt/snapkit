#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
keystore_dir="$project_dir/app/android/keystore"
keystore_path="$keystore_dir/toolbox-upload.jks"
env_path="$project_dir/.android-signing.env"

if [[ -f "$keystore_path" && -f "$env_path" ]]; then
  echo "Android upload keystore already exists. Existing signing identity was preserved."
  exit 0
fi
if [[ -f "$keystore_path" || -f "$env_path" ]]; then
  echo "Signing setup is incomplete: keystore and .android-signing.env must either both exist or both be absent." >&2
  exit 1
fi
if ! command -v keytool >/dev/null 2>&1; then
  echo "keytool was not found. Install JDK 17+ and run this command again." >&2
  exit 1
fi

mkdir -p "$keystore_dir"
signing_password="$(openssl rand -hex 24)"

keytool -genkeypair \
  -keystore "$keystore_path" \
  -storepass "$signing_password" \
  -keypass "$signing_password" \
  -alias toolbox-upload \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000 \
  -dname "CN=Toolbox One, OU=Mobile, O=Toolbox One, L=Ho Chi Minh City, C=VN" \
  -noprompt >/dev/null

umask 077
printf '%s\n' \
  "ANDROID_KEYSTORE_PATH=../keystore/toolbox-upload.jks" \
  "ANDROID_KEYSTORE_PASSWORD=$signing_password" \
  "ANDROID_KEY_ALIAS=toolbox-upload" \
  "ANDROID_KEY_PASSWORD=$signing_password" \
  > "$env_path"

chmod 600 "$keystore_path" "$env_path"
echo "Android upload signing identity created."
echo "Back up app/android/keystore/toolbox-upload.jks and .android-signing.env securely; losing them can block future app updates."
