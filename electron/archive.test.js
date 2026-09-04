import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { describe, it } from "node:test";
import { unzipTo, tarGzipDir, findModelRoot } from "./archive.mjs";

function writeStoredZip(zipPath, files) {
  const chunks = [];
  const centrals = [];
  let offset = 0;
  for (const [name, data] of files) {
    const nameBuf = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const piece = Buffer.concat([local, nameBuf, data]);
    chunks.push(piece);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, nameBuf]));
    offset += piece.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  fs.writeFileSync(zipPath, Buffer.concat([...chunks, cd, eocd]));
}

describe("zip/tar helpers", () => {
  it("round-trips a fake vosk model folder", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "slideagent-arc-"));
    const zipPath = path.join(tmp, "m.zip");
    const extracted = path.join(tmp, "raw");
    const tarPath = path.join(tmp, "model.tar.gz");
    writeStoredZip(zipPath, [
      ["vosk-model-small-tr-0.3/am/final.mdl", Buffer.from("mdl")],
      ["vosk-model-small-tr-0.3/conf/mfcc.conf", Buffer.from("mfcc")],
    ]);
    unzipTo(zipPath, extracted);
    const root = findModelRoot(extracted);
    assert.equal(path.basename(root), "vosk-model-small-tr-0.3");
    await tarGzipDir(root, tarPath);
    const gunzipped = zlib.gunzipSync(fs.readFileSync(tarPath));
    const names = [];
    for (let i = 0; i + 512 <= gunzipped.length; ) {
      const name = gunzipped.subarray(i, i + 100).toString("utf8").replace(/\0.*$/, "");
      if (!name) break;
      const size = Number.parseInt(gunzipped.subarray(i + 124, i + 135).toString("utf8").trim(), 8) || 0;
      names.push(name);
      i += 512 + Math.ceil(size / 512) * 512;
    }
    assert.ok(names.includes("am/final.mdl"));
    assert.ok(names.includes("conf/mfcc.conf"));
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
