import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const brandDir = path.join(webRoot, 'src', 'brand');
const outputDir = path.join(webRoot, 'src', 'assets');
const outputFile = path.join(outputDir, 'nbs-hero-card.jpg');
const encodedFile = path.join(brandDir, 'nbs_hero_card.compact.b64');

const encoded = fs.readFileSync(encodedFile, 'utf8').replace(/\s+/g, '');
const bytes = Buffer.from(encoded, 'base64');
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
const expectedSha256 = 'd09a9053f75a8920b1e18d4d51d3d08831b0895c42b3f823434131d9eaac5340';

if (
  bytes.length !== 6069 ||
  sha256 !== expectedSha256 ||
  bytes[0] !== 0xff ||
  bytes[1] !== 0xd8 ||
  bytes[bytes.length - 2] !== 0xff ||
  bytes[bytes.length - 1] !== 0xd9
) {
  throw new Error(`El recurso NBS hero no coincide con el archivo validado (bytes=${bytes.length}, sha256=${sha256}).`);
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, bytes);
console.log(`NBS hero validado y generado: ${path.relative(webRoot, outputFile)} (${bytes.length} bytes, sha256=${sha256})`);
