import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient, type IngredientStatus } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";

type IngredientFacts = {
  isStaple: boolean;
  isSpicyIngredient: boolean;
};

type SystemIngredientSnapshot = {
  id: number;
  name: string;
  status: IngredientStatus;
  categoryId: number;
  categoryCode: string;
  isStaple: boolean;
  isSpicyIngredient: boolean;
};

export type IngredientTagFactsReviewRow = {
  id: number;
  name: string;
  status: IngredientStatus;
  categoryCode: string;
  expected: IngredientFacts;
  confirmed: { isStaple: boolean | null; isSpicyIngredient: boolean | null };
};

type ReviewFile = {
  schemaVersion: "ingredient.tag-facts-review.v1";
  rows: IngredientTagFactsReviewRow[];
};

function readFlag(name: string) {
  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function readApplyFlag() {
  return process.argv.includes("--apply");
}

function isFacts(value: unknown): value is IngredientFacts {
  if (!value || typeof value !== "object") return false;
  const facts = value as Record<string, unknown>;
  return typeof facts.isStaple === "boolean" && typeof facts.isSpicyIngredient === "boolean";
}

export function validateIngredientTagFactsReview(
  currentRows: SystemIngredientSnapshot[],
  reviewRows: IngredientTagFactsReviewRow[]
) {
  if (reviewRows.length !== currentRows.length) {
    throw new Error(`食材数量不匹配：数据库 ${currentRows.length} 条，核对文件 ${reviewRows.length} 条`);
  }

  const currentById = new Map(currentRows.map((row) => [row.id, row]));
  const reviewById = new Map<number, IngredientTagFactsReviewRow>();
  for (const row of reviewRows) {
    if (reviewById.has(row.id)) throw new Error(`重复食材 ID：${row.id}`);
    if (!Number.isInteger(row.id) || !isFacts(row.expected) || !isFacts(row.confirmed)) {
      throw new Error(`食材 ${row.id} 必须填写完整且明确的两个布尔属性`);
    }
    reviewById.set(row.id, row);
  }

  const changes: Array<{ id: number; isStaple: boolean; isSpicyIngredient: boolean }> = [];
  for (const current of currentRows) {
    const review = reviewById.get(current.id);
    if (!review) throw new Error(`核对文件缺少系统食材 ID：${current.id}`);
    if (review.name !== current.name || review.status !== current.status || review.categoryCode !== current.categoryCode) {
      throw new Error(`食材快照已变化，请重新导出并核对：${current.id} ${current.name}`);
    }

    const currentFacts = {
      isStaple: current.isStaple,
      isSpicyIngredient: current.isSpicyIngredient
    };
    const matchesExpected =
      currentFacts.isStaple === review.expected.isStaple &&
      currentFacts.isSpicyIngredient === review.expected.isSpicyIngredient;
    const matchesConfirmed =
      currentFacts.isStaple === review.confirmed.isStaple &&
      currentFacts.isSpicyIngredient === review.confirmed.isSpicyIngredient;
    if (!matchesExpected && !matchesConfirmed) throw new Error(`属性值已变化，请重新核对：${current.id} ${current.name}`);

    if (!matchesConfirmed) {
      changes.push({ id: current.id, ...review.confirmed });
    }
  }
  return changes;
}

async function main() {
  const exportPath = readFlag("--export");
  const filePath = readFlag("--file");
  if (exportPath && (filePath || readApplyFlag())) throw new Error("--export 不能与 --file 或 --apply 同时使用");
  if (!exportPath && !filePath) throw new Error("必须提供 --export=<path> 或 --file=<ingredient.tag-facts-review.v1.json>");

  loadLocalEnv();
  const prisma = new PrismaClient();
  try {
    const currentRows = await prisma.ingredient.findMany({
      where: { ownerId: null },
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        categoryId: true,
        isStaple: true,
        isSpicyIngredient: true,
        category: { select: { code: true } }
      }
    });
    const snapshots = currentRows.map(({ category, ...row }) => ({ ...row, categoryCode: category.code }));
    if (exportPath) {
      const reviewFile: ReviewFile = {
        schemaVersion: "ingredient.tag-facts-review.v1",
        rows: snapshots.map((row) => ({
          id: row.id,
          name: row.name,
          status: row.status,
          categoryCode: row.categoryCode,
          expected: {
            isStaple: row.isStaple,
            isSpicyIngredient: row.isSpicyIngredient
          },
          confirmed: { isStaple: null, isSpicyIngredient: null }
        }))
      };
      writeFileSync(exportPath, `${JSON.stringify(reviewFile, null, 2)}\n`, "utf8");
      console.log(JSON.stringify({ mode: "export", systemIngredientCount: currentRows.length, exportPath }, null, 2));
      return;
    }

    const reviewFile = JSON.parse(readFileSync(filePath!, "utf8")) as ReviewFile;
    if (reviewFile.schemaVersion !== "ingredient.tag-facts-review.v1" || !Array.isArray(reviewFile.rows)) {
      throw new Error("核对文件必须使用 ingredient.tag-facts-review.v1 格式");
    }
    const changes = validateIngredientTagFactsReview(snapshots, reviewFile.rows);
    const apply = readApplyFlag();
    if (apply && changes.length > 0) {
      const currentById = new Map(currentRows.map((row) => [row.id, row]));
      for (let index = 0; index < changes.length; index += 100) {
        const batch = changes.slice(index, index + 100);
        await prisma.$transaction(async (tx) => {
          for (const change of batch) {
            const review = reviewFile.rows.find((row) => row.id === change.id)!;
            const source = currentById.get(change.id)!;
            const result = await tx.$executeRaw`
              UPDATE "ingredients"
              SET "is_staple" = ${change.isStaple}, "is_spicy_ingredient" = ${change.isSpicyIngredient}
              WHERE "id" = ${change.id}
                AND "owner_id" IS NULL
                AND "name" = ${review.name}
                AND "category_id" = ${source.categoryId}
                AND "is_staple" = ${review.expected.isStaple}
                AND "is_spicy_ingredient" = ${review.expected.isSpicyIngredient}
            `;
            if (result !== 1) throw new Error(`写入前食材已变化，当前批次已回滚：${change.id}`);
          }
        });
      }

      const savedRows = await prisma.ingredient.findMany({
        where: { ownerId: null },
        orderBy: { id: "asc" },
        select: {
          id: true,
          name: true,
          status: true,
          isStaple: true,
          isSpicyIngredient: true,
          category: { select: { code: true } }
        }
      });
      const savedById = new Map(savedRows.map((row) => [row.id, row]));
      for (const row of reviewFile.rows) {
        const saved = savedById.get(row.id);
        if (
          !saved ||
          saved.name !== row.name ||
          saved.status !== row.status ||
          saved.category.code !== row.categoryCode ||
          saved.isStaple !== row.confirmed.isStaple ||
          saved.isSpicyIngredient !== row.confirmed.isSpicyIngredient
        ) {
          throw new Error(`数据库回读未匹配核对结果：${row.id} ${row.name}`);
        }
      }
    }

    console.log(JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      systemIngredientCount: currentRows.length,
      confirmedCount: reviewFile.rows.length,
      changedCount: changes.length,
      updatedCount: apply ? changes.length : 0,
      sampleChangedIds: changes.slice(0, 20).map((row) => row.id)
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
