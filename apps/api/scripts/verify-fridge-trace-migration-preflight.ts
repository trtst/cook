import { Prisma, PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";

const migrationName = "20260924100000_low_maintenance_fridge_traces";

export function assertNoLegacyFridgeRows(counts: { fridgeItems: number; reservations: number }) {
  if (counts.fridgeItems > 0 || counts.reservations > 0) {
    throw new Error(
      `fridge trace migration preflight failed: fridge_items=${counts.fridgeItems}, shopping_item_fridge_reservations=${counts.reservations}; export and disposition legacy data before deploying`
    );
  }
}

export async function main() {
  loadLocalEnv();
  const prisma = new PrismaClient();
  try {
    const migrationTable = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
      SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS exists
    `);
    if (migrationTable[0]?.exists) {
      const applied = await prisma.$queryRaw<Array<{ applied: boolean }>>(Prisma.sql`
        SELECT EXISTS (
          SELECT 1 FROM "_prisma_migrations"
          WHERE "migration_name" = ${migrationName} AND "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL
        ) AS applied
      `);
      if (applied[0]?.applied) {
        console.log(`${migrationName} already applied; legacy-table preflight skipped`);
        return;
      }
    }

    const tables = await prisma.$queryRaw<Array<{ fridgeItems: string | null; reservations: string | null }>>(Prisma.sql`
      SELECT to_regclass('public.fridge_items')::text AS "fridgeItems",
        to_regclass('public.shopping_item_fridge_reservations')::text AS reservations
    `);
    const tableNames = tables[0];
    const [fridgeItems, reservations] = await Promise.all([
      tableNames?.fridgeItems
        ? prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`SELECT COUNT(*) AS count FROM "fridge_items"`)
        : Promise.resolve([{ count: 0 }]),
      tableNames?.reservations
        ? prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`SELECT COUNT(*) AS count FROM "shopping_item_fridge_reservations"`)
        : Promise.resolve([{ count: 0 }])
    ]);
    const counts = { fridgeItems: Number(fridgeItems[0]?.count ?? 0), reservations: Number(reservations[0]?.count ?? 0) };
    assertNoLegacyFridgeRows(counts);
    console.log(JSON.stringify(counts));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main();
}
