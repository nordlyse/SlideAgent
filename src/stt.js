const TARGET_RATE = 16000;
const SILENCE_MS = 180;
const MIN_SPEECH_MS = 140;
const MAX_UTTERANCE_MS = 4000;
const RMS_START = 0.008;
const RMS_KEEP = 0.0035;

function rms(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i += 1) sum += buf[i] * buf[i];
  return Math.sqrt(sum / Math.max(1, buf.length));
}

function downsample(input, fromRate) {
  if (fromRate === TARGET_RATE) return input;
  const ratio = fromRate / TARGET_RATE;
  const length = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const start = Math.round(i * ratio);
    const end = Math.min(input.length, Math.round((i + 1) * ratio));
    let acc = 0;
    let n = 0;
    for (let j = start; j < end; j += 1) {
      acc += input[j];
      n += 1;
    }
    out[i] = n ? acc / n : 0;
  }
  return out;
}

export class WhisperStt {
  constructor({ onTranscript, onStatus, onLevel, language }) {
    this.onTranscript = onTranscript;
    this.onStatus = onStatus;
    this.onLevel = onLevel;
    this.language = language || "tr";
    this.worker = null;
    this.ready = false;
    this.listening = false;
    this.ctx = null;
    this.source = null;
    this.processor = null;
    this.sink = null;
    this.stream = null;
    this.pending = [];
    this.speaking = false;
    this.silenceAt = 0;
    this.speechAt = 0;
    this.nextId = 1;
    this.busy = false;
    this.levelTimer = 0;
    this.lastRms = 0;
  }

  async start() {
    if (this.listening) return;
    const mic = await window.slideagent?.ensureMicrophone?.();
    if (mic && mic.ok === false) {
      throw new Error(mic.reason || "Microphone permission denied");
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
      this.onAudio(input, this.ctx.sampleRate);
    };
    this.source.connect(this.processor);
    this.processor.connect(this.sink);
    this.keepAlive = this.ctx.createGain();
    this.keepAlive.gain.value = 0.0001;
    this.processor.connect(this.keepAlive);
    this.keepAlive.connect(this.ctx.destination);

    this.listening = true;
    this.onStatus?.("listen", "Microphone on, loading Whisper…");
    await this.ensureWorker();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.onStatus?.("listen", "Listening (Whisper) — speak, then pause");
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

  async ensureWorker() {
    if (this.worker && this.ready) return;
    this.worker = new Worker(new URL("./stt-worker.js", import.meta.url), { type: "module" });
    this.worker.onmessage = (ev) => this.onWorker(ev.data);
    this.ready = false;
    await new Promise((resolve, reject) => {
      this._ready = resolve;
      this._fail = reject;
      this.worker.postMessage({ type: "init" });
      setTimeout(() => reject(new Error("Whisper timed out")), 180000);
    });
  }

  onWorker(msg) {
    if (msg.type === "progress") {
      this.onStatus?.("model", `${msg.label} (${msg.pct}%)`);
      return;
    }
    if (msg.type === "ready") {
      this.ready = true;
      this._ready?.();
      this.onStatus?.("ready", "Whisper ready");
      return;
    }
    if (msg.type === "error") {
      this._fail?.(new Error(msg.error));
      this.onStatus?.("error", msg.error);
      return;
    }
    if (msg.type === "transcript") {
      this.busy = false;
      const text = String(msg.text ?? "").trim();
      if (text) this.onTranscript?.(text);
      else this.onTranscript?.("", msg.error || "empty");
      if (this.listening && this.ready) this.onStatus?.("listen", "Listening (Whisper)");
    }
  }

  onAudio(channel, sampleRate) {
    if (!this.listening) return;
    const copy = new Float32Array(channel);
    const level = rms(copy);
    this.lastRms = level;
    this.onLevel?.(level);

    if (!this.ready || this.busy) return;
    const now = performance.now();
    if (!this.speaking) {
      if (level >= RMS_START) {
        this.speaking = true;
        this.speechAt = now;
        this.silenceAt = 0;
        this.pending = [downsample(copy, sampleRate)];
      }
      return;
    }
    this.pending.push(downsample(copy, sampleRate));
    if (level < RMS_KEEP) {
      if (!this.silenceAt) this.silenceAt = now;
      if (now - this.silenceAt >= SILENCE_MS) this.flush();
    } else {
      this.silenceAt = 0;
    }
    if (now - this.speechAt >= MAX_UTTERANCE_MS) this.flush();
  }

  flush() {
    if (!this.speaking || this.busy) return;
    const duration = performance.now() - this.speechAt;
    const chunks = this.pending;
    this.pending = [];
    this.speaking = false;
    this.silenceAt = 0;
    if (duration < MIN_SPEECH_MS || !chunks.length) return;
    let len = 0;
    for (const c of chunks) len += c.length;
    const merged = new Float32Array(len);
    let o = 0;
    for (const c of chunks) {
      merged.set(c, o);
      o += c.length;
    }
    const audio = merged;
    this.busy = true;
    const id = this.nextId++;
    this.worker.postMessage({ type: "transcribe", id, audio, language: this.language }, [audio.buffer]);
    this.onStatus?.("busy", "Transcribing…");
  }

  async stop() {
    this.listening = false;
    this.speaking = false;
    this.busy = false;
    this.pending = [];
    this.onLevel?.(0);
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

  dispose() {
    void this.stop();
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
  }
}
