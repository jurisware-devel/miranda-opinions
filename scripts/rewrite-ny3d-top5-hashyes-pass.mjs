#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/jonathan/Projects/miranda-opinions';
const years = process.argv.slice(2);
if (years.length === 0) {
  console.error('Usage: rewrite-ny3d-top5-hashyes-pass.mjs <year> [year...]');
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

// Top 5 hash:yes shapes from latest scan.
const rules = [
  {
    key: 'none_comma_none_year_no',
    // [#]People v <name>, XXX NY3d YYY
    re: /\[(\d+)\](People\s+v\.?\s+[^,\n]+,\s*\d+\s+NY3d\s+\d+)(?!\s*,)(?!\s*\[\d{4}\])/g,
    render: (_refNum, citation) => `[${citation}]`,
  },
  {
    key: 'cf_comma_single_year_yes',
    // [#]cf. People v <name>, XXX NY3d YYY, ZZZ [yyyy]
    re: /\[(\d+)\](cf\.?\s+)(People\s+v\.?\s+[^,\n]+,\s*\d+\s+NY3d\s+\d+,\s*\d+\s*\[\d{4}\])/gi,
    render: (_refNum, signal, citation) => `${signal}[${citation}]`,
  },
  {
    key: 'see_also_comma_none_year_yes',
    // [#]see also People v <name>, XXX NY3d YYY [yyyy]
    re: /\[(\d+)\](see also\s+)(People\s+v\.?\s+[^,\n]+,\s*\d+\s+NY3d\s+\d+\s*\[\d{4}\])/gi,
    render: (_refNum, signal, citation) => `${signal}[${citation}]`,
  },
  {
    key: 'see_also_comma_single_year_no',
    // [#]see also People v <name>, XXX NY3d YYY, ZZZ
    re: /\[(\d+)\](see also\s+)(People\s+v\.?\s+[^,\n]+,\s*\d+\s+NY3d\s+\d+,\s*\d+)(?!\s*\[\d{4}\])/gi,
    render: (_refNum, signal, citation) => `${signal}[${citation}]`,
  },
  {
    key: 'none_comma_single_year_yes',
    // [#]People v <name>, XXX NY3d YYY, ZZZ [yyyy]
    re: /\[(\d+)\](People\s+v\.?\s+[^,\n]+,\s*\d+\s+NY3d\s+\d+,\s*\d+\s*\[\d{4}\])/g,
    render: (_refNum, citation) => `[${citation}]`,
  },
];

let filesChanged = 0;
let rewrites = 0;
let refsRemoved = 0;
const byRule = Object.fromEntries(rules.map((r) => [r.key, 0]));

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const refsHeader = original.match(/\nReferences\s*\n/i);
  if (!refsHeader || refsHeader.index == null) continue;
  const splitAt = refsHeader.index;
  const headerLen = refsHeader[0].length;
  let body = original.slice(0, splitAt);
  const refsText = original.slice(splitAt + headerLen);

  const refs = new Map();
  for (const line of refsText.split(/\r?\n/)) {
    const m = line.match(refRe);
    if (m) refs.set(m[1], { caseId: m[3] });
  }

  const currentId = path.basename(file, '.md');
  const removedRefNums = new Set();
  let local = 0;

  for (const rule of rules) {
    body = body.replace(rule.re, (...args) => {
      const refNum = args[1];
      const ref = refs.get(refNum);
      if (!ref) return args[0];
      if (ref.caseId === currentId) return args[0];

      const textBits = args.slice(2, -2);
      const candidate = textBits.join('');
      if (candidate.includes('](https://miranda.jurisware.com/case/')) return args[0];

      local += 1;
      byRule[rule.key] += 1;
      removedRefNums.add(refNum);
      const labeled = rule.render(...args.slice(1, -2));
      return `${labeled}(https://miranda.jurisware.com/case/${ref.caseId}/)`;
    });
  }

  if (local > 0) {
    const kept = [];
    let localRefsRemoved = 0;
    for (const line of refsText.split(/\r?\n/)) {
      const m = line.match(refLineRe);
      if (m && removedRefNums.has(m[2])) {
        localRefsRemoved += 1;
        continue;
      }
      kept.push(line);
    }
    fs.writeFileSync(file, `${body}\nReferences\n${kept.join('\n')}`, 'utf8');
    filesChanged += 1;
    rewrites += local;
    refsRemoved += localRefsRemoved;
  }
}

console.log(JSON.stringify({ years, files_scanned: files.length, files_changed: filesChanged, rewrites, refs_removed: refsRemoved, by_rule: byRule }, null, 2));
