import { Prisma, PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import type { RecipeAssistantSnapshot, RecipeAssistantStep } from "../src/contracts/types";

type RecipeAssistantSnapshotBody = Omit<RecipeAssistantSnapshot, "generatedAt">;

type ReadinessStatus = "READY" | "NEEDS_REVIEW";

type CandidateRecord = {
  id: number;
  recipeVersionId: number;
  candidateJson: unknown;
  updatedAt: Date;
};

type ReadySaveRecord = Pick<CandidateRecord, "id" | "recipeVersionId" | "candidateJson" | "updatedAt"> & {
  snapshotJson: RecipeAssistantSnapshotBody;
  generatedAt: Date;
};

export type RecipeWikiReadinessArgs = {
  apply: boolean;
  batchSize: number;
  limit: number | null;
};

export type RecipeWikiReadinessResult = {
  mode: "dry-run" | "apply";
  scannedCount: number;
  readyCount: number;
  needsReviewCount: number;
  appliedCount: number;
  concurrentChangeCount: number;
  blockingReasons: Record<string, number>;
  readyVersionIds: number[];
  needsReviewVersionIds: number[];
  concurrentChangeVersionIds: number[];
  nextStep: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPhase(value: unknown): value is RecipeAssistantStep["phase"] {
  return value === "PREP" || value === "COOK" || value === "SERVE";
}

function isValidText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function candidateBody(candidate: unknown): RecipeAssistantSnapshotBody | null {
  if (!isRecord(candidate) || !isRecord(candidate.summary) || !Array.isArray(candidate.steps)) return null;
  return {
    summary: candidate.summary as RecipeAssistantSnapshotBody["summary"],
    steps: candidate.steps as RecipeAssistantStep[]
  };
}

function stepReasons(step: unknown, index: number) {
  const reasons: string[] = [];
  const field = `steps.${index}`;
  if (!isRecord(step)) return [`${field} must be an object`];

  if (step.order !== index + 1) reasons.push(`${field}.order must be ${index + 1}`);
  if (!isPhase(step.phase)) reasons.push(`${field}.phase must be PREP, COOK or SERVE`);
  if (!isValidText(step.title)) reasons.push(`${field}.title is required`);
  if (!isValidText(step.detail)) reasons.push(`${field}.detail is required`);
  if (!(step.imageUrl === null || typeof step.imageUrl === "string")) {
    reasons.push(`${field}.imageUrl must be null or string`);
  }
  if (!Number.isInteger(step.durationMinutes) || Number(step.durationMinutes) <= 0) {
    reasons.push(`${field}.durationMinutes must be a positive integer`);
  }
  if (!(step.durationText === null || typeof step.durationText === "string")) {
    reasons.push(`${field}.durationText must be null or string`);
  }
  return reasons;
}

function summaryReasons(body: RecipeAssistantSnapshotBody) {
  const reasons: string[] = [];
  const summary = body.summary;
  const counts = {
    stepCount: body.steps.length,
    prepStepCount: body.steps.filter(step => step.phase === "PREP").length,
    cookStepCount: body.steps.filter(step => step.phase === "COOK").length,
    serveStepCount: body.steps.filter(step => step.phase === "SERVE").length
  };

  for (const [key, value] of Object.entries(counts)) {
    if (summary[key as keyof typeof counts] !== value) {
      reasons.push(`summary.${key} must match validated steps`);
    }
  }
  if (!(summary.totalDurationText === null || typeof summary.totalDurationText === "string")) {
    reasons.push("summary.totalDurationText must be null or string");
  }
  return reasons;
}

export function candidateReadiness(candidate: unknown): {
  status: ReadinessStatus;
  blockingReasons: string[];
  snapshotJson: RecipeAssistantSnapshotBody | null;
} {
  const body = candidateBody(candidate);
  if (!body) {
    return { status: "NEEDS_REVIEW", blockingReasons: ["candidate must include summary and steps"], snapshotJson: null };
  }

  const blockingReasons = body.steps.flatMap((step, index) => stepReasons(step, index));
  if (!body.steps.length) blockingReasons.push("steps must not be empty");
  blockingReasons.push(...summaryReasons(body));

  if (blockingReasons.length) {
    return { status: "NEEDS_REVIEW", blockingReasons, snapshotJson: null };
  }
  return { status: "READY", blockingReasons: [], snapshotJson: body };
}

function addBlockingReason(target: Record<string, number>, reasons: string[]) {
  for (const reason of reasons) {
    target[reason] = (target[reason] ?? 0) + 1;
  }
}

export async function backfillRecipeWikiReadiness(input: {
  apply: boolean;
  now: Date;
  records: CandidateRecord[];
  saveReady?: (record: ReadySaveRecord) => Promise<boolean>;
}): Promise<RecipeWikiReadinessResult> {
  let readyCount = 0;
  let needsReviewCount = 0;
  let appliedCount = 0;
  let concurrentChangeCount = 0;
  const blockingReasons: Record<string, number> = {};
  const readyVersionIds: number[] = [];
  const needsReviewVersionIds: number[] = [];
  const concurrentChangeVersionIds: number[] = [];

  for (const record of input.records) {
    const readiness = candidateReadiness(record.candidateJson);
    if (readiness.status === "READY" && readiness.snapshotJson) {
      readyCount += 1;
      if (readyVersionIds.length < 20) readyVersionIds.push(record.recipeVersionId);
      if (input.apply && input.saveReady) {
        const saved = await input.saveReady({
          id: record.id,
          recipeVersionId: record.recipeVersionId,
          candidateJson: record.candidateJson,
          updatedAt: record.updatedAt,
          snapshotJson: readiness.snapshotJson,
          generatedAt: input.now
        });
        if (saved) {
          appliedCount += 1;
        } else {
          concurrentChangeCount += 1;
          if (concurrentChangeVersionIds.length < 20) concurrentChangeVersionIds.push(record.recipeVersionId);
        }
      }
    } else {
      needsReviewCount += 1;
      if (needsReviewVersionIds.length < 20) needsReviewVersionIds.push(record.recipeVersionId);
      addBlockingReason(blockingReasons, readiness.blockingReasons);
    }
  }

  return {
    mode: input.apply ? "apply" : "dry-run",
    scannedCount: input.records.length,
    readyCount,
    needsReviewCount,
    appliedCount,
    concurrentChangeCount,
    blockingReasons,
    readyVersionIds,
    needsReviewVersionIds,
    concurrentChangeVersionIds,
    nextStep: input.apply
      ? concurrentChangeCount ? "Re-run with --apply for candidates changed during this run." : null
      : "Re-run with --apply to publish valid candidates as READY."
  };
}

function readPositiveNumberFlag(argv: string[], name: string) {
  const prefix = `${name}=`;
  const raw = argv.find(item => item.startsWith(prefix));
  if (!raw) return null;
  const value = Number(raw.slice(prefix.length));
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

export function parseRecipeWikiReadinessArgs(argv: string[]): RecipeWikiReadinessArgs {
  return {
    apply: argv.includes("--apply"),
    batchSize: readPositiveNumberFlag(argv, "--batch-size") ?? 100,
    limit: readPositiveNumberFlag(argv, "--limit")
  };
}

async function loadCandidates(prisma: PrismaClient, args: RecipeWikiReadinessArgs) {
  const records: CandidateRecord[] = [];
  let cursorId = 0;

  while (true) {
    const remaining = args.limit === null ? args.batchSize : Math.max(args.limit - records.length, 0);
    if (args.limit !== null && remaining === 0) break;

    const batch = await prisma.recipeCookAssistant.findMany({
      where: {
        id: { gt: cursorId },
        status: { not: "READY" },
        candidateJson: { not: Prisma.DbNull }
      },
      orderBy: { id: "asc" },
      take: Math.min(args.batchSize, remaining || args.batchSize),
      select: {
        id: true,
        recipeVersionId: true,
        candidateJson: true,
        updatedAt: true
      }
    });
    if (!batch.length) break;

    for (const record of batch) {
      cursorId = record.id;
      records.push(record);
    }
  }

  return records;
}

async function runCli() {
  loadLocalEnv();
  const prisma = new PrismaClient();
  const args = parseRecipeWikiReadinessArgs(process.argv.slice(2));
  const now = new Date();

  try {
    const records = await loadCandidates(prisma, args);
    const result = await backfillRecipeWikiReadiness({
      apply: args.apply,
      now,
      records,
      saveReady: async record => {
        const updated = await prisma.recipeCookAssistant.updateMany({
          where: {
            id: record.id,
            status: { not: "READY" },
            candidateJson: { equals: record.candidateJson as Prisma.InputJsonValue },
            updatedAt: record.updatedAt
          },
          data: {
            status: "READY",
            snapshotJson: record.snapshotJson as Prisma.InputJsonValue,
            generatedAt: record.generatedAt,
            lastAttemptAt: record.generatedAt,
            lastError: null
          }
        });
        return updated.count === 1;
      }
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void runCli().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
