# Changelog

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
