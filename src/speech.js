/**
 * Web Speech API listener, adapted from Sosial Video's speechLog.js (MIT).
 * Chrome/Edge can stream interim results. Electron Chromium usually errors with `network`.
 */

import { speechLanguage } from "./languages.js";

export function speechRecognitionSupported() {
  return Boolean(typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition));
}

export function recognitionLanguage(pref) {
  return speechLanguage(pref);
}

export function startWebSpeech({ onFinal, onInterim, onError, language }) {
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
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const piece = event.results[i][0]?.transcript || "";
      if (event.results[i].isFinal) finalText += `${piece} `;
      else interim += `${piece} `;
    }
    const live = interim.trim();
    if (live) onInterim?.(live);
    const body = finalText.trim();
    if (body) onFinal(body);
  };

  recognition.onerror = (event) => {
    if (event.error === "no-speech" || event.error === "aborted" || event.error === "audio-capture") {
      return;
    }
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
