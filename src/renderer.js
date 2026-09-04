import { describeCommand, pickBestTranscript } from "./nlu.js";
import { WhisperStt } from "./stt.js";
import { VoskStt } from "./vosk-stt.js";
import { LANGUAGES, knownLanguageId, languageById, voskLanguageKey, speechLanguage } from "./languages.js";

const $ = (id) => document.getElementById(id);

const ui = {
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
  language: "tr",
  engine: "auto",
  stt: "chrome",
  listening: false,
};
let stopSpeech = null;
let whisper = null;
let vosk = null;
let busy = false;
let lastFired = { key: "", at: 0 };

function t(tr, en) {
  return config.language === "en" ? en : tr;
}

function setStatus(kind, text) {
  ui.status.dataset.kind = kind;
  ui.status.textContent = text;
}

function addLog(line) {
  const row = document.createElement("li");
  row.textContent = line;
  ui.log.prepend(row);
  while (ui.log.children.length > 12) ui.log.lastElementChild.remove();
}

function fillLanguages() {
  ui.language.replaceChildren();
  for (const lang of LANGUAGES) {
    const opt = document.createElement("option");
    opt.value = lang.id;
    opt.textContent = lang.label;
    ui.language.append(opt);
  }
}

function updateExamples() {
  const row = languageById(config.language);
  ui.manual.placeholder = row.example;
  const el = document.getElementById("examples");
  if (el) {
    const bits = row.example.split(/[·,]/).map((s) => s.trim()).filter(Boolean).slice(0, 4);
    el.replaceChildren(
      document.createTextNode("Örnekler: "),
      ...bits.flatMap((bit, i) => {
        const code = document.createElement("code");
        code.textContent = bit;
        return i ? [document.createTextNode(" "), code] : [code];
      }),
    );
  }
}

async function applyConfig(next) {
  config = { ...config, ...next, language: knownLanguageId(next.language ?? config.language) };
  if (config.stt === "auto" || config.stt === "whisper") config.stt = "chrome";
  if (!["chrome", "vosk", "whisper"].includes(config.stt)) config.stt = "chrome";
  if (![...ui.language.options].some((o) => o.value === config.language)) fillLanguages();
  ui.language.value = config.language;
  ui.engine.value = config.engine;
  ui.stt.value = config.stt;
  ui.listen.checked = Boolean(config.listening);
  ui.listen.setAttribute("aria-checked", String(ui.listen.checked));
  updateExamples();
}

async function persist(patch) {
  const saved = await window.slideagent.setConfig(patch);
  await applyConfig(saved);
}

