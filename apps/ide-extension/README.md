# Snapkit Debug Sync

<img src="icon.png" width="80" height="80" alt="Snapkit">

**Choose devices in Snapkit. Keep debugging in your editor.**

[Tiếng Việt](README.vi.md) · [Changelog](CHANGELOG.md) · [Support](SUPPORT.md) · [Download Snapkit](https://github.com/bimbimvqt/snapkit/releases)

Snapkit Debug Sync connects the local Snapkit desktop app to your editor’s Flutter debugger. Launch the devices selected in Dashboard, synchronize Hot Restart, and stop debug on a single device without changing your project files.

## What you can do

- Launch multiple selected Flutter devices from one normal **F5 / Run and Debug** action. Peer launches begin concurrently; Flutter/Xcode may serialize build work.
- Keep each device’s breakpoints, logs, Hot Reload and DevTools in the IDE.
- Forward the IDE **Restart** action to other ready Flutter sessions. This performs Hot Restart and resets app state; it is separate from Hot Reload.
- See connected debug sessions on Snapkit device cards. **Stop debug** asks the owning IDE to stop that device’s sessions while other devices continue.
- Use your original IDE configuration when Snapkit is unavailable or Dashboard targets are disabled.

The extension is optional for creating, starting and turning off simulators/emulators. Those controls belong to Snapkit Desktop. **Turn off device** shuts down the virtual device and preserves its data; **Stop debug** keeps the virtual device running. Physical phones cannot be powered off from Snapkit.

## Compatibility and requirements

| Component | Requirement |
| --- | --- |
| Snapkit Desktop | beta.7 or later recommended; beta.6 introduced device debug controls |
| Editor | VS Code 1.85+; Cursor and Antigravity compatibility is beta |
| Editor extensions | Dart and Flutter, installed and enabled in the same editor |
| Project | A trusted local Flutter workspace |
| Development tools | Flutter SDK and Android SDK; iOS Simulator also requires macOS and Xcode |
| Other editors | Android Studio/IntelliJ keep their own debug controls; this VSIX does not run there |

Windows supports Android device management. Native desktop packages for Linux and Windows ARM are not part of the current beta. This extension does not provide React Native, Metro or JetBrains group-debug integration. Remote SSH, WSL and Dev Containers are not verified: loopback refers to the machine running the extension host, which may differ from the desktop app’s machine.

## Install or update

1. Download **snapkit-debug-sync.vsix** from the [Snapkit release page](https://github.com/bimbimvqt/snapkit/releases).
2. In your editor, open **Extensions → … → Install from VSIX…**, then choose the downloaded file.
3. Run **Developer: Reload Window**. Save your work and stop existing debug sessions before reloading.
4. Open this extension’s details and confirm version **1.3.1** or later. Start a new debug run so the updated extension owns the session.

Install the VSIX in each editor you want to connect. A VSIX install does not configure automatic marketplace updates; update using a newer VSIX. You do not need Node.js or Python to use the packaged extension or desktop app.

Optional VS Code CLI installation:

```sh
code --install-extension /absolute/path/to/snapkit-debug-sync.vsix --force
```

## First debug run

1. Open Snapkit Desktop and your Flutter project in the IDE.
2. In Snapkit, open **IDE debug setup**, select the same project folder, then choose a debug profile or enter its flavor, Dart entrypoint and optional defines file path.
3. Start your simulators/emulators and select **Select for IDE** on the devices you want.
4. Keep **Use Dashboard targets** enabled.
5. In the IDE, select your normal Flutter launch profile and press **F5**. Snapkit supplies the selected device configurations in memory.
6. Use the IDE for breakpoints, Hot Reload, logs and DevTools. Changing Dashboard selection affects the next run.

If you move or rename the project folder, select its new location in Snapkit. The extension does not search your disks for moved projects. SDK folders are separate from project folders and do not need changing when only the project moves.

## Stop one device’s debug session

With a new debug run started under Debug Sync 1.3+, the matching Snapkit device card shows **Debugging in IDE → Stop debug**. The local agent requests a stop, and the owning IDE executes it. Other devices stay running. If multiple IDE sessions target that same device, the action requests all of those sessions to stop.

The button appears only for sessions reported by a connected extension with a device ID. Older extensions, unsupported editors and sessions without an identified device retain their IDE’s own Stop control. Disconnected session reports expire after about ten seconds. Closing Snapkit or losing the agent connection does not automatically stop IDE sessions.

A failed group launch cancels its peers to avoid leaving a partially launched group behind. Ending an individual running session leaves other running sessions alive.

## Settings and commands

| Setting | Default | Behavior |
| --- | --- | --- |
| `snapkit.useDashboardTargets` | `true` | Use Dashboard’s selected devices for eligible Flutter launches when project paths match. |
| `snapkit.agentUrl` | `http://127.0.0.1:4310` | Local agent URL. Only HTTP loopback addresses (`127.0.0.1` or `localhost`) are accepted. |
| `snapkit.syncFlutterRestart` | `true` | Forward IDE Restart to other ready Flutter sessions tracked by this editor. |

Command Palette: **Snapkit: Toggle Dashboard Targets** switches the integration on or off in the editor. It does not stop existing sessions.

Attach, tests, profile/release mode, Run Without Debugging, untrusted workspaces and other project folders keep their original IDE launch configuration. If the agent has an active selection that is invalid or offline, the extension reports the issue rather than choosing a different device.

## Your project and data

The extension does not write `launch.json`, project settings, generated source files or device IDs into your repository. Snapkit stores project configuration on your computer; it keeps a defines file’s path, not its contents.

Debug plans and session reports travel to the loopback agent. Reports contain the IDE session ID, debug session name and device ID; stop requests are scoped to the owning extension instance. Session control uses the local agent’s mutation token, keeps ownership in memory and expires disconnected owners. This integration sends no project source to the Snapkit cloud service. IDE/Flutter extensions retain their own data policies.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| F5 uses the original device selection | Open Snapkit, enable Dashboard targets, trust the workspace and select the same project folder in both apps. |
| No Stop debug button | Upgrade this VSIX, reload the IDE and start a fresh device debug run. Confirm the session has a device ID. |
| A selected device is offline | Start it or remove it from the next run’s selection in Dashboard. |
| Agent cannot connect | Check the desktop app is running and Agent URL matches its loopback port. Resolve port conflicts without stopping unrelated processes. |
| Devices build at different speeds | Launches are concurrent; Flutter/Xcode build locks and host resources can delay app readiness. |
| Restart affects other sessions | Turn off `snapkit.syncFlutterRestart` if you want Restart to apply only to its source session. |
| Source folder moved | Select the new folder in Snapkit’s IDE debug setup. |

Open **View → Output → Snapkit Debug Sync** for integration logs. See [Support](SUPPORT.md) for reporting a reproducible problem, or [Changelog](CHANGELOG.md) for version history.
