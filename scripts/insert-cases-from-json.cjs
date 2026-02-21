#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
let Amplify;
let generateClient;

function parseArgs(argv) {
  const args = {
    file: "coa_2026_case_records.json",
    outputs: "amplify_outputs.json",
    dryRun: false,
    createOnly: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--create-only") args.createOnly = true;
    else if (a === "--file" && argv[i + 1]) args.file = argv[++i];
    else if (a === "--outputs" && argv[i + 1]) args.outputs = argv[++i];
    else if (a === "--help" || a === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return args;
}

function loadJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, "utf8"));
}

function normalizeRecord(raw) {
  const required = ["caseId", "caseName", "opinionUrl"];
  for (const key of required) {
    if (!raw[key] || typeof raw[key] !== "string") {
      throw new Error(`Record missing required string field: ${key}`);
    }
  }

  return {
    caseId: raw.caseId,
    caseName: raw.caseName,
    slipOp: raw.slipOp ?? null,
    ny3dCite: raw.ny3dCite ?? null,
    opinionUrl: raw.opinionUrl,
    court: raw.court ?? null,
    decisionDate: raw.decisionDate ?? null,
    arguedDate: raw.arguedDate ?? null,
    correctedDate: raw.correctedDate ?? null,
    citation: raw.citation ?? null,
    lowerCourtCite: raw.lowerCourtCite ?? null,
    disposition: raw.disposition ?? null,
    authoringJudge: raw.authoringJudge ?? null,
    partiesCaption: raw.partiesCaption ?? null,
    statutesCited: Array.isArray(raw.statutesCited) ? raw.statutesCited : [],
    summary: raw.summary ?? null,
  };
}

async function createCase(client, record) {
  const { data, errors } = await client.models.Case.create(record, {
    authMode: "iam",
  });
  if (errors?.length) throw new Error(JSON.stringify(errors));
  return data;
}

async function updateCase(client, record) {
  const { data, errors } = await client.models.Case.update(record, {
    authMode: "iam",
  });
  if (errors?.length) throw new Error(JSON.stringify(errors));
  return data;
}

async function getCase(client, caseId) {
  const { data, errors } = await client.models.Case.get(
    { caseId },
    { authMode: "iam" }
  );
  if (errors?.length) throw new Error(JSON.stringify(errors));
  return data;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:
  node scripts/insert-cases-from-json.cjs [--file <path>] [--outputs <path>] [--dry-run] [--create-only]

Options:
  --file         JSON file containing an array of Case records (default: coa_2026_case_records.json)
  --outputs      Amplify outputs JSON file (default: amplify_outputs.json)
  --dry-run      Validate and print actions without writing
  --create-only  Only create records; skip existing caseIds
`);
    return;
  }

  try {
    ({ Amplify } = require("aws-amplify"));
    ({ generateClient } = require("aws-amplify/data"));
  } catch (err) {
    throw new Error(
      "Missing dependencies. Install with: npm install aws-amplify"
    );
  }

  const cwd = process.cwd();
  const filePath = path.resolve(cwd, args.file);
  const outputsPath = path.resolve(cwd, args.outputs);

  const outputs = loadJson(outputsPath);
  const rawRecords = loadJson(filePath);
  if (!Array.isArray(rawRecords)) {
    throw new Error("Input JSON must be an array of records");
  }

  const records = rawRecords.map(normalizeRecord);
  const seen = new Set();
  for (const r of records) {
    if (seen.has(r.caseId)) throw new Error(`Duplicate caseId in input: ${r.caseId}`);
    seen.add(r.caseId);
  }

  Amplify.configure(outputs);
  const client = generateClient();

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  console.log(
    `Processing ${records.length} Case records from ${path.relative(cwd, filePath)}...`
  );

  for (const record of records) {
    try {
      const existing = await getCase(client, record.caseId);
      if (existing) {
        if (args.createOnly) {
          skipped += 1;
          console.log(`SKIP (exists): ${record.caseId}`);
          continue;
        }
        if (args.dryRun) {
          updated += 1;
          console.log(`DRY-RUN UPDATE: ${record.caseId}`);
          continue;
        }
        await updateCase(client, record);
        updated += 1;
        console.log(`UPDATED: ${record.caseId}`);
      } else {
        if (args.dryRun) {
          created += 1;
          console.log(`DRY-RUN CREATE: ${record.caseId}`);
          continue;
        }
        await createCase(client, record);
        created += 1;
        console.log(`CREATED: ${record.caseId}`);
      }
    } catch (err) {
      failed += 1;
      console.error(`FAILED: ${record.caseId} -> ${err.message || String(err)}`);
    }
  }

  console.log(
    `Done. created=${created} updated=${updated} skipped=${skipped} failed=${failed}`
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
