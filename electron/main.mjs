import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, session, screen, systemPreferences, protocol } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runSlideCommand } from "./control.mjs";
import { ensureVoskModel, voskLangKey } from "./vosk-model.mjs";
import { startChromeSpeech, stopChromeSpeech, findChrome } from "./chrome-speech.mjs";
import { t } from "../src/i18n.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEV_URL = process.env.SLIDEAGENT_URL || "http://localhost:5173";

let win = null;
let tray = null;
let quitting = false;

if (process.platform === "win32") app.setAppUserModelId("com.nordlyse.slideagent");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "slideagent",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true,
    },
  },
]);

function iconFile(name) {
  return path.join(__dirname, "..", "assets", name);
}

function loadIcon(name, size) {
  const file = iconFile(name);
  const img = fs.existsSync(file) ? nativeImage.createFromPath(file) : nativeImage.createEmpty();
  if (size && !img.isEmpty()) return img.resize({ width: size, height: size });
  return img;
}

function configPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function normalizeConfig(raw = {}) {
  const next = {
    language: "en",
    engine: "auto",
    stt: "chrome",
    listening: false,
    openAtLogin: false,
    kprimeSpeech: true,
    localeChosen: false,
    ...raw,
  };
  if (!next.kprimeSpeech || next.stt === "auto" || next.stt === "whisper") {
    next.stt = "chrome";
    next.kprimeSpeech = true;
  }
  if (!["chrome", "vosk", "whisper"].includes(next.stt)) next.stt = "chrome";
  if (!next.language) next.language = "en";
  next.localeChosen = Boolean(next.localeChosen);
  return next;
}

function loadConfig() {
  try {
    return normalizeConfig(JSON.parse(fs.readFileSync(configPath(), "utf8")));
  } catch {
    return normalizeConfig();
  }
}

function saveConfig(next) {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(normalizeConfig(next), null, 2));
}

async function waitForVite(url) {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok || res.status === 404) return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

function loadPage(window) {
  if (!app.isPackaged) return window.loadURL(DEV_URL);
  return window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

function quitApp() {
  quitting = true;
  stopChromeSpeech();
  app.quit();
}

function createWindow() {
  if (win) {
    win.show();
    win.focus();
    return win;
  }
  const wa = screen.getPrimaryDisplay().workArea;
  win = new BrowserWindow({
    x: Math.round(wa.x + wa.width - 440),
    y: Math.round(wa.y + 64),
    width: 420,
    height: 720,
    minWidth: 360,
    minHeight: 560,
    title: "SlideAgent",
    icon: loadIcon("icon.png", 256),
    backgroundColor: "#0c1a28",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  win.on("closed", () => {
    win = null;
  });
  void loadPage(win);
  return win;
}

function rebuildTray() {
  const cfg = loadConfig();
  const lang = cfg.language || "en";
  const menu = Menu.buildFromTemplate([
    { label: "SlideAgent", enabled: false },
    { type: "separator" },
    { label: t(lang, "trayShow"), click: () => createWindow() },
    {
      label: cfg.listening ? t(lang, "trayStop") : t(lang, "trayStart"),
      click: () => {
        const next = { ...loadConfig(), listening: !loadConfig().listening };
        saveConfig(next);
        win?.webContents.send("listening-changed", next.listening);
        rebuildTray();
      },
    },
    { type: "separator" },
    {
      label: t(lang, "trayLogin"),
      type: "checkbox",
      checked: cfg.openAtLogin,
      click: (item) => {
        const next = { ...loadConfig(), openAtLogin: item.checked };
        saveConfig(next);
        app.setLoginItemSettings({ openAtLogin: item.checked });
      },
    },
    { type: "separator" },
    { label: t(lang, "quit"), accelerator: "CmdOrCtrl+Q", click: () => quitApp() },
  ]);
  if (!tray) {
    const image = loadIcon("tray.png", process.platform === "darwin" ? 22 : 32);
    tray = new Tray(image.isEmpty() ? loadIcon("icon.png", 32) : image);
    tray.setToolTip("SlideAgent");
    tray.on("click", () => createWindow());
    tray.on("right-click", () => tray.popUpContextMenu());
  }
  tray.setContextMenu(menu);
}

function installAppMenu() {
  const lang = loadConfig().language || "en";
  const quitItem = { label: t(lang, "quit"), accelerator: "CmdOrCtrl+Q", click: () => quitApp() };
  const template =
    process.platform === "darwin"
      ? [{ label: "SlideAgent", submenu: [{ role: "about" }, { type: "separator" }, quitItem] }]
      : [{ label: "SlideAgent", submenu: [quitItem] }];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  if (process.platform === "darwin") {
    app.dock?.setIcon(loadIcon("icon.png"));
  }
}

function allowMicrophone() {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "media" || permission === "microphone" || permission === "audioCapture");
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return permission === "media" || permission === "microphone" || permission === "audioCapture";
  });
}

