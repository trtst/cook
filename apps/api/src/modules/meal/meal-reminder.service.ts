import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { MealSlot, Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { completeIdempotentOperation, getIdempotentResult, startIdempotentOperation } from "../../common/idempotency";
import type { MealReminderSummary, OperationId, UUID } from "../../contracts/types";

const REMINDER_LEAD_MS = 2 * 60 * 60 * 1000;
const REMINDER_EVENT_TYPE = "MEAL_REMINDER_SEND";
const REMINDER_SEND_LOCK = "meal-reminder-send";
const REMINDER_TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 20_000 };

type ReminderDb = Prisma.TransactionClient | PrismaService;

function planReferenceTime(planDate: Date, mealSlot: MealSlot) {
  const dateText = planDate.toISOString().slice(0, 10);
  const time = mealSlot === "BREAKFAST" ? "08:00:00"
    : mealSlot === "LUNCH" ? "12:00:00"
      : mealSlot === "AFTERNOON_TEA" ? "15:30:00"
        : mealSlot === "DINNER" ? "18:30:00" : "21:30:00";
  return new Date(`${dateText}T${time}+08:00`);
}

@Injectable()
export class MealReminderService {
  constructor(private readonly prisma: PrismaService) {}

  async getDiningEventReminder(userId: UUID, eventId: UUID): Promise<MealReminderSummary> {
    const event = await this.prisma.diningEvent.findUnique({
      where: { id: eventId },
      select: { id: true, userId: true, participants: { where: { userId, status: "ACCEPTED" }, select: { id: true } } }
    });
    if (!event || (event.userId !== userId && !event.participants.length)) throw new NotFoundException("饭局不存在");
    return this.readReminder(this.prisma, { userId, diningEventId: eventId });
  }

  async getMealPlanReminder(userId: UUID, planItemId: UUID): Promise<MealReminderSummary> {
    const plan = await this.prisma.mealPlanItem.findFirst({
      where: { id: planItemId, userId },
      select: { id: true, diningEvent: { select: { id: true } } }
    });
    if (!plan) throw new NotFoundException("计划不存在");
    if (plan.diningEvent) return this.getDiningEventReminder(userId, plan.diningEvent.id);
    return this.readReminder(this.prisma, { userId, mealPlanItemId: planItemId });
  }

  async subscribeDiningEvent(userId: UUID, eventId: UUID, operationId: OperationId): Promise<MealReminderSummary> {
    return this.prisma.$transaction(async tx => {
      const requestHash = String(eventId);
      const repeated = await getIdempotentResult<MealReminderSummary>(tx, operationId, "meal-reminder:event", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "meal-reminder:event", userId, null, requestHash);

      await tx.$queryRaw`SELECT "id" FROM "dining_events" WHERE "id" = ${eventId} FOR UPDATE`;
      const event = await tx.diningEvent.findUnique({
        where: { id: eventId },
        select: { id: true, userId: true, scheduledAt: true, status: true, participants: { where: { userId, status: "ACCEPTED" }, select: { id: true } } }
      });
      if (!event || (event.userId !== userId && !event.participants.length)) throw new NotFoundException("饭局不存在");
      if (event.status === "CANCELLED" || event.status === "COMPLETED") throw new ConflictException("当前饭局已结束，不能预约提醒");
      await this.assertWechatIdentity(tx, userId);
      const scheduledAt = new Date(event.scheduledAt.getTime() - REMINDER_LEAD_MS);
      this.assertEnoughLeadTime(scheduledAt);
      const result = await this.saveReminder(tx, { userId, diningEventId: eventId, scheduledAt });
      await completeIdempotentOperation(tx, operationId, "meal-reminder:event", userId, null, requestHash, result);
      return result;
    }, REMINDER_TRANSACTION_OPTIONS);
  }

  async subscribeMealPlan(userId: UUID, planItemId: UUID, operationId: OperationId): Promise<MealReminderSummary> {
    return this.prisma.$transaction(async tx => {
      const requestHash = String(planItemId);
      const repeated = await getIdempotentResult<MealReminderSummary>(tx, operationId, "meal-reminder:plan", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "meal-reminder:plan", userId, null, requestHash);

      await tx.$queryRaw`SELECT "id" FROM "meal_plan_items" WHERE "id" = ${planItemId} FOR UPDATE`;
      const plan = await tx.mealPlanItem.findFirst({
        where: { id: planItemId, userId },
        select: { id: true, planDate: true, mealSlot: true, status: true, diningEvent: { select: { id: true } } }
      });
      if (!plan) throw new NotFoundException("计划不存在");
      if (plan.diningEvent) throw new ConflictException("请在饭局详情中预约提醒");
      if (plan.status !== "PLANNED") throw new ConflictException("当前计划已结束，不能预约提醒");
      await this.assertWechatIdentity(tx, userId);
      const scheduledAt = new Date(planReferenceTime(plan.planDate, plan.mealSlot).getTime() - REMINDER_LEAD_MS);
      this.assertEnoughLeadTime(scheduledAt);
      const result = await this.saveReminder(tx, { userId, mealPlanItemId: planItemId, scheduledAt });
      await completeIdempotentOperation(tx, operationId, "meal-reminder:plan", userId, null, requestHash, result);
      return result;
    }, REMINDER_TRANSACTION_OPTIONS);
  }

