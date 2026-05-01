import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const rootDir = path.resolve(process.cwd(), 'src', 'tickets');
const quality = 72;
const minSavingsBytes = 24 * 1024;

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walk(fullPath)));
      continue;
    }

    if (/\.(png|jpg|jpeg)$/i.test(entry.name)) {
      results.push(fullPath);
    }
  }

  return results;
}

async function fileSize(filePath) {
  const stats = await fs.stat(filePath);
  return stats.size;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function convertImage(inputPath) {
  const outputPath = inputPath.replace(/\.(png|jpg|jpeg)$/i, '.webp');
  const inputSize = await fileSize(inputPath);

  if (await exists(outputPath)) {
    const outputSize = await fileSize(outputPath);
    return {
      inputPath,
      outputPath,
      inputSize,
      outputSize,
      skipped: true,
      reason: 'exists',
    };
  }

  await sharp(inputPath)
    .rotate()
    .webp({ quality, effort: 6 })
    .toFile(outputPath);

  const outputSize = await fileSize(outputPath);
  const savings = inputSize - outputSize;

  if (savings < minSavingsBytes) {
    await fs.unlink(outputPath);
    return {
      inputPath,
      outputPath,
      inputSize,
      outputSize,
      skipped: true,
      reason: 'small_savings',
    };
  }

  return {
    inputPath,
    outputPath,
    inputSize,
    outputSize,
    skipped: false,
  };
}

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const inputFiles = await walk(rootDir);
const results = [];

for (const inputPath of inputFiles) {
  results.push(await convertImage(inputPath));
}

const converted = results.filter((item) => !item.skipped);
const inputTotal = converted.reduce((sum, item) => sum + item.inputSize, 0);
const outputTotal = converted.reduce((sum, item) => sum + item.outputSize, 0);
const savedTotal = inputTotal - outputTotal;

console.log(
  JSON.stringify(
    {
      scanned: results.length,
      converted: converted.length,
      skipped: results.length - converted.length,
      inputTotalBytes: inputTotal,
      outputTotalBytes: outputTotal,
      savedTotalBytes: savedTotal,
      inputTotal: formatMb(inputTotal),
      outputTotal: formatMb(outputTotal),
      savedTotal: formatMb(savedTotal),
    },
    null,
    2,
  ),
);
