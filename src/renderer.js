import { parseCommand, describeCommand } from "./nlu.js";
import { speechRecognitionSupported, startWebSpeech } from "./speech.js";
import { WhisperStt } from "./stt.js";
import { LANGUAGES, knownLanguageId, languageById } from "./languages.js";

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
};

let config = {
  language: "tr",
  engine: "auto",
  stt: "auto",
  listening: false,
};
let stopSpeech = null;
let whisper = null;
let busy = false;

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

async function handleTranscript(text) {
  const heard = text.trim();
  if (!heard) return;
  ui.heard.textContent = heard;
  const cmd = parseCommand(heard);
  if (!cmd) {
    addLog(`• ${heard}`);
    ui.action.textContent = t("Komut değil", "Not a command");
    return;
  }
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
  }
}

async function stopListening() {
  stopSpeech?.();
  stopSpeech = null;
  if (whisper) {
    await whisper.stop();
  }
  setStatus("idle", t("Beklemede", "Idle"));
}

async function startListening() {
  await stopListening();
  const mode = config.stt;
  const wantWeb = mode === "webspeech" || (mode === "auto" && speechRecognitionSupported());
  if (wantWeb && speechRecognitionSupported()) {
    let switched = false;
    stopSpeech = startWebSpeech({
      language: config.language,
      onFinal: (text) => void handleTranscript(text),
      onError: (err) => {
        const fatal = err === "network" || err === "service-not-allowed" || err === "not-allowed";
        if (mode === "auto" && fatal && !switched) {
          switched = true;
          stopSpeech?.();
          stopSpeech = null;
          void startWhisper();
        } else if (!switched) {
          setStatus("error", String(err));
        }
      },
    });
    if (stopSpeech) {
      setStatus("listen", t("Dinleniyor (Web Speech)", "Listening (Web Speech)"));
      ui.micHint.textContent = t(
        "Sosial Video ile aynı Web Speech API. Electron’da çalışmazsa Whisper’a düşer.",
        "Same Web Speech API as Sosial Video. Falls back to Whisper in Electron.",
      );
      return;
    }
  }
  if (mode === "webspeech") {
    setStatus("error", t("Web Speech bu ortamda yok", "Web Speech is unavailable here"));
    return;
  }
  await startWhisper();
}

async function startWhisper() {
  if (!whisper) {
    whisper = new WhisperStt({
      language: config.language,
      onTranscript: (text) => void handleTranscript(text),
      onStatus: (kind, text) => setStatus(kind, text),
    });
  }
  whisper.language = config.language;
  try {
    await whisper.start();
    ui.micHint.textContent = t(
      "Çevrimdışı Whisper tiny (Apache-2.0 / MIT). İlk açılışta model bir kez indirilir.",
      "Offline Whisper tiny (Apache-2.0 / MIT). The model downloads once on first use.",
    );
  } catch (err) {
    setStatus("error", err instanceof Error ? err.message : String(err));
  }
}

ui.listen.addEventListener("change", async () => {
  await persist({ listening: ui.listen.checked });
  if (ui.listen.checked) await startListening();
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
  await handleTranscript(text);
});

ui.manual.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    ui.send.click();
  }
});

window.slideagent.onListening((on) => {
  ui.listen.checked = on;
  if (on) void startListening();
  else void stopListening();
});

fillLanguages();
const boot = await window.slideagent.getConfig();
await applyConfig(boot);
if (speechRecognitionSupported()) {
  ui.micHint.textContent = t("Web Speech kullanılabilir.", "Web Speech is available.");
} else {
  ui.micHint.textContent = t("Web Speech yok; Whisper kullanılacak.", "Web Speech missing; Whisper will be used.");
}
if (config.listening) await startListening();
else setStatus("idle", t("Beklemede — dinlemeyi açın", "Idle — turn listening on"));
