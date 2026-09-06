import { describeCommand, pickBestTranscript } from "./nlu.js";
import { WhisperStt } from "./stt.js";
import { VoskStt } from "./vosk-stt.js";
import { LANGUAGES, PICKER_LANGUAGES, knownLanguageId, languageById, voskLanguageKey, speechLanguage } from "./languages.js";
import { htmlLang, resolveUiLanguage, t, translateReason } from "./i18n.js";

if (!window.slideagent) {
  const mem = {
    language: "en",
    engine: "auto",
    stt: "chrome",
    listening: false,
    localeChosen: false,
    openAtLogin: false,
  };
  window.slideagent = {
    getConfig: async () => ({ ...mem }),
    setConfig: async (patch) => Object.assign(mem, patch),
    command: async () => ({ ok: false, reason: "preview" }),
    getPaths: async () => ({ userData: "" }),
    ensureMicrophone: async () => ({ ok: true, status: "granted" }),
    ensureVoskModel: async () => ({ ok: false, reason: "no-model" }),
    chromeAvailable: async () => ({ ok: false }),
    startChromeSpeech: async () => ({ ok: false, reason: "no-chrome" }),
    stopChromeSpeech: async () => ({ ok: true }),
    onListening: () => {},
    onVoskProgress: () => {},
    onChromeTranscript: () => {},
    onChromeClosed: () => {},
  };
}

const $ = (id) => document.getElementById(id);

const ui = {
  setup: $("setup"),
  setupLangs: $("setupLangs"),
  status: $("status"),
  heard: $("heard"),
  action: $("action"),
  backend: $("backend"),
  log: $("log"),
  listen: $("listen"),
  language: $("language"),
  engine: $("engine"),
  stt: $("stt"),
  manual: $("manual"),
  send: $("send"),
  micHint: $("micHint"),
  meterBar: $("meterBar"),
  meterLabel: $("meterLabel"),
};

let config = {
  language: "en",
  engine: "auto",
  stt: "chrome",
  listening: false,
  localeChosen: false,
};
let stopSpeech = null;
let whisper = null;
let vosk = null;
let busy = false;
let lastFired = { key: "", at: 0 };
let lastStatus = { kind: "idle", key: "starting" };
let lastHintKey = "bootHint";
let meterMode = "off";

function uiLang() {
  return resolveUiLanguage(config.language, typeof navigator !== "undefined" ? navigator.language : "");
}

function tr(key, vars) {
  return t(uiLang(), key, vars);
}

function setStatus(kind, text, key = null) {
  lastStatus = { kind, key, text };
  ui.status.dataset.kind = kind;
  ui.status.textContent = key ? tr(key) : text;
}

function refreshStatus() {
  if (lastStatus.key) setStatus(lastStatus.kind, lastStatus.text, lastStatus.key);
  else setStatus(lastStatus.kind, lastStatus.text);
}

function addLog(line) {
  const row = document.createElement("li");
  row.textContent = line;
  ui.log.prepend(row);
  while (ui.log.children.length > 12) ui.log.lastElementChild.remove();
}

function fillLanguages() {
  const selected = ui.language.value || config.language;
  ui.language.replaceChildren();
  for (const lang of LANGUAGES) {
    const opt = document.createElement("option");
    opt.value = lang.id;
    opt.textContent = lang.id === "auto" ? tr("langAuto") : lang.native || lang.label;
    ui.language.append(opt);
  }
  if ([...ui.language.options].some((o) => o.value === selected)) ui.language.value = selected;
}

function applyStaticI18n() {
  document.documentElement.lang = htmlLang(uiLang());
  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.textContent = tr(el.dataset.i18n);
  }
  fillLanguages();
  updateExamples();
  refreshMeterLabel();
  if (ui.micHint && lastHintKey) ui.micHint.textContent = tr(lastHintKey);
  refreshStatus();
}

function updateExamples() {
  const row = languageById(config.language);
  ui.manual.placeholder = row.example;
  const el = document.getElementById("examples");
  if (el) {
    const bits = row.example.split(/[·,]/).map((s) => s.trim()).filter(Boolean).slice(0, 4);
    el.replaceChildren(
      document.createTextNode(`${tr("examples")} `),
      ...bits.flatMap((bit, i) => {
        const code = document.createElement("code");
        code.textContent = bit;
        return i ? [document.createTextNode(" "), code] : [code];
      }),
    );
  }
}

function refreshMeterLabel() {
  if (!ui.meterLabel) return;
  if (meterMode === "off") ui.meterLabel.textContent = tr("off");
  else if (meterMode === "silent") ui.meterLabel.textContent = tr("silent");
  else ui.meterLabel.textContent = tr("audioIn");
}

function showSetup(on) {
  if (!ui.setup) return;
  ui.setup.hidden = !on;
  ui.setup.setAttribute("aria-hidden", on ? "false" : "true");
}

