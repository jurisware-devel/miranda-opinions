#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/jonathan/Projects/miranda-opinions';
const years = process.argv.slice(2);
if (years.length === 0) {
  console.error('Usage: rewrite-ny3d-strict-people.mjs <year> [year...]');
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

const refRe = /^\[(\d+)\]\s+https?:\/\/www\.nycourts\.gov\/reporter\/3dseries\/(\d{4})\/(\d{4}_\d{5})\.htm(?:#\w+)?\s*$/i;

// Strict target pattern requested by user:
// [#]People v <name>, XXX NY3d YYY, ZZZ [year]
// tolerate typo v.
const strictRe = /\[(\d+)\](People\s+v\.?\s+[A-Z][A-Za-z'\- ]+?,\s*\d+\s+NY3d\s+\d+,\s*\d+\s*\[\d{4}\])/g;

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
    if (m) refs.set(m[1], { caseId: m[3] });
  }

  const currentId = path.basename(file, '.md');
  let local = 0;

  const updatedBody = body.replace(strictRe, (full, refNum, citation) => {
    const ref = refs.get(refNum);
    if (!ref) return full;
    if (ref.caseId === currentId) return full;
    if (citation.includes('](https://miranda.jurisware.com/case/')) return full;

    local += 1;
    const url = `https://miranda.jurisware.com/case/${ref.caseId}/`;
    return `[${citation}](${url})`;
  });

  if (local > 0) {
    fs.writeFileSync(file, `${updatedBody}\nReferences\n${refsText}`, 'utf8');
    filesChanged += 1;
    rewrites += local;
  }
}

console.log(JSON.stringify({ years, files_scanned: files.length, files_changed: filesChanged, rewrites }, null, 2));
