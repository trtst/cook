import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { SHOPPING_LIST_VOID_RETENTION_MS } from "./shopping-list-retention";

const CLEANUP_BATCH_SIZE = 100;
const MAX_CLEANUP_BATCHES_PER_RUN = 10;
const SHANGHAI_TIME_ZONE = "Asia/Shanghai";
const SHANGHAI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

@Injectable()
export class ShoppingListRetentionService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ShoppingListRetentionService.name);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    this.scheduleNextCleanup();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async cleanExpiredLists() {
    if (this.running) return;
    this.running = true;
    const cutoff = new Date(Date.now() - SHOPPING_LIST_VOID_RETENTION_MS);
    try {
      let deletedCount = 0;
      for (let batchNumber = 0; batchNumber < MAX_CLEANUP_BATCHES_PER_RUN; batchNumber += 1) {
        const batchCount = await this.cleanExpiredListsBatch(cutoff);
        deletedCount += batchCount;
        if (batchCount < CLEANUP_BATCH_SIZE) break;
      }

      if (deletedCount) this.logger.log(`Permanently deleted ${deletedCount} shopping lists past the 30-day void retention period.`);
    } catch (error) {
      this.logger.error("Failed to clean expired voided shopping lists.", error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }

  private async cleanExpiredListsBatch(cutoff: Date) {
    return this.prisma.$transaction(async tx => {
      const lock = await tx.$queryRaw<Array<{ acquired: boolean }>>(Prisma.sql`
        SELECT pg_try_advisory_xact_lock(20260926, 30030) AS acquired
      `);
      if (!lock[0]?.acquired) return 0;

      const expiredLists = await tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
        SELECT id
        FROM shopping_lists
        WHERE status = 'VOIDED' AND voided_at <= ${cutoff}
        ORDER BY voided_at ASC, id ASC
        LIMIT ${CLEANUP_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      `);
      const listIds = expiredLists.map(list => list.id);
      if (!listIds.length) return 0;

      await tx.shoppingItem.deleteMany({ where: { listId: { in: listIds } } });
      const result = await tx.shoppingList.deleteMany({
        where: { id: { in: listIds }, status: "VOIDED", voidedAt: { lte: cutoff } }
      });
      return result.count;
    }, { timeout: 30_000 });
  }

  private scheduleNextCleanup() {
    if (this.timer) clearTimeout(this.timer);
    const now = new Date();
    const localDate = new Intl.DateTimeFormat("en-US", {
      timeZone: SHANGHAI_TIME_ZONE,
      year: "numeric",
      month: "numeric",
      day: "numeric"
    }).formatToParts(now);
    const year = Number(localDate.find(part => part.type === "year")?.value);
    const month = Number(localDate.find(part => part.type === "month")?.value);
    const day = Number(localDate.find(part => part.type === "day")?.value);
    const nextMidnightUtc = Date.UTC(year, month - 1, day + 1) - SHANGHAI_UTC_OFFSET_MS;
    const delay = Math.max(1, nextMidnightUtc - now.getTime());

    this.timer = setTimeout(() => {
      void this.cleanExpiredLists();
      this.scheduleNextCleanup();
    }, delay);
    this.timer.unref();
  }
}
