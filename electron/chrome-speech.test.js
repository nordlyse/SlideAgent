import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { chromeCandidates, findChrome } from "./chrome-speech.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));

describe("K-PrimeApp Chrome speech helper", () => {
  it("ships a listen page that uses the same Web Speech API", () => {
    const html = fs.readFileSync(path.join(root, "listen.html"), "utf8");
    assert.match(html, /webkitSpeechRecognition/);
    assert.match(html, /recognition\.continuous = true/);
    assert.match(html, /recognition\.interimResults = true/);
    assert.match(html, /recognition\.lang = language/);
    assert.match(html, /Speech to Text/);
    assert.doesNotMatch(html, /recognition\.maxAlternatives/);
    assert.match(html, /recognition\.abort/);
    assert.match(html, /tr-TR/);
  });

  it("looks for branded Chrome or Edge, not Electron", () => {
    const list = chromeCandidates();
    assert.ok(list.length >= 2);
    assert.equal(list.some((p) => /Chrome/i.test(p) || /chrome/i.test(p)), true);
    assert.equal(
      list.every((p) => !/Electron/i.test(p)),
      true,
    );
    const helper = fs.readFileSync(path.join(root, "chrome-speech.mjs"), "utf8");
    assert.match(helper, /--app=/);
    assert.match(helper, /17391/);
    assert.match(helper, /user-data-dir/);
    assert.match(helper, /use-fake-ui-for-media-stream/);
    assert.match(helper, /window-position/);
    assert.match(helper, /pkill|taskkill/);
    const found = findChrome();
    if (found) assert.match(found, /Chrome|chrome|msedge|Edge|chromium/i);
  });
});
