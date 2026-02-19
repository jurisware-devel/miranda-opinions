#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/jonathan/Projects/miranda-opinions';
const years = process.argv.slice(2);
if (years.length === 0) {
  console.error('Usage: fix-leading-signal-outside-link.mjs <year> [year...]');
  process.exit(1);
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && p.endsWith('.md')) out.push(p);
  }
  return out;
}

const files = walk(path.join(root, 'coa'))
  .filter((f) => years.includes(path.basename(path.dirname(f))))
  .sort();

const signals = [
  'see generally',
  'see also',
  'but cf\\.?',
  'but see',
  'cf\\.?',
  'see',
  'contra',
  'accord',
  'compare'
];

const signalAlt = signals.join('|');
const re = new RegExp(
  String.raw`\[((?:${signalAlt})\s+)(People\s+v\.?[\s\S]*?\[\d{4}\])\]\((https:\/\/miranda\.jurisware\.com\/case\/\d{4}_\d{5}\/)\)`,
  'gi'
);

let filesChanged = 0;
let rewrites = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let local = 0;
  const updated = original.replace(re, (_m, signal, citation, url) => {
    local += 1;
    return `${signal}[${citation}](${url})`;
  });
  if (local > 0) {
    fs.writeFileSync(file, updated, 'utf8');
    filesChanged += 1;
    rewrites += local;
  }
}

console.log(JSON.stringify({ years, files_scanned: files.length, files_changed: filesChanged, rewrites }, null, 2));
