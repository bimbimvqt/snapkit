import { execFileSync } from "node:child_process";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { isIP } from "node:net";
import { networkInterfaces } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const root = resolve(dirname(scriptPath), "..");
const sourcePath = resolve(root, "app/config/development.json");
const outputPath = resolve(root, "app/config/development.device.json");
const virtualInterfacePrefixes = ["awdl", "bridge", "docker", "llw", "lo", "utun", "vmenet", "vmnet"];

function isPrivateIpv4(address) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return false;
  }
  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function isPhysicalInterface(name) {
  return !virtualInterfacePrefixes.some((prefix) => name.startsWith(prefix));
}

export function selectDeviceAddress(interfaces, defaultInterface) {
  const candidates = Object.entries(interfaces).flatMap(([name, addresses]) =>
    (addresses ?? [])
      .filter(
        (entry) =>
          (entry.family === "IPv4" || entry.family === 4) &&
          !entry.internal &&
          isPrivateIpv4(entry.address) &&
          isPhysicalInterface(name),
      )
      .map((entry) => ({
        address: entry.address,
        score: (name === defaultInterface ? 1_000 : 0) + (name === "en0" ? 200 : name === "en1" ? 100 : 0),
      })),
  );

  candidates.sort((left, right) => right.score - left.score || left.address.localeCompare(right.address));
  return candidates[0]?.address ?? null;
}

function defaultInterfaceName() {
  if (process.platform !== "darwin") return null;
  try {
    const route = execFileSync("/sbin/route", ["-n", "get", "default"], { encoding: "utf8" });
    return route.match(/^\s*interface:\s*(\S+)/m)?.[1] ?? null;
  } catch {
    return null;
  }
}

function argumentValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function configuredHost() {
  const host = argumentValue("host") ?? process.env.SNAPKIT_DEVICE_HOST;
  if (!host) return null;
  if (isIP(host) === 4 || /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9][a-z0-9-]*$/i.test(host)) {
    return host;
  }
  throw new Error("SNAPKIT_DEVICE_HOST must be an IPv4 address or hostname without a protocol or port");
}

function readDevelopmentConfig() {
  const config = JSON.parse(readFileSync(sourcePath, "utf8"));
  const requiredKeys = ["APP_ENV", "GOOGLE_SERVER_CLIENT_ID", "GOOGLE_IOS_CLIENT_ID"];
  const missing = requiredKeys.filter((key) => typeof config[key] !== "string" || config[key].trim() === "");
  if (missing.length > 0) throw new Error(`Missing ${missing.join(", ")} in app/config/development.json`);
  if (config.APP_ENV !== "development") throw new Error("app/config/development.json must use APP_ENV=development");
  return config;
}

async function checkBackend(apiBaseUrl) {
  const response = await fetch(`${apiBaseUrl}/api/health`, { signal: AbortSignal.timeout(3_000) });
  if (!response.ok) throw new Error(`Backend health check returned HTTP ${response.status}`);
}

export async function generateDeviceConfig() {
  const host = configuredHost() ?? selectDeviceAddress(networkInterfaces(), defaultInterfaceName());
  if (!host) {
    throw new Error(
      "Cannot find an active private IPv4 address. Connect the Mac to the same network as the iPhone or set SNAPKIT_DEVICE_HOST.",
    );
  }

  const port = Number(argumentValue("port") ?? process.env.SNAPKIT_DEVICE_API_PORT ?? "3001");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("SNAPKIT_DEVICE_API_PORT is invalid");

  const apiBaseUrl = `http://${host}:${port}`;
  const config = { ...readDevelopmentConfig(), API_BASE_URL: apiBaseUrl };
  const temporaryPath = `${outputPath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporaryPath, outputPath);

  if (process.argv.includes("--check-backend")) await checkBackend(apiBaseUrl);
  console.log(`Ready app/config/development.device.json → ${apiBaseUrl}`);
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  try {
    await generateDeviceConfig();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