function setMicLevel(level) {
  const pct = Math.max(0, Math.min(100, Math.round(Math.sqrt(level) * 280)));
  if (ui.meterBar) ui.meterBar.style.width = `${pct}%`;
  if (ui.meterLabel) {
    ui.meterLabel.textContent = level <= 0.0005 ? t("sessiz — konuşun", "silent — speak") : t("ses var", "audio in");
  }
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

async function handleTranscript(text, { live = false, alternatives = [] } = {}) {
  const picked = pickBestTranscript([text, ...alternatives]);
  const heard = picked.text || String(text ?? "").trim();
  if (!heard) {
    if (live) return;
    const empty = t("(anlaşılamadı — daha net söyleyin)", "(not recognized — speak more clearly)");
    ui.heard.textContent = empty;
    addLog(`• ${empty}`);
    return;
  }
  ui.heard.textContent = heard;
  if (live) return;
  const cmd = picked.cmd;
  if (!cmd) {
    addLog(`• ${heard}`);
    ui.action.textContent = t("Komut değil", "Not a command");
    return;
  }
  if (!canFire(cmd)) return;
  await runCommand(cmd, heard);
}

async function runCommand(cmd, heard = "") {
  if (busy) return;
  busy = true;
  const label = describeCommand(cmd, config.language);
  ui.action.textContent = label;
  setStatus("busy", t("Gönderiliyor…", "Sending…"));
  try {
    const result = await window.slideagent.command(cmd);
    if (result?.ok) {
      const backend = result.backend || "ok";
      ui.backend.textContent = backend;
      setStatus("ok", label);
      addLog(`✓ ${heard || label} → ${backend}`);
    } else {
      const reason = result?.reason || t("Başarısız", "Failed");
      ui.backend.textContent = reason;
      setStatus("error", reason);
      addLog(`✗ ${heard || label} → ${reason}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setStatus("error", message);
    addLog(`✗ ${message}`);
  } finally {
    busy = false;
    if (config.listening) setStatus("listen", t("Dinleniyor", "Listening"));
  }
}

async function stopListening() {
  stopSpeech?.();
  stopSpeech = null;
  await window.slideagent.stopChromeSpeech?.();
  if (whisper) await whisper.stop();
  if (vosk) await vosk.stop();
  setMicLevel(0);
  if (ui.meterLabel) ui.meterLabel.textContent = t("kapalı", "off");
  setStatus("idle", t("Beklemede", "Idle"));
}

function attachVoskProgress() {
  window.slideagent.onVoskProgress?.((info) => {
    if (!info) return;
    const label = info.label || t("Model yükleniyor…", "Loading model…");
    setStatus("model", info.pct != null ? `${label} (${info.pct}%)` : label);
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
      setStatus("error", t("Bu dil için Vosk modeli yok", "No Vosk model for this language"));
      return;
    }
    try {
      await startVosk(voskKey);
    } catch (err) {
      setStatus("error", err instanceof Error ? err.message : String(err));
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
    setStatus("error", result?.reason || t("Speech to Text başlatılamadı", "Could not start Speech to Text"));
    ui.micHint.textContent = t(
      "Speech to Text Google Chrome / Edge gerektirir (K-PrimeApp ile aynı motor). SlideAgent penceresinde dinlenir; ayrı bir sayfa açılmaz.",
      "Speech to Text needs Google Chrome or Edge (same engine as K-PrimeApp). You listen in the SlideAgent window; no extra page opens.",
    );
    return false;
  }
  setStatus("listen", t("Dinleniyor — konuşun", "Listening — speak"));
  ui.backend.textContent = "Speech to Text";
  setMicLevel(0.04);
  ui.micHint.textContent = t(
    "Komutları bu pencerede söyleyin. Motor K-PrimeApp Speech to Text ile aynıdır; ayrı tarayıcı sayfası açılmaz.",
    "Speak commands in this window. Same engine as K-PrimeApp Speech to Text; no extra browser page.",
  );
  return true;
}

async function startVosk(langKey) {
  vosk = new VoskStt({
    language: config.language,
    langKey,
    onTranscript: (text) => void handleTranscript(text, { live: false }),
    onPartial: (text) => void handleTranscript(text, { live: true }),
    onStatus: (kind, text) => setStatus(kind, text),
    onLevel: (level) => setMicLevel(level),
  });
  await vosk.start();
  ui.micHint.textContent = t(
    "Akan tanıma (Vosk). Sosyal Video gibi konuşurken anlar. İlk seferde model bir kez indirilir.",
    "Streaming recognition (Vosk). Understands as you speak, like Sosial Video. Model downloads once.",
  );
}

async function startWhisper() {
  if (!whisper) {
    whisper = new WhisperStt({
      language: config.language,
      onTranscript: (text, note) => void handleTranscript(text, { live: false }),
      onStatus: (kind, text) => setStatus(kind, text),
      onLevel: (level) => setMicLevel(level),
    });
  }
  whisper.language = config.language;
  try {
    await whisper.start();
    ui.micHint.textContent = t(
      "Whisper yedek yoludur; kısa Türkçe komutlarda zayıf kalabilir. Vosk önerilir.",
      "Whisper is the fallback; short commands are weaker. Prefer Vosk.",
    );
  } catch (err) {
    setStatus("error", err instanceof Error ? err.message : String(err));
  }
}

ui.listen.addEventListener("change", async () => {
  const on = ui.listen.checked;
  void persist({ listening: on });
  if (on) await startListening();
  else await stopListening();
});

ui.language.addEventListener("change", async () => {
  await persist({ language: ui.language.value });
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
  setStatus("idle", t("Chrome dinleyici kapandı", "Chrome listener closed"));
});

window.slideagent.onListening((on) => {
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

fillLanguages();
attachVoskProgress();
const boot = await window.slideagent.getConfig();
await applyConfig(boot);
ui.micHint.textContent = t(
  "Dinle’yi açın; Speech to Text bu pencerede çalışır (K-PrimeApp ile aynı Google motoru, ayrı sayfa yok).",
  "Turn Listen on. Speech to Text runs in this window (same Google engine as K-PrimeApp, no extra page).",
);
if (config.listening) await startListening();
else setStatus("idle", t("Beklemede — dinlemeyi açın", "Idle — turn listening on"));
