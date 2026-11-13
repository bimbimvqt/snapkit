# Snapkit Dev Lab

Open **Snapkit Kit → Dev Lab** in Snapkit Desktop. Workspaces, devices, runs and access keys stay on the current computer. Website pairing cannot run Dev Lab jobs. Demo mode never launches commands or enables MCP.

## Maestro flows

Install [Maestro](https://docs.maestro.dev/getting-started/installing-maestro) separately, then add an entry flow to your project's `.maestro` folder:

```yaml
appId: com.example.app
---
- launchApp
- assertVisible: "Welcome"
```

Connect the workspace and start an Android device or an iOS Simulator. Select the flow, choose up to four online devices and press **Run test flows**. Snapkit runs devices sequentially, with a five-minute limit per device. Physical iOS devices are not supported by this integration.

Only run flows you trust: Maestro commands and scripts can change app data and access the local environment. Snapkit discovers at most 100 files, each at most 256 KB, within `.maestro`, ignoring symlinks and nested hidden directories. Keep large test assets outside this folder. Root flows require an `appId` header. Flow changes require a new run.

Expand a finished run to inspect the redacted output. Export JSON, per-device JUnit, or copy a summary into a Teams task. Reports are not automatically uploaded. Review reports before sharing: redaction covers common credentials, not arbitrary app data or personally identifying information.

## Compare builds

Install build A on the device using your normal build/install workflow. Enter its package/bundle ID, a build label, an optional Maestro flow and an observation duration. Measure it, install build B and measure again using the same device and workload. Choose both successful measurements under **Build comparison**.

- Android: cold launch `am start -W -S` TotalTime, end-of-run PSS memory and HWUI frame jank from `dumpsys gfxinfo`. HWUI does not represent every Flutter or React Native engine frame.
- iOS Simulator on macOS: `simctl launch` command duration and host RSS for the app process. Command duration is not time to first rendered frame. Frame jank is unavailable; use Instruments for rendering analysis.

Unavailable metrics stay unavailable. Comparisons require the same app ID, workspace, device ID, OS, measurement method, flow fingerprint and observation duration. Lower values indicate improvement. Repeat measurements under similar conditions to assess noise; single runs do not establish a statistically reliable regression. Snapkit does not install or build the compared apps automatically.

## AI connection over MCP

1. Keep Snapkit Desktop open and signed in.
2. Open **Dev Lab → AI connection (MCP)** and enable MCP.
3. Copy **Client configuration** into your AI coding client's MCP server settings, then reconnect that client.
4. Verify the client lists `snapkit_context`, `snapkit_results`, `snapkit_logs` and `snapkit_compare`.

MCP is disabled by default. Read access includes local workspace paths, device status, run summaries and existing redacted system logs. It does not start log capture or expose debug transport addresses. The client must run on the same machine.

Enable **Allow AI to run tests and measurements** separately to expose `snapkit_test`, `snapkit_measure` and `snapkit_cancel`. These accept known device IDs and workspace flow IDs; they do not accept arbitrary shell commands. For example, a test call uses:

```json
{"flowId":".maestro/login.yaml","deviceIds":["avd:Pixel"],"label":"Login smoke"}
```

Use `snapkit_context` to obtain current device IDs and `snapkit_results` for available flows. Calls return a job immediately; read results again after completion. Disable MCP to revoke access. **Rotate access key** invalidates the previous key; the relay reads the replacement automatically. The configuration contains a private key file path rather than the key itself. Keep that local file private.

One Dev Lab job can run at a time. Stop builds, recordings, debugging and start-kit tasks first. During a job, Snapkit blocks device and workspace mutations. Cancel, sign-out and app shutdown terminate active processes. The latest 60 runs are retained, filtered by workspace; runs interrupted by a restart are marked interrupted.
