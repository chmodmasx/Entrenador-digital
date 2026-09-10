import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const brandDir = path.join(webRoot, 'src', 'brand');
const outputDir = path.join(webRoot, 'src', 'assets');
const outputFile = path.join(outputDir, 'nbs-hero-card.jpg');

const parts = [1, 2, 3, 4].map((part) =>
  fs.readFileSync(path.join(brandDir, `nbs_hero_card.part${part}.b64`), 'utf8').replace(/\s+/g, '')
);

const bytes = Buffer.from(parts.join(''), 'base64');
if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
  throw new Error('El recurso NBS hero no es un JPEG válido.');
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, bytes);
console.log(`NBS hero generado: ${path.relative(webRoot, outputFile)} (${bytes.length} bytes)`);
