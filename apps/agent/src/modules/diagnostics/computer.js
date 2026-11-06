import os from 'node:os';
import { run } from '../../infrastructure/process/cli.js';
// Return only display fields; hardware serial numbers and identifiers stay out of the API.
export function describeComputer(platform, hardware = {}, software = {}, fallback = {}) {
  const base = { name: fallback.name || os.hostname(), model: null, chip: fallback.chip || os.cpus()[0]?.model || null, osName: platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : 'Linux', osVersion: fallback.release || os.release(), form: 'desktop' };
  if (platform === 'darwin') return { ...base, name: software.computer_name || software.local_host_name || base.name, model: hardware.machine_name || null, chip: hardware.chip_type || hardware.cpu_type || base.chip, osVersion: software.os_version || base.osVersion, form: /MacBook/i.test(hardware.machine_name || '') ? 'laptop' : /Mac mini/i.test(hardware.machine_name || '') ? 'mini' : /Mac Studio/i.test(hardware.machine_name || '') ? 'studio' : /iMac/i.test(hardware.machine_name || '') ? 'display' : 'desktop' };
  if (platform === 'win32') return { ...base, model: hardware.Model?.trim() || null, chip: hardware.Processor?.trim() || base.chip, osName: software.Caption?.trim() || 'Windows', osVersion: [software.Version, software.BuildNumber && `Build ${software.BuildNumber}`].filter(Boolean).join(' · ') || base.osVersion, form: [8, 9, 10, 14, 30, 31, 32].includes(Number(hardware.ChassisType)) || Number(hardware.PCSystemType) === 2 ? 'laptop' : 'desktop' };
  return base;
}
export async function computerInfo() {
  try {
    if (process.platform === 'darwin') {
      const data = JSON.parse(await run('/usr/sbin/system_profiler', ['SPHardwareDataType', 'SPSoftwareDataType', '-json'], { timeout: 8000 }));
      return describeComputer('darwin', data.SPHardwareDataType?.[0], data.SPSoftwareDataType?.[0]);
    }
    if (process.platform === 'win32') {
      const script = "$c=Get-CimInstance Win32_ComputerSystem;$p=Get-CimInstance Win32_Processor|Select-Object -First 1;$o=Get-CimInstance Win32_OperatingSystem;$e=Get-CimInstance Win32_SystemEnclosure|Select-Object -First 1;@{hardware=@{Model=$c.Model;PCSystemType=$c.PCSystemType;Processor=$p.Name;ChassisType=$e.ChassisTypes[0]};software=@{Caption=$o.Caption;Version=$o.Version;BuildNumber=$o.BuildNumber}}|ConvertTo-Json -Compress";
      const data = JSON.parse(await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 8000 }));
      return describeComputer('win32', data.hardware, data.software);
    }
  } catch { /* Restricted system tools must not prevent SDK checks. */ }
  return describeComputer(process.platform);
}
