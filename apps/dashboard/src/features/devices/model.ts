export interface Device {
  id: string; name: string; os: string; group: 'ios' | 'android' | 'physical';
  platform: 'ios' | 'android'; state: string; flutterId?: string; avd?: string;
  ram?: string; cpu?: string; resolution?: string;
}
export interface DeviceView {
  device: Device; selected: boolean; starting: boolean; shutting: boolean;
  debugging: boolean; debugStopping: boolean; selectionSaving: boolean; canRunRelease: boolean; showRunRelease: boolean;
}
export interface EmptyDevices { title: string; detail: string; icon?: string; actions?: { id: string; label: string }[] }
