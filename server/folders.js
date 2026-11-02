import { run } from './cli.js';
export async function chooseFolder({ platform = process.platform, execute = run, purpose = 'project', language = 'en' } = {}) {
  const prompts = language === 'vi' ? {
    project: 'Chọn thư mục dự án Flutter', flutterSDK: 'Chọn thư mục Flutter SDK chứa bin/flutter', androidSDK: 'Chọn thư mục Android SDK chứa platform-tools'
  } : {
    project: 'Choose your Flutter project folder', flutterSDK: 'Choose your Flutter SDK folder containing bin/flutter', androidSDK: 'Choose your Android SDK folder containing platform-tools'
  };
  const prompt = Object.hasOwn(prompts, purpose) ? prompts[purpose] : prompts.project;
  try {
    if (platform === 'darwin') return { path: (await execute('osascript', ['-e', `POSIX path of (choose folder with prompt ${JSON.stringify(prompt)})`], { timeout: 300000 })).trim() };
    if (platform === 'win32') {
      const script = `Add-Type -AssemblyName System.Windows.Forms; $picker = New-Object System.Windows.Forms.FolderBrowserDialog; $picker.Description = '${prompt}'; $picker.ShowNewFolderButton = $false; if ($picker.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Write-Output $picker.SelectedPath }`;
      const selected = (await execute('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { timeout: 300000 })).trim();
      return selected ? { path: selected } : { cancelled: true };
    }
    const selected = (await execute('zenity', ['--file-selection', '--directory', `--title=${prompt}`], { timeout: 300000 })).trim();
    return selected ? { path: selected } : { cancelled: true };
  } catch (e) {
    if (/(-128|User canceled|User cancelled|exit 1$)/i.test(e.message)) return { cancelled: true };
    throw new Error(`Folder picker could not open: ${e.message}. You can still paste the absolute folder path.`);
  }
}
