import { execFile, spawn } from "node:child_process";
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ACTIONS = new Set(["next", "prev", "first", "last", "goto", "start", "stop"]);

export function helperDir() {
  if (app.isPackaged) return path.join(process.resourcesPath, "helpers");
  return path.join(__dirname, "..", "helpers");
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 10000, windowsHide: true, ...opts }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        stdout: String(stdout ?? ""),
        stderr: String(stderr ?? ""),
        error: err ? String(err.message ?? err) : "",
      });
    });
  });
}

function parseJson(stdout) {
  const lines = String(stdout)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      return JSON.parse(lines[i]);
    } catch {
      /* keep looking */
    }
  }
  return null;
}

function assertCommand(cmd) {
  if (!cmd || !ACTIONS.has(cmd.type)) throw new Error("bad-command");
  if (cmd.type === "goto") {
    const n = Number(cmd.index);
    if (!Number.isInteger(n) || n < 1 || n > 9999) throw new Error("bad-index");
    return n;
  }
  return 0;
}

function sendKeysFor(cmd) {
  const n = cmd.type === "goto" ? String(cmd.index) : "";
  switch (cmd.type) {
    case "next":
      return { win: "{RIGHT}", mac: "124", linux: "Right", type: null };
    case "prev":
      return { win: "{LEFT}", mac: "123", linux: "Left", type: null };
    case "first":
      return { win: "{HOME}", mac: "115", linux: "Home", type: null };
    case "last":
      return { win: "{END}", mac: "119", linux: "End", type: null };
    case "goto":
      return { win: `${n}{ENTER}`, mac: null, linux: null, type: n };
    case "start":
      return { win: "{F5}", mac: "96", linux: "F5", type: null };
    case "stop":
      return { win: "{ESC}", mac: "53", linux: "Escape", type: null };
    default:
      return null;
  }
}

function sofficeCandidates() {
  if (process.platform === "darwin") {
    return ["/Applications/LibreOffice.app/Contents/MacOS/soffice"];
  }
  if (process.platform === "win32") {
    const pf = process.env["ProgramFiles"] || "C:\\Program Files";
    const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    return [
      path.join(pf, "LibreOffice", "program", "soffice.exe"),
      path.join(pf86, "LibreOffice", "program", "soffice.exe"),
    ];
  }
  return ["soffice", "libreoffice"];
}

function unoPythonCandidates() {
  if (process.platform === "darwin") {
    return ["/Applications/LibreOffice.app/Contents/Resources/python"];
  }
  if (process.platform === "win32") {
    const pf = process.env["ProgramFiles"] || "C:\\Program Files";
    const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    return [
      path.join(pf, "LibreOffice", "program", "python.exe"),
      path.join(pf86, "LibreOffice", "program", "python.exe"),
    ];
  }
  return ["/usr/lib/libreoffice/program/python", "python3"];
}

