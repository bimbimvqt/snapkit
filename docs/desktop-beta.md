# Desktop beta and commercialization

## What ships

Snapkit 0.2.0-beta.7 is a free, account-free desktop beta. The Electron app includes its Node runtime and local device agent. The renderer is sandboxed with no Node access. A narrow preload bridge handles version checks, opening allowlisted HTTPS setup links, and restarting the application. Device commands stay on loopback and retain Host/Origin checks, mutation tokens, pairing expiry and exact-device delete confirmation.

The dashboard separates Devices, Setup & tools, Preferences and Your plan. Onboarding can be hidden and reopened from Setup & tools. No purchase button, price or artificial active subscription is shown. Multi-device Flutter workflows remain available during beta. Signing, production accounts and payments are release gates for commercialization, not beta features silently claimed as complete.

## Platforms and editors

| Target | Beta scope | Validation |
| --- | --- | --- |
| macOS arm64 | DMG/ZIP, Android + iOS preparation | Local Electron smoke, packaged-app smoke, CI packaging |
| macOS x64 | DMG/ZIP, Android + iOS preparation | CI packaging and launch smoke on runner; physical Intel Mac QA remains |
| Windows x64 | per-user NSIS installer, Android preparation | CI packaging and Electron launch smoke; clean Windows hardware/device QA remains |
| Windows ARM64 / Linux | source-level device-management architecture only | Not advertised as supported downloads |
| VS Code | optional VSIX for Flutter group debug | mocked adapter lifecycle tests; fresh installed-IDE QA remains |
| Cursor / Antigravity | VSIX integration in beta | compatibility varies by editor/Dart extension version; release notes state beta |
| Android Studio / IntelliJ / other editors | start/manage devices, use editor's selector | native group-debug plugin not implemented |
| React Native / Expo | prepare virtual devices for external tools | Metro, app launch and debug integration not implemented |

## Installation and recovery cases

| Case | Behavior |
| --- | --- |
| No Node or terminal | packaged runtime starts the agent |
| Flutter missing or GUI PATH differs | diagnostics explains setup; choose SDK root in Preferences |
| Android SDK exists | discover environment variables and standard OS install location |
| SDK path contains spaces | CLI argument arrays; Windows .bat invocation quotes validated arguments |
| SDK on a custom drive | user can save an existing SDK folder; restart applies storage paths |
| Existing local Snapkit/SSD install | retain data root when existing settings are detected; never select an arbitrary similarly named drive |
| Existing AVDs / native CoreSimulator data | retain configured AVD home; use standard AVD home for new installations; honor existing iOS symlink |
| Missing Xcode/runtime | explain separate installation; no automatic license acceptance |
| Low memory / low disk | setup guidance warns; OS/tool errors remain visible; no automatic deletion |
| No internet | manage installed local devices; updates/downloads show retryable errors |
| Local port 4310 busy | show actionable error; never kill another process |
| Same desktop opened twice | focus existing window |
| Browser/demo agent occupies the port | do not silently attach the desktop to a demo or incompatible agent |
| Tool/agent crashes | explain restart; preserve project and device data |
| Quit during setup | ask whether to keep open; graceful shutdown terminates tracked setup commands |
| Restart during download/install | persisted running job becomes an error; user refreshes catalog before retry |
| USB device not visible | explain trust, developer mode/drivers; physical devices cannot be deleted |
| Selected device disappears | existing debug plan rejects unavailable targets; user updates selection |
| IDE integration disabled / agent offline | ordinary IDE debug remains available |
| App removed | per-user installer retains app data; devices and project folders are not uninstalled |
| Update available | explicit check and download; no unsigned automatic replacement |

## RevenueCat integration

The cloud service has an authenticated RevenueCat webhook and a customer entitlement endpoint. Webhooks reconcile current provider state instead of trusting an event as a purchase grant. Duplicate events are deduplicated on disk; transfers reconcile previous and new owners. Customer keys are hashes, and server-side provider credentials are never shipped to desktop or exposed by configuration APIs. State writes are serialized and atomically renamed; deploy one replica for this beta service. A failed provider lookup returns a retryable error and does not mark the event processed.

Entitlement normalization handles cancellation until expiry, billing grace, expiry, lifetime access and production rejection of sandbox subscriptions. `/v1/me/subscription` requires a verified OIDC JWT subject; a client cannot choose another customer's ID. In beta checkout always returns `BETA_FREE`, including when provider credentials are present.

