Device lifecycle status is checked every two seconds while Dashboard is connected, independently of the slower hardware/Flutter scan. Device cards now offer Turn off device for iOS Simulators and Android AVDs, keeping installed apps and data.

Snapkit Debug Sync 1.3.0 reports active Flutter device sessions to the local agent. A Stop debug button appears on the matching device card and asks the owning IDE to stop that device only, leaving peer sessions and the simulator running. Install the updated VSIX and reload your compatible editor; existing sessions may need restarting. Other IDEs retain their own debug controls. Physical phones cannot be powered off from Snapkit. Session reports expire when the owning extension disconnects; agent failure never stops debug sessions automatically.

Preferences now includes Choose folder buttons for Flutter SDK and Android SDK. Each opens a native folder picker with an English or Vietnamese prompt, keeps existing paths when cancelled, and reminds you to save the selected folder. Saving validates SDK contents; restart Snapkit after changing SDK paths.

The Add device dialog now shows its form immediately while installed models load. iOS no longer waits for Android SDK discovery. Recent catalogs are reused for fast reopening; platform changes, in-progress typing and retry after errors are handled safely.

Device previews now show the full phone/tablet, including the bottom edge. The EN/VN picker uses a styled, keyboard-accessible menu on desktop and the website, instead of the operating system dropdown.

English and Vietnamese are now available in the desktop app and landing page. Choose EN / VN in the top bar; the choice is remembered. Switching language keeps your current project, filters and unsaved form fields. Device names, SDK paths and technical command output are preserved.

Snapkit brings your local test devices into one calm workspace. The beta is free and does not ask for a payment card or create a subscription.

Downloads:
- **mac-arm64.dmg**: Apple Silicon Macs running macOS 13 or later.
- **mac-x64.dmg**: Intel Macs running macOS 13 or later.
- **win-x64.exe**: Windows x64, installed for your user account.
- **snapkit-debug-sync.vsix**: optional Flutter group-debug integration for compatible VS Code editors.

Open the app, visit **Setup & tools**, choose your project, then start a device. Node.js and a terminal are not required to open the packaged application. Flutter, Android SDK and/or Xcode are separate development tools; Snapkit detects them and guides you through missing setup. iOS Simulator requires macOS and Xcode. Windows supports Android device management.

This beta is **ad-hoc signed on macOS, without an Apple Developer ID or notarization**. Bundle signatures are verified during packaging, fixing the invalid signature in beta.1. Gatekeeper may still block downloaded apps. Copy Snapkit.app to a writable Applications folder before opening; try System Settings → Privacy & Security → Open Anyway. Trusted beta testers can remove quarantine only from their installed Snapkit copy (`xattr -dr com.apple.quarantine "/path/to/Snapkit.app"`). Do not disable Gatekeeper globally. Windows installers do not yet have a publisher certificate. If your computer or organization requires a developer-signed application, wait for that release. Published SHA256 checksums detect file changes but are not a substitute for code signing. No automatic update installation is enabled.

Device management works alongside any editor. Snapkit Debug Sync provides Flutter group selection in VS Code-compatible editors; Cursor and Antigravity compatibility is beta. Android Studio, IntelliJ and other editors use their own device selector. Native JetBrains group-debug integration, Linux packages and React Native launch/Metro integration are not included.

Existing local Snapkit configurations are retained when detected. SDK folder changes need an app restart. A process already using port 4310 is never stopped automatically. Closing Snapkit stops only its own agent; it does not erase devices or stop IDE-owned debug sessions. Removing Snapkit preserves device/project data.

Pro features shown in the app are included during beta. Paid pricing and limits are not final. RevenueCat checkout remains disabled until account identity, purchase recovery, billing configuration and end-to-end payment validation are ready. Ending beta never starts a paid subscription automatically.
