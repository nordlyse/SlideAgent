/**
 * Web Speech API listener, adapted from Sosial Video's speechLog.js (MIT).
 * Chrome/Edge expose SpeechRecognition; Electron often does not, so Whisper is the fallback.
 */

import { speechLanguage } from "./languages.js";

export function speechRecognitionSupported() {
  return Boolean(typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition));
}

export function recognitionLanguage(pref) {
  return speechLanguage(pref);
}

export function startWebSpeech({ onFinal, onError, language }) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition || typeof onFinal !== "function") {
    return () => {};
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = recognitionLanguage(language);

  let stopped = false;
  let restartTimer = 0;

  recognition.onresult = (event) => {
    let finalText = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const piece = event.results[i][0]?.transcript || "";
      if (event.results[i].isFinal && piece.trim()) {
        finalText += `${piece} `;
      }
    }
    const body = finalText.trim();
    if (body) onFinal(body);
  };

  recognition.onerror = (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      stopped = true;
    }
    onError?.(event.error);
  };

  recognition.onend = () => {
    if (stopped) return;
    restartTimer = window.setTimeout(() => {
      if (stopped) return;
      try {
        recognition.start();
      } catch {
        /* already running */
      }
    }, 250);
  };

  try {
    recognition.start();
  } catch (err) {
    onError?.(String(err?.message ?? err));
    return () => {};
  }

  return () => {
    stopped = true;
    window.clearTimeout(restartTimer);
    try {
      recognition.stop();
    } catch {
      /* already stopped */
    }
  };
}
