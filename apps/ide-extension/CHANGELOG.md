# Changelog

## 1.7.1 — 2026-11-16

- Package the extension README as the IDE Details page and this document as the Changelog tab.
- Add bilingual setup help, configuration precedence, Flutter toolbar requirements and troubleshooting.
- Require a matching README version and a non-empty changelog entry before packaging future updates.

## 1.7.0 — 2026-11-16

- Add a local bridge so Snapkit and its floating Mini widget can start Flutter debug in the connected IDE.
- Add Hot reload, Hot restart and Stop commands scoped to selected device sessions.
- Keep the bridge connected before a debug session starts; reject ambiguous IDE windows and untrusted project launches.
- Capture Snapkit's build configuration when Run is pressed and prevent duplicate launch delivery.

## 1.6.1 — 2026-11-16

- Preserve the selected IDE profile's entrypoint, flavor, Dart defines, arguments and environment for F5.
- Add `snapkit.flutterLaunchConfiguration` to opt into Snapkit's saved project configuration.
- Keep prepared Teams configurations and selected-device fan-out.

## 1.6.0

- Support parallel Flutter device launches before adapter initialization.
- Include React Native Metro/Hermes debugging and Teams session references.
