#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";

function usage() {
  console.error("Usage: node scripts/import-case-tags.mjs <path-to-json-file>");
}

function loadJson(filePath, label) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to read ${label} at ${filePath}: ${error.message}`);
  }
}

function normalizeAndValidateCaseTags(input) {
  if (!Array.isArray(input)) {
    throw new Error("Input file must contain a JSON array");
  }

  const seen = new Set();
  const rows = [];

  for (let i = 0; i < input.length; i += 1) {
    const row = input[i];
    const where = `entry ${i}`;

    if (!row || typeof row !== "object") {
      throw new Error(`${where} must be an object`);
    }

    const { caseId, tagId } = row;

    if (typeof caseId !== "string" || caseId.trim() === "") {
      throw new Error(`${where} has invalid caseId`);
    }

    if (typeof tagId !== "string" || tagId.trim() === "") {
      throw new Error(`${where} has invalid tagId`);
    }

    const normalized = {
      caseId: caseId.trim(),
      tagId: tagId.trim(),
    };

    const key = `${normalized.caseId}::${normalized.tagId}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    rows.push(normalized);
  }

  return rows.sort((a, b) => {
    if (a.caseId === b.caseId) {
      return a.tagId.localeCompare(b.tagId);
    }
    return a.caseId.localeCompare(b.caseId);
  });
}

function isExistingRecordError(error) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("conditional") || message.includes("already exists") || message.includes("duplicate")) {
    return true;
  }

  const errors = error?.errors;
  if (Array.isArray(errors)) {
    return errors.some((e) => {
      const m = String(e?.message || "").toLowerCase();
      return m.includes("conditional") || m.includes("already exists") || m.includes("duplicate");
    });
  }

  return false;
}

async function main() {
  const inputArg = process.argv[2];
  if (!inputArg) {
    usage();
    process.exit(1);
  }

  const cwd = process.cwd();
  const inputPath = path.resolve(cwd, inputArg);
  const amplifyOutputsPath = path.resolve(cwd, "amplify_outputs.json");

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  if (!fs.existsSync(amplifyOutputsPath)) {
    throw new Error(`amplify_outputs.json not found at: ${amplifyOutputsPath}`);
  }

  const amplifyOutputs = loadJson(amplifyOutputsPath, "Amplify outputs");
  const caseTagsRaw = loadJson(inputPath, "CaseTag input");
  const caseTags = normalizeAndValidateCaseTags(caseTagsRaw);

  Amplify.configure(amplifyOutputs);
  const client = generateClient();

  let created = 0;
  let skippedExisting = 0;
  let failed = 0;

  for (const row of caseTags) {
    try {
      await client.models.CaseTag.create(
        {
          caseId: row.caseId,
          tagId: row.tagId,
        },
        { authMode: "iam" },
      );
      created += 1;
    } catch (error) {
      if (isExistingRecordError(error)) {
        skippedExisting += 1;
        continue;
      }

      failed += 1;
      const details = error?.errors?.map((e) => e?.message).filter(Boolean).join(" | ") || error?.message || String(error);
      console.error(`CREATE_FAILED ${row.caseId} ${row.tagId}: ${details}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        inputFile: inputPath,
        totalInput: Array.isArray(caseTagsRaw) ? caseTagsRaw.length : 0,
        uniqueProcessed: caseTags.length,
        created,
        skippedExisting,
        failed,
      },
      null,
      2,
    ),
  );

  if (failed > 0) {
    process.exit(2);
  }
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
