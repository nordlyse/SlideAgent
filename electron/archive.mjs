import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

function findEocd(buf) {
  const min = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= min; i -= 1) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i;
  }
  throw new Error("ZIP: EOCD not found");
}

function readName(buf, offset, length) {
  return buf.subarray(offset, offset + length).toString("utf8").replace(/\\/g, "/");
}

/**
 * Extract a zip file into destDir using the central directory.
 * @returns {string[]} relative file paths written
 */
export function unzipTo(zipPath, destDir) {
  const buf = fs.readFileSync(zipPath);
  const eocd = findEocd(buf);
  const count = buf.readUInt16LE(eocd + 10);
  let cdOffset = buf.readUInt32LE(eocd + 16);
  const written = [];

  for (let n = 0; n < count; n += 1) {
    if (buf.readUInt32LE(cdOffset) !== CENTRAL_SIG) throw new Error("ZIP: corrupt central directory");
    const method = buf.readUInt16LE(cdOffset + 10);
    const compSize = buf.readUInt32LE(cdOffset + 20);
    const nameLen = buf.readUInt16LE(cdOffset + 28);
    const extraLen = buf.readUInt16LE(cdOffset + 30);
    const commentLen = buf.readUInt16LE(cdOffset + 32);
    const localOff = buf.readUInt32LE(cdOffset + 42);
    const name = readName(buf, cdOffset + 46, nameLen);
    cdOffset += 46 + nameLen + extraLen + commentLen;

    if (!name || name.endsWith("/") || name.includes("..")) continue;
    if (name.startsWith("__MACOSX/") || name.endsWith(".DS_Store")) continue;

    if (buf.readUInt32LE(localOff) !== LOCAL_SIG) throw new Error(`ZIP: corrupt entry ${name}`);
    const localNameLen = buf.readUInt16LE(localOff + 26);
    const localExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + localNameLen + localExtraLen;
    const compressed = buf.subarray(dataStart, dataStart + compSize);
    let out;
    if (method === 0) out = compressed;
    else if (method === 8) out = zlib.inflateRawSync(compressed);
    else throw new Error(`ZIP: compression ${method} not supported (${name})`);

    const dest = path.join(destDir, name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, out);
    written.push(name);
  }
  return written;
}

function tarChecksum(header) {
  let sum = 0;
  for (let i = 0; i < 512; i += 1) sum += header[i];
  return sum;
}

function tarHeader(name, size, type) {
  const buf = Buffer.alloc(512, 0);
  const safe = name.length > 100 ? name.slice(0, 100) : name;
  buf.write(safe, 0, 100, "utf8");
  buf.write("0000755\0", 100, 8, "utf8");
  buf.write("0000000\0", 108, 8, "utf8");
  buf.write("0000000\0", 116, 8, "utf8");
  buf.write(`${size.toString(8).padStart(11, "0")}\0`, 124, 12, "utf8");
  buf.write(`${Math.floor(Date.now() / 1000).toString(8).padStart(11, "0")}\0`, 136, 12, "utf8");
  buf.write("        ", 148, 8, "utf8");
  buf.write(type, 156, 1, "utf8");
  buf.write("ustar\0", 257, 6, "utf8");
  buf.write("00", 263, 2, "utf8");
  const sum = tarChecksum(buf);
  buf.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8, "utf8");
  return buf;
}

function walkFiles(root, dir = root, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(root, full, out);
    else if (ent.isFile()) out.push(path.relative(root, full));
  }
  return out;
}

/** Pack directory contents (not the folder itself) into gzipped tar. */
export async function tarGzipDir(srcDir, destFile) {
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  const gzip = zlib.createGzip({ level: 6 });
  const out = fs.createWriteStream(destFile);
  const done = new Promise((resolve, reject) => {
    out.on("finish", resolve);
    out.on("error", reject);
    gzip.on("error", reject);
  });
  gzip.pipe(out);

  const files = walkFiles(srcDir).sort();
  const dirs = new Set();
  for (const rel of files) {
    const parts = rel.split(path.sep);
    let acc = "";
    for (let i = 0; i < parts.length - 1; i += 1) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i];
      if (!dirs.has(acc)) {
        dirs.add(acc);
        gzip.write(tarHeader(`${acc}/`, 0, "5"));
      }
    }
    const abs = path.join(srcDir, rel);
    const data = fs.readFileSync(abs);
    const tarName = rel.split(path.sep).join("/");
    gzip.write(tarHeader(tarName, data.length, "0"));
    gzip.write(data);
    const pad = (512 - (data.length % 512)) % 512;
    if (pad) gzip.write(Buffer.alloc(pad));
  }
  gzip.write(Buffer.alloc(1024));
  gzip.end();
  await done;
}

export function findModelRoot(extractedDir) {
  const match = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "am" && fs.existsSync(path.join(full, "final.mdl"))) {
          match.push(dir);
        }
        walk(full);
      }
    }
  }
  walk(extractedDir);
  if (match.length === 0) throw new Error("Vosk model (am/final.mdl) not found in zip");
  match.sort((a, b) => a.length - b.length);
  return match[0];
}

export function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}
