/**
 * Parse spoken slide commands in the supported languages.
 * Matching is language-agnostic: any listed phrase works after STT.
 */

const ORDINAL_SUFFIX =
  /(inci|inci|uncu|uncu|nci|ncu|ste|te|de|eme|eme|ere|er|o|a|th|st|nd|rd|e|ve|de|te)$/i;

const UNITS = {
  zero: 0,
  sifir: 0,
  bir: 1,
  one: 1,
  eins: 1,
  ein: 1,
  een: 1,
  en: 1,
  un: 1,
  uno: 1,
  uma: 1,
  um: 1,
  einn: 1,
  ek: 1,
  iki: 2,
  two: 2,
  to: 2,
  zwei: 2,
  twee: 2,
  deux: 2,
  dos: 2,
  dois: 2,
  tveir: 2,
  tre: 3,
  three: 3,
  drei: 3,
  drie: 3,
  trois: 3,
  tres: 3,
  thrir: 3,
  uc: 3,
  dort: 4,
  four: 4,
  vier: 4,
  quatre: 4,
  cuatro: 4,
  quatro: 4,
  fjorir: 4,
  fire: 4,
  bes: 5,
  five: 5,
  fuenf: 5,
  vijf: 5,
  cinq: 5,
  cinco: 5,
  fimm: 5,
  fem: 5,
  alti: 6,
  six: 6,
  sechs: 6,
  zes: 6,
  seis: 6,
  yedi: 7,
  seven: 7,
  sieben: 7,
  zeven: 7,
  sept: 7,
  siete: 7,
  sete: 7,
  sjo: 7,
  sju: 7,
  syv: 7,
  sekiz: 8,
  eight: 8,
  acht: 8,
  huit: 8,
  ocho: 8,
  oito: 8,
  atta: 8,
  otte: 8,
  dokuz: 9,
  nine: 9,
  neun: 9,
  negen: 9,
  neuf: 9,
  nueve: 9,
  nove: 9,
  niu: 9,
  ni: 9,
};

const TENS = {
  on: 10,
  ten: 10,
  zehn: 10,
  tien: 10,
  dix: 10,
  diez: 10,
  dez: 10,
  tiu: 10,
  ti: 10,
  tio: 10,
  yirmi: 20,
  twenty: 20,
  zwanzig: 20,
  twintig: 20,
  vingt: 20,
  veinte: 20,
  vinte: 20,
  tjue: 20,
  tjugu: 20,
  tjugo: 20,
  tyve: 20,
  tuttugu: 20,
  otuz: 30,
  thirty: 30,
  dreissig: 30,
  dertig: 30,
  trente: 30,
  treinta: 30,
  trinta: 30,
  tretti: 30,
  trettio: 30,
  tredive: 30,
  thrjatiu: 30,
  kirk: 40,
  forty: 40,
  vierzig: 40,
  veertig: 40,
  quarante: 40,
  cuarenta: 40,
  quarenta: 40,
  forti: 40,
  fyrtio: 40,
  fyrre: 40,
  fjortiu: 40,
  elli: 50,
  fifty: 50,
  fuenfzig: 50,
  vijftig: 50,
  cinquante: 50,
  cincuenta: 50,
  cinquenta: 50,
  femti: 50,
  femtio: 50,
  halvtreds: 50,
  fimmtiu: 50,
  altmis: 60,
  sixty: 60,
  sechzig: 60,
  zestig: 60,
  soixante: 60,
  sesenta: 60,
  sessenta: 60,
  seksti: 60,
  sextio: 60,
  yetmis: 70,
  seventy: 70,
  siebzig: 70,
  zeventig: 70,
  "soixante-dix": 70,
  setenta: 70,
  sytti: 70,
  sjuttio: 70,
  halvfjerds: 70,
  sjotiu: 70,
  seksen: 80,
  eighty: 80,
  achtzig: 80,
  tachtig: 80,
  "quatre-vingts": 80,
  ochenta: 80,
  oitenta: 80,
  atti: 80,
  attio: 80,
  firs: 80,
  attatiu: 80,
  doksan: 90,
  ninety: 90,
  neunzig: 90,
  negentig: 90,
  "quatre-vingt-dix": 90,
  noventa: 90,
  nitti: 90,
  nittio: 90,
  halvfems: 90,
  niuatiu: 90,
};

