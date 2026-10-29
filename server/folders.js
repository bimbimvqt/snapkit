import { run } from './cli.js';
export async function chooseFolder({ platform = process.platform, execute = run } = {}) {
  try {
    if (platform === 'darwin') return { path: (await execute('osascript', ['-e', 'POSIX path of (choose folder with prompt "Choose your Flutter project folder")'], { timeout: 300000 })).trim() };
    if (platform === 'win32') {
      const script = `Add-Type -AssemblyName System.Windows.Forms; $picker = New-Object System.Windows.Forms.FolderBrowserDialog; $picker.Description = 'Choose your Flutter project folder'; $picker.ShowNewFolderButton = $false; if ($picker.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Write-Output $picker.SelectedPath }`;
      const selected = (await execute('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { timeout: 300000 })).trim();
      return selected ? { path: selected } : { cancelled: true };
    }
    const selected = (await execute('zenity', ['--file-selection', '--directory', '--title=Choose your Flutter project folder'], { timeout: 300000 })).trim();
    return selected ? { path: selected } : { cancelled: true };
  } catch (e) {
    if (/(-128|User canceled|User cancelled|exit 1$)/i.test(e.message)) return { cancelled: true };
    throw new Error(`Folder picker could not open: ${e.message}. You can still paste the absolute folder path.`);
  }
}
