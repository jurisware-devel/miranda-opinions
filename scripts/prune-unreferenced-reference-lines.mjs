#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/jonathan/Projects/miranda-opinions';
const years = process.argv.slice(2);
if (years.length === 0) {
  console.error('Usage: prune-unreferenced-reference-lines.mjs <year> [year...]');
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

const refLineRe = /^(\s*)\[(\d+)\](\s+.*)$/;
const bodyRefRe = /\[(\d+)\]/g;

let filesChanged = 0;
let refsRemoved = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const refsHeader = original.match(/\nReferences\s*\n/i);
  if (!refsHeader || refsHeader.index == null) continue;

  const splitAt = refsHeader.index;
  const headerLen = refsHeader[0].length;
  const body = original.slice(0, splitAt);
  const refsText = original.slice(splitAt + headerLen);

  const used = new Set();
  for (const m of body.matchAll(bodyRefRe)) used.add(m[1]);

  let local = 0;
  const kept = [];
  for (const line of refsText.split(/\r?\n/)) {
    const m = line.match(refLineRe);
    if (!m) {
      kept.push(line);
      continue;
    }
    if (used.has(m[2])) {
      kept.push(line);
    } else {
      local += 1;
    }
  }

  if (local > 0) {
    fs.writeFileSync(file, `${body}\nReferences\n${kept.join('\n')}`, 'utf8');
    filesChanged += 1;
    refsRemoved += local;
  }
}

console.log(JSON.stringify({ years, files_scanned: files.length, files_changed: filesChanged, refs_removed: refsRemoved }, null, 2));
