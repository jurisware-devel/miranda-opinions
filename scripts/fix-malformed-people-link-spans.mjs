#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/jonathan/Projects/miranda-opinions/coa';
const years = process.argv.slice(2);
if (years.length === 0) {
  console.error('Usage: fix-malformed-people-link-spans.mjs <year> [year...]');
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

const files = walk(root)
  .filter((f) => years.includes(path.basename(path.dirname(f))))
  .sort();

// Match markdown links to Miranda cases.
const linkRe = /\[([^\]]+)\]\((https:\/\/miranda\.jurisware\.com\/case\/\d{4}_\d{5}\/)\)/g;

// Find the first People v citation inside text and stop at citation end.
const citeRe = /People\s+v\.?\s+[^,\n()]{1,160}?(?:\(\s*\d+\s+NY3d\s+\d+(?:,\s*\d+(?:-\d+)?)?(?:\s*\[\d{4}\])?\s*\)|,\s*\d+\s+NY3d\s+\d+(?:,\s*\d+(?:-\d+)?)?(?:\s*\[\d{4}\])?)/i;

const signalRe = /^(see generally|see also|see e\.g\.|see|cf\.?|but cf\.?|but see|contra|accord|compare)\s+$/i;

let filesChanged = 0;
let fixes = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let local = 0;

  const updated = original.replace(linkRe, (full, text, url) => {
    if (!/People\s+v\.?/i.test(text)) return full;

    const m = text.match(citeRe);
    if (!m || m.index == null) return full;

    const citation = m[0].replace(/^\[\d+\]\s*/, '').replace(/^\[/, '').trim();
    let prefix = text.slice(0, m.index).replace(/\[\d+\]\s*/g, '').replace(/\[/g, '').trim();
    if (!prefix) {
      if (citation === text) return full;
      local += 1;
      return `[${citation}](${url})`;
    }

    if (!signalRe.test(prefix + ' ')) {
      // Not a recognized leading signal; keep only citation linked.
      local += 1;
      return `${prefix} [${citation}](${url})`;
    }

    local += 1;
    return `${prefix} [${citation}](${url})`;
  });

  if (local > 0) {
    fs.writeFileSync(file, updated, 'utf8');
    filesChanged += 1;
    fixes += local;
  }
}

console.log(JSON.stringify({ years, files_scanned: files.length, files_changed: filesChanged, fixes }, null, 2));
