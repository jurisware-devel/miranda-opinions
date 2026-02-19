#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/jonathan/Projects/miranda-opinions';
const years = process.argv.slice(2);
if (years.length === 0) {
  console.error('Usage: rewrite-ny3d-crosslinks.mjs <year> [year...]');
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

const cueAlternation = [
  'see also', 'but see', 'but cf', 'cf', 'contra', 'see',
  'as shown in', 'as noted in', 'as explained in', 'as we observed in',
  'as we held in', 'as we noted in', 'as we explained in',
  'for example, in', 'for example in', 'for instance, in', 'for instance in',
  'more recently, in', 'more recently in', 'most recently, in',
  'most recently in', 'recently, in', 'recently in',
  'in contrast to', 'similarly, in', 'similarly in',
  'relying on', 'citing', 'pursuant to', 'under', 'in', 'and'
].map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

const bodyRe = new RegExp(
  String.raw`\[(\d+)\]\s*(?:(` + cueAlternation + String.raw`)\s+)?([A-Z][^\n]{0,220}?\b\d+\s+NY3d\s+\d+[^\n]{0,120})`,
  'gi'
);
const refRe = /^\[(\d+)\]\s+https?:\/\/www\.nycourts\.gov\/reporter\/3dseries\/(\d{4})\/(\d{4}_\d{5})\.htm(?:#\w+)?\s*$/i;

const files = walk(path.join(root, 'coa'))
  .filter((f) => years.includes(path.basename(path.dirname(f))))
  .sort();

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
  let localRewrites = 0;

  const updatedBody = body.replace(bodyRe, (full, refNum, cue, citation) => {
    const ref = refs.get(refNum);
    if (!ref) return full;
    if (ref.caseId === currentId) return full;
    if (citation.includes('](https://miranda.jurisware.com/case/')) return full;

    const link = `https://miranda.jurisware.com/case/${ref.caseId}/`;
    const linkedCitation = `[${citation}](${link})`;
    localRewrites += 1;

    if (cue) return `[${refNum}]${cue} ${linkedCitation}`;
    return `[${refNum}]${linkedCitation}`;
  });

  if (localRewrites > 0) {
    const updated = `${updatedBody}\nReferences\n${refsText}`;
    fs.writeFileSync(file, updated, 'utf8');
    filesChanged += 1;
    rewrites += localRewrites;
  }
}

console.log(JSON.stringify({ years, files_scanned: files.length, files_changed: filesChanged, rewrites }, null, 2));
