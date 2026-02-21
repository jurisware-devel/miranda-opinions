#!/usr/bin/env node

const { spawnSync } = require("child_process");
const path = require("path");

function parseArgs(argv) {
  const args = {
    outputs: "amplify_outputs.json",
    dryRun: false,
    createOnly: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--create-only") args.createOnly = true;
    else if (a === "--outputs" && argv[i + 1]) args.outputs = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`Usage:
  node scripts/insert-2025-cases.cjs [--dry-run] [--create-only] [--outputs amplify_outputs.json]

Behavior:
  - Uses /coa_2025_case_records.json as input.
  - Delegates to scripts/insert-cases-from-json.cjs.
`);
    return;
  }

  const root = process.cwd();
  const scriptPath = path.join(root, "scripts", "insert-cases-from-json.cjs");

  const cmdArgs = [
    scriptPath,
    "--file",
    "coa_2025_case_records.json",
    "--outputs",
    args.outputs,
  ];
  if (args.dryRun) cmdArgs.push("--dry-run");
  if (args.createOnly) cmdArgs.push("--create-only");

  const res = spawnSync(process.execPath, cmdArgs, { stdio: "inherit" });
  if (res.error) throw res.error;
  process.exit(res.status ?? 1);
}

main();
