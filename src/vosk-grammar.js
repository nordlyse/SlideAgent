/** Command phrases for Vosk grammar (must be words the language model knows). */

const TR_ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TR_TENS = ["", "on", "yirmi", "otuz", "kırk"];

function trNum(n) {
  if (n < 10) return TR_ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TR_TENS[t]}${o ? ` ${TR_ONES[o]}` : ""}`.trim();
}

const TR_CORE = [
  "ileri",
  "geri",
  "ileri git",
  "geri git",
  "sonraki",
  "önceki",
  "sonraki slayt",
  "önceki slayt",
  "başa",
  "başa git",
  "başa dön",
  "en başa",
  "sona",
  "sona git",
  "en sona",
  "ilk slayt",
  "son slayt",
  "devam",
];

const EN_CORE = [
  "next",
  "next slide",
  "back",
  "previous",
  "previous slide",
  "first",
  "first slide",
  "last",
  "last slide",
  "go to first",
  "go to last",
];

function numbered(prefix, count = 40) {
  const out = [];
  for (let n = 1; n <= count; n += 1) {
    out.push(`${prefix} ${n}`);
  }
  return out;
}

function numberedTr(count = 40) {
  const out = [];
  for (let n = 1; n <= count; n += 1) {
    const w = trNum(n);
    out.push(`slayt ${w}`);
    out.push(`${w} slayt`);
    out.push(`${w}. slayt`);
  }
  return out;
}

const BY_LANG = {
  tr: [...TR_CORE, ...numberedTr(40), ...numbered("slayt", 40)],
  en: [...EN_CORE, ...numbered("slide", 40), ...numbered("go to slide", 40)],
  de: ["weiter", "zurück", "nächste", "vorherige", "erste", "letzte", ...numbered("folie", 40)],
  fr: ["suivant", "précédent", "première", "dernière", ...numbered("diapo", 40)],
  es: ["siguiente", "atrás", "anterior", "primera", "última", ...numbered("diapositiva", 40)],
  pt: ["próximo", "voltar", "anterior", "primeira", "última", ...numbered("slide", 40)],
  nl: ["volgende", "terug", "eerste", "laatste", ...numbered("dia", 40)],
  zh: ["下一张", "上一张", "第一张", "最后"],
  ja: ["次へ", "戻る", "最初", "最後"],
  hi: ["अगला", "पिछला", "पहला", "आखिरी"],
};

export function voskGrammar(langKey) {
  const phrases = BY_LANG[langKey] || BY_LANG.en;
  return JSON.stringify([...new Set(phrases), "[unk]"]);
}
