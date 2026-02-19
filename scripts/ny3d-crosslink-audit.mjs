#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] || 'coa/2003';
const absRoot = path.resolve(root);
const coaRoot = path.resolve('coa');

if (!fs.existsSync(absRoot)) {
  console.error(`Missing path: ${absRoot}`);
  process.exit(1);
}
if (!fs.existsSync(coaRoot)) {
  console.error(`Missing path: ${coaRoot}`);
  process.exit(1);
}

function listMdFiles(rootDir) {
  const out = [];
  const years = fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}$/.test(d.name))
    .map((d) => d.name)
    .sort();
  for (const year of years) {
    const yearDir = path.join(rootDir, year);
    for (const f of fs.readdirSync(yearDir).filter((x) => x.endsWith('.md')).sort()) {
      out.push(path.join(yearDir, f));
    }
  }
  return out;
}

function normalizeCaseName(name) {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

const allMdFiles = listMdFiles(coaRoot);
const byVolPage = new Map();
const byCaseAndVol = new Map();

for (const filePath of allMdFiles) {
  const text = fs.readFileSync(filePath, 'utf8');
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const reporterMatch = text.match(/\[(\d+)\s+NY3d\s+(\d+)\]/);
  const slipMatch = path.basename(filePath).match(/^(\d{4})_(\d{5})\.md$/);
  if (!titleMatch || !reporterMatch || !slipMatch) continue;

  const year = slipMatch[1];
  const slipId = `${slipMatch[1]}_${slipMatch[2]}`;
  const vol = reporterMatch[1];
  const page = reporterMatch[2];
  const caseName = titleMatch[1].trim();

  byVolPage.set(`${vol}:${page}`, { year, slipId, caseName });
  byCaseAndVol.set(`${normalizeCaseName(caseName)}|${vol}`, { year, slipId, caseName, page });
}

const files = fs.readdirSync(absRoot).filter((f) => f.endsWith('.md')).sort();
const results = [];

for (const file of files) {
  const filePath = path.join(absRoot, file);
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const currentSlipId = file.replace(/\.md$/, '');
  const refs = new Map();

  for (const line of lines) {
    const urlRef = line.match(/^\[(\d+)\]\s+https?:\/\/www\.nycourts\.gov\/reporter\/3dseries\/(\d{4})\/(\d{4}_\d{5})\.htm(?:#\w+)?\s*$/);
    if (urlRef) {
      refs.set(urlRef[1], { year: urlRef[2], slipId: urlRef[3], mode: 'url' });
      continue;
    }

    const txtRef = line.match(/^\[(\d+)\]\s+(?:see(?:\s+also)?|but\s+cf|cf)?\s*([A-Z][^,\n]+?),\s*(\d+)\s+NY3d\s+(\d+)/i);
    if (txtRef) {
      const refNum = txtRef[1];
      const caseName = txtRef[2].trim();
      const vol = txtRef[3];
      const page = txtRef[4];
      const hit = byVolPage.get(`${vol}:${page}`) || byCaseAndVol.get(`${normalizeCaseName(caseName)}|${vol}`);
      if (hit) refs.set(refNum, { year: hit.year, slipId: hit.slipId, mode: 'text' });
    }
  }

  const body = text.split(/\nReferences\n/)[0] ?? text;
  const citeRe = /\[(\d+)\]\s*(?:see(?:\s+also)?|but\s+cf|cf)?\s*([^()\n]*?\b\d+\s+NY3d\s+\d+[^)\n]*)/gi;
  let m;
  while ((m = citeRe.exec(body)) !== null) {
    const refNum = m[1];
    const citationText = m[2].trim();
    const ref = refs.get(refNum);
    if (!ref) continue;
    if (ref.slipId === currentSlipId) continue;

    const localTarget = path.resolve(`coa/${ref.year}/${ref.slipId}.md`);
    if (!fs.existsSync(localTarget)) continue;

    results.push({
      sourceFile: path.relative(process.cwd(), filePath),
      refNum,
      citationText,
      resolver: ref.mode,
      target: `s3://opinions.jurisware.com/coa/${ref.year}/${ref.slipId}`,
    });
  }
}

console.log(JSON.stringify({ root: path.relative(process.cwd(), absRoot), opportunities: results }, null, 2));