const TEENS = {
  onbir: 11,
  eleven: 11,
  elf: 11,
  onze: 11,
  once: 11,
  elleve: 11,
  elva: 11,
  ellifu: 11,
  oniki: 12,
  twelve: 12,
  zwoelf: 12,
  twaalf: 12,
  douze: 12,
  doce: 12,
  doze: 12,
  tolv: 12,
  tolf: 12,
  onuc: 13,
  thirteen: 13,
  dreizehn: 13,
  dertien: 13,
  treize: 13,
  trece: 13,
  treze: 13,
  tretten: 13,
  tretton: 13,
  trettan: 13,
  ondort: 14,
  fourteen: 14,
  vierzehn: 14,
  veertien: 14,
  quatorze: 14,
  catorce: 14,
  catorze: 14,
  fjorten: 14,
  fjorton: 14,
  onbes: 15,
  fifteen: 15,
  fuenfzehn: 15,
  vijftien: 15,
  quinze: 15,
  quince: 15,
  quinze: 15,
  femten: 15,
  femton: 15,
  fimmtan: 15,
  onalti: 16,
  sixteen: 16,
  sechzehn: 16,
  zestien: 16,
  seize: 16,
  dieciseis: 16,
  dezesseis: 16,
  seksten: 16,
  sexton: 16,
  onyedi: 17,
  seventeen: 17,
  siebzehn: 17,
  zeventien: 17,
  "dix-sept": 17,
  diecisiete: 17,
  dezessete: 17,
  sytten: 17,
  sjutton: 17,
  onsekiz: 18,
  eighteen: 18,
  achtzehn: 18,
  achttien: 18,
  "dix-huit": 18,
  dieciocho: 18,
  dezoito: 18,
  atten: 18,
  arton: 18,
  ondokuz: 19,
  nineteen: 19,
  neunzehn: 19,
  negentien: 19,
  "dix-neuf": 19,
  diecinueve: 19,
  dezenove: 19,
  nitten: 19,
  nitton: 19,
};

const HINDI_NUM = {
  "०": 0,
  "१": 1,
  "२": 2,
  "३": 3,
  "४": 4,
  "५": 5,
  "६": 6,
  "७": 7,
  "८": 8,
  "९": 9,
  एक: 1,
  दो: 2,
  तीन: 3,
  चार: 4,
  पांच: 5,
  पाँच: 5,
  छह: 6,
  सात: 7,
  आठ: 8,
  नौ: 9,
  दस: 10,
  ग्यारह: 11,
  बारह: 12,
  तेरह: 13,
  चौदह: 14,
  पंद्रह: 15,
  पन्द्रह: 15,
  सोलह: 16,
  सत्रह: 17,
  अठारह: 18,
  उन्नीस: 19,
  बीस: 20,
};

const CJK_DIGITS = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  兩: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

const FILLER = new Set([
  "lutfen",
  "please",
  "tane",
  "kere",
  "hadi",
  "hemen",
  "simdi",
  "the",
  "a",
  "an",
  "ya",
  "sila",
  "vennligst",
  "tack",
  "tak",
  "bitte",
  "alsjeblieft",
  "sothou",
  "por",
  "favor",
  "s'il",
  "te",
  "plaît",
  "plait",
  "la",
  "le",
  "el",
  "o",
  "a",
  "ao",
  "à",
  "naar",
  "till",
  "til",
  "zu",
  "zum",
  "zur",
  "auf",
]);

const SLIDE_WORDS = new Set([
  "slayt",
  "slayta",
  "slaytin",
  "slaytta",
  "slide",
  "slides",
  "sayfa",
  "sayfaya",
  "side",
  "lysbilde",
  "lysbildet",
  "bild",
  "bilden",
  "dias",
  "dia",
  "folie",
  "folien",
  "glaera",
  "glaere",
  "glaeru",
  "diapo",
  "diapositive",
  "diapositiva",
  "pagina",
  "page",
  "seite",
  "pagina",
  "स्लाइड",
  "स्लाइड पर",
  "幻灯片",
  "頁",
  "页",
  "张",
  "張",
  "スライド",
  "ページ",
  "枚",
]);

const GO_WORDS = new Set([
  "git",
  "gidin",
  "gidelim",
  "go",
  "goto",
  "atla",
  "jump",
  "ga",
  "gaan",
  "gehe",
  "geh",
  "va",
  "aller",
  "ve",
  "vayase",
  "va",
  "vá",
  "vao",
  "fara",
  "gaa",
  "ga",
  "जाओ",
  "जाएं",
]);

