#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repo = '/Users/jonathan/Projects/miranda-opinions';

function walk(dir, out=[]) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && p.endsWith('.md')) out.push(p);
  }
  return out;
}

const files = walk(repo).sort();

// Match either:
// - People v Name, 12 NY3d 345
// - People v Name (12 NY3d 345
// Allow typo v. and optional bracket markers before People.
const citeRe = /(People\s+v\.?\s+[A-Z][^,\n()]{1,120}?)(,|\s*\()(\d+)\s+NY3d\s+(\d+)/g;

function normalizeLead(leadRaw) {
  let s = leadRaw.replace(/\s+/g, ' ').trim();
  // drop trailing punctuation noise except words/cues
  s = s.replace(/[\[(\{;,\-\s]+$/g, '').trim();
  if (!s) return '(none)';
  // collapse numbered refs and stars
  s = s.replace(/\[[0-9*]+\]$/g, '').trim();
  if (!s) return '(none)';
  return s.toLowerCase();
}

const byLead = new Map();
const byShape = new Map();
let total = 0;

for (const file of files) {
  const txt = fs.readFileSync(file, 'utf8');
  for (const m of txt.matchAll(citeRe)) {
    total += 1;
    const idx = m.index ?? 0;
    const before = txt.slice(0, idx);

    // grab text since last strong boundary
    const boundary = Math.max(
      before.lastIndexOf('\n'),
      before.lastIndexOf('. '),
      before.lastIndexOf('; '),
      before.lastIndexOf(': ')
    );
    const leadRaw = before.slice(boundary + 1);
    const lead = normalizeLead(leadRaw);

    const rec = byLead.get(lead) || { count: 0, samples: [] };
    rec.count += 1;
    if (rec.samples.length < 3) {
      rec.samples.push({
        file: path.relative(repo, file),
        snippet: `${m[0]}`,
      });
    }
    byLead.set(lead, rec);

    const shape = m[2] === ',' ? 'comma' : 'paren';
    byShape.set(shape, (byShape.get(shape) || 0) + 1);
  }
}

const sortedLeads = [...byLead.entries()]
  .sort((a,b) => b[1].count - a[1].count)
  .map(([lead, data]) => ({ lead, count: data.count, samples: data.samples }));

const out = {
  files_scanned: files.length,
  total_matches: total,
  shape_counts: Object.fromEntries([...byShape.entries()]),
  lead_variants_top200: sortedLeads.slice(0, 200),
};

console.log(JSON.stringify(out, null, 2));
