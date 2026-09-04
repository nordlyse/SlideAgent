const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("slideagent", {
  getConfig: () => ipcRenderer.invoke("get-config"),
  setConfig: (patch) => ipcRenderer.invoke("set-config", patch),
  command: (cmd) => ipcRenderer.invoke("slide-command", cmd),
  getPaths: () => ipcRenderer.invoke("get-paths"),
  onListening: (cb) => {
    const fn = (_e, on) => cb(on);
    ipcRenderer.on("listening-changed", fn);
    return () => ipcRenderer.removeListener("listening-changed", fn);
  },
});
