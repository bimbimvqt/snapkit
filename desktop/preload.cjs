const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('snapkitDesktop', Object.freeze({
  ready: () => ipcRenderer.send('snapkit:ready'),
  setLanguage: language => ipcRenderer.invoke('snapkit:language', language),
  version: () => ipcRenderer.invoke('snapkit:version'),
  checkUpdates: () => ipcRenderer.invoke('snapkit:updates'),
  openExternal: url => ipcRenderer.invoke('snapkit:external', url),
  restart: () => ipcRenderer.invoke('snapkit:restart')
}));
