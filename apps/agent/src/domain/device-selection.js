// Device selection policy is independent of HTTP, Electron, SDKs and persistence.
export function readyTargets(ids, devices) {
  if (!Array.isArray(ids) || ids.length > 20 || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) throw new Error('Select a list of unique device IDs');
  return ids.map(id => {
    const device = devices.find(item => item.id === id);
    if (!device) throw new Error('Device not found. Refresh the device list.');
    if (device.state !== 'online' || !device.flutterId) throw new Error(`${device.name} is unavailable. Start it and refresh, or uncheck it before saving.`);
    return device;
  });
}
export function selectedSet(setId, devices, sets) {
  if (!setId) return '';
  const set = sets.find(item => item.id === setId);
  if (!set || !devices.length || devices.some(device => !set.deviceIds.includes(device.id))) throw new Error('Device set does not match the selected devices.');
  return setId;
}
