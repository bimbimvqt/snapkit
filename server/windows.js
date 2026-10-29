import { run } from './cli.js';

export async function resizeWindow(device, preset) {
  const sizes = { compact: [390, 780], comfortable: [480, 920], large: [600, 1100] };
  const dimensions = sizes[preset];
  if (!dimensions) throw new Error('Choose compact, comfortable, or large');
  if (device.group === 'physical') throw new Error('Physical devices do not have a simulator window');
  const [width, height] = dimensions;
  const identity = device.avd || device.name;
  if (process.platform === 'darwin') {
    const literal = value => JSON.stringify(value);
    // Select by the actual device/AVD window title, never an arbitrary front window.
    const script = `tell application "System Events"
      set didResize to false
      repeat with appProcess in application processes
        set processName to name of appProcess
        if processName is "Simulator" or processName contains "qemu-system" or processName is "emulator" then
          repeat with deviceWindow in windows of appProcess
            set windowTitle to name of deviceWindow
            if windowTitle contains ${literal(identity)} or windowTitle contains ${literal(identity.replaceAll('_', ' '))} then
              set size of deviceWindow to {${width}, ${height}}
              set didResize to true
              exit repeat
            end if
          end repeat
        end if
      end repeat
      if not didResize then error "No matching simulator window found. Open its native window first."
    end tell`;
    try { await run('osascript', ['-e', script]); }
    catch (e) { throw new Error(`Window resize: ${e.message}. On macOS, allow Accessibility and Automation access for the terminal running Snapkit in System Settings → Privacy & Security, or resize using native window controls.`); }
  } else if (process.platform === 'win32' && device.group === 'android') {
    const quote = s => `'${s.replaceAll("'", "''")}'`;
    const script = `
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class SnapkitWindow {
 public delegate bool Callback(IntPtr h, IntPtr p);
 [DllImport("user32.dll")] public static extern bool EnumWindows(Callback cb, IntPtr p);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder t, int max);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out Rect r);
 [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int height, bool repaint);
 public struct Rect { public int Left; public int Top; public int Right; public int Bottom; }
}
'@
$script:matched = $false
[SnapkitWindow]::EnumWindows({ param($handle, $unused)
 $title = New-Object System.Text.StringBuilder 1024
 [void][SnapkitWindow]::GetWindowText($handle, $title, 1024)
 if ([SnapkitWindow]::IsWindowVisible($handle) -and $title.ToString().Contains('Android Emulator') -and ($title.ToString().Contains(${quote(identity)}) -or $title.ToString().Contains(${quote(identity.replaceAll('_', ' '))}))) {
  $rect = New-Object SnapkitWindow+Rect
  [void][SnapkitWindow]::GetWindowRect($handle, [ref]$rect)
  $script:matched = [SnapkitWindow]::MoveWindow($handle, $rect.Left, $rect.Top, ${width}, ${height}, $true)
  return $false
 }
 return $true
}, [IntPtr]::Zero) | Out-Null
if (-not $script:matched) { throw 'No matching Android Emulator window found. Open its native window first.' }
`;
    await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  } else throw new Error('Native window resizing supports macOS and Windows Android emulators');
  return { message: `Window resize requested: ${width} × ${height}. The emulator may constrain its aspect ratio.` };
}
