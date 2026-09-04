import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, session, screen } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runSlideCommand } from "./control.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEV_URL = process.env.SLIDEAGENT_URL || "http://localhost:5173";

let win = null;
let tray = null;
let quitting = false;

if (process.platform === "win32") app.setAppUserModelId("com.nordlyse.slideagent");

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

function loadConfig() {
  try {
    return {
      language: "tr",
      engine: "auto",
      stt: "auto",
      listening: false,
      openAtLogin: false,
      ...JSON.parse(fs.readFileSync(configPath(), "utf8")),
    };
  } catch {
    return { language: "tr", engine: "auto", stt: "auto", listening: false, openAtLogin: false };
  }
}

function saveConfig(next) {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(next, null, 2));
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
  win.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
      if (process.platform === "darwin") app.dock?.hide();
    }
  });
  win.on("closed", () => {
    win = null;
  });
  void loadPage(win);
  return win;
}

function rebuildTray() {
  const cfg = loadConfig();
  const menu = Menu.buildFromTemplate([
    { label: "SlideAgent", enabled: false },
    { type: "separator" },
    { label: "Pencereyi göster", click: () => createWindow() },
    {
      label: cfg.listening ? "Dinlemeyi durdur" : "Dinlemeyi başlat",
      click: () => {
        const next = { ...loadConfig(), listening: !loadConfig().listening };
        saveConfig(next);
        win?.webContents.send("listening-changed", next.listening);
        rebuildTray();
      },
    },
    { type: "separator" },
    {
      label: "Açılışta başlat",
      type: "checkbox",
      checked: cfg.openAtLogin,
      click: (item) => {
        const next = { ...loadConfig(), openAtLogin: item.checked };
        saveConfig(next);
        app.setLoginItemSettings({ openAtLogin: item.checked });
      },
    },
    { type: "separator" },
    { label: "Quit", accelerator: "CmdOrCtrl+Q", click: () => quitApp() },
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
  const quitItem = { label: "Quit", accelerator: "CmdOrCtrl+Q", click: () => quitApp() };
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

function registerIpc() {
  ipcMain.handle("get-config", () => loadConfig());
  ipcMain.handle("set-config", (_e, patch) => {
    const next = { ...loadConfig(), ...(patch && typeof patch === "object" ? patch : {}) };
    saveConfig(next);
    rebuildTray();
    return next;
  });
  ipcMain.handle("get-paths", () => ({ userData: app.getPath("userData") }));
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
});

app.on("window-all-closed", () => {
  /* stay in tray */
});

app.on("activate", () => {
  createWindow();
});
