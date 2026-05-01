import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Source model files are kept in the NSFWJS repo.
// We only need the default mobilenet_v2 layers model (model.json + shard file).
const MODEL_BASE_URL = "https://raw.githubusercontent.com/infinitered/nsfwjs/master/models/mobilenet_v2";
const FILES = ["model.json", "group1-shard1of1"];

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "..", "moderation", "models", "nsfwjs");

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const downloadFile = async (url, filePath) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buf);
};

const main = async () => {
  ensureDir(outDir);
  for (const file of FILES) {
    const url = `${MODEL_BASE_URL}/${file}`;
    const filePath = path.join(outDir, file);
    // eslint-disable-next-line no-console
    console.log(`Downloading ${url} -> ${filePath}`);
    // eslint-disable-next-line no-await-in-loop
    await downloadFile(url, filePath);
  }
  // eslint-disable-next-line no-console
  console.log("Done.");
};

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
