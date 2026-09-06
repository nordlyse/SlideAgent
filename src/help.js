/** Spoken command examples shown in Help, per UI language. */

const PHRASES = {
  en: {
    next: ["next", "next slide", "forward"],
    prev: ["back", "previous", "previous slide"],
    first: ["first", "go to the start", "beginning"],
    last: ["last", "go to the end"],
    goto: ["go to slide 15", "slide 15"],
  },
  tr: {
    next: ["ileri", "sonraki", "ileri git"],
    prev: ["geri", "önceki slayt"],
    first: ["başa dön", "başa git", "ilk"],
    last: ["sona git", "son"],
    goto: ["15 e git", "15. slayta git", "slayt 15"],
  },
  de: {
    next: ["weiter", "nächste", "nächste Folie"],
    prev: ["zurück", "vorherige", "vorherige Folie"],
    first: ["erste", "zum Anfang", "Anfang"],
    last: ["letzte", "zum Ende", "Ende"],
    goto: ["gehe zu Folie 15", "Folie 15"],
  },
  gsw: {
    next: ["witer", "naechscht"],
    prev: ["zrugg", "vorigi"],
    first: ["erschti", "Aafang"],
    last: ["letschti", "Ändi"],
    goto: ["Folie 15", "zu Folie 15"],
  },
  nb: {
    next: ["neste", "videre", "neste lysbilde"],
    prev: ["forrige", "tilbake"],
    first: ["første", "gå til start"],
    last: ["siste", "gå til slutt"],
    goto: ["gå til lysbilde 15", "lysbilde 15"],
  },
  sv: {
    next: ["nästa", "vidare", "nästa bild"],
    prev: ["tillbaka", "föregående"],
    first: ["första", "gå till början"],
    last: ["sista", "gå till slutet"],
    goto: ["gå till bild 15", "bild 15"],
  },
  da: {
    next: ["næste", "videre", "næste dias"],
    prev: ["tilbage", "forrige"],
    first: ["første", "gå til start"],
    last: ["sidste", "gå til slut"],
    goto: ["gå til dias 15", "dias 15"],
  },
  is: {
    next: ["næsta", "áfram"],
    prev: ["til baka", "fyrri"],
    first: ["fyrsta", "fara á byrjun"],
    last: ["síðasta", "fara á enda"],
    goto: ["fara á glæru 15", "glæra 15"],
  },
  nl: {
    next: ["volgende", "verder", "volgende dia"],
    prev: ["terug", "vorige"],
    first: ["eerste", "naar het begin"],
    last: ["laatste", "naar het einde"],
    goto: ["ga naar dia 15", "dia 15"],
  },
  fr: {
    next: ["suivant", "suivante", "avance"],
    prev: ["précédent", "retour"],
    first: ["première", "début"],
    last: ["dernière", "fin"],
    goto: ["va à la diapo 15", "diapo 15"],
  },
  es: {
    next: ["siguiente", "adelante"],
    prev: ["atrás", "anterior"],
    first: ["primera", "inicio"],
    last: ["última", "final"],
    goto: ["ve a la diapositiva 15", "diapositiva 15"],
  },
  pt: {
    next: ["próximo", "seguinte", "avançar"],
    prev: ["voltar", "anterior"],
    first: ["primeira", "início"],
    last: ["última", "fim"],
    goto: ["vá para o slide 15", "slide 15"],
  },
  zh: {
    next: ["下一张", "下一页"],
    prev: ["上一张", "上一页"],
    first: ["第一张", "到开头"],
    last: ["最后一张", "到结尾"],
    goto: ["第15页", "第15张"],
  },
  ja: {
    next: ["次へ", "次のスライド"],
    prev: ["戻る", "前へ"],
    first: ["最初", "先頭へ"],
    last: ["最後", "最後へ"],
    goto: ["15枚目", "スライド 15"],
  },
  hi: {
    next: ["अगला", "आगे"],
    prev: ["पिछला", "वापस"],
    first: ["पहला", "शुरुआत"],
    last: ["आखिरी", "अंत"],
    goto: ["स्लाइड 15", "15 पर जाओ"],
  },
};

export function helpPhrases(lang) {
  return PHRASES[lang] || PHRASES.en;
}
