const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("slideagent", {
  getConfig: () => ipcRenderer.invoke("get-config"),
  setConfig: (patch) => ipcRenderer.invoke("set-config", patch),
  command: (cmd) => ipcRenderer.invoke("slide-command", cmd),
  getPaths: () => ipcRenderer.invoke("get-paths"),
  ensureMicrophone: () => ipcRenderer.invoke("ensure-microphone"),
  ensureVoskModel: (lang) => ipcRenderer.invoke("ensure-vosk-model", lang),
  chromeAvailable: () => ipcRenderer.invoke("chrome-available"),
  startChromeSpeech: (opts) => ipcRenderer.invoke("start-chrome-speech", opts),
  stopChromeSpeech: () => ipcRenderer.invoke("stop-chrome-speech"),
  onListening: (cb) => {
    const fn = (_e, on) => cb(on);
    ipcRenderer.on("listening-changed", fn);
    return () => ipcRenderer.removeListener("listening-changed", fn);
  },
  onVoskProgress: (cb) => {
    const fn = (_e, info) => cb(info);
    ipcRenderer.on("vosk-progress", fn);
    return () => ipcRenderer.removeListener("vosk-progress", fn);
  },
  onChromeTranscript: (cb) => {
    const fn = (_e, payload) => cb(payload);
    ipcRenderer.on("chrome-transcript", fn);
    return () => ipcRenderer.removeListener("chrome-transcript", fn);
  },
  onChromeClosed: (cb) => {
    const fn = () => cb();
    ipcRenderer.on("chrome-closed", fn);
    return () => ipcRenderer.removeListener("chrome-closed", fn);
  },
});