const NEXT = new Set([
  "ileri",
  "ileriye",
  "elleri",
  "illeri",
  "sonraki",
  "devam",
  "next",
  "forward",
  "neste",
  "videre",
  "fram",
  "fremover",
  "nasta",
  "naesta",
  "vidare",
  "framat",
  "naeste",
  "frem",
  "weiter",
  "nachste",
  "naechste",
  "nachster",
  "naechster",
  "nachstes",
  "naechstes",
  "vorwaerts",
  "vor",
  "witer",
  "naechschti",
  "naechscht",
  "volgende",
  "verder",
  "vooruit",
  "suivant",
  "suivante",
  "avance",
  "avancer",
  "proximo",
  "proxima",
  "avancar",
  "seguinte",
  "siguiente",
  "adelante",
  "agla",
  "aage",
  "अगला",
  "आगे",
]);

const PREV = new Set([
  "geri",
  "geriye",
  "gerigel",
  "keri",
  "gery",
  "gerri",
  "gerry",
  "onceki",
  "previous",
  "back",
  "forrige",
  "tilbake",
  "foregaaende",
  "tillbaka",
  "tilbage",
  "zuruck",
  "zurueck",
  "vorherige",
  "vorheriger",
  "vorheriges",
  "zrugg",
  "vorigi",
  "vorige",
  "terug",
  "precedent",
  "precedente",
  "retour",
  "anterior",
  "voltar",
  "atras",
  "atras",
  "fyrri",
  "tilbaka",
  "पिछला",
  "वापस",
]);

const FIRST = new Set([
  "basa",
  "basadon",
  "ilk",
  "first",
  "beginning",
  "start",
  "forste",
  "foerste",
  "starten",
  "begynnelsen",
  "forsta",
  "borjan",
  "fyrsta",
  "byrjun",
  "erste",
  "erster",
  "erstes",
  "anfang",
  "beginn",
  "erschti",
  "eerste",
  "begin",
  "premiere",
  "premier",
  "debut",
  "primeira",
  "primeiro",
  "inicio",
  "primera",
  "primero",
  "inicio",
  "पहला",
  "शुरुआत",
]);

const LAST = new Set([
  "sona",
  "sonagit",
  "son",
  "last",
  "end",
  "siste",
  "slutten",
  "sista",
  "slutet",
  "sidste",
  "slut",
  "sidasta",
  "enda",
  "letzte",
  "letzter",
  "letztes",
  "ende",
  "letschti",
  "laatste",
  "einde",
  "derniere",
  "dernier",
  "fin",
  "ultima",
  "ultimo",
  "fim",
  "ultima",
  "ultimo",
  "final",
  "अंतिम",
  "आखिरी",
]);

const EXTRA = new Set([
  "slayt",
  "slayta",
  "slaytin",
  "slaytta",
  "slide",
  "git",
  "gidin",
  "gidelim",
  "al",
  "gel",
  "to",
  "lysbilde",
  "bild",
  "dias",
  "dia",
  "folie",
  "glaera",
  "diapo",
  "diapositive",
  "diapositiva",
  "seite",
  "pagina",
  "page",
  "sayfa",
  "en",
  "the",
  "de",
  "du",
  "der",
  "die",
  "das",
  "het",
  "een",
  "la",
  "le",
  "el",
  "o",
  "a",
  "zum",
  "zur",
  "naar",
  "till",
  "til",
  "auf",
  "an",
  "go",
  "ga",
  "gehe",
  "va",
  "ve",
  "fara",
  "don",
  "स्लाइड",
]);