  async movePlanReminderToEvent(tx: Prisma.TransactionClient, userId: UUID, planItemId: UUID, eventId: UUID, eventAt: Date) {
    await this.lockReminderSend(tx);
    const current = await tx.mealReminder.findUnique({ where: { userId_mealPlanItemId: { userId, mealPlanItemId: planItemId } } });
    if (!current || current.status !== "PENDING") return;
    const scheduledAt = new Date(eventAt.getTime() - REMINDER_LEAD_MS);
    if (scheduledAt <= new Date()) {
      await this.deletePending(tx, current.id);
      return;
    }
    await tx.mealReminder.update({
      where: { id: current.id },
      data: { mealPlanItemId: null, diningEventId: eventId, scheduledAt, lastError: null }
    });
    await tx.outboxEvent.updateMany({
      where: { eventType: REMINDER_EVENT_TYPE, aggregateId: current.id, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "PENDING", nextRunAt: scheduledAt, retryCount: 0, lastError: null }
    });
  }

  async rescheduleEventReminder(tx: Prisma.TransactionClient, eventId: UUID, eventAt: Date) {
    await this.lockReminderSend(tx);
    const reminders = await tx.mealReminder.findMany({ where: { diningEventId: eventId, status: "PENDING" }, select: { id: true } });
    const scheduledAt = new Date(eventAt.getTime() - REMINDER_LEAD_MS);
    for (const reminder of reminders) {
      if (scheduledAt <= new Date()) {
        await this.deletePending(tx, reminder.id);
        continue;
      }
      await tx.mealReminder.update({ where: { id: reminder.id }, data: { scheduledAt, lastError: null } });
      await tx.outboxEvent.updateMany({
        where: { eventType: REMINDER_EVENT_TYPE, aggregateId: reminder.id, status: { in: ["PENDING", "PROCESSING"] } },
        data: { status: "PENDING", nextRunAt: scheduledAt, retryCount: 0, lastError: null }
      });
    }
  }

  async clearTarget(tx: Prisma.TransactionClient, target: { mealPlanItemId?: UUID; diningEventId?: UUID }) {
    await this.lockReminderSend(tx);
    const reminders = await tx.mealReminder.findMany({
      where: { ...target, status: "PENDING" },
      select: { id: true }
    });
    for (const reminder of reminders) await this.deletePending(tx, reminder.id);
  }

  private async readReminder(db: ReminderDb, where: { userId: UUID; mealPlanItemId?: UUID; diningEventId?: UUID }): Promise<MealReminderSummary> {
    const reminder = await db.mealReminder.findFirst({ where, select: { status: true, scheduledAt: true } });
    if (!reminder) return { status: "NOT_SCHEDULED", scheduledAt: null };
    return { status: reminder.status === "PENDING" ? "SCHEDULED" : reminder.status, scheduledAt: reminder.scheduledAt.toISOString() };
  }

  private async saveReminder(
    tx: Prisma.TransactionClient,
    input: { userId: UUID; mealPlanItemId?: UUID; diningEventId?: UUID; scheduledAt: Date }
  ): Promise<MealReminderSummary> {
    await this.lockReminderSend(tx);
    const where = input.diningEventId
      ? { userId_diningEventId: { userId: input.userId, diningEventId: input.diningEventId } }
      : { userId_mealPlanItemId: { userId: input.userId, mealPlanItemId: input.mealPlanItemId! } };
    const current = await tx.mealReminder.findUnique({ where });
    if (current?.status === "SENT") return { status: "SENT", scheduledAt: current.scheduledAt.toISOString() };
    const reminder = current
      ? await tx.mealReminder.update({
          where: { id: current.id },
          data: { status: "PENDING", acceptedAt: new Date(), scheduledAt: input.scheduledAt, sentAt: null, lastError: null }
        })
      : await tx.mealReminder.create({ data: { ...input, status: "PENDING", acceptedAt: new Date() } });
    await tx.outboxEvent.deleteMany({
      where: { eventType: REMINDER_EVENT_TYPE, aggregateId: reminder.id, status: { in: ["PENDING", "PROCESSING", "FAILED"] } }
    });
    await tx.outboxEvent.create({
      data: {
        eventType: REMINDER_EVENT_TYPE,
        aggregateType: "MEAL_REMINDER",
        aggregateId: reminder.id,
        payload: { reminderId: reminder.id },
        nextRunAt: input.scheduledAt
      }
    });
    return { status: "SCHEDULED", scheduledAt: reminder.scheduledAt.toISOString() };
  }

  private async deletePending(tx: Prisma.TransactionClient, reminderId: number) {
    await tx.outboxEvent.deleteMany({
      where: { eventType: REMINDER_EVENT_TYPE, aggregateId: reminderId, status: { in: ["PENDING", "PROCESSING", "FAILED"] } }
    });
    await tx.mealReminder.deleteMany({ where: { id: reminderId, status: "PENDING" } });
  }

  private async lockReminderSend(tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${REMINDER_SEND_LOCK}, 0))`;
  }

  private assertEnoughLeadTime(scheduledAt: Date) {
    if (scheduledAt <= new Date()) throw new ConflictException("距离开饭不足 2 小时，无法安排提前提醒");
  }

  private async assertWechatIdentity(db: Prisma.TransactionClient, userId: UUID) {
    const appId = process.env.WECHAT_APP_ID?.trim();
    if (!appId) throw new ServiceUnavailableException("微信提醒服务暂不可用");
    const identity = await db.userWechatIdentity.findUnique({ where: { userId_appid: { userId, appid: appId } }, select: { id: true } });
    if (!identity) throw new ConflictException("当前微信账号未完成关联，暂不能预约微信提醒");
  }
}
