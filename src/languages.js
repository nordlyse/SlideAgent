/** Shared language catalog for STT (Vosk / Whisper / Web Speech) and the UI. */

export const LANGUAGES = [
  { id: "auto", native: "Auto", label: "Auto", whisper: null, speech: null, vosk: null, example: "next · ileri · neste · 下一张" },
  { id: "en", native: "English", label: "English", whisper: "english", speech: "en-US", vosk: "en", example: "next, back, first, go to slide 15" },
  { id: "tr", native: "Türkçe", label: "Turkish", whisper: "turkish", speech: "tr-TR", vosk: "tr", example: "ileri, geri, 3 e git, 5 git, başa dön" },
  { id: "de", native: "Deutsch", label: "German", whisper: "german", speech: "de-DE", vosk: "de", example: "weiter, zurück, erste, gehe zu Folie 15" },
  { id: "ja", native: "日本語", label: "Japanese", whisper: "japanese", speech: "ja-JP", vosk: "ja", example: "次へ, 戻る, 最初, 15枚目" },
  { id: "zh", native: "中文", label: "Chinese", whisper: "chinese", speech: "zh-CN", vosk: "zh", example: "下一张, 上一张, 第一张, 第15页" },
  { id: "fr", native: "Français", label: "French", whisper: "french", speech: "fr-FR", vosk: "fr", example: "suivant, précédent, première, va à la diapo 15" },
  { id: "es", native: "Español", label: "Spanish", whisper: "spanish", speech: "es-ES", vosk: "es", example: "siguiente, atrás, primera, ve a la diapositiva 15" },
  { id: "pt", native: "Português", label: "Portuguese", whisper: "portuguese", speech: "pt-BR", vosk: "pt", example: "próximo, voltar, primeira, vá para o slide 15" },
  { id: "nl", native: "Nederlands", label: "Dutch", whisper: "dutch", speech: "nl-NL", vosk: "nl", example: "volgende, terug, eerste, ga naar dia 15" },
  { id: "nb", native: "Norsk", label: "Norwegian", whisper: "norwegian", speech: "nb-NO", vosk: null, example: "neste, forrige, første, gå til lysbilde 15" },
  { id: "sv", native: "Svenska", label: "Swedish", whisper: "swedish", speech: "sv-SE", vosk: null, example: "nästa, tillbaka, första, gå till bild 15" },
  { id: "da", native: "Dansk", label: "Danish", whisper: "danish", speech: "da-DK", vosk: null, example: "næste, tilbage, første, gå til dias 15" },
  { id: "is", native: "Íslenska", label: "Icelandic", whisper: "icelandic", speech: "is-IS", vosk: null, example: "næsta, til baka, fyrsta, fara á glæru 15" },
  { id: "gsw", native: "Schweizerdeutsch", label: "Swiss German", whisper: "german", speech: "de-CH", vosk: "de", example: "witer, zrugg, erschti, Folie 15" },
  { id: "hi", native: "हिन्दी", label: "Hindi", whisper: "hindi", speech: "hi-IN", vosk: "hi", example: "अगला, पिछला, पहला, स्लाइड 15" },
];

export const PICKER_LANGUAGES = LANGUAGES.filter((l) => l.id !== "auto");

const BY_ID = new Map(LANGUAGES.map((l) => [l.id, l]));

export function languageById(id) {
  return BY_ID.get(id) || BY_ID.get("en");
}

export function knownLanguageId(id) {
  return BY_ID.has(id) ? id : "en";
}

export function whisperLanguage(id) {
  return languageById(id).whisper;
}

export function speechLanguage(id) {
  const row = languageById(id);
  if (row.speech) return row.speech;
  return "en-US";
}

export function voskLanguageKey(id) {
  const row = languageById(id);
  if (row.vosk) return row.vosk;
  if (id !== "auto") return null;
  const nav = typeof navigator !== "undefined" ? navigator.language || "" : "";
  const prefix = nav.slice(0, 2).toLowerCase();
  const mapped = LANGUAGES.find((l) => l.id === prefix && l.vosk)?.vosk;
  return mapped || "en";
}
