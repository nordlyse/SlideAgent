const TARGET_RATE = 16000;
const SILENCE_MS = 650;
const MIN_SPEECH_MS = 280;
const MAX_UTTERANCE_MS = 6000;
const RMS_START = 0.018;
const RMS_KEEP = 0.009;

function rms(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i += 1) sum += buf[i] * buf[i];
  return Math.sqrt(sum / Math.max(1, buf.length));
}

function downsample(input, fromRate) {
  if (fromRate === TARGET_RATE) return input;
  const ratio = fromRate / TARGET_RATE;
  const length = Math.round(input.length / ratio);
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
  constructor({ onTranscript, onStatus, language }) {
    this.onTranscript = onTranscript;
    this.onStatus = onStatus;
    this.language = language || "tr";
    this.worker = null;
    this.ready = false;
    this.listening = false;
    this.ctx = null;
    this.source = null;
    this.processor = null;
    this.stream = null;
    this.pending = [];
    this.speaking = false;
    this.silenceAt = 0;
    this.speechAt = 0;
    this.nextId = 1;
  }

  async start() {
    if (this.listening) return;
    this.onStatus?.("model", "Whisper hazırlanıyor…");
    await this.ensureWorker();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
    this.ctx = new AudioContext();
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (ev) => this.onAudio(ev.inputBuffer.getChannelData(0), this.ctx.sampleRate);
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    this.source.connect(this.processor);
    this.processor.connect(mute);
    mute.connect(this.ctx.destination);
    this.listening = true;
    this.onStatus?.("listen", "Dinleniyor (Whisper)");
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
      setTimeout(() => reject(new Error("Whisper zaman aşımı")), 180000);
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
      this.onStatus?.("ready", "Whisper hazır");
      return;
    }
    if (msg.type === "error") {
      this._fail?.(new Error(msg.error));
      this.onStatus?.("error", msg.error);
      return;
    }
    if (msg.type === "transcript") {
      const text = String(msg.text ?? "").trim();
      if (text) this.onTranscript?.(text);
      else if (msg.error) this.onStatus?.("error", msg.error);
    }
  }

  onAudio(channel, sampleRate) {
    if (!this.listening || !this.ready) return;
    const level = rms(channel);
    const now = performance.now();
    if (!this.speaking) {
      if (level >= RMS_START) {
        this.speaking = true;
        this.speechAt = now;
        this.silenceAt = 0;
        this.pending = [downsample(new Float32Array(channel), sampleRate)];
      }
      return;
    }
    this.pending.push(downsample(new Float32Array(channel), sampleRate));
    if (level < RMS_KEEP) {
      if (!this.silenceAt) this.silenceAt = now;
      if (now - this.silenceAt >= SILENCE_MS) this.flush();
    } else {
      this.silenceAt = 0;
    }
    if (now - this.speechAt >= MAX_UTTERANCE_MS) this.flush();
  }

  flush() {
    if (!this.speaking) return;
    const duration = performance.now() - this.speechAt;
    const chunks = this.pending;
    this.pending = [];
    this.speaking = false;
    this.silenceAt = 0;
    if (duration < MIN_SPEECH_MS || !chunks.length) return;
    let len = 0;
    for (const c of chunks) len += c.length;
    const audio = new Float32Array(len);
    let o = 0;
    for (const c of chunks) {
      audio.set(c, o);
      o += c.length;
    }
    const id = this.nextId++;
    this.worker.postMessage({ type: "transcribe", id, audio, language: this.language }, [audio.buffer]);
    this.onStatus?.("busy", "Çözülüyor…");
  }

  async stop() {
    this.listening = false;
    this.speaking = false;
    this.pending = [];
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
