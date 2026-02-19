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

const cueAlternation = [
  'see also',
  'but see',
  'but cf',
  'cf',
  'contra',
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
]
  .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

// [12]see People v X (22 NY3d 123 ...)
// [12]People v X, 22 NY3d 123 ...
const bodyRe = new RegExp(
  String.raw`\[(\d+)\]\s*(?:(` + cueAlternation + String.raw`)\s+)?([A-Z][^\n]{0,220}?\b\d+\s+NY3d\s+\d+[^\n]{0,120})`,
  'gi'
);

const refRe = /^\[(\d+)\]\s+https?:\/\/www\.nycourts\.gov\/reporter\/3dseries\/(\d{4})\/(\d{4}_\d{5})\.htm(?:#\w+)?\s*$/i;

const results = [];
const cueCounts = new Map();

for (const file of files) {
  const txt = fs.readFileSync(file, 'utf8');
  const parts = txt.split(/\nReferences\n/);
  const body = parts[0] ?? txt;
  const refsText = parts[1] ?? '';

  const refs = new Map();
  for (const line of refsText.split(/\r?\n/)) {
    const m = line.match(refRe);
    if (!m) continue;
    refs.set(m[1], { year: m[2], caseId: m[3], sourceUrl: line.trim() });
  }

  for (const m of body.matchAll(bodyRe)) {
    const refNum = m[1];
    const cue = (m[2] || 'bare').toLowerCase();
    const citeText = (m[3] || '').trim();
    const ref = refs.get(refNum);
    if (!ref) continue;

    const miranda = `https://miranda.jurisware.com/case/${ref.caseId}/`;
    const currentId = path.basename(file, '.md');
    const isCrossCase = ref.caseId !== currentId;

    results.push({
      file: path.relative(root, file),
      refNum,
      cue,
      citation: citeText,
      currentCaseId: currentId,
      caseId: ref.caseId,
      isCrossCase,
      miranda,
      referenceUrl: ref.sourceUrl,
    });
    cueCounts.set(cue, (cueCounts.get(cue) || 0) + 1);
  }
}

const crossOnly = results.filter((r) => r.isCrossCase);

const report = {
  files_scanned: files.length,
  matches: results.length,
  cross_case_matches: crossOnly.length,
  cue_counts: Object.fromEntries([...cueCounts.entries()].sort((a, b) => b[1] - a[1])),
  all_matches: results,
  all_cross_case_matches: crossOnly,
  sample_all: results.slice(0, 200),
  sample_cross_case: crossOnly.slice(0, 200),
};

console.log(JSON.stringify(report, null, 2));
