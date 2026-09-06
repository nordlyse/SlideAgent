import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { I18N_KEYS, UI, t, translateReason } from "./i18n.js";
import { describeCommand } from "./nlu.js";

describe("i18n", () => {
  it("has the same keys in every language pack", () => {
    for (const [id, pack] of Object.entries(UI)) {
      const missing = I18N_KEYS.filter((key) => pack[key] == null || pack[key] === "");
      assert.deepEqual(missing, [], `${id} is missing keys`);
    }
  });

  it("translates German and Japanese UI strings", () => {
    assert.equal(t("de", "listen"), "Zuhören");
    assert.equal(t("ja", "listen"), "聞き取り");
    assert.equal(t("de", "cmdSlide", { n: 15 }), "Folie 15");
    assert.equal(t("ja", "cmdSlide", { n: 15 }), "スライド 15");
  });

  it("falls back to English for unknown languages", () => {
    assert.equal(t("xx", "send"), "Send");
  });

  it("maps machine reasons to the UI language", () => {
    assert.equal(translateReason("de", "no-chrome"), t("de", "chromeMissing"));
    assert.equal(translateReason("ja", "mic-denied"), t("ja", "micDenied"));
  });
});

describe("describeCommand i18n", () => {
  it("labels commands in the chosen UI language", () => {
    assert.equal(describeCommand({ type: "next" }, "de"), "Weiter");
    assert.equal(describeCommand({ type: "goto", index: 4 }, "ja"), "スライド 4");
  });
});