function firstExisting(files) {
  return files.find((f) => {
    if (f === "python3" || f === "soffice" || f === "libreoffice") return true;
    try {
      return fs.existsSync(f);
    } catch {
      return false;
    }
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureUnoSocket() {
  const soffice = firstExisting(sofficeCandidates());
  if (!soffice) return;
  try {
    const child = spawn(soffice, ["--norestore", "--accept=socket,host=127.0.0.1,port=2002;urp;"], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  } catch {
    return;
  }
  await sleep(700);
}

async function powerpointWindows(cmd) {
  if (process.platform !== "win32") return { ok: false, reason: "not-windows" };
  const index = assertCommand(cmd);
  const script = path.join(helperDir(), "powerpoint.ps1");
  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-Action", cmd.type];
  if (cmd.type === "goto") args.push("-Index", String(index));
  const result = await run("powershell.exe", args);
  const parsed = parseJson(result.stdout);
  if (parsed?.ok) return parsed;
  return { ok: false, reason: parsed?.reason || result.error || "powerpoint-failed" };
}

async function powerpointMac(cmd) {
  if (process.platform !== "darwin") return { ok: false, reason: "not-mac" };
  assertCommand(cmd);
  const body = appleScript(cmd);
  if (!body) return { ok: false, reason: "unsupported" };
  const result = await run("osascript", ["-e", body]);
  if (result.ok && /ok/.test(result.stdout)) {
    return { ok: true, backend: "powerpoint-applescript" };
  }
  return { ok: false, reason: result.stderr || result.stdout || result.error || "applescript-failed" };
}

function appleScript(cmd) {
  const nav = {
    next: "go to next slide",
    prev: "go to previous slide",
    first: "go to first slide",
    last: "go to last slide",
  };
  if (cmd.type === "goto") {
    return `
tell application "Microsoft PowerPoint"
  activate
  if (count of slide show windows) is 0 then
    try
      run slide show slide show settings of active presentation
      delay 0.4
    end try
  end if
  if (count of slide show windows) > 0 then
    tell slide show view of slide show window 1
      goto slide slide ${Number(cmd.index)} of active presentation
    end tell
    return "ok"
  end if
  try
    go to slide slide ${Number(cmd.index)} of active presentation
    return "ok"
  end try
end tell
return "fail"
`;
  }
  if (cmd.type === "start") {
    return `
tell application "Microsoft PowerPoint"
  activate
  run slide show slide show settings of active presentation
  return "ok"
end tell
`;
  }
  if (cmd.type === "stop") {
    return `
tell application "Microsoft PowerPoint"
  if (count of slide show windows) > 0 then
    exit slide show slide show view of slide show window 1
    return "ok"
  end if
end tell
return "fail"
`;
  }
  if (!nav[cmd.type]) return null;
  return `
tell application "Microsoft PowerPoint"
  activate
  if (count of slide show windows) is 0 then
    try
      run slide show slide show settings of active presentation
      delay 0.4
    end try
  end if
  if (count of slide show windows) > 0 then
    tell slide show view of slide show window 1
      ${nav[cmd.type]}
    end tell
    return "ok"
  end if
end tell
return "fail"
`;
}

async function libreoffice(cmd) {
  const index = assertCommand(cmd);
  const py = firstExisting(unoPythonCandidates());
  if (!py) return { ok: false, reason: "no-uno-python" };
  await ensureUnoSocket();
  const script = path.join(helperDir(), "impress.py");
  const args = [script, cmd.type];
  if (cmd.type === "goto") args.push(String(index));
  const result = await run(py, args);
  const parsed = parseJson(result.stdout);
  if (parsed?.ok) return parsed;
  return { ok: false, reason: parsed?.reason || result.stderr || result.error || "impress-failed" };
}

async function focusMacPresentation() {
  await run("osascript", [
    "-e",
    `tell application "System Events"
      set names to name of every process whose background only is false
      repeat with n in names
        if n contains "PowerPoint" or n contains "LibreOffice" or n contains "soffice" or n contains "Impress" then
          set frontmost of process n to true
          return n
        end if
      end repeat
    end tell`,
  ]);
}

async function keyboardFallback(cmd) {
  const keys = sendKeysFor(cmd);
  if (!keys) return { ok: false, reason: "no-keys" };

  if (process.platform === "win32") {
    const script = path.join(helperDir(), "powerpoint.ps1");
    const result = await run("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      script,
      "-Action",
      "keys",
      "-Keys",
      keys.win,
    ]);
    const parsed = parseJson(result.stdout);
    if (parsed?.ok) return parsed;
    return { ok: false, reason: parsed?.reason || result.error || "keys-failed" };
  }

  if (process.platform === "darwin") {
    await focusMacPresentation();
    if (keys.type) {
      const typed = await run("osascript", [
        "-e",
        `tell application "System Events" to keystroke "${keys.type}"`,
      ]);
      const enter = await run("osascript", ["-e", 'tell application "System Events" to key code 36']);
      if (typed.ok && enter.ok) return { ok: true, backend: "keyboard" };
      return { ok: false, reason: typed.stderr || enter.stderr || "keys-failed" };
    }
    const result = await run("osascript", ["-e", `tell application "System Events" to key code ${keys.mac}`]);
    if (result.ok) return { ok: true, backend: "keyboard" };
    return { ok: false, reason: result.stderr || result.error || "keys-failed" };
  }

  await run("xdotool", ["search", "--name", "PowerPoint|Impress|LibreOffice|Slide", "windowactivate"]);
  if (keys.type) {
    const typed = await run("xdotool", ["type", keys.type]);
    const enter = await run("xdotool", ["key", "Return"]);
    if (typed.ok && enter.ok) return { ok: true, backend: "keyboard" };
  } else {
    const result = await run("xdotool", ["key", keys.linux]);
    if (result.ok) return { ok: true, backend: "keyboard" };
  }
  return { ok: false, reason: "xdotool-missing-or-failed" };
}

export async function runSlideCommand(cmd, engine = "auto") {
  assertCommand(cmd);
  const tries = [];
  const want = engine || "auto";

  const attempt = async (name, fn) => {
    const result = await fn();
    tries.push({ name, ...result });
    return result;
  };

  if (want === "powerpoint" || want === "auto") {
    if (process.platform === "win32") {
      const r = await attempt("powerpoint", () => powerpointWindows(cmd));
      if (r.ok) return { ...r, tries };
    }
    if (process.platform === "darwin") {
      const r = await attempt("powerpoint", () => powerpointMac(cmd));
      if (r.ok) return { ...r, tries };
    }
  }

  if (want === "impress" || want === "auto") {
    const r = await attempt("impress", () => libreoffice(cmd));
    if (r.ok) return { ...r, tries };
  }

  if (want === "keyboard" || want === "auto") {
    const r = await attempt("keyboard", () => keyboardFallback(cmd));
    if (r.ok) return { ...r, tries };
  }

  return {
    ok: false,
    reason: tries.map((t) => `${t.name}:${t.reason || "fail"}`).join(", ") || "no-backend",
    tries,
  };
}
