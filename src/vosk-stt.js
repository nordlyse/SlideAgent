import { voskGrammar } from "./vosk-grammar.js";

const TARGET_RATE = 16000;

function rms(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i += 1) sum += buf[i] * buf[i];
  return Math.sqrt(sum / Math.max(1, buf.length));
}

async function loadVoskModel(url) {
  const mod = await import("vosk-browser");
  const Model = mod.Model ?? mod.default?.Model;
  if (typeof Model !== "function") {
    const createModel = mod.createModel ?? mod.default?.createModel;
    if (typeof createModel !== "function") throw new Error("vosk-browser yüklenemedi");
    return createModel(url);
  }
  const model = new Model(url);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Vosk zaman aşımı")), 180000);
    const fail = (err) => {
      clearTimeout(timer);
      reject(err instanceof Error ? err : new Error(String(err?.error ?? err ?? "Vosk hata")));
    };
    model.on("error", fail);
    model.on("load", (message) => {
      if (message?.result) {
        clearTimeout(timer);
        resolve(model);
      } else fail(new Error("Vosk modeli yüklenemedi"));
    });
  });
}

const modelCache = new Map();

export class VoskStt {
  constructor({ onTranscript, onPartial, onStatus, onLevel, language, langKey }) {
    this.onTranscript = onTranscript;
    this.onPartial = onPartial;
    this.onStatus = onStatus;
    this.onLevel = onLevel;
    this.language = language || "tr";
    this.langKey = langKey || "tr";
    this.modelUrl = null;
    this.listening = false;
    this.ctx = null;
    this.source = null;
    this.processor = null;
    this.sink = null;
    this.keepAlive = null;
    this.stream = null;
    this.model = null;
    this.recognizer = null;
  }

  async start() {
    if (this.listening) return;
    const mic = await window.slideagent?.ensureMicrophone?.();
    if (mic && mic.ok === false) {
      throw new Error(mic.reason || "Mikrofon izni yok");
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });

    try {
      this.ctx = new AudioContext({ sampleRate: TARGET_RATE });
    } catch {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();

    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
    this.sink = this.ctx.createMediaStreamDestination();
    this.processor.onaudioprocess = (ev) => {
      const input = ev.inputBuffer.getChannelData(0);
      this.onLevel?.(rms(input));
      if (!this.recognizer || !this.listening) return;
      try {
        this.recognizer.acceptWaveform(ev.inputBuffer);
      } catch (err) {
        console.warn("Vosk acceptWaveform", err);
      }
    };
    this.source.connect(this.processor);
    this.processor.connect(this.sink);
    this.keepAlive = this.ctx.createGain();
    this.keepAlive.gain.value = 0.0001;
    this.processor.connect(this.keepAlive);
    this.keepAlive.connect(this.ctx.destination);

    this.listening = true;
    try {
      this.onStatus?.("model", "Ses modeli hazırlanıyor…");
      const ready = await window.slideagent.ensureVoskModel(this.langKey);
      if (!ready?.ok) throw new Error(ready?.reason || "Vosk modeli yok");
      this.modelUrl = ready.fileUrl;
      await this.ensureRecognizer();
      if (this.ctx.state === "suspended") await this.ctx.resume();
      this.onStatus?.("listen", "Dinleniyor — konuşun");
    } catch (err) {
      await this.stop();
      throw err;
    }
  }

  async resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        /* ignore */
      }
    }
  }

  async ensureRecognizer() {
    if (!this.modelUrl) throw new Error("Vosk model URL yok");
    let model = modelCache.get(this.modelUrl);
    if (!model) {
      try {
        model = await loadVoskModel(this.modelUrl);
        modelCache.set(this.modelUrl, model);
      } catch (err) {
        modelCache.delete(this.modelUrl);
        throw err;
      }
    }
    this.model = model;
    const rate = this.ctx?.sampleRate || TARGET_RATE;
    const grammar = voskGrammar(this.langKey);
    try {
      this.recognizer = new this.model.KaldiRecognizer(rate, grammar);
    } catch (err) {
      console.warn("Vosk grammar failed, using open vocabulary", err);
      this.recognizer = new this.model.KaldiRecognizer(rate);
    }
    this.recognizer.on("partialresult", (message) => {
      const text = String(message?.result?.partial ?? "").trim();
      if (text && text !== "[unk]") this.onPartial?.(text);
    });
    this.recognizer.on("result", (message) => {
      const text = String(message?.result?.text ?? "").trim();
      if (text && text !== "[unk]") this.onTranscript?.(text);
    });
  }

  async stop() {
    this.listening = false;
    this.onLevel?.(0);
    try {
      this.recognizer?.remove?.();
    } catch {
      /* ignore */
    }
    this.recognizer = null;
    try {
      this.processor?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      this.source?.disconnect();
    } catch {
      /* ignore */
    }
    this.processor = null;
    this.source = null;
    this.sink = null;
    this.keepAlive = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        /* ignore */
      }
      this.ctx = null;
    }
  }
}