function fillSetup() {
  if (!ui.setupLangs) return;
  ui.setupLangs.replaceChildren();
  for (const lang of PICKER_LANGUAGES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.lang = lang.id;
    btn.textContent = lang.native || lang.label;
    ui.setupLangs.append(btn);
  }
}

async function applyConfig(next) {
  config = {
    ...config,
    ...next,
    language: knownLanguageId(next.language ?? config.language),
    localeChosen: Boolean(next.localeChosen),
  };
  if (config.stt === "auto" || config.stt === "whisper") config.stt = "chrome";
  if (!["chrome", "vosk", "whisper"].includes(config.stt)) config.stt = "chrome";
  applyStaticI18n();
  ui.language.value = config.language;
  ui.engine.value = config.engine;
  ui.stt.value = config.stt;
  ui.listen.checked = Boolean(config.listening);
  ui.listen.setAttribute("aria-checked", String(ui.listen.checked));
  showSetup(!config.localeChosen);
}

async function persist(patch) {
  const saved = await window.slideagent.setConfig(patch);
  await applyConfig(saved);
}

function setMicLevel(level) {
  const pct = Math.max(0, Math.min(100, Math.round(Math.sqrt(level) * 280)));
  if (ui.meterBar) ui.meterBar.style.width = `${pct}%`;
  meterMode = level <= 0.0005 ? "silent" : "audioIn";
  refreshMeterLabel();
}

function commandKey(cmd) {
  return `${cmd.type}:${cmd.index ?? ""}`;
}

function canFire(cmd) {
  const key = commandKey(cmd);
  const now = Date.now();
  if (key === lastFired.key && now - lastFired.at < 250) return false;
  lastFired = { key, at: now };
  return true;
}

function boundT(key, vars) {
  return tr(key, vars);
}

async function handleTranscript(text, { live = false, alternatives = [] } = {}) {
  const picked = pickBestTranscript([text, ...alternatives]);
  const heard = picked.text || String(text ?? "").trim();
  if (!heard) {
    if (live) return;
    const empty = tr("notRecognized");
    ui.heard.textContent = empty;
    addLog(`• ${empty}`);
    return;
  }
  ui.heard.textContent = heard;
  if (live) return;
  const cmd = picked.cmd;
  if (!cmd) {
    addLog(`• ${heard}`);
    ui.action.textContent = tr("notACommand");
    return;
  }
  if (!canFire(cmd)) return;
  await runCommand(cmd, heard);
}

async function runCommand(cmd, heard = "") {
  if (busy) return;
  busy = true;
  const label = describeCommand(cmd, uiLang());
  ui.action.textContent = label;
  setStatus("busy", tr("sending"), "sending");
  try {
    const result = await window.slideagent.command(cmd);
    if (result?.ok) {
      const backend = result.backend || "ok";
      ui.backend.textContent = backend;
      setStatus("ok", label);
      addLog(`✓ ${heard || label} → ${backend}`);
    } else {
      const reason = translateReason(uiLang(), result?.reason || "failed");
      ui.backend.textContent = reason;
      setStatus("error", reason);
      addLog(`✗ ${heard || label} → ${reason}`);
    }
  } catch (err) {
    const message = translateReason(uiLang(), err instanceof Error ? err.message : String(err));
    setStatus("error", message);
    addLog(`✗ ${message}`);
  } finally {
    busy = false;
    if (config.listening) setStatus("listen", tr("listening"), "listening");
  }
}

async function stopListening() {
  stopSpeech?.();
  stopSpeech = null;
  await window.slideagent.stopChromeSpeech?.();
  if (whisper) await whisper.stop();
  if (vosk) await vosk.stop();
  if (ui.meterBar) ui.meterBar.style.width = "0%";
  meterMode = "off";
  refreshMeterLabel();
  setStatus("idle", tr("idle"), "idle");
}

function attachVoskProgress() {
  window.slideagent.onVoskProgress?.((info) => {
    if (!info) return;
    const label =
      info.key === "modelMb"
        ? tr("modelMb", { mb: info.mb })
        : tr(info.key || "loadingModel");
    setStatus("model", `${label} (${info.pct}%)`);
  });
}

async function startListening() {
  await stopListening();
  const mode = config.stt === "auto" || !config.stt ? "chrome" : config.stt;
  if (mode === "whisper") {
    await startWhisper();
    return;
  }
  if (mode === "vosk") {
    const voskKey = voskLanguageKey(config.language);
    if (!voskKey) {
      setStatus("error", tr("noVosk"), "noVosk");
      return;
    }
    try {
      await startVosk(voskKey);
    } catch (err) {
      setStatus("error", translateReason(uiLang(), err instanceof Error ? err.message : String(err)));
    }
    return;
  }
  const started = await startChrome();
  if (!started) {
    ui.listen.checked = false;
    void persist({ listening: false });
  }
}

