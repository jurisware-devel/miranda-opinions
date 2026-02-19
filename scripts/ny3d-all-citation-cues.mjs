#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/jonathan/Projects/miranda-opinions';

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && p.endsWith('.md')) out.push(p);
  }
  return out;
}

const files = walk(root).sort();

// Any NY3d citation where a case name appears before the reporter cite.
// e.g., "People v Morris, 21 NY3d 588" or "People v Morris (21 NY3d 588"
const citeRe = /([A-Z][A-Za-z0-9'&.\- ]{1,140}?)(,|\s*\()(\d+)\s+NY3d\s+(\d+)/g;

const cuePatterns = [
  'see also',
  'but see',
  'but cf',
  'contra',
  'cf',
  'see',
  'as shown in',
  'as noted in',
  'as explained in',
  'as we observed in',
  'as we held in',
  'as we noted in',
  'as we explained in',
  'for example, in',
  'for example in',
  'for instance, in',
  'for instance in',
  'more recently, in',
  'more recently in',
  'most recently, in',
  'most recently in',
  'recently, in',
  'recently in',
  'in contrast to',
  'similarly, in',
  'similarly in',
  'relying on',
  'citing',
  'pursuant to',
  'under',
  'in',
  'and'
];

const counts = new Map();
const samples = new Map();
let total = 0;

for (const file of files) {
  const txt = fs.readFileSync(file, 'utf8');
  for (const m of txt.matchAll(citeRe)) {
    const caseName = (m[1] || '').trim();
    // Guard: looks like a case citation text (has v or Matter of or In re style token)
    if (!/\bv\.?\b|\bMatter of\b|\bIn re\b|\bex rel\b/.test(caseName)) continue;

    total += 1;
    const idx = m.index || 0;
    let pre = txt.slice(Math.max(0, idx - 120), idx)
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    pre = pre.replace(/\[[0-9*]+\]\s*$/g, '').trim();
    pre = pre.replace(/[;:,([\]\s]+$/g, '').trim();

    let cue = 'bare';
    for (const cp of cuePatterns) {
      if (pre.endsWith(cp)) {
        cue = cp;
        break;
      }
    }

    counts.set(cue, (counts.get(cue) || 0) + 1);
    if (!samples.has(cue)) samples.set(cue, []);
    const arr = samples.get(cue);
    if (arr.length < 8) {
      arr.push({
        file: path.relative(root, file),
        snippet: txt.slice(Math.max(0, idx - 60), idx + m[0].length + 30).replace(/\s+/g, ' ')
      });
    }
  }
}

const ordered = [...counts.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([cue, count]) => ({ cue, count, samples: samples.get(cue) || [] }));

const cueFocus = ['see also', 'but see', 'but cf', 'cf', 'contra', 'see'];
const focused = ordered.filter((x) => cueFocus.includes(x.cue));

const report = {
  files_scanned: files.length,
  total_matches: total,
  cue_counts: ordered,
  focused_cues: focused
};

console.log(JSON.stringify(report, null, 2));
