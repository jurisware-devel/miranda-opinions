#!/usr/bin/env node

import fs from "fs";
import path from "path";

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const scopeArg = argv.find((a) => a.startsWith("--scope="));
const segmentArg = argv.find((a) => a.startsWith("--segment="));

const scope = scopeArg ? scopeArg.slice("--scope=".length) : "coa/2026";
const segment = segmentArg ? segmentArg.slice("--segment=".length) : "pub";

if (!["pub", "sub", "admin"].includes(segment)) {
  console.error("Invalid --segment. Use pub, sub, or admin.");
  process.exit(2);
}

const root = process.cwd();
const scopePath = path.join(root, scope);

function collectMarkdownFiles(targetPath) {
  const st = fs.statSync(targetPath);
  if (st.isFile()) return targetPath.endsWith(".md") ? [targetPath] : [];
  const out = [];
  for (const name of fs.readdirSync(targetPath)) {
    out.push(...collectMarkdownFiles(path.join(targetPath, name)));
  }
  return out;
}

const files = collectMarkdownFiles(scopePath).sort();
const broken = /https:\/\/miranda\.jurisware\.com\/case\/([0-9]{4}_[0-9]{5})(\/?)/g;

let total = 0;

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const changes = [];

  const updated = text.replace(broken, (m, caseId, slash) => {
    const to = `https://miranda.jurisware.com/${segment}/case/${caseId}${slash}`;
    changes.push({ from: m, to });
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
