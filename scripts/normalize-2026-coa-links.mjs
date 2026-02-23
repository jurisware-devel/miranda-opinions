#!/usr/bin/env node

import fs from "fs";
import path from "path";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const dryRun = !apply;

const root = process.cwd();
const targetDir = path.join(root, "coa", "2026");

function findMarkdownLinks(content) {
  const links = [];
  let i = 0;

  while (i < content.length) {
    if (content[i] !== "[") {
      i += 1;
      continue;
    }

    const labelStart = i + 1;
    let j = labelStart;
    let depth = 1;

    while (j < content.length && depth > 0) {
      if (content[j] === "[") depth += 1;
      else if (content[j] === "]") depth -= 1;
      j += 1;
    }
    if (depth !== 0) {
      i += 1;
      continue;
    }
    if (content[j] !== "(") {
      i += 1;
      continue;
    }

    const labelEnd = j - 2;
    const urlStart = j + 1;
    const urlEnd = content.indexOf(")", urlStart);
    if (urlEnd === -1) {
      i += 1;
      continue;
    }

    const label = content.slice(labelStart, labelEnd + 1);
    const url = content.slice(urlStart, urlEnd);

    links.push({
      start: i,
      end: urlEnd + 1,
      label,
      url,
      raw: content.slice(i, urlEnd + 1),
    });

    i = urlEnd + 1;
  }

  return links;
}

const corePattern = /^(\*People v [^*]+\*,\s*\d+\s+NY3d\s+\d+)([\s\S]*)$/;

function rewriteLink(link) {
  if (!/^https?:\/\//.test(link.url)) return null;
  const match = link.label.match(corePattern);
  if (!match) return null;

  const core = match[1];
  const remainder = match[2] || "";
  if (!remainder) return null;

  const rewritten = `[${core}](${link.url})${remainder}`;
  if (rewritten === link.raw) return null;
  return rewritten;
}

const files = fs
  .readdirSync(targetDir)
  .filter((f) => f.endsWith(".md"))
  .sort()
  .map((f) => path.join(targetDir, f));

let totalChanges = 0;

for (const file of files) {
  const original = fs.readFileSync(file, "utf8");
  const links = findMarkdownLinks(original);
  if (links.length === 0) continue;

  const edits = [];
  for (const link of links) {
    const rewritten = rewriteLink(link);
    if (rewritten) {
      edits.push({ ...link, rewritten });
    }
  }

  if (edits.length === 0) continue;
  totalChanges += edits.length;

  let updated = original;
  for (let idx = edits.length - 1; idx >= 0; idx -= 1) {
    const e = edits[idx];
    updated = updated.slice(0, e.start) + e.rewritten + updated.slice(e.end);
  }

  console.log(path.relative(root, file));
  for (const e of edits) {
    console.log(`  - ${e.raw}`);
    console.log(`    -> ${e.rewritten}`);
  }
  console.log("");

  if (apply && updated !== original) {
    fs.writeFileSync(file, updated, "utf8");
  }
}

console.log(
  `${dryRun ? "Dry run" : "Applied"} complete. ${totalChanges} link(s) ${dryRun ? "would be" : "were"} updated.`
);
