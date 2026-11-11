'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('snapkitMini',Object.freeze({state:()=>ipcRenderer.invoke('snapkit:mini-state'),action:value=>ipcRenderer.invoke('snapkit:mini-action',value),onState:callback=>{const handler=(_event,value)=>callback(value);ipcRenderer.on('snapkit:mini-state',handler);return()=>ipcRenderer.removeListener('snapkit:mini-state',handler);}}));
