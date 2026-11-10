const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('snapkitDesktop', Object.freeze({
  notifyTeam: data => ipcRenderer.invoke('snapkit:team-notify', data),
  onTeamNotification: callback => { const handler = (_event,target) => callback(target); ipcRenderer.on('snapkit:team-notification',handler); return () => ipcRenderer.removeListener('snapkit:team-notification',handler); },
  openXcode: () => ipcRenderer.invoke('snapkit:open-xcode'),
  chooseReleaseFile: kind => ipcRenderer.invoke('snapkit:release-file', kind),
  ready: () => ipcRenderer.send('snapkit:ready'),
  setLanguage: language => ipcRenderer.invoke('snapkit:language', language),
  version: () => ipcRenderer.invoke('snapkit:version'),
  checkUpdates: () => ipcRenderer.invoke('snapkit:updates'),
  updateState: () => ipcRenderer.invoke('snapkit:update-state'),
  downloadUpdate: () => ipcRenderer.invoke('snapkit:update-download'),
  cancelUpdate: () => ipcRenderer.invoke('snapkit:update-cancel'),
  installUpdate: () => ipcRenderer.invoke('snapkit:update-install'),
  setAppearance: value => ipcRenderer.invoke('snapkit:appearance', value),
  clearCache: () => ipcRenderer.invoke('snapkit:clear-cache'),
  openExternal: url => ipcRenderer.invoke('snapkit:external', url),
  restart: () => ipcRenderer.invoke('snapkit:restart')
}));
