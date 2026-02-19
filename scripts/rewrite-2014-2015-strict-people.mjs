#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/jonathan/Projects/miranda-opinions';
const years = new Set(['2014', '2015']);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && p.endsWith('.md')) out.push(p);
  }
  return out;
}

const files = walk(path.join(root, 'coa'))
  .filter((f) => years.has(path.basename(path.dirname(f))))
  .sort();

const refRe = /^\[(\d+)\]\s+https?:\/\/www\.nycourts\.gov\/reporter\/3dseries\/(\d{4})\/(\d{4}_\d{5})\.htm(?:#\w+)?\s*$/i;
const citeRe = /\[(\d+)\](People\s+v\.?\s+[A-Z][A-Za-z'\- ]+?,\s*\d+\s+NY3d\s+\d+,\s*\d+\s*\[\d{4}\])/g;

let filesChanged = 0;
let rewrites = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const split = original.split(/\nReferences\n/);
  if (split.length < 2) continue;

  const body = split[0];
  const refsText = split.slice(1).join('\nReferences\n');
  const refs = new Map();

  for (const line of refsText.split(/\r?\n/)) {
    const m = line.match(refRe);
    if (!m) continue;
    refs.set(m[1], m[3]);
  }

  let local = 0;
  const updatedBody = body.replace(citeRe, (full, refNum, citation) => {
    const caseId = refs.get(refNum);
    if (!caseId) return full;
    if (citation.includes('](https://miranda.jurisware.com/case/')) return full;

    local += 1;
    return `[${citation}](https://miranda.jurisware.com/case/${caseId}/)`;
  });

  if (local > 0) {
    fs.writeFileSync(file, `${updatedBody}\nReferences\n${refsText}`, 'utf8');
    filesChanged += 1;
    rewrites += local;
  }
}

console.log(JSON.stringify({ files_scanned: files.length, files_changed: filesChanged, rewrites }, null, 2));
