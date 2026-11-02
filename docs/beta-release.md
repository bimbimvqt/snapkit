Snapkit brings your local test devices into one calm workspace. The beta is free and does not ask for a payment card or create a subscription.

Downloads:
- **mac-arm64.dmg**: Apple Silicon Macs running macOS 13 or later.
- **mac-x64.dmg**: Intel Macs running macOS 13 or later.
- **win-x64.exe**: Windows x64, installed for your user account.
- **snapkit-debug-sync.vsix**: optional Flutter group-debug integration for compatible VS Code editors.

Open the app, visit **Setup & tools**, choose your project, then start a device. Node.js and a terminal are not required to open the packaged application. Flutter, Android SDK and/or Xcode are separate development tools; Snapkit detects them and guides you through missing setup. iOS Simulator requires macOS and Xcode. Windows supports Android device management.

This first beta is **unsigned and not notarized**. Operating-system security warnings are expected; if your computer or organization requires signed applications, wait for a signed release. Published SHA256 checksums detect file changes but are not a substitute for code signing. No automatic update installation is enabled.

Device management works alongside any editor. Snapkit Debug Sync provides Flutter group selection in VS Code-compatible editors; Cursor and Antigravity compatibility is beta. Android Studio, IntelliJ and other editors use their own device selector. Native JetBrains group-debug integration, Linux packages and React Native launch/Metro integration are not included.

Existing local Snapkit configurations are retained when detected. SDK folder changes need an app restart. A process already using port 4310 is never stopped automatically. Closing Snapkit stops only its own agent; it does not erase devices or stop IDE-owned debug sessions. Removing Snapkit preserves device/project data.

Pro features shown in the app are included during beta. Paid pricing and limits are not final. RevenueCat checkout remains disabled until account identity, purchase recovery, billing configuration and end-to-end payment validation are ready. Ending beta never starts a paid subscription automatically.
