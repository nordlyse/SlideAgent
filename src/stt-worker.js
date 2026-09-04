import { env, pipeline } from "@huggingface/transformers";
import { whisperLanguage } from "./languages.js";

env.allowLocalModels = false;
env.useBrowserCache = true;
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
}

let asr = null;

self.onmessage = async (event) => {
  const msg = event.data || {};
  if (msg.type === "init") {
    try {
      self.postMessage({ type: "progress", pct: 4, label: "Loading Whisper…" });
      asr = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
        dtype: "q8",
        progress_callback: (p) => {
          if (p?.status === "progress" && p.total) {
            const pct = Math.min(96, Math.round((p.loaded / p.total) * 90) + 5);
            const mb = Math.round((p.loaded / 1024 / 1024) * 10) / 10;
            self.postMessage({ type: "progress", pct, label: `Model ${mb} MB` });
          }
        },
      });
      self.postMessage({ type: "ready" });
    } catch (err) {
      self.postMessage({ type: "error", error: String(err?.message ?? err) });
    }
    return;
  }

  if (msg.type === "transcribe") {
    if (!asr) {
      self.postMessage({ type: "transcript", id: msg.id, text: "", error: "not-ready" });
      return;
    }
    try {
      const options = { task: "transcribe", max_new_tokens: 16 };
      const lang = whisperLanguage(msg.language);
      if (lang) options.language = lang;
      const src = msg.audio;
      const audio = new Float32Array(src);
      const result = await asr(audio, options);
      const text = String(result?.text ?? result?.[0]?.text ?? "").trim();
      self.postMessage({ type: "transcript", id: msg.id, text });
    } catch (err) {
      self.postMessage({ type: "transcript", id: msg.id, text: "", error: String(err?.message ?? err) });
    }
  }
};