Before enabling sales:
1. Create the Snapkit RevenueCat project, entitlement `pro`, products and offering. Choose RevenueCat Web Billing or another supported store distribution deliberately; a backend entitlement adapter alone is not a purchase SDK.
2. Provide production account identity (OIDC/JWKS issuer/audience), verified account recovery and a desktop sign-in flow. Use the account subject as RevenueCat App User ID; avoid per-install IDs for paid ownership.
3. Add RevenueCat purchase UI/SDK, restore on another computer, authenticated customer management/cancellation, and provider-derived price/currency/renewal disclosure. No placeholder price is final.
4. Add short-lived server-signed entitlements for offline paid use, renewal grace and clock-tamper handling. Never trust localStorage or an unsigned plan flag for access.
5. Publish final plan boundaries, privacy/terms and support contact; confirm source licensing/business ownership separately. Public source does not itself grant an open-source license.
6. Validate sandbox purchase, renewal, cancellation, refund, billing failure/recovery, expiry, account transfer, duplicate/out-of-order webhook, offline recovery, account deletion and restore. Validate a controlled live transaction before public paid launch.
7. Enable checkout only in a separately reviewed release after these checks pass. Beta never turns into a paid subscription automatically.

## Service deployment

`cloud/compose.yaml` runs a separate 192 MiB / 0.35 CPU service on the existing edge network. The host serves release metadata and the public beta plan catalog; it never receives local device commands. `cloud/.env.example` lists provider/identity settings. Real `.env` and data are ignored. Server data directory must be writable by UID 1000. Use one cloud replica while JSON persistence is in place; use a transactional database before scaled paid traffic.

Temporary HTTPS host: `snapkit.45.119.214.94.sslip.io`. Website downloads remain on GitHub Releases. The existing GitHub Pages controller stays the default pairing origin. A future domain change must update the website origin and pairing configuration together.

## Release verification and remaining gates

Run `npm run check`, `npm test`, `npm run test:ui`, `npm run test:pages`, `npm run desktop:smoke`, then `npm run desktop:dist` on target platforms. Tag `v*-beta.*` builds macOS arm64/x64 and Windows x64, publishes a prerelease only when all packaging jobs succeed, and includes VSIX plus SHA256 checksums.

The first downloadable beta is unsigned/not notarized. GitHub-hosted Windows/macOS launch checks and packaging do not establish USB-device, virtualization, production billing or clean-machine user acceptance. Perform real-device and first-install QA before declaring those supported without qualification. Obtain Apple distribution/notarization credentials and Windows code-signing credentials before signed public distribution. No signing credential is checked into source.

## Language support

Landing page and desktop UI support English (`en`) and Vietnamese (`vi`, shown as VN). A first visit follows the browser locale; an explicit selection is saved as `snapkit-language`. `?lang=en` and `?lang=vi` provide direct links and update when the selector changes. Selection is shared by tabs on the same origin. Desktop and website have separate browser storage, so each retains its own choice. Native desktop notices use the remembered desktop language.

`public/i18n.js` is reused by Pages and cloud. Authored static copy is bound once; dynamic renderers call `t` with source keys and positional values. No observer scans or rewrites arbitrary server data. Project names, device names, paths, identifiers, source code and raw SDK output are preserved. Unknown technical errors retain their original diagnostic text. Catalogs live in `public/locales.js`, `site/locales.js`, and `desktop/locales.cjs`.

Beta.2 macOS bundles use verified ad-hoc signatures. Apple Developer ID signing and notarization remain pending. See the beta release notes for targeted tester installation steps.

Device status is probed every 2 seconds while Dashboard is connected, using CoreSimulator and adb without invoking Flutter or rereading hardware metadata. Full discovery remains every 30 seconds; command latency can delay an individual probe. Shutdown uses an exact simulator ID or a verified AVD name and preserves device data.

Debug Sync 1.3.0 adds authenticated local session reports and per-device stop commands polled by the owning extension. Owners expire after 10 seconds without reports. Reports and commands are in memory only. The dashboard never runs adapter executables or kills Flutter/IDE processes. A session termination leaves peer sessions running; a failed group launch still cancels its peers. Upgrade the VSIX and reload the IDE to enable the button; sessions created before reload may need a fresh debug run.