function fold(raw) {
  return String(raw ?? "")
    .normalize("NFKC")
    .replace(/İ/g, "i")
    .replace(/ß/g, "ss")
    .toLocaleLowerCase("tr-TR")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/ð/g, "d")
    .replace(/þ/g, "th")
    .replace(/[àáâäãāăą]/g, "a")
    .replace(/[èéêëēėę]/g, "e")
    .replace(/[ìíîïīįı]/g, "i")
    .replace(/[òóôöõōő]/g, "o")
    .replace(/[ùúûüūůű]/g, "u")
    .replace(/[çćč]/g, "c")
    .replace(/[şšś]/g, "s")
    .replace(/[ğĝ]/g, "g")
    .replace(/[ñń]/g, "n")
    .replace(/[ýÿ]/g, "y")
    .replace(/[žźż]/g, "z")
    .replace(/[''`´’]/g, "")
    .replace(/[.,!?;:()[\]{}"«»、。！？，]/g, " ")
    .replace(/(\d+)\s*(?:st|nd|rd|th|e|er|eme|ème|º|ª)\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function stem(word) {
  return word.replace(ORDINAL_SUFFIX, "");
}

function lookupNumberToken(word) {
  if (Object.prototype.hasOwnProperty.call(HINDI_NUM, word)) return HINDI_NUM[word];
  const s = stem(word);
  if (Object.prototype.hasOwnProperty.call(TEENS, s)) return TEENS[s];
  if (Object.prototype.hasOwnProperty.call(TEENS, word)) return TEENS[word];
  if (Object.prototype.hasOwnProperty.call(TENS, s)) return TENS[s];
  if (Object.prototype.hasOwnProperty.call(UNITS, s)) return UNITS[s];
  return null;
}

function parseNumberWords(words) {
  for (let i = 0; i < words.length; i += 1) {
    const a = lookupNumberToken(words[i]);
    if (a == null) continue;
    const b = i + 1 < words.length ? lookupNumberToken(words[i + 1]) : null;
    const aStem = stem(words[i]);
    if (TENS[aStem] && b != null && b < 10 && UNITS[stem(words[i + 1])] != null) {
      return TENS[aStem] + b;
    }
    if (a >= 1) return a;
  }
  return null;
}

function parseCjkNumber(text) {
  const digit = text.match(/\d{1,4}/);
  if (digit) {
    const n = Number.parseInt(digit[0], 10);
    if (n >= 1 && n <= 9999) return n;
  }
  const m = text.match(/[零〇一两兩三四五六七八九十百千]+/);
  if (!m) return null;
  const s = m[0];
  if (s === "十") return 10;
  if (s.includes("十")) {
    const [left, right] = s.split("十");
    const tens = left ? CJK_DIGITS[left] ?? 1 : 1;
    const ones = right ? CJK_DIGITS[right] ?? 0 : 0;
    return tens * 10 + ones;
  }
  if (s.length === 1 && CJK_DIGITS[s] >= 1) return CJK_DIGITS[s];
  return null;
}

function extractDigit(text) {
  const hindi = text.replace(/[०-९]/g, (ch) => String("०१२३४५६७८९".indexOf(ch)));
  const m = hindi.match(/\d{1,4}/);
  if (!m) return parseCjkNumber(text);
  const n = Number.parseInt(m[0], 10);
  return Number.isInteger(n) && n >= 1 && n <= 9999 ? n : parseCjkNumber(text);
}

const GOTO_LETTER_NUM = {
  c: 3,
  ce: 3,
  uc: 3,
  uce: 3,
  ucc: 3,
};

function numberFromGotoHead(head) {
  if (!head) return null;
  if (/^\d{1,4}$/.test(head)) {
    const n = Number.parseInt(head, 10);
    return n >= 1 && n <= 9999 ? n : null;
  }
  if (Object.prototype.hasOwnProperty.call(GOTO_LETTER_NUM, head)) return GOTO_LETTER_NUM[head];
  const n = lookupNumberToken(head);
  return n != null && n >= 1 ? n : null;
}

/** "3egit", "5 e git", "Cegit" (üç e git), "ucegit", "besegit". */
function parseCompactGoto(text) {
  const compact = fold(text).replace(/\s+/g, "").replace(/['’]/g, "");
  const tail = compact.match(/^(.*)(git|gidin|atla)$/);
  if (!tail || !tail[1]) return null;
  const head = tail[1];
  const direct = numberFromGotoHead(head);
  if (direct != null) return direct;
  const dative = head.match(/^(.*)(ye|ya|e|a)$/);
  if (dative?.[1]) return numberFromGotoHead(dative[1]);
  return null;
}

function extractIndex(text, words) {
  const compact = parseCompactGoto(text);
  if (compact != null) return compact;
  const digit = extractDigit(text);
  if (digit != null) return digit;
  return parseNumberWords(words);
}

function hasCommandVerb(words) {
  return words.some((w) => NEXT.has(w) || PREV.has(w) || FIRST.has(w) || LAST.has(w));
}

function tokensWithoutFiller(words) {
  return words.filter((w) => !FILLER.has(w));
}

function restAfter(tokens, extra) {
  return tokens.filter((t) => !extra.has(t));
}

function isNext(tokens) {
  const rest = restAfter(tokens, EXTRA);
  return rest.length >= 1 && rest.length <= 2 && rest.every((t) => NEXT.has(t));
}

function isPrev(tokens) {
  const rest = restAfter(tokens, EXTRA);
  return rest.length >= 1 && rest.length <= 2 && rest.every((t) => PREV.has(t));
}

function isFirst(tokens) {
  const joined = tokens.join(" ");
  if (/^(en\s+)?basa(\s+(git|gidin|don|donun|donelim|gel))?$/.test(joined)) return true;
  if (/^(basa|ilk)(\s+slayt)?(\s+(git|don))?$/.test(joined)) return true;
  if (/^go\s+to\s+(the\s+)?(first|beginning|start)(\s+slide)?$/.test(joined)) return true;
  if (/^(ga|gehe|va|ve|fara|aller)\s+(naar|zu|a|ao|á|till|til)?\s*(de\s+|het\s+|la\s+|el\s+|o\s+)?(eerste|erste|premiere|premier|primeira|primera|fyrsta|forste|forsta)/.test(joined))
    return true;
  const rest = restAfter(tokens, EXTRA);
  return rest.length === 1 && FIRST.has(rest[0]);
}

function isLast(tokens) {
  const joined = tokens.join(" ");
  if (/^(en\s+)?sona(\s+(git|gidin|don|gel))?$/.test(joined)) return true;
  if (/^(en\s+)?sonra(\s+git)$/.test(joined)) return true;
  if (/^(en\s+)?son(\s+)?(slayt|slayta|slaytin|sayfa|sayfaya)(\s+(git|gidin|don|gel))?$/.test(joined)) return true;
  if (/^go\s+to\s+(the\s+)?(last|end)(\s+slide)?$/.test(joined)) return true;
  const rest = restAfter(tokens, EXTRA);
  return rest.length === 1 && LAST.has(rest[0]);
}

function isStart(tokens) {
  const joined = tokens.join(" ");
  return /^(slayt\s+gosterisi|slideshow|sunumu\s+baslat|baslat|start(\s+slideshow)?|starte?(\s+slideshow)?|demarrer|iniciar|iniciar\s+presentacion|starten)$/.test(
    joined,
  );
}

function isStop(tokens) {
  const joined = tokens.join(" ");
  return /^(bitir|kapat|cik|exit|stop|end\s+slideshow|sunumu\s+bitir|avslutt|stoppen|arreter|parar|salir)$/.test(joined);
}

function isGotoUtterance(text, words) {
  if (parseCompactGoto(text) != null) return true;
  const index = extractIndex(text, words);
  if (index != null) {
    if (words.some((w) => SLIDE_WORDS.has(w))) return true;
    if (words.some((w) => GO_WORDS.has(w))) return true;
    if (/(go\s+to|goto|ga\s+naar|gehe\s+zu|aller\s+(a|à)|ve\s+a|va\s+para|vaa?\s+para|fara\s+a|gå\s+til|gaa\s+til|ga\s+till|जाओ)/.test(text))
      return true;
  }
  if (/(slayt|slide|sayfa|lysbilde|bild|dias|dia|folie|glaera|diapo|diapositive|diapositiva|seite|pagina|page|स्लाइड|幻灯片|页|頁|张|張|スライド|ページ)/.test(text) && extractIndex(text, words) != null)
    return true;
  if (/^\d{1,4}\s+(e|a|ye|ya)\s+(git|gidin|atla)$/.test(text)) return true;
  if (/^\d{1,4}\s+(git|gidin|atla)$/.test(text)) return true;
  if (/第\s*\d+\s*[张張页頁枚]/.test(text) || /\d+\s*(枚目|番目|页|頁|张)/.test(text)) return true;
  if (words.length <= 3 && extractDigit(text) == null && parseNumberWords(words) != null && !hasCommandVerb(words)) {
    const n = parseNumberWords(words);
    return n != null && n >= 10 && words.length <= 2;
  }
  return false;
}

function parseCjkCommand(raw) {
  const text = String(raw ?? "").replace(/\s+/g, "");
  if (!text) return null;
  if (text.length > 18) return null;
  if (/^(下一[张張页頁个個]|下一枚|下一个|次へ|次のスライド|進む|次)$/.test(text)) return { type: "next" };
  if (/^(上一[张張页頁个個]|上一枚|上一个|前へ|戻る|前)$/.test(text)) return { type: "prev" };
  if (/^(第一[张張页頁枚]|最初|先頭|一番目)$/.test(text)) return { type: "first" };
  if (/^(最后[一张張页頁]?|最後|最終)$/.test(text)) return { type: "last" };
  const numbered = text.match(/第?\s*([0-9一二两三兩三四五六七八九十]{1,4})\s*[张張页頁枚](目)?/);
  if (numbered) {
    const index = extractDigit(numbered[1]) ?? parseCjkNumber(numbered[1]);
    if (index != null) return { type: "goto", index };
  }
  const jp = text.match(/([0-9一二三四五六七八九十]+)\s*(枚目|番目)/);
  if (jp) {
    const index = extractDigit(jp[1]) ?? parseCjkNumber(jp[1]);
    if (index != null) return { type: "goto", index };
  }
  return null;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cur = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = cur;
    }
  }
  return row[b.length];
}

/** Whisper-tiny often misspells short Turkish commands. */
const COMPACT_COMMANDS = [
  { type: "next", keys: ["ileri", "ilerigit", "ileriye", "elleri", "illeri", "ilari", "leri", "next"] },
  { type: "prev", keys: ["geri", "gerigit", "gerigel", "geriye", "keri", "gerri", "gerry", "gery", "kery", "gitti", "yeti", "yetti", "previous", "back"] },
  { type: "first", keys: ["basa", "basagit", "basadon", "enbasa", "enbasadon", "enbasagit", "basladon", "bosadon", "pasadon", "ilkslayt"] },
  { type: "last", keys: ["sona", "sonagit", "ensona", "ensonagit", "sonragit", "sonnagit", "sonslayt", "sonslaytagit"] },
];

function matchSpokenAlias(text, wordCount) {
  if (wordCount > 4) return null;
  const compact = text.replace(/\s+/g, "");
  if (compact.length < 3 || compact.length > 16) return null;
  for (const row of COMPACT_COMMANDS) {
    if (row.keys.includes(compact)) return { type: row.type };
  }
  let best = null;
  let bestDist = 99;
  let ties = false;
  for (const row of COMPACT_COMMANDS) {
    for (const key of row.keys) {
      const max = key.length <= 4 ? 1 : 1;
      const d = levenshtein(compact, key);
      if (d === 0 || d > max) continue;
      if (d < bestDist) {
        best = row.type;
        bestDist = d;
        ties = false;
      } else if (d === bestDist && best !== row.type) {
        ties = true;
      }
    }
  }
  if (ties || best == null) return null;
  return { type: best };
}

/**
 * @param {string} raw
 * @returns {{ type: 'next'|'prev'|'first'|'last'|'goto'|'start'|'stop', index?: number } | null}
 */
export function parseCommand(raw) {
  const cjk = parseCjkCommand(raw);
  if (cjk) return cjk;

  const text = fold(raw);
  if (!text) return null;
  const words = text.split(" ");
  if (words.length > 12) return null;

  const compactGoto = parseCompactGoto(text);
  if (compactGoto != null) return { type: "goto", index: compactGoto };

  const alias = matchSpokenAlias(text, words.length);
  if (alias) return alias;

  const tokens = tokensWithoutFiller(words);
  if (tokens.length === 0) return null;

  if (isStart(tokens)) return { type: "start" };
  if (isStop(tokens)) return { type: "stop" };
  if (isNext(tokens)) return { type: "next" };
  if (isPrev(tokens)) return { type: "prev" };
  if (isFirst(tokens)) return { type: "first" };
  if (isLast(tokens)) return { type: "last" };

  if (isGotoUtterance(text, words) || isGotoUtterance(String(raw ?? ""), words)) {
    const index = extractIndex(text, words) ?? extractIndex(String(raw ?? ""), words);
    if (index != null) return { type: "goto", index };
  }

  return null;
}

/** Prefer the first candidate that parses as a slide command. */
export function pickBestTranscript(texts) {
  const list = [];
  for (const raw of Array.isArray(texts) ? texts : [texts]) {
    const t = String(raw ?? "").trim();
    if (t) list.push(t);
  }
  for (const t of list) {
    const cmd = parseCommand(t);
    if (cmd) return { text: t, cmd };
  }
  return { text: list[0] || "", cmd: null };
}

export function describeCommand(cmd, language = "tr") {
  if (!cmd) return language === "tr" ? "Komut yok" : "No command";
  const tr = {
    next: "İleri",
    prev: "Geri",
    first: "Başa git",
    last: "Sona git",
    start: "Gösteriyi başlat",
    stop: "Gösteriyi bitir",
    goto: `Slayt ${cmd.index}`,
  };
  const en = {
    next: "Next",
    prev: "Previous",
    first: "Go to start",
    last: "Go to end",
    start: "Start slideshow",
    stop: "End slideshow",
    goto: `Slide ${cmd.index}`,
  };
  return (language === "tr" ? tr : en)[cmd.type] ?? cmd.type;
}
