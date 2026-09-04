import fs from "node:fs";
import path from "node:path";
import { unzipTo, tarGzipDir, findModelRoot, rmrf } from "./archive.mjs";

/** Small Apache-2.0 Vosk models. Nordic languages have no small model. */
export const VOSK_MODELS = {
  tr: { id: "vosk-model-small-tr-0.3", url: "https://alphacephei.com/vosk/models/vosk-model-small-tr-0.3.zip" },
  en: { id: "vosk-model-small-en-us-0.15", url: "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip" },
  de: { id: "vosk-model-small-de-0.15", url: "https://alphacephei.com/vosk/models/vosk-model-small-de-0.15.zip" },
  fr: { id: "vosk-model-small-fr-0.22", url: "https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip" },
  es: { id: "vosk-model-small-es-0.42", url: "https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip" },
  pt: { id: "vosk-model-small-pt-0.3", url: "https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip" },
  zh: { id: "vosk-model-small-cn-0.22", url: "https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip" },
  ja: { id: "vosk-model-small-ja-0.22", url: "https://alphacephei.com/vosk/models/vosk-model-small-ja-0.22.zip" },
  hi: { id: "vosk-model-small-hi-0.22", url: "https://alphacephei.com/vosk/models/vosk-model-small-hi-0.22.zip" },
  nl: { id: "vosk-model-small-nl-0.22", url: "https://alphacephei.com/vosk/models/vosk-model-small-nl-0.22.zip" },
};

export function voskLangKey(language) {
  if (language === "gsw") return "de";
  if (VOSK_MODELS[language]) return language;
  return null;
}

function modelDir(userData, key) {
  return path.join(userData, "vosk", key);
}

export function modelTarPath(userData, key) {
  return path.join(modelDir(userData, key), "model.tar.gz");
}

export function modelReady(userData, key) {
  const tar = modelTarPath(userData, key);
  const meta = path.join(modelDir(userData, key), "meta.json");
  if (!fs.existsSync(tar) || !fs.existsSync(meta)) return false;
  try {
    const info = JSON.parse(fs.readFileSync(meta, "utf8"));
    return info.id === VOSK_MODELS[key].id && fs.statSync(tar).size > 1_000_000;
  } catch {
    return false;
  }
}

async function downloadFile(url, dest, onProgress) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  const total = Number(res.headers.get("content-length")) || 0;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const file = fs.createWriteStream(dest);
  const reader = res.body.getReader();
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    loaded += value.byteLength;
    file.write(Buffer.from(value));
    if (onProgress && total) {
      const pct = Math.min(90, Math.round((loaded / total) * 80) + 4);
      const mb = Math.round((loaded / 1024 / 1024) * 10) / 10;
      onProgress(pct, `Model ${mb} MB`);
    }
  }
  await new Promise((resolve, reject) => {
    file.end(() => resolve());
    file.on("error", reject);
  });
}

export async function ensureVoskModel(userData, language, onProgress) {
  const key = voskLangKey(language);
  if (!key) return { ok: false, reason: "no-model" };
  if (modelReady(userData, key)) {
    onProgress?.(100, "Model ready");
    return { ok: true, key, fileUrl: `slideagent://vosk/${key}/model.tar.gz` };
  }

  const spec = VOSK_MODELS[key];
  const dir = modelDir(userData, key);
  const zipPath = path.join(dir, `${spec.id}.zip`);
  const rawDir = path.join(dir, "raw");
  fs.mkdirSync(dir, { recursive: true });
  onProgress?.(2, "Downloading speech model…");
  await downloadFile(spec.url, zipPath, onProgress);
  onProgress?.(88, "Extracting model…");
  rmrf(rawDir);
  unzipTo(zipPath, rawDir);
  const root = findModelRoot(rawDir);
  const tar = modelTarPath(userData, key);
  onProgress?.(94, "Preparing model…");
  await tarGzipDir(root, tar);
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ id: spec.id }, null, 2));
  try {
    fs.unlinkSync(zipPath);
  } catch {
    /* ignore */
  }
  rmrf(rawDir);
  onProgress?.(100, "Model ready");
  return { ok: true, key, fileUrl: `slideagent://vosk/${key}/model.tar.gz` };
}
