import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, "assets", "icon.png");
const tmp = path.join(root, "build", "icon-256.png");
const out = path.join(root, "build", "icon.ico");

execFileSync("sips", ["-z", "256", "256", src, "--out", tmp], { stdio: "inherit" });
const png = fs.readFileSync(tmp);
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
const entry = Buffer.alloc(16);
entry.writeUInt8(0, 0);
entry.writeUInt8(0, 1);
entry.writeUInt8(0, 2);
entry.writeUInt8(0, 3);
entry.writeUInt16LE(1, 4);
entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(22, 12);
fs.writeFileSync(out, Buffer.concat([header, entry, png]));
fs.unlinkSync(tmp);
console.log("wrote", out, fs.statSync(out).size);
