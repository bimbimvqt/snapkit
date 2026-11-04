New in beta.22: connect Apple teams using local App Store Connect team API keys, load accessible apps and remember team/app selections per workspace and flavor. Team suggestions come from project signing settings and local certificates. New IPA builds validate the effective Xcode bundle ID, use per-job team/export settings without editing project files, and inspect the saved IPA before upload. Saved builds keep their original team/app even when the current environment changes. Apple credentials remain local; Apple password sign-in and automatic account-wide team discovery are not supported. English/Vietnamese custom selectors, key errors and setup guidance are included. Real Apple signing/upload requires your own team setup and has not been exercised in automated verification.

New in beta.21: fixes in-app update preparation getting stuck in packaged Electron. Update bundles are cleaned using the real filesystem, not Electron's virtual ASAR filesystem. Preparation/cleanup failures now produce retryable errors. Real-Electron updater filesystem regression checks run before packaging. Install still requires your restart/install confirmation.

New in beta.20: release configuration lists remove workspace/IDE duplicates without hiding distinct configurations. Version and build number are prefilled from pubspec.yaml and remain editable per build. Refresh preserves edits, and a reset restores project values. TestFlight confirmation identifies the saved IPA version/build; the release page now explains signing, upload and Apple processing in English/Vietnamese.

New in beta.19: production desktop packages include workspace APK/AAB/IPA builds and a separate TestFlight upload action. Updates can now be checked, downloaded, verified and installed from Preferences. Installation requires confirmation and no active builds/uploads/recordings/debug sessions. macOS stages the new bundle and retains the previous version until startup succeeds. Cache clearing preserves user data. Older app versions need one manual installation to gain this updater. See docs/in-app-updates.md for release and signing requirements.

New in beta.18: sidebar keyboard focus uses an inset outline, preventing clipping by the navigation scroll container and overlap with adjacent items. Active-page highlighting stays distinct in both themes.

New in beta.17: selected device sets have a persistent IDE badge, selected/online counts and a clear update action when readiness changes. Selection is remembered per project and cleared by manual target changes, set edits or deletion. Card spacing and startup-result separation are improved. Selecting targets applies to the next debug run.

New in beta.16: saved screenshots and finalized recordings automatically display thumbnail images. Click a thumbnail to open a large preview dialog, with playback, seeking and fullscreen controls for video, plus download and close actions. Escape closes the viewer and restores focus. Video tiles show a static poster and play icon, with no autoplay in the gallery.

Thumbnails load near the visible gallery area, with at most two generation jobs at a time. Full original video blobs are released after producing small poster images. Requests retain local/paired authentication; captures are never uploaded to the cloud. Loading and retry feedback, EN/VI copy and small-window layouts are included.

New in beta.15: all app selects use a shared themed menu instead of OS dropdowns, including device pickers, log level, project profile, device model and runtimes. Flavor suggestions are custom and still accept free text. Long lists support search; menus support keyboard selection, disabled/required feedback, English/Vietnamese and dialog/viewport boundaries in both themes.

The UI review also fixes capture previews after returning to the page, preserves focused device-set controls across background refreshes, adds explicit cancel for device-set editing and keeps Stop logs disabled after stopping. Unavailable capture actions are disabled until the required project/device is selected.

New in beta.14: Quick start guide is now a full, bilingual page with eight chapters, platform requirements, troubleshooting and actions that open the right tool.

Project device sets can be saved, edited, deleted and started with per-device results. Up to two virtual devices boot concurrently. Connected physical devices are included when ready; Snapkit never powers them on remotely. IDE selection is a separate action after startup.

Device logs stream Android logcat or iOS Simulator system logs, with search, warning/error filters, follow/pause and filtered text export. These are system logs; Flutter/Dart debug output stays in your IDE. Buffers retain up to 1,000 lines / 1 MB, with at most four streams. Streams stop after a minute without a viewer.

Captures offers project-specific PNG screenshots and MP4 screen recordings for Android and iOS Simulator, with preview, download and explicit deletion. Recording is limited to three minutes without audio, and at most two simultaneous recordings. Physical iPhone logs and capture require Xcode or QuickTime. Protected content may appear blank. Capture files and device sets stay in Snapkit application data; project source is never modified. Quit asks for confirmation while a recording is active, then stops Snapkit-owned recordings. An abrupt termination is reported as an interrupted capture on the next launch. Android recordings are stopped using only their owned PID and remote filename.

Empty admin announcements no longer leave a blank banner. Sidebar navigation is organized into Workspace, Setup, Account and Support, with Quick start guide available directly under Support.

Desktop sign-in now includes the Google icon and a cleaner layout. Connection retry appears only after a connection or verification error, shows progress and performs a fresh session check.

Snapkit now opens with an animated logo splash while the local agent and sign-in screen get ready. The splash follows your English/Vietnamese preference and system reduced-motion setting.

Google sign-in is required to use the app. Sessions stay in the operating system encrypted credential store; source code and device commands stay on your computer. Internet is required to verify account access.

Physical device cards no longer show a disabled power button. Missing hardware specifications use a clear availability message instead of empty RAM/CPU/screen indicators. Android values remain visible when reported by adb. The app and website wordmark now reads Snapkit with a capital S.

Snapkit Debug Sync 1.3.1 now includes the shared Snapkit app icon, detailed English and Vietnamese guides, a changelog and support links in its editor Details view. Install the included VSIX and reload your editor to activate the updated extension.

IDE status updates are ordered so delayed state responses cannot restore an already-ended debug session.

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

Open the app, sign in with Google, visit **Setup & tools**, choose your project, then start a device. Node.js and a terminal are not required to open the packaged application. Flutter, Android SDK and/or Xcode are separate development tools; Snapkit detects them and guides you through missing setup. iOS Simulator requires macOS and Xcode. Windows supports Android device management.

This beta is **ad-hoc signed on macOS, without an Apple Developer ID or notarization**. Bundle signatures are verified during packaging, fixing the invalid signature in beta.1. Gatekeeper may still block downloaded apps. Copy Snapkit.app to a writable Applications folder before opening; try System Settings → Privacy & Security → Open Anyway. Trusted beta testers can remove quarantine only from their installed Snapkit copy (`xattr -dr com.apple.quarantine "/path/to/Snapkit.app"`). Do not disable Gatekeeper globally. Windows installers do not yet have a publisher certificate. If your computer or organization requires a developer-signed application, wait for that release. Published SHA256 checksums detect file changes but are not a substitute for code signing. From beta.19, updates can be downloaded and installed inside Snapkit after explicit user confirmation; ad-hoc signing limitations still apply.

Device management works alongside any editor. Snapkit Debug Sync provides Flutter group selection in VS Code-compatible editors; Cursor and Antigravity compatibility is beta. Android Studio, IntelliJ and other editors use their own device selector. Native JetBrains group-debug integration, Linux packages and React Native launch/Metro integration are not included.

Existing local Snapkit configurations are retained when detected. SDK folder changes need an app restart. A process already using port 4310 is never stopped automatically. Closing Snapkit stops only its own agent; it does not erase devices or stop IDE-owned debug sessions. Removing Snapkit preserves device/project data.

Pro features shown in the app are included during beta. Paid pricing and limits are not final. RevenueCat checkout remains disabled until account identity, purchase recovery, billing configuration and end-to-end payment validation are ready. Ending beta never starts a paid subscription automatically.
