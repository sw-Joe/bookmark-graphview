import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = process.argv[2];

const sourceByTarget = {
  chrome: 'public/manifest.json',
  firefox: 'public/manifest.firefox.json'
};

if (!sourceByTarget[target]) {
  console.error('Usage: node scripts/copy-manifest.mjs <chrome|firefox>');
  process.exit(1);
}

const source = resolve(process.cwd(), sourceByTarget[target]);
const destination = resolve(process.cwd(), 'dist/manifest.json');

copyFileSync(source, destination);
console.log(`Copied ${sourceByTarget[target]} -> dist/manifest.json`);
