# Snapkit Dev Lab

Open **Dev Lab** from the sidebar in Snapkit Desktop. Workspaces, devices, runs and access keys stay on the current computer. Website pairing cannot run Dev Lab jobs. Demo mode never launches commands or enables MCP.

## Compare builds

1. Open **Dev Lab → Performance** and choose your device and installed app. One available device/app is selected automatically.
2. Press **Measure current build**. Snapkit uses a 5-second observation by default.
3. Install your new build on the same device, then press **New build installed — measure & compare**. App, device and duration stay fixed. Snapkit compares automatically and explains opening time, memory and recorded jank separately.

The comparison draft is saved locally per workspace so you can leave and return. Cancellation or failure keeps the successful first measurement. **Options & missing apps** contains manual app ID entry and duration. Previous measurements and technical notes are collapsed below the main flow. **Save comparison** exports both measurements and their differences as JSON.

- Android: cold launch `am start -W -S` TotalTime, end-of-run PSS memory and HWUI frame jank from `dumpsys gfxinfo`. HWUI does not represent every Flutter or React Native engine frame.
- iOS Simulator on macOS: `simctl launch` command duration and host RSS for the app process. Command duration is not time to first rendered frame. Frame jank is unavailable; use Instruments for rendering analysis.

Unavailable metrics stay unavailable. Comparisons require the same app ID, workspace, device ID, OS, measurement method, observation duration. Lower values indicate improvement. Repeat measurements under similar conditions to assess noise; single runs do not establish a statistically reliable regression. Snapkit does not install or build the compared apps automatically.

## AI connection over MCP

1. Keep Snapkit Desktop open and signed in.
2. Open **Dev Lab → AI connection (MCP)** and enable MCP.
3. Copy **Client configuration** into your AI coding client's MCP server settings, then reconnect that client.
4. Verify the client lists `snapkit_context`, `snapkit_results`, `snapkit_logs` and `snapkit_compare`.

MCP is disabled by default. Read access includes local workspace paths, device status, run summaries and existing redacted system logs. It does not start log capture or expose debug transport addresses. The client must run on the same machine.

Enable **Allow AI to run measurements** separately to expose `snapkit_measure` and `snapkit_cancel`. They accept a known device ID, package/bundle ID, build label and observation duration; they do not accept arbitrary shell commands. A measurement call uses:

```json
{"appId":"com.example.app","deviceIds":["avd:Pixel"],"label":"Build 1.2","seconds":5}
```

Use `snapkit_context` to obtain current device IDs. Calls return a job immediately; read `snapkit_results` again after completion. Disable MCP to revoke access. **Rotate access key** invalidates the previous key; the relay reads the replacement automatically. The configuration contains a private key file path rather than the key itself. Keep that local file private.

One Dev Lab job can run at a time. Stop builds, recordings, debugging and start-kit tasks first. During a job, Snapkit blocks device and workspace mutations. Cancel, sign-out and app shutdown terminate active processes. The latest 60 runs are retained, filtered by workspace; runs interrupted by a restart are marked interrupted.
