/**
 * K-PrimeApp SpeechToText uses Chrome's Web Speech API (webkitSpeechRecognition).
 * Electron Chromium has the constructor but no Google speech key, so it errors with `network`.
 * This module serves that same recognizer in a real Chrome/Edge --app window
 * and forwards transcripts to the Electron main process.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const LISTEN_PORT = 17391;

let server = null;
let port = LISTEN_PORT;
let token = "";
let listening = false;
let generation = 0;
let language = "tr-TR";
let onTranscript = null;
let onClosed = null;
let chromeChild = null;
let profileDir = "";

function json(res, code, body) {
  const data = JSON.stringify(body);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(data),
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function authorized(url) {
  return url.searchParams.get("token") === token;
}

function listenHtml() {
  return fs.readFileSync(path.join(__dirname, "listen.html"), "utf8");
}

function startServer() {
  if (server) return Promise.resolve(port);
  token = crypto.randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    server = http.createServer(async (req, res) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      if (!authorized(url)) {
        json(res, 403, { ok: false, reason: "token" });
        return;
      }
      try {
        if (req.method === "GET" && url.pathname === "/listen") {
          const html = listenHtml();
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
          res.end(html);
          return;
        }
        if (req.method === "GET" && url.pathname === "/state") {
          json(res, 200, { ok: true, listening, language, session: generation });
          return;
        }
        if (req.method === "POST" && url.pathname === "/transcript") {
          const body = JSON.parse((await readBody(req)) || "{}");
          const text = String(body.text || "").trim();
          const live = Boolean(body.live);
          const alternatives = Array.isArray(body.alternatives)
            ? body.alternatives.map((x) => String(x || "").trim()).filter(Boolean)
            : [];
          const session = Number(body.session || url.searchParams.get("session") || 0);
          if (session && session !== generation) {
            json(res, 200, { ok: true, ignored: true });
            return;
          }
          if (text || alternatives.length) onTranscript?.({ text: text || alternatives[0], live, alternatives });
          json(res, 200, { ok: true });
          return;
        }
        if (req.method === "POST" && url.pathname === "/closed") {
          const body = JSON.parse((await readBody(req)) || "{}");
          const session = Number(body.session || url.searchParams.get("session") || 0);
          if (!session || session === generation) {
            listening = false;
            onClosed?.();
          }
          json(res, 200, { ok: true });
          return;
        }
        json(res, 404, { ok: false });
      } catch (err) {
        json(res, 500, { ok: false, reason: String(err?.message ?? err) });
      }
    });
    const onBound = () => {
      server.removeListener("error", onError);
      port = server.address().port;
      resolve(port);
    };
    const onError = (err) => {
      if (err.code === "EADDRINUSE") {
        server.listen(0, "127.0.0.1", onBound);
        return;
      }
      reject(err);
    };
    server.once("error", onError);
    server.listen(LISTEN_PORT, "127.0.0.1", onBound);
  });
}

export function chromeCandidates() {
  const out = [];
  if (process.platform === "darwin") {
    out.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    );
  } else if (process.platform === "win32") {
    const pf = process.env.PROGRAMFILES || "C:\\Program Files";
    const pf86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
    const local = process.env.LOCALAPPDATA || "";
    out.push(
      path.join(pf, "Google/Chrome/Application/chrome.exe"),
      path.join(local, "Google/Chrome/Application/chrome.exe"),
      path.join(pf86, "Google/Chrome/Application/chrome.exe"),
      path.join(pf, "Microsoft/Edge/Application/msedge.exe"),
      path.join(pf86, "Microsoft/Edge/Application/msedge.exe"),
    );
  } else {
    out.push("google-chrome-stable", "google-chrome", "microsoft-edge", "microsoft-edge-stable", "chromium-browser", "chromium");
  }
  return out;
}

function exists(file) {
  try {
    return fs.existsSync(file);
  } catch {
    return false;
  }
}

export function findChrome() {
  for (const candidate of chromeCandidates()) {
    if ((candidate.includes("/") || candidate.includes("\\")) && exists(candidate)) return candidate;
  }
  if (process.platform === "linux") {
    const bins = [
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome",
      "/usr/bin/microsoft-edge",
      "/snap/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
    ];
    for (const file of bins) {
      if (exists(file)) return file;
    }
  }
  return null;
}

function helperProfile(userData) {
  const name = "slideagent-chrome-speech-profile";
  if (userData) return path.join(userData, name);
  return path.join(os.tmpdir(), name);
}

function stopChromeProcess() {
  const marker = "slideagent-chrome-speech-profile";
  if (process.platform === "win32") {
    if (chromeChild?.pid) {
      spawn("taskkill", ["/PID", String(chromeChild.pid), "/T", "/F"], { detached: true, stdio: "ignore" }).unref();
    }
  } else {
    spawnSync("pkill", ["-KILL", "-f", marker], { stdio: "ignore" });
    if (chromeChild?.pid) {
      try {
        process.kill(-chromeChild.pid, "SIGKILL");
      } catch {
        /* ignore */
      }
      try {
        process.kill(chromeChild.pid, "SIGKILL");
      } catch {
        /* ignore */
      }
    }
  }
  chromeChild = null;
}

function openChromeApp(exe, url) {
  stopChromeProcess();
  fs.mkdirSync(profileDir, { recursive: true });
  const args = [
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    `--app=${url}`,
    "--window-size=420,640",
  ];
  chromeChild = spawn(exe, args, { detached: true, stdio: "ignore" });
  chromeChild.unref();
}

export async function startChromeSpeech({ lang = "tr-TR", transcript, closed, userData } = {}) {
  language = lang || "tr-TR";
  onTranscript = transcript || null;
  onClosed = closed || null;
  profileDir = helperProfile(userData);
  const exe = findChrome();
  if (!exe) {
    return {
      ok: false,
      reason:
        "Google Chrome (veya Edge) yok. K-PrimeApp’teki ses tanıma yalnızca gerçek Chrome’da çalışır — Electron’da Google konuşma servisi yoktur.",
    };
  }
  await startServer();
  generation += 1;
  listening = true;
  const url = `http://127.0.0.1:${port}/listen?token=${token}&lang=${encodeURIComponent(language)}&session=${generation}`;
  openChromeApp(exe, url);
  return { ok: true, url, browser: exe, language };
}

export function stopChromeSpeech() {
  listening = false;
  stopChromeProcess();
}

export function chromeSpeechActive() {
  return listening;
}
