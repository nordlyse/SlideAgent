import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCommand } from "./nlu.js";

describe("parseCommand Turkish", () => {
  it("navigates forward and back", () => {
    assert.deepEqual(parseCommand("ileri"), { type: "next" });
    assert.deepEqual(parseCommand("İleri git"), { type: "next" });
    assert.deepEqual(parseCommand("sonraki slayt"), { type: "next" });
    assert.deepEqual(parseCommand("geri"), { type: "prev" });
    assert.deepEqual(parseCommand("önceki slayt"), { type: "prev" });
  });

  it("jumps to first and last", () => {
    assert.deepEqual(parseCommand("başa git"), { type: "first" });
    assert.deepEqual(parseCommand("en başa"), { type: "first" });
    assert.deepEqual(parseCommand("ilk slayt"), { type: "first" });
    assert.deepEqual(parseCommand("sona git"), { type: "last" });
    assert.deepEqual(parseCommand("en sona"), { type: "last" });
    assert.deepEqual(parseCommand("son slayt"), { type: "last" });
  });

  it("goes to a numbered slide", () => {
    assert.deepEqual(parseCommand("15. slayta git"), { type: "goto", index: 15 });
    assert.deepEqual(parseCommand("23. slayt"), { type: "goto", index: 23 });
    assert.deepEqual(parseCommand("slayt 20"), { type: "goto", index: 20 });
    assert.deepEqual(parseCommand("on beşinci slayt"), { type: "goto", index: 15 });
    assert.deepEqual(parseCommand("yirmi üç"), { type: "goto", index: 23 });
  });

  it("ignores ordinary speech that only contains ileri", () => {
    assert.equal(parseCommand("bu slaytta ileri teknoloji görüyorsunuz"), null);
  });
});

describe("parseCommand English", () => {
  it("navigates", () => {
    assert.deepEqual(parseCommand("next"), { type: "next" });
    assert.deepEqual(parseCommand("next slide"), { type: "next" });
    assert.deepEqual(parseCommand("previous"), { type: "prev" });
    assert.deepEqual(parseCommand("go to first slide"), { type: "first" });
    assert.deepEqual(parseCommand("go to last slide"), { type: "last" });
    assert.deepEqual(parseCommand("go to slide 15"), { type: "goto", index: 15 });
  });
});

describe("parseCommand other languages", () => {
  it("understands Nordic and Germanic next/back", () => {
    assert.deepEqual(parseCommand("neste"), { type: "next" });
    assert.deepEqual(parseCommand("nästa"), { type: "next" });
    assert.deepEqual(parseCommand("næste"), { type: "next" });
    assert.deepEqual(parseCommand("næsta"), { type: "next" });
    assert.deepEqual(parseCommand("weiter"), { type: "next" });
    assert.deepEqual(parseCommand("witer"), { type: "next" });
    assert.deepEqual(parseCommand("volgende"), { type: "next" });
    assert.deepEqual(parseCommand("forrige"), { type: "prev" });
    assert.deepEqual(parseCommand("zurück"), { type: "prev" });
    assert.deepEqual(parseCommand("terug"), { type: "prev" });
  });

  it("understands Romance languages", () => {
    assert.deepEqual(parseCommand("suivant"), { type: "next" });
    assert.deepEqual(parseCommand("siguiente"), { type: "next" });
    assert.deepEqual(parseCommand("próximo"), { type: "next" });
    assert.deepEqual(parseCommand("précédent"), { type: "prev" });
    assert.deepEqual(parseCommand("anterior"), { type: "prev" });
    assert.deepEqual(parseCommand("va à la diapo 15"), { type: "goto", index: 15 });
    assert.deepEqual(parseCommand("ve a la diapositiva 23"), { type: "goto", index: 23 });
  });

  it("understands Chinese, Japanese, and Hindi", () => {
    assert.deepEqual(parseCommand("下一张"), { type: "next" });
    assert.deepEqual(parseCommand("上一页"), { type: "prev" });
    assert.deepEqual(parseCommand("第一张"), { type: "first" });
    assert.deepEqual(parseCommand("最后"), { type: "last" });
    assert.deepEqual(parseCommand("第15页"), { type: "goto", index: 15 });
    assert.deepEqual(parseCommand("次へ"), { type: "next" });
    assert.deepEqual(parseCommand("15枚目"), { type: "goto", index: 15 });
    assert.deepEqual(parseCommand("अगला"), { type: "next" });
    assert.deepEqual(parseCommand("स्लाइड 20"), { type: "goto", index: 20 });
  });

  it("still jumps with Nordic slide phrases", () => {
    assert.deepEqual(parseCommand("gå til lysbilde 15"), { type: "goto", index: 15 });
    assert.deepEqual(parseCommand("gehe zu Folie 8"), { type: "goto", index: 8 });
    assert.deepEqual(parseCommand("ga naar dia 4"), { type: "goto", index: 4 });
  });
});