async function startChrome() {
  const result = await window.slideagent.startChromeSpeech({
    language: speechLanguage(config.language),
  });
  if (!result?.ok) {
    setStatus("error", translateReason(uiLang(), result?.reason || "sttStartFail"));
    lastHintKey = "chromeNeed";
    ui.micHint.textContent = tr("chromeNeed");
    return false;
  }
  setStatus("listen", tr("listeningSpeak"), "listeningSpeak");
  ui.backend.textContent = tr("sttChrome");
  setMicLevel(0.04);
  lastHintKey = "chromeHint";
  ui.micHint.textContent = tr("chromeHint");
  return true;
}

async function startVosk(langKey) {
  vosk = new VoskStt({
    language: config.language,
    langKey,
    t: boundT,
    onTranscript: (text) => void handleTranscript(text, { live: false }),
    onPartial: (text) => void handleTranscript(text, { live: true }),
    onStatus: (kind, text) => setStatus(kind, text),
    onLevel: (level) => setMicLevel(level),
  });
  await vosk.start();
  lastHintKey = "voskHint";
  ui.micHint.textContent = tr("voskHint");
}

async function startWhisper() {
  if (!whisper) {
    whisper = new WhisperStt({
      language: config.language,
      t: boundT,
      onTranscript: (text, note) => void handleTranscript(text, { live: false }),
      onStatus: (kind, text) => setStatus(kind, text),
      onLevel: (level) => setMicLevel(level),
    });
  }
  whisper.language = config.language;
  whisper.t = boundT;
  try {
    await whisper.start();
    lastHintKey = "whisperHint";
    ui.micHint.textContent = tr("whisperHint");
  } catch (err) {
    setStatus("error", translateReason(uiLang(), err instanceof Error ? err.message : String(err)));
  }
}

ui.listen.addEventListener("change", async () => {
  if (!config.localeChosen) {
    ui.listen.checked = false;
    return;
  }
  const on = ui.listen.checked;
  void persist({ listening: on });
  if (on) await startListening();
  else await stopListening();
});

ui.language.addEventListener("change", async () => {
  await persist({ language: ui.language.value, localeChosen: true });
  lastHintKey = "bootHint";
  ui.micHint.textContent = tr("bootHint");
  if (!config.listening) setStatus("idle", tr("idleTurnOn"), "idleTurnOn");
  if (config.listening) await startListening();
});

ui.engine.addEventListener("change", async () => {
  await persist({ engine: ui.engine.value });
});

ui.stt.addEventListener("change", async () => {
  await persist({ stt: ui.stt.value });
  if (config.listening) await startListening();
});

ui.send.addEventListener("click", async () => {
  const text = ui.manual.value.trim();
  if (!text) return;
  ui.manual.value = "";
  lastFired = { key: "", at: 0 };
  await handleTranscript(text, { live: false });
});

ui.manual.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    ui.send.click();
  }
});

ui.setupLangs?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-lang]");
  if (!btn) return;
  await persist({ language: btn.dataset.lang, localeChosen: true, listening: false });
  lastHintKey = "bootHint";
  ui.micHint.textContent = tr("bootHint");
  setStatus("idle", tr("idleTurnOn"), "idleTurnOn");
});

window.slideagent.onChromeTranscript((payload) => {
  if (!payload?.text && !(payload?.alternatives || []).length) return;
  setMicLevel(payload.live ? 0.22 : 0.1);
  void handleTranscript(payload.text, {
    live: Boolean(payload.live),
    alternatives: payload.alternatives || [],
  });
});

window.slideagent.onChromeClosed(() => {
  if (!config.listening) return;
  ui.listen.checked = false;
  void persist({ listening: false });
  void stopListening();
  setStatus("idle", tr("chromeClosed"), "chromeClosed");
});

window.slideagent.onListening((on) => {
  if (!config.localeChosen) return;
  ui.listen.checked = on;
  if (on) void startListening();
  else void stopListening();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    void whisper?.resume?.();
    void vosk?.resume?.();
  }
});
window.addEventListener("focus", () => {
  void whisper?.resume?.();
  void vosk?.resume?.();
});

fillSetup();
fillLanguages();
attachVoskProgress();
const boot = await window.slideagent.getConfig();
await applyConfig(boot);
if (!config.localeChosen) {
  setStatus("idle", tr("chooseLanguage"), "chooseLanguage");
} else if (config.listening) {
  lastHintKey = "bootHint";
  ui.micHint.textContent = tr("bootHint");
  await startListening();
} else {
  lastHintKey = "bootHint";
  ui.micHint.textContent = tr("bootHint");
  setStatus("idle", tr("idleTurnOn"), "idleTurnOn");
}
