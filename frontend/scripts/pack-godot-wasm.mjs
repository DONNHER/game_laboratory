import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const godotPublicDir = path.join(rootDir, 'public', 'godot');
const wasmPath = path.join(godotPublicDir, 'maze_runner.wasm');
const pckPath = path.join(godotPublicDir, 'maze_runner.pck');
const hostHtmlPath = path.join(godotPublicDir, 'host.html');
const tmpHtmlPath = path.join(godotPublicDir, 'maze_runner.html');
const outDir = path.join(godotPublicDir, 'wasm');
const manifestJsonPath = path.join(outDir, 'manifest.json');
const manifestJsPath = path.join(outDir, 'manifest.js');
const pckBundleJsPath = path.join(outDir, 'pck_bundle.js');

function syncHostHtmlSizes(wasmSize, pckSize) {
  if (!fs.existsSync(hostHtmlPath)) return;
  let html = fs.readFileSync(hostHtmlPath, 'utf8');
  if (wasmSize > 0) {
    html = html.replace(/var EXPECTED_WASM_SIZE = \d+;/, `var EXPECTED_WASM_SIZE = ${wasmSize};`);
  }
  if (pckSize > 0) {
    html = html.replace(/var EXPECTED_PCK_SIZE = \d+;/, `var EXPECTED_PCK_SIZE = ${pckSize};`);
  }
  fs.writeFileSync(hostHtmlPath, html);
}

function writePckBundleJs() {
  if (!fs.existsSync(pckPath)) return 0;
  const pckBytes = fs.readFileSync(pckPath);
  const b64 = pckBytes.toString('base64');
  fs.writeFileSync(pckBundleJsPath, `window.__GODOT_PCK_B64 = "${b64}";\n`);
  return pckBytes.byteLength;
}

function extractGzBytesFromExistingChunks(existingManifest) {
  const chunkList = existingManifest?.chunks || [];
  const parts = [];
  for (const cname of chunkList) {
    const fullPath = path.join(outDir, cname);
    if (!fs.existsSync(fullPath)) return null;
    if (cname.endsWith('.bin')) {
      parts.push(fs.readFileSync(fullPath));
    } else if (cname.endsWith('.js')) {
      const text = fs.readFileSync(fullPath, 'utf8');
      const match = text.match(/"([A-Za-z0-9+/=]+)"/);
      if (!match) return null;
      parts.push(Buffer.from(match[1], 'base64'));
    }
  }
  return parts.length > 0 ? Buffer.concat(parts) : null;
}

fs.mkdirSync(outDir, { recursive: true });
const pckSize = writePckBundleJs();

let gzBytes = null;
let rawSize = 0;
let sha256 = '';

if (fs.existsSync(wasmPath)) {
  const rawBytes = fs.readFileSync(wasmPath);
  rawSize = rawBytes.byteLength;
  sha256 = crypto.createHash('sha256').update(rawBytes).digest('hex');
  gzBytes = zlib.gzipSync(rawBytes, { level: 9 });
} else if (fs.existsSync(manifestJsonPath)) {
  const existingManifest = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'));
  rawSize = existingManifest.rawSize || 39514754;
  sha256 = existingManifest.sha256 || '';
  const allJsExist =
    Array.isArray(existingManifest.jsChunks) &&
    existingManifest.jsChunks.length > 0 &&
    existingManifest.jsChunks.every((f) => fs.existsSync(path.join(outDir, f)));

  if (allJsExist) {
    existingManifest.pckSize = pckSize;
    const jsonText = JSON.stringify(existingManifest, null, 2);
    fs.writeFileSync(manifestJsonPath, jsonText + '\n');
    fs.writeFileSync(manifestJsPath, `window.__GODOT_WASM_MANIFEST = ${jsonText};\n`);
    syncHostHtmlSizes(rawSize, pckSize);
    console.log(
      `Synced Godot 4.7 PCK bundle (${pckSize} bytes) and manifest (${existingManifest.jsChunks.length} script chunks).`
    );
    process.exit(0);
  }

  gzBytes = extractGzBytesFromExistingChunks(existingManifest);
}

if (!gzBytes) {
  console.log('No WASM source or chunks found to pack.');
  process.exit(0);
}

for (const entry of fs.readdirSync(outDir)) {
  if (entry.startsWith('chunk_') && (entry.endsWith('.bin') || entry.endsWith('.js'))) {
    fs.unlinkSync(path.join(outDir, entry));
  }
}

const gzipSize = gzBytes.byteLength;
const chunkSize = 524288; // 512 KB compressed per chunk
const jsChunks = [];
let idx = 0;

for (let offset = 0; offset < gzipSize; offset += chunkSize) {
  const slice = gzBytes.subarray(offset, offset + chunkSize);
  const cname = `chunk_${String(idx).padStart(2, '0')}.js`;
  const b64 = slice.toString('base64');
  fs.writeFileSync(
    path.join(outDir, cname),
    `window.__receiveGodotWasmChunk(${idx}, "${b64}");\n`
  );
  jsChunks.push(cname);
  idx++;
}

const manifest = {
  engine: 'Godot 4.7.2-stable (MIT)',
  rawSize,
  gzipSize,
  pckSize,
  chunkSize,
  sha256,
  chunks: jsChunks,
  jsChunks,
};

const manifestJsonText = JSON.stringify(manifest, null, 2);
fs.writeFileSync(manifestJsonPath, manifestJsonText + '\n');
fs.writeFileSync(manifestJsPath, `window.__GODOT_WASM_MANIFEST = ${manifestJsonText};\n`);
syncHostHtmlSizes(rawSize, pckSize);

if (fs.existsSync(wasmPath)) {
  fs.unlinkSync(wasmPath);
}
if (fs.existsSync(tmpHtmlPath)) {
  fs.unlinkSync(tmpHtmlPath);
}

console.log(
  `Packed Godot 4.7 WASM into ${jsChunks.length} proxy-safe JS chunks + pck_bundle.js (${pckSize} bytes).`
);
