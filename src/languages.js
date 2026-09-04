/** Shared language catalog for STT (Whisper / Web Speech) and the UI. */

export const LANGUAGES = [
  { id: "auto", label: "Otomatik / Auto", whisper: null, speech: null, example: "next · ileri · neste · 下一张" },
  { id: "tr", label: "Türkçe", whisper: "turkish", speech: "tr-TR", example: "ileri, geri, başa git, 15. slayta git" },
  { id: "en", label: "English", whisper: "english", speech: "en-US", example: "next, back, first, go to slide 15" },
  { id: "nb", label: "Norsk", whisper: "norwegian", speech: "nb-NO", example: "neste, forrige, første, gå til lysbilde 15" },
  { id: "sv", label: "Svenska", whisper: "swedish", speech: "sv-SE", example: "nästa, tillbaka, första, gå till bild 15" },
  { id: "da", label: "Dansk", whisper: "danish", speech: "da-DK", example: "næste, tilbage, første, gå til dias 15" },
  { id: "is", label: "Íslenska", whisper: "icelandic", speech: "is-IS", example: "næsta, til baka, fyrsta, fara á glæru 15" },
  { id: "de", label: "Deutsch", whisper: "german", speech: "de-DE", example: "weiter, zurück, erste, gehe zu Folie 15" },
  { id: "gsw", label: "Schweizerdeutsch", whisper: "german", speech: "de-CH", example: "witer, zrugg, erschti, Folie 15" },
  { id: "nl", label: "Nederlands", whisper: "dutch", speech: "nl-NL", example: "volgende, terug, eerste, ga naar dia 15" },
  { id: "fr", label: "Français", whisper: "french", speech: "fr-FR", example: "suivant, précédent, première, va à la diapo 15" },
  { id: "es", label: "Español", whisper: "spanish", speech: "es-ES", example: "siguiente, atrás, primera, ve a la diapositiva 15" },
  { id: "pt", label: "Português", whisper: "portuguese", speech: "pt-BR", example: "próximo, voltar, primeira, vá para o slide 15" },
  { id: "zh", label: "中文", whisper: "chinese", speech: "zh-CN", example: "下一张, 上一张, 第一张, 第15页" },
  { id: "ja", label: "日本語", whisper: "japanese", speech: "ja-JP", example: "次へ, 戻る, 最初, 15枚目" },
  { id: "hi", label: "हिन्दी", whisper: "hindi", speech: "hi-IN", example: "अगला, पिछला, पहला, स्लाइड 15" },
];

const BY_ID = new Map(LANGUAGES.map((l) => [l.id, l]));

export function languageById(id) {
  return BY_ID.get(id) || BY_ID.get("tr");
}

export function knownLanguageId(id) {
  return BY_ID.has(id) ? id : "tr";
}

export function whisperLanguage(id) {
  return languageById(id).whisper;
}

export function speechLanguage(id) {
  const row = languageById(id);
  if (row.speech) return row.speech;
  if (typeof navigator === "undefined") return "tr-TR";
  return navigator.language || "tr-TR";
}
