#!/usr/bin/env node

import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const scopeArg = args.find((a) => a.startsWith("--scope="));
const scope = scopeArg ? scopeArg.slice("--scope=".length) : "coa/2026";

const root = process.cwd();
const target = path.join(root, scope);

function collectMarkdownFiles(p) {
  const st = fs.statSync(p);
  if (st.isFile()) return p.endsWith(".md") ? [p] : [];
  const out = [];
  for (const name of fs.readdirSync(p)) {
    out.push(...collectMarkdownFiles(path.join(p, name)));
  }
  return out;
}

const files = collectMarkdownFiles(target).sort();
const re =
  /https:\/\/miranda\.jurisware\.com\/(?:(?:pub|sub|admin)\/)?case\/([0-9]{4}_[0-9]{5})\/?/g;

let total = 0;

for (const file of files) {
  const original = fs.readFileSync(file, "utf8");
  const changes = [];

  const updated = original.replace(re, (from, caseId) => {
    const to = `/case/${caseId}`;
    changes.push({ from, to });
    return to;
  });

  if (changes.length === 0) continue;
  total += changes.length;

  console.log(path.relative(root, file));
  for (const c of changes) {
    console.log(`  - ${c.from}`);
    console.log(`    -> ${c.to}`);
  }
  console.log("");

  if (apply) fs.writeFileSync(file, updated, "utf8");
}

console.log(`${apply ? "Applied" : "Dry run"} complete. ${total} link(s) ${apply ? "updated" : "would be updated"}.`);
