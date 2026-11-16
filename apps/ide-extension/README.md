# Snapkit Debug Sync

Debug Flutter and React Native on the devices selected in [Snapkit](https://snapkit.vn/), from VS Code, Cursor or Antigravity. Project source and `launch.json` stay on your computer and are not rewritten.

## What's new in 1.8.1

Snapkit Desktop beta.94 aligns the debug toolbar in two rows, removes Quick setup from Devices, and uses the same themed Run configuration menu in Devices and Mini, with keyboard support.


- Choose dev, prod, staging or any project debug profile next to Run in Devices and Mini.
- Choose IDE profiles or saved Snapkit profiles without changing your device selection.
- IDE profiles preserve their entrypoint, flavor, arguments, defines and environment.

### Debug Console update (1.7.2)

- Mirror IDE debug adapter output in Snapkit Debug Console, scoped to the project and selected device.
- Receive output only during debug sessions; device system logs are no longer collected.
- Keep console output local and in memory, with bounded retry queues when Snapkit is unavailable.

### Previous toolbar update (1.7.1)

- Run Flutter debug from Snapkit or the floating Mini widget.
- Use Hot reload, Hot restart and Stop for sessions on the selected devices.
- Keep the IDE's selected dev/prod profile when pressing F5.
- Read extension setup instructions here and release notes in the Changelog tab.

The new Snapkit and Mini controls require Snapkit Desktop **0.2.0-beta.94 or newer** and this extension **1.8 or newer**. Your IDE must be open with the same project in a trusted workspace. React Native continues to launch from the IDE.

## Install and connect

1. Download Snapkit Desktop from [snapkit.vn](https://snapkit.vn/#downloads).
2. Install the Snapkit Debug Sync VSIX in your editor: **Extensions → … → Install from VSIX**. Reload the editor window after updating.
3. For Flutter, also install Dart and Flutter extensions. For React Native, install Node.js and the project's native Android/iOS tools.
4. Open the same project in Snapkit and your IDE. Start devices, then select the devices you want to debug in Snapkit.

## Choose dev, prod or another configuration

In **Devices** or the floating **Mini → Debug**, choose **Run configuration** above Run. IDE choices come from this project’s debug profiles; saved Snapkit profiles appear alongside the current project settings. The flavor is shown before the profile name. This choice is shared between Devices and Mini and remembered per workspace. Device selection stays unchanged. Changes apply to your next Run; stop existing sessions before running again. Missing, deleted or ambiguous profiles never fall back to another environment.

F5 continues using the profile selected in your IDE. The Snapkit selector applies to Run in Snapkit and Mini.

## Two ways to start Flutter debug

| Where you press Run | Configuration used |
| --- | --- |
| IDE Run/Debug or F5 | The selected IDE profile, including entrypoint, flavor, Dart defines, arguments and environment. Snapkit supplies device selection. |
| Snapkit or Mini Run | The profile chosen in **Run configuration** in Snapkit or Mini: an IDE debug profile, a saved Snapkit profile, or the current Snapkit project settings. IDE profiles keep their full IDE configuration. |

To use Snapkit's project settings when pressing F5 too, set `snapkit.flutterLaunchConfiguration` to `dashboard` in the IDE settings. Its default value is `ide`. These settings apply to the next launch; running sessions are not reconfigured. Prepared Teams sessions use the configuration prepared in Teams.

The toolbar's Hot reload, Hot restart and Stop commands apply to running sessions on **selected devices**. Hot reload and Hot restart are available for Flutter. Stop ends debugging; it does not shut down the device. The IDE remains responsible for building and debugging your app.

## Debug Console

Open **Debug Console** in Snapkit, then start debugging in your IDE or use Snapkit Run. Install extension **1.7.2** to mirror console, stdout and stderr output from supported Flutter and React Native debug adapters. Select all devices or one device; search, filter, pause following, clear the view, copy or export the output. No active session shows a waiting state. Finished output remains available in memory until Snapkit closes or older entries are discarded (latest 1,000 lines). Device system logs and adapter telemetry are not collected.

## React Native

Select **Snapkit React Native** in Run and Debug, then press F5. Snapkit prepares Metro and a separate Hermes debugger for each selected device. Supported targets are Android devices/emulators and iOS simulators. Expo Go and physical iPhone launches are not supported. The new Run button in Snapkit/Mini is currently for Flutter.

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `snapkit.useDashboardTargets` | `true` | Use Snapkit's selected devices for IDE Run/Debug when the local agent and project match. |
| `snapkit.flutterLaunchConfiguration` | `ide` | Choose `ide` or `dashboard` as the Flutter configuration source for F5. |
| `snapkit.agentUrl` | `http://127.0.0.1:4310` | Local Snapkit agent address. Only loopback HTTP addresses are accepted. |
| `snapkit.syncFlutterRestart` | `true` | Forward the IDE Restart button to other running Flutter sessions. |

## Troubleshooting

- **F5 uses the wrong environment:** choose the intended IDE profile and leave `snapkit.flutterLaunchConfiguration` set to `ide`. Snapkit Run uses the profile selected in Run configuration in Devices or Mini.
- **Run cannot find an IDE:** open the same project in one trusted IDE window with Debug Sync 1.8.1+, then reload the window. Multiple connected windows for the same project must be reduced to one before starting from Snapkit.
- **A selected device is unavailable:** start it or remove it from the selection. Stop existing debug sessions on selected devices before launching again.
- **A launch or reload fails:** check the IDE Debug Console and **Output → Snapkit Debug Sync** for details.
- **Snapkit is offline:** normal IDE debug profiles continue to work. Snapkit toolbar controls need the local agent and connected IDE.

## Tiếng Việt

**F5 trong IDE** dùng cấu hình dev/prod đang chọn trong IDE. **Run trên Snapkit hoặc widget Mini** dùng profile trong bộ chọn **Cấu hình chạy** phía trên nút Run: profile IDE dev/prod, profile Snapkit đã lưu hoặc cấu hình dự án hiện tại. Lựa chọn được lưu theo workspace và đồng bộ giữa Devices với Mini. Chọn thiết bị trước khi chạy; Hot reload, Hot restart và Stop chỉ điều khiển các phiên trên thiết bị đã chọn.

Cần mở cùng dự án trong IDE, tin cậy workspace và tải lại cửa sổ IDE sau khi cập nhật extension. Bộ điều khiển mới cần Snapkit Desktop 0.2.0-beta.94 trở lên. Run trong Snapkit/Mini hiện dành cho Flutter; React Native tiếp tục chạy từ IDE.

[Website and downloads](https://snapkit.vn/) · [Report an issue](https://github.com/bimbimvqt/snapkit/issues)
