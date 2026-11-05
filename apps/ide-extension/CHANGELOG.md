# 1.5.0

- Add Snapkit-owned React Native CLI launch and per-device Hermes attach through the built-in JavaScript debugger.
- Support selected Android devices and iOS simulators with independent debug stop.
- Bundle the local inspector transport; React Native Tools is no longer required for this workflow.

# Changelog

## 1.4.0 — 2026-11-05

- Add React Native device launch plans through React Native Tools, alongside Flutter.
- Report React Native debug sessions and support per-device Stop debug.
- Preserve normal IDE configurations when the agent is unavailable or the framework differs.
- React Native requires native android/ios projects; Expo Go and native iPhone launch are not supported. Start Metro once before debugging multiple devices.

## 1.3.1 — 2026-11-02

- Add the Snapkit icon shared with the desktop app and dashboard branding.
- Include detailed English and Vietnamese guides, troubleshooting, settings and support links in the VSIX.
- Include a changelog and extension metadata so editor Details and Changelog pages have content.
- Preserve the `snapkit-local.snapkit-debug-sync` extension identity so existing installs can be upgraded.

## 1.3.0 — 2026-11-02

- Report active Flutter device sessions to the authenticated local Snapkit agent.
- Accept per-device debug-stop requests from Dashboard through the owning editor.
- Keep peer debug sessions running when one session ends.
- Expire disconnected session owners; agent loss does not stop IDE sessions.

## 1.2.1

- Begin parallel peer launches before debug adapter initialization.
- Avoid waiting for the first app to become ready before requesting peer launches.

## 1.2.0

- Launch Dashboard-selected Flutter devices using in-memory IDE configurations.
- Preserve normal IDE configurations when integration is unavailable or ineligible.

## Earlier versions

- Introduced Flutter Restart synchronization across ready IDE sessions.

Older release dates are omitted where they are not recorded reliably in this package.
