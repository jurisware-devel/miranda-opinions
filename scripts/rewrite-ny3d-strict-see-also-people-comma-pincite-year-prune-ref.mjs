#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/jonathan/Projects/miranda-opinions';
const years = process.argv.slice(2);
if (years.length === 0) {
  console.error('Usage: rewrite-ny3d-strict-see-also-people-comma-pincite-year-prune-ref.mjs <year> [year...]');
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

const refRe = /^\s*\[(\d+)\]\s+https?:\/\/(?:www\.)?(?:nycourts\.gov|courts\.state\.ny\.us)\/reporter\/3dseries\/(\d{4})\/(\d{4}_\d{5})\.htm(?:#\w+)?\s*$/i;
const refLineRe = /^(\s*)\[(\d+)\](\s+.*)$/;

// Strict target:
// [#]see also People v[.] <name>, <vol> NY3d <page>, <pin|pin-range> [<year>]
const strictRe = /\[(\d+)\](see also\s+)(People\s+v\.?\s+[^,\n]+,\s*\d+\s+NY3d\s+\d+,\s*\d+(?:\s*[-–—]\s*\d+)?\s*\[\d{4}\])/gi;

let filesChanged = 0;
let rewrites = 0;
let refsRemoved = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const refsHeader = original.match(/\nReferences\s*\n/i);
  if (!refsHeader || refsHeader.index == null) continue;
  const splitAt = refsHeader.index;
  const headerLen = refsHeader[0].length;
  const body = original.slice(0, splitAt);
  const refsText = original.slice(splitAt + headerLen);

  const refs = new Map();
  for (const line of refsText.split(/\r?\n/)) {
    const m = line.match(refRe);
    if (m) refs.set(m[1], { caseId: m[3] });
  }

  const currentId = path.basename(file, '.md');
  const removedRefNums = new Set();
  let local = 0;

  const updatedBody = body.replace(strictRe, (full, refNum, signal, citation) => {
    const ref = refs.get(refNum);
    if (!ref) return full;
    if (ref.caseId === currentId) return full;
    if (citation.includes('](https://miranda.jurisware.com/case/')) return full;

    local += 1;
    removedRefNums.add(refNum);
    return `${signal}[${citation}](https://miranda.jurisware.com/case/${ref.caseId}/)`;
  });

  if (local > 0) {
    const keptRefLines = [];
    let localRefsRemoved = 0;
    for (const line of refsText.split(/\r?\n/)) {
      const m = line.match(refLineRe);
      if (m && removedRefNums.has(m[2])) {
        localRefsRemoved += 1;
        continue;
      }
      keptRefLines.push(line);
    }

    fs.writeFileSync(file, `${updatedBody}\nReferences\n${keptRefLines.join('\n')}`, 'utf8');
    filesChanged += 1;
    rewrites += local;
    refsRemoved += localRefsRemoved;
  }
}

console.log(JSON.stringify({ years, files_scanned: files.length, files_changed: filesChanged, rewrites, refs_removed: refsRemoved }, null, 2));