async function ensureMicrophone() {
  if (process.platform !== "darwin") return { ok: true, status: "granted" };
  const current = systemPreferences.getMediaAccessStatus("microphone");
  if (current === "granted") return { ok: true, status: current };
  if (current === "denied") {
    return {
      ok: false,
      status: current,
      reason: "mic-denied",
    };
  }
  const granted = await systemPreferences.askForMediaAccess("microphone");
  const status = systemPreferences.getMediaAccessStatus("microphone");
  return {
    ok: Boolean(granted) && status === "granted",
    status,
    reason: granted
      ? null
      : "mic-not-granted",
  };
}

function registerVoskProtocol() {
  protocol.handle("slideagent", (request) => {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }
    const url = new URL(request.url);
    if (url.hostname !== "vosk") return new Response("not found", { status: 404 });
    const rel = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    const root = path.join(app.getPath("userData"), "vosk");
    const file = path.normalize(path.join(root, rel));
    const rootResolved = path.resolve(root);
    if (!file.startsWith(rootResolved + path.sep) && file !== rootResolved) {
      return new Response("forbidden", { status: 403 });
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      return new Response("not found", { status: 404 });
    }
    const data = fs.readFileSync(file);
    return new Response(data, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Length": String(data.length),
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  });
}

function registerIpc() {
  ipcMain.handle("get-config", () => loadConfig());
  ipcMain.handle("set-config", (_e, patch) => {
    const next = normalizeConfig({ ...loadConfig(), ...(patch && typeof patch === "object" ? patch : {}) });
    saveConfig(next);
    installAppMenu();
    rebuildTray();
    return next;
  });
  ipcMain.handle("get-paths", () => ({ userData: app.getPath("userData") }));
  ipcMain.handle("ensure-microphone", () => ensureMicrophone());
  ipcMain.handle("ensure-vosk-model", async (e, lang) => {
    const key = voskLangKey(lang) || lang;
    try {
      return await ensureVoskModel(app.getPath("userData"), key, (pct, keyName, mb) => {
        e.sender.send("vosk-progress", { pct, key: keyName, mb });
      });
    } catch (err) {
      return { ok: false, reason: String(err?.message ?? err) };
    }
  });
  ipcMain.handle("chrome-available", () => {
    const browser = findChrome();
    return { ok: Boolean(browser), browser };
  });
  ipcMain.handle("start-chrome-speech", async (_e, opts) => {
    return startChromeSpeech({
      lang: opts?.language || "tr-TR",
      userData: app.getPath("userData"),
      transcript: (payload) => win?.webContents.send("chrome-transcript", payload),
      closed: () => win?.webContents.send("chrome-closed"),
    });
  });
  ipcMain.handle("stop-chrome-speech", () => {
    stopChromeSpeech();
    return { ok: true };
  });
  ipcMain.handle("slide-command", async (_e, cmd) => {
    const cfg = loadConfig();
    try {
      return await runSlideCommand(cmd, cfg.engine);
    } catch (err) {
      return { ok: false, reason: String(err?.message ?? err) };
    }
  });
}

app.whenReady().then(async () => {
  if (!app.isPackaged) await waitForVite(DEV_URL);
  registerVoskProtocol();
  allowMicrophone();
  registerIpc();
  const cfg = loadConfig();
  app.setLoginItemSettings({ openAtLogin: cfg.openAtLogin });
  installAppMenu();
  rebuildTray();
  createWindow();
});

app.on("before-quit", () => {
  quitting = true;
  stopChromeSpeech();
});

app.on("window-all-closed", () => {
  quitApp();
});

app.on("activate", () => {
  createWindow();
});
