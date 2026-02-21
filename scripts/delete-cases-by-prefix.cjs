#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

let Amplify;
let generateClient;

function parseArgs(argv) {
  const args = {
    outputs: "amplify_outputs.json",
    prefix: "2025_",
    execute: false,
    limit: 1000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--outputs" && argv[i + 1]) args.outputs = argv[++i];
    else if (a === "--prefix" && argv[i + 1]) args.prefix = argv[++i];
    else if (a === "--execute") args.execute = true;
    else if (a === "--limit" && argv[i + 1]) args.limit = Number(argv[++i]);
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }

  if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 1000) {
    throw new Error("--limit must be an integer between 1 and 1000");
  }

  return args;
}

function loadJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, "utf8"));
}

async function listCaseIdsByPrefix(client, prefix, pageLimit) {
  const query = `
    query ListCasesByPrefix($limit: Int, $nextToken: String, $filter: ModelCaseFilterInput) {
      listCases(limit: $limit, nextToken: $nextToken, filter: $filter) {
        items { caseId }
        nextToken
      }
    }
  `;

  let nextToken = null;
  const caseIds = [];

  do {
    const res = await client.graphql({
      query,
      variables: {
        limit: pageLimit,
        nextToken,
        filter: { caseId: { beginsWith: prefix } },
      },
      authMode: "iam",
    });

    const payload = res?.data?.listCases;
    if (!payload) throw new Error(`Unexpected listCases response: ${JSON.stringify(res)}`);

    for (const item of payload.items || []) {
      if (item?.caseId) caseIds.push(item.caseId);
    }
    nextToken = payload.nextToken || null;
  } while (nextToken);

  return caseIds;
}

async function deleteCase(client, caseId) {
  const { errors } = await client.models.Case.delete(
    { caseId },
    { authMode: "iam" }
  );
  if (errors?.length) throw new Error(JSON.stringify(errors));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:
  node scripts/delete-cases-by-prefix.cjs [--prefix 2025_] [--outputs amplify_outputs.json] [--limit 1000] [--execute]

Behavior:
  - Default is DRY RUN (no deletes).
  - Add --execute to actually delete.
`);
    return;
  }

  try {
    ({ Amplify } = require("aws-amplify"));
    ({ generateClient } = require("aws-amplify/data"));
  } catch (_err) {
    throw new Error("Missing dependencies. Install with: npm install aws-amplify");
  }

  const cwd = process.cwd();
  const outputsPath = path.resolve(cwd, args.outputs);
  const outputs = loadJson(outputsPath);

  Amplify.configure(outputs);
  const client = generateClient();

  const caseIds = await listCaseIdsByPrefix(client, args.prefix, args.limit);
  console.log(`Matched ${caseIds.length} Case records with caseId prefix "${args.prefix}".`);

  if (caseIds.length === 0) return;

  for (const id of caseIds) {
    console.log(` - ${id}`);
  }

  if (!args.execute) {
    console.log("DRY RUN only. Re-run with --execute to delete these records.");
    return;
  }

  let deleted = 0;
  let failed = 0;
  for (const id of caseIds) {
    try {
      await deleteCase(client, id);
      deleted += 1;
      console.log(`DELETED: ${id}`);
    } catch (err) {
      failed += 1;
      console.error(`FAILED: ${id} -> ${err.message || String(err)}`);
    }
  }

  console.log(`Done. deleted=${deleted} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
