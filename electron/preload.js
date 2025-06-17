const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
	onCpuUpdate: (callback) => ipcRenderer.on('cpu-update', (event, data) => callback(data)),
});
