import { createHash, randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, type MealSlot } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { completeIdempotentOperation, getIdempotentResult, startIdempotentOperation } from "../../common/idempotency";
import { removeStorageLedger, sizeOfJson, upsertStorageLedger } from "../../common/storage-ledger";
import type {
  DiningMemorySharePreview,
  DiningMemoryShareSnapshot,
  DiningEventParticipantSummary,
  DiningEventSummary,
  DiningGroupActivitySummary,
  MealPlanSummary,
  MealPollDetail,
  MealPollSummary,
  OperationId,
  PageResult,
  RecipeContentSnapshot,
  SharePreviewResponse,
  UUID
} from "../../contracts/types";
import { EntitlementService } from "../entitlement/entitlement.service";
import { fromJson, toJson, versionToContent } from "../recipe/recipe-content";
import { MedalService } from "../user/medal.service";

type MealPlanRow = Prisma.MealPlanItemGetPayload<{
  include: {
    diningEvent: true;
  };
}>;

type DiningEventRow = Prisma.DiningEventGetPayload<{
  include: {
    user: { select: { uid: true; nickname: true; avatarUrl: true } };
    mealPlanItem: { select: { planDate: true; mealSlot: true } };
    participants: {
      include: {
        user: { select: { uid: true; nickname: true; avatarUrl: true } };
        bringRecipe: true;
      };
    };
    menuItems: {
      include: {
        cookUser: { select: { uid: true; nickname: true } };
        recipeVersion: {
          include: {
            currentRecipes: {
              select: { id: true; coverImageUrl: true };
              take: 1;
            };
          };
        };
      };
    };
  };
}>;

type MealPollSummaryRow = Prisma.MealPollGetPayload<{
  include: {
    _count: { select: { candidates: true; responses: true } };
  };
}>;

type MealPollDetailRow = Prisma.MealPollGetPayload<{
  include: {
    createdBy: { select: { uid: true; nickname: true } };
    candidates: {
      include: {
        suggestedBy: { select: { uid: true } };
        recipeVersion: {
          include: {
            currentRecipes: {
              select: { id: true; coverImageUrl: true };
              take: 1;
            };
          };
        };
        _count: { select: { responseItems: true } };
      };
    };
    responses: {
      include: {
        user: { select: { uid: true } };
        items: {
          include: {
            candidate: { select: { id: true; sourceType: true } };
          };
        };
      };
    };
    _count: { select: { candidates: true; responses: true } };
  };
}>;

type ActivityRow = Prisma.DiningGroupActivityGetPayload<{
  include: {
    actor: { select: { uid: true; nickname: true } };
  };
}>;

type DiningEventMemoryShareRow = Prisma.DiningEventMemoryShareGetPayload<{}>;

type MealDb = Prisma.TransactionClient | PrismaService;

type ResolvedMenuVersion = {
  recipeId: UUID | null;
  recipeVersionId: UUID;
  coverUrl: string | null;
  title: string;
  content: RecipeContentSnapshot;
};

type DiningMemoryShareMenuItemSnapshot = {
  title: string;
  coverUrl: string | null;
  cookName: string | null;
};

type DiningMemoryShareParticipantSnapshot = {
  displayName: string;
  avatarUrl: string | null;
  role: "ORGANIZER" | "PARTICIPANT" | "GUEST";
};

const activeMemberStatuses = ["ACTIVE", "RESTRICTED"] as const;
const groupManagerRoles = ["OWNER", "ADMIN"] as const;

function toIsoDate(value: Date) {
  return value.toISOString();
}

function hashText(value: string | number) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function createShareToken() {
  return randomBytes(24).toString("base64url");
}

function buildMemorySharePath(shareToken: string) {
  return `/pages_share/memory/index?token=${encodeURIComponent(shareToken)}`;
}

function parseDateOnly(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException("计划日期格式错误");
  return parsed;
}

function parseDateTime(value: string, message = "时间格式错误") {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException(message);
  return parsed;
}

function normalizeMealSlot(value: string): MealSlot {
  if (value !== "BREAKFAST" && value !== "LUNCH" && value !== "DINNER") {
    throw new BadRequestException("餐次参数错误");
  }
  return value;
}

function normalizeEventStatus(value: string) {
  if (value !== "ACCEPTED" && value !== "DECLINED") {
    throw new BadRequestException("参与状态参数错误");
  }
  return value;
}

function normalizeCookAction(value: string) {
  if (value !== "CLAIM" && value !== "RELEASE") {
    throw new BadRequestException("掌勺操作参数错误");
  }
  return value;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function toPositiveInt(value: number | string | undefined, fallback: number) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildMealPollTitle(planDate: string, mealSlot: MealSlot) {
  const label = mealSlot === "BREAKFAST" ? "早餐" : mealSlot === "LUNCH" ? "午餐" : "晚餐";
  return `${planDate} ${label}吃什么`;
}

function buildMenuTitle(titles: string[]) {
  if (!titles.length) return "本餐菜单";
  if (titles.length === 1) return titles[0];
  return `${titles[0]}等${titles.length}道菜`;
}

function buildFallbackScheduledAt(planDate: string, mealSlot: MealSlot) {
  const time = mealSlot === "BREAKFAST" ? "08:00:00" : mealSlot === "LUNCH" ? "12:00:00" : "18:30:00";
  return new Date(`${planDate}T${time}+08:00`);
}

function buildMenuSnapshot(menuItems: ResolvedMenuVersion[]): RecipeContentSnapshot {
  const first = menuItems[0];
  if (!first) throw new BadRequestException("最终菜单不能为空");
  if (menuItems.length === 1) return first.content;

  const estimatedCalories = menuItems.reduce((sum, item) => sum + (item.content.estimatedCalories ?? 0), 0);
  return {
    name: buildMenuTitle(menuItems.map(item => item.content.name)),
    story: null,
    baseServings: first.content.baseServings,
    difficulty: first.content.difficulty,
    duration: first.content.duration,
    estimatedCalories: estimatedCalories > 0 ? estimatedCalories : null,
    tips: null,
    ingredients: menuItems.flatMap(item => item.content.ingredients),
    steps: []
  };
}

function isActiveMemberStatus(status: string) {
  return activeMemberStatuses.includes(status as (typeof activeMemberStatuses)[number]);
}

@Injectable()
export class MealService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EntitlementService) private readonly entitlementService: EntitlementService,
    @Inject(MedalService) private readonly medalService: MedalService
  ) {}

  async listMealPlans(userId: UUID, page: number, pageSize: number, from?: string, to?: string): Promise<PageResult<MealPlanSummary>> {
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where: Prisma.MealPlanItemWhereInput = {
      userId,
      ...(from || to
        ? {
            planDate: {
              ...(from ? { gte: parseDateOnly(from) } : {}),
              ...(to ? { lte: parseDateOnly(to) } : {})
            }
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.mealPlanItem.findMany({
        where,
        include: {
          diningEvent: true
        },
        orderBy: [{ planDate: "asc" }, { mealSlot: "asc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.mealPlanItem.count({ where })
    ]);

    return {
      items: items.map(item => this.toMealPlanSummary(item)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async listMealPolls(
    userId: UUID,
    diningGroupId: UUID,
    status?: string,
    planDate?: string,
    mealSlot?: string,
    limit?: number
  ): Promise<MealPollSummary[]> {
    await this.requireActiveMembership(this.prisma, userId, diningGroupId);
    const normalizedLimit = Math.min(toPositiveInt(limit, 20), 20);
    const where: Prisma.MealPollWhereInput = {
      diningGroupId,
      ...(status ? { status: status as "OPEN" | "CLOSED" | "CONFIRMED" | "COMPLETED" } : {}),
      ...(planDate ? { planDate: parseDateOnly(planDate) } : {}),
      ...(mealSlot ? { mealSlot: normalizeMealSlot(mealSlot) } : {})
    };
    const polls = await this.prisma.mealPoll.findMany({
      where,
      include: {
        _count: {
          select: {
            candidates: true,
            responses: true
          }
        }
      },
      orderBy: [{ planDate: "desc" }, { createdAt: "desc" }],
      take: normalizedLimit
    });
    return polls.map(item => this.toMealPollSummary(item));
  }

  async createMealPoll(
    userId: UUID,
    operationId: OperationId,
    diningGroupId: UUID,
    planDate: string,
    mealSlot: string,
    deadlineAt: string,
    choiceLimit: number,
    note: string | null,
    candidateRecipeVersionIds: UUID[]
  ): Promise<MealPollDetail> {
    const normalizedSlot = normalizeMealSlot(mealSlot);
    const normalizedPlanDate = parseDateOnly(planDate);
    const normalizedDeadline = parseDateTime(deadlineAt, "征集截止时间格式错误");
    const normalizedNote = normalizeOptionalText(note);
    const uniqueVersionIds = Array.from(new Set(candidateRecipeVersionIds));
    const requestHash = JSON.stringify({
      diningGroupId,
      planDate,
      mealSlot: normalizedSlot,
      deadlineAt: normalizedDeadline.toISOString(),
      choiceLimit,
      note: normalizedNote,
      candidateRecipeVersionIds: uniqueVersionIds
    });

    try {
      return await this.prisma.$transaction(async tx => {
        const membership = await this.requireManagerMembership(tx, userId, diningGroupId);
        if (normalizedDeadline <= new Date()) throw new BadRequestException("征集截止时间必须晚于当前时间");

        const repeated = await getIdempotentResult<MealPollDetail>(tx, operationId, "meal-poll:create", userId, diningGroupId, requestHash);
        if (repeated) return repeated;
        await startIdempotentOperation(tx, operationId, "meal-poll:create", userId, diningGroupId, requestHash);

        const existing = await tx.mealPoll.findUnique({
          where: {
            diningGroupId_planDate_mealSlot: {
              diningGroupId,
              planDate: normalizedPlanDate,
              mealSlot: normalizedSlot
            }
          }
        });
        if (existing) {
          throw new ConflictException("该饭搭子当前餐次已存在征集");
        }

        const candidateVersions = await this.resolveMenuVersions(tx, uniqueVersionIds);
        const poll = await tx.mealPoll.create({
          data: {
            diningGroupId,
            createdByUserId: membership.userId,
            planDate: normalizedPlanDate,
            mealSlot: normalizedSlot,
            deadlineAt: normalizedDeadline,
            choiceLimit,
            note: normalizedNote,
            candidates: {
              create: candidateVersions.map(item => ({
                recipeVersionId: item.recipeVersionId,
                title: item.title,
                sourceType: "RECIPE",
                status: "ACTIVE"
              }))
            }
          },
          select: { id: true }
        });

        await this.writeActivity(tx, {
          diningGroupId,
          kind: "POLL_OPENED",
          state: "PENDING",
          actorUserId: userId,
          title: buildMealPollTitle(planDate, normalizedSlot),
          detail: normalizedNote,
          pollId: poll.id,
          dedupeKey: `poll-opened:${poll.id}`
        });

        const result = await this.getMealPoll(userId, poll.id, tx);
        await completeIdempotentOperation(tx, operationId, "meal-poll:create", userId, diningGroupId, requestHash, result);
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("该饭搭子当前餐次已存在征集");
      }
      throw error;
    }
  }

  async getMealPoll(userId: UUID, pollId: UUID, db: MealDb = this.prisma): Promise<MealPollDetail> {
    const poll = await db.mealPoll.findUnique({
      where: { id: pollId },
      include: {
        createdBy: { select: { uid: true, nickname: true } },
        candidates: {
          include: {
            suggestedBy: { select: { uid: true } },
            recipeVersion: {
              include: {
                currentRecipes: {
                  select: { id: true, coverImageUrl: true },
                  take: 1
                }
              }
            },
            _count: {
              select: { responseItems: true }
            }
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }]
        },
        responses: {
          include: {
            user: { select: { uid: true } },
            items: {
              include: {
                candidate: { select: { id: true, sourceType: true } }
              }
            }
          },
          orderBy: { respondedAt: "desc" }
        },
        _count: {
          select: {
            candidates: true,
            responses: true
          }
        }
      }
    });
    if (!poll) throw new NotFoundException("征集不存在");
    await this.requireActiveMembership(db, userId, poll.diningGroupId);
    return this.toMealPollDetail(poll);
  }

  async voteMealPoll(
    userId: UUID,
    pollId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    selectedCandidateIds: UUID[],
    suggestionTitle: string | null,
    note: string | null
  ): Promise<MealPollDetail> {
    const uniqueCandidateIds = Array.from(new Set(selectedCandidateIds));
    const normalizedSuggestion = normalizeOptionalText(suggestionTitle);
    const normalizedNote = normalizeOptionalText(note);
    const requestHash = JSON.stringify({
      pollId,
      expectedVersion,
      selectedCandidateIds: uniqueCandidateIds,
      suggestionTitle: normalizedSuggestion,
      note: normalizedNote
    });

    return this.prisma.$transaction(async tx => {
      const poll = await tx.mealPoll.findUnique({
        where: { id: pollId }
      });
      if (!poll) throw new NotFoundException("征集不存在");

      const membership = await this.requireActiveMembership(tx, userId, poll.diningGroupId);
      if (poll.status !== "OPEN") throw new ConflictException("当前征集已关闭");
      if (poll.deadlineAt <= new Date()) throw new ConflictException("当前征集已截止");
      if (poll.version !== expectedVersion) throw new ConflictException("征集已被更新，请刷新后重试");
      if (uniqueCandidateIds.length > poll.choiceLimit) throw new BadRequestException("超过当前征集允许选择的菜数");
      if (!uniqueCandidateIds.length && !normalizedSuggestion) {
        throw new BadRequestException("至少选择一道菜或补充一道建议菜");
      }

      const repeated = await getIdempotentResult<MealPollDetail>(tx, operationId, "meal-poll:vote", userId, poll.diningGroupId, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "meal-poll:vote", userId, poll.diningGroupId, requestHash);

      const candidates = await tx.mealPollCandidate.findMany({
        where: {
          pollId,
          id: { in: uniqueCandidateIds },
          status: "ACTIVE"
        }
      });
      if (candidates.length !== uniqueCandidateIds.length) {
        throw new BadRequestException("存在无效候选菜");
      }

      const locked = await tx.mealPoll.updateMany({
        where: {
          id: poll.id,
          version: expectedVersion,
          status: "OPEN"
        },
        data: {
          version: { increment: 1 }
        }
      });
      if (locked.count !== 1) throw new ConflictException("征集已被更新，请刷新后重试");

      const existing = await tx.mealPollResponse.findUnique({
        where: {
          pollId_userId: {
            pollId,
            userId
          }
        },
        include: {
          items: {
            include: {
              candidate: true
            }
          }
        }
      });

      if (existing) {
        const removableSuggestionIds = existing.items
          .filter(item => item.candidate.sourceType === "SUGGESTION" && item.candidate.suggestedByUserId === userId)
          .map(item => item.candidateId);
        await tx.mealPollResponseItem.deleteMany({
          where: { responseId: existing.id }
        });
        if (removableSuggestionIds.length) {
          await tx.mealPollCandidate.deleteMany({
            where: {
              id: { in: removableSuggestionIds },
              pollId,
              sourceType: "SUGGESTION",
              suggestedByUserId: userId
            }
          });
        }
      }

      const response = existing
        ? await tx.mealPollResponse.update({
            where: { id: existing.id },
            data: {
              note: normalizedNote,
              respondedAt: new Date()
            }
          })
        : await tx.mealPollResponse.create({
            data: {
              pollId,
              userId,
              note: normalizedNote,
              respondedAt: new Date()
            }
          });

      let suggestionCandidateId: UUID | null = null;
      if (normalizedSuggestion) {
        const suggestionCandidate = await tx.mealPollCandidate.create({
          data: {
            pollId,
            recipeVersionId: null,
            title: normalizedSuggestion,
            sourceType: "SUGGESTION",
            status: "PENDING",
            suggestedByUserId: userId
          }
        });
        suggestionCandidateId = suggestionCandidate.id;
      }

      await tx.mealPollResponseItem.createMany({
        data: [...uniqueCandidateIds, ...(suggestionCandidateId ? [suggestionCandidateId] : [])].map(candidateId => ({
          responseId: response.id,
          candidateId
        }))
      });

      await this.writeActivity(tx, {
        diningGroupId: poll.diningGroupId,
        kind: "POLL_VOTED",
        state: "DONE",
        actorUserId: membership.userId,
        title: `${membership.userId === poll.createdByUserId ? "主理人" : "成员"}选择了${uniqueCandidateIds.length}道菜`,
        detail: normalizedNote,
        pollId: poll.id,
        dedupeKey: `poll-voted:${poll.id}:${membership.userId}`
      });

      if (normalizedSuggestion) {
        await this.writeActivity(tx, {
          diningGroupId: poll.diningGroupId,
          kind: "POLL_SUGGESTED",
          state: "DONE",
          actorUserId: membership.userId,
          title: "补充了一道建议菜",
          detail: normalizedSuggestion,
          pollId: poll.id,
          dedupeKey: `poll-suggested:${poll.id}:${membership.userId}`
        });
      }

      if (normalizedNote) {
        await this.writeActivity(tx, {
          diningGroupId: poll.diningGroupId,
          kind: "POLL_NOTED",
          state: "DONE",
          actorUserId: membership.userId,
          title: "留下了这次点菜备注",
          detail: normalizedNote,
          pollId: poll.id,
          dedupeKey: `poll-noted:${poll.id}:${membership.userId}`
        });
      }

      const result = await this.getMealPoll(userId, poll.id, tx);
      await completeIdempotentOperation(tx, operationId, "meal-poll:vote", userId, poll.diningGroupId, requestHash, result);
      return result;
    });
  }

  async confirmMealPoll(
    userId: UUID,
    pollId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    finalRecipeVersionIds: UUID[],
    scheduledAt: string | null,
    location: string | null
  ): Promise<MealPollDetail> {
    const uniqueVersionIds = Array.from(new Set(finalRecipeVersionIds));
    const normalizedLocation = normalizeOptionalText(location);
    const requestHash = JSON.stringify({
      pollId,
      expectedVersion,
      finalRecipeVersionIds: uniqueVersionIds,
      scheduledAt,
      location: normalizedLocation
    });

    return this.prisma.$transaction(async tx => {
      const poll = await tx.mealPoll.findUnique({
        where: { id: pollId }
      });
      if (!poll) throw new NotFoundException("征集不存在");

      await this.requireManagerMembership(tx, userId, poll.diningGroupId);
      if (poll.status !== "OPEN") throw new ConflictException("当前征集不可确认");
      if (poll.version !== expectedVersion) throw new ConflictException("征集已被更新，请刷新后重试");

      const repeated = await getIdempotentResult<MealPollDetail>(tx, operationId, "meal-poll:confirm", userId, poll.diningGroupId, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "meal-poll:confirm", userId, poll.diningGroupId, requestHash);

      const closing = await tx.mealPoll.updateMany({
        where: {
          id: poll.id,
          version: expectedVersion,
          status: "OPEN"
        },
        data: {
          status: "CLOSED",
          version: { increment: 1 }
        }
      });
      if (closing.count !== 1) throw new ConflictException("征集已被更新，请刷新后重试");

      const finalMenus = await this.resolveConfirmedPollMenus(tx, poll.id, uniqueVersionIds);
      const menuSnapshot = buildMenuSnapshot(finalMenus);
      const plan = await this.upsertPollMealPlan(tx, poll, finalMenus, menuSnapshot);
      const event = await this.upsertPollDiningEvent(tx, poll, plan, finalMenus, menuSnapshot, scheduledAt, normalizedLocation);
      await this.syncPollParticipants(tx, poll, event.id);

      await tx.mealPoll.update({
        where: { id: poll.id },
        data: {
          status: "CONFIRMED",
          confirmedPlanItemId: plan.id,
          confirmedDiningEventId: event.id
        }
      });

      await this.writeActivity(tx, {
        diningGroupId: poll.diningGroupId,
        kind: "POLL_OPENED",
        state: "DONE",
        actorUserId: poll.createdByUserId,
        title: buildMealPollTitle(plan.planDate.toISOString().slice(0, 10), plan.mealSlot),
        detail: poll.note,
        pollId: poll.id,
        planItemId: plan.id,
        diningEventId: event.id,
        dedupeKey: `poll-opened:${poll.id}`
      });

      await this.writeActivity(tx, {
        diningGroupId: poll.diningGroupId,
        kind: "MENU_CONFIRMED",
        state: "DONE",
        actorUserId: userId,
        title: "确认了这顿饭的最终菜单",
        detail: buildMenuTitle(finalMenus.map(item => item.title)),
        pollId: poll.id,
        planItemId: plan.id,
        diningEventId: event.id,
        dedupeKey: `menu-confirmed:${poll.id}`
      });

      const result = await this.getMealPoll(userId, poll.id, tx);
      await completeIdempotentOperation(tx, operationId, "meal-poll:confirm", userId, poll.diningGroupId, requestHash, result);
      return result;
    });
  }

  async createMealPlan(
    userId: UUID,
    operationId: OperationId,
    planDate: string,
    mealSlot: string,
    recipeId: UUID,
    note?: string | null
  ) {
    return this.prisma.$transaction(async tx => {
      const slot = normalizeMealSlot(mealSlot);
      const recipe = await this.requireOwnedRecipe(tx, userId, recipeId);
      const recipeVersion = await this.resolveRecipeVersion(tx, recipe);
      const menu = this.getEffectiveRecipeContent(recipe);
      const normalizedNote = normalizeOptionalText(note);
      const normalizedPlanDate = parseDateOnly(planDate);
      const requestHash = `${planDate}:${slot}:${recipeId}:${normalizedNote ?? ""}`;
      const repeated = await getIdempotentResult<MealPlanSummary>(tx, operationId, "meal-plan:create", userId, null, requestHash);
      if (repeated) return repeated;

      await startIdempotentOperation(tx, operationId, "meal-plan:create", userId, null, requestHash);
      await this.assertStorageWritable(tx, userId, sizeOfJson({ planDate, mealSlot: slot, menu, note: normalizedNote }));

      const existing = await tx.mealPlanItem.findUnique({
        where: {
          userId_planDate_mealSlot: {
            userId,
            planDate: normalizedPlanDate,
            mealSlot: slot
          }
        },
        include: {
          diningEvent: true
        }
      });

      if (existing?.status === "COMPLETED") {
        throw new ConflictException("已完成餐次不能修改");
      }

      const item = existing
        ? await tx.mealPlanItem.update({
            where: { id: existing.id },
            data: {
              recipeId,
              recipeVersionId: recipeVersion.id,
              menuSnapshot: toJson(menu),
              note: normalizedNote,
              version: { increment: 1 }
            },
            include: {
              diningEvent: true
            }
          })
        : await tx.mealPlanItem.create({
            data: {
              userId,
              planDate: normalizedPlanDate,
              mealSlot: slot,
              recipeId,
              recipeVersionId: recipeVersion.id,
              menuSnapshot: toJson(menu),
              note: normalizedNote
            },
            include: {
              diningEvent: true
            }
          });

      await upsertStorageLedger(tx, userId, "MEAL", item.id, sizeOfJson(item));
      const result = this.toMealPlanSummary(item);
      await completeIdempotentOperation(tx, operationId, "meal-plan:create", userId, null, requestHash, result);
      return result;
    });
  }

  async completeMealPlan(userId: UUID, planItemId: UUID, operationId: OperationId) {
    const requestHash = String(planItemId);
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<MealPlanSummary>(tx, operationId, "meal-plan:complete", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "meal-plan:complete", userId, null, requestHash);

      const current = await tx.mealPlanItem.findUnique({
        where: { id: planItemId },
        include: { diningEvent: true }
      });
      if (!current || current.userId !== userId) throw new NotFoundException("计划不存在");

      const item =
        current.status === "COMPLETED"
          ? current
          : await tx.mealPlanItem.update({
              where: { id: current.id },
              data: {
                status: "COMPLETED",
                completedAt: new Date(),
                version: { increment: 1 }
              },
              include: { diningEvent: true }
            });

      if (current.status !== "COMPLETED" && item.completedAt) {
        await this.medalService.awardMealCompletion(tx, userId, item.diningEvent, item.completedAt);
      }

      const result = this.toMealPlanSummary(item);
      await completeIdempotentOperation(tx, operationId, "meal-plan:complete", userId, null, requestHash, result);
      return result;
    });
  }

  async createDiningEvent(userId: UUID, planItemId: UUID, operationId: OperationId, scheduledAt: string, location?: string | null) {
    return this.prisma.$transaction(async tx => {
      const plan = await tx.mealPlanItem.findUnique({
        where: { id: planItemId },
        include: { diningEvent: true }
      });
      if (!plan || plan.userId !== userId) throw new NotFoundException("计划不存在");
      if (plan.status === "COMPLETED") throw new ConflictException("已完成餐次不能再发起饭局");
      if (plan.diningEvent) throw new ConflictException("该餐次已发起饭局");

      const shareToken = createShareToken();
      const sharePath = `/pages_share/preview/index?token=${encodeURIComponent(shareToken)}`;
      const normalizedLocation = normalizeOptionalText(location);
      const eventRequestHash = `${planItemId}:${scheduledAt}:${normalizedLocation ?? ""}`;
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:create", userId, null, eventRequestHash);
      if (repeated) return repeated;

      await startIdempotentOperation(tx, operationId, "dining-event:create", userId, null, eventRequestHash);
      await this.assertStorageWritable(tx, userId, sizeOfJson({ scheduledAt, location: normalizedLocation, menu: plan.menuSnapshot }));

      const menu = fromJson<RecipeContentSnapshot>(plan.menuSnapshot);
      const event = await tx.diningEvent.create({
        data: {
          userId,
          mealPlanItemId: plan.id,
          title: menu.name,
          scheduledAt: parseDateTime(scheduledAt, "饭局时间格式错误"),
          location: normalizedLocation,
          menuSnapshot: toJson(plan.menuSnapshot),
          shareTokenHash: hashText(shareToken),
          shareTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          menuItems: {
            create: [
              {
                recipeVersionId: plan.recipeVersionId,
                title: menu.name,
                sortOrder: 0
              }
            ]
          }
        }
      });

      await upsertStorageLedger(tx, userId, "MEAL", event.id, sizeOfJson(event));
      const result = await this.getDiningEvent(userId, event.id, sharePath, tx);
      await completeIdempotentOperation(tx, operationId, "dining-event:create", userId, null, eventRequestHash, result);
      return result;
    });
  }

  async listDiningGroupActivities(userId: UUID, diningGroupId: UUID, limit?: number): Promise<DiningGroupActivitySummary[]> {
    await this.requireActiveMembership(this.prisma, userId, diningGroupId);
    const normalizedLimit = Math.min(Math.max(toPositiveInt(limit, 5), 3), 5);
    const activities = await this.prisma.diningGroupActivity.findMany({
      where: { diningGroupId },
      include: {
        actor: { select: { uid: true, nickname: true } }
      },
      orderBy: { createdAt: "desc" },
      take: normalizedLimit
    });
    return activities.map(item => this.toActivitySummary(item));
  }

  async inviteDiningGroup(userId: UUID, eventId: UUID, diningGroupId: UUID, operationId: OperationId) {
    const requestHash = `${eventId}:${diningGroupId}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:invite-group", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:invite-group", userId, null, requestHash);

      const event = await tx.diningEvent.findUnique({
        where: { id: eventId }
      });
      if (!event || event.userId !== userId) throw new NotFoundException("饭局不存在");

      const membership = await tx.diningGroupMember.findUnique({
        where: {
          diningGroupId_userId: {
            diningGroupId,
            userId
          }
        },
        include: { diningGroup: true }
      });
      if (!membership || membership.role !== "OWNER" || membership.status !== "ACTIVE") {
        throw new ForbiddenException("无权从该饭搭子邀请成员");
      }

      const entitlements = await this.entitlementService.resolveForUser(tx, userId);
      const activeCount = await tx.diningGroupMember.count({
        where: {
          diningGroupId,
          status: { in: ["ACTIVE", "RESTRICTED"] }
        }
      });
      if (entitlements.state === "OVER_MEMBER_LIMIT" || activeCount > entitlements.memberLimit) {
        throw new ForbiddenException("当前饭搭子处于超额受限状态");
      }

      const members = await tx.diningGroupMember.findMany({
        where: {
          diningGroupId,
          userId: { not: userId },
          status: { in: ["ACTIVE", "RESTRICTED"] }
        }
      });
      const existing = await tx.diningEventParticipant.findMany({
        where: {
          diningEventId: eventId,
          userId: { in: members.map(item => item.userId) }
        },
        select: { userId: true }
      });
      const existingUserIds = new Set(existing.map(item => item.userId).filter(Boolean));
      for (const member of members) {
        if (existingUserIds.has(member.userId)) continue;
        const participant = await tx.diningEventParticipant.create({
          data: {
            diningEventId: eventId,
            userId: member.userId,
            sourceType: "DINING_GROUP",
            status: "INVITED"
          }
        });
        await upsertStorageLedger(tx, userId, "MEAL_GUEST", participant.id, sizeOfJson(participant));
      }

      if (event.diningGroupId) {
        await this.writeActivity(tx, {
          diningGroupId: event.diningGroupId,
          kind: "INVITE_PENDING",
          state: "PENDING",
          actorUserId: userId,
          title: "邀请了饭搭子成员一起参加这顿饭",
          detail: null,
          diningEventId: eventId,
          dedupeKey: `invite-pending:${eventId}`
        });
      }

      const result = await this.getDiningEvent(userId, eventId, undefined, tx);
      await completeIdempotentOperation(tx, operationId, "dining-event:invite-group", userId, null, requestHash, result);
      return result;
    });
  }

  async respondToDiningEvent(userId: UUID, eventId: UUID, operationId: OperationId, status: string) {
    const normalizedStatus = normalizeEventStatus(status);
    const requestHash = `${eventId}:${normalizedStatus}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:respond", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:respond", userId, null, requestHash);

      const participant = await tx.diningEventParticipant.findFirst({
        where: { diningEventId: eventId, userId },
        include: {
          diningEvent: true
        }
      });
      if (!participant) throw new NotFoundException("饭局不存在");

      await tx.diningEventParticipant.update({
        where: { id: participant.id },
        data: {
          status: normalizedStatus,
          respondedAt: new Date()
        }
      });
      await upsertStorageLedger(tx, participant.diningEvent.userId, "MEAL_GUEST", participant.id, sizeOfJson(participant));
      const result = await this.getDiningEvent(userId, eventId, undefined, tx);
      await completeIdempotentOperation(tx, operationId, "dining-event:respond", userId, null, requestHash, result);
      return result;
    });
  }

  async chooseBringRecipe(userId: UUID, eventId: UUID, recipeId: UUID, operationId: OperationId) {
    const requestHash = `${eventId}:${recipeId}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:bring", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:bring", userId, null, requestHash);

      const participant = await tx.diningEventParticipant.findFirst({
        where: {
          diningEventId: eventId,
          userId
        },
        include: {
          diningEvent: true
        }
      });
      if (!participant) throw new NotFoundException("饭局不存在");

      const recipe = await this.requireOwnedRecipe(tx, userId, recipeId);
      const recipeVersion = await this.resolveRecipeVersion(tx, recipe);

      await tx.diningEventParticipant.update({
        where: { id: participant.id },
        data: {
          status: "ACCEPTED",
          respondedAt: new Date(),
          bringRecipeId: recipe.id,
          bringVersionId: recipeVersion.id
        }
      });

      if (participant.diningEvent.diningGroupId) {
        await this.writeActivity(tx, {
          diningGroupId: participant.diningEvent.diningGroupId,
          kind: "BRING_UPDATED",
          state: "DONE",
          actorUserId: userId,
          title: "更新了我带菜",
          detail: recipe.title,
          diningEventId: eventId,
          dedupeKey: `bring-updated:${eventId}:${userId}`
        });
      }

      await upsertStorageLedger(tx, participant.diningEvent.userId, "MEAL_GUEST", participant.id, sizeOfJson(participant));
      const result = await this.getDiningEvent(userId, eventId, undefined, tx);
      await completeIdempotentOperation(tx, operationId, "dining-event:bring", userId, null, requestHash, result);
      return result;
    });
  }

  async claimCook(
    userId: UUID,
    eventId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    menuItemId: UUID,
    action: string
  ): Promise<DiningEventSummary> {
    const normalizedAction = normalizeCookAction(action);
    const requestHash = JSON.stringify({ eventId, expectedVersion, menuItemId, action: normalizedAction });
    return this.prisma.$transaction(async tx => {
      const event = await tx.diningEvent.findUnique({
        where: { id: eventId }
      });
      if (!event) throw new NotFoundException("饭局不存在");
      if (event.status === "CANCELLED" || event.status === "COMPLETED") {
        throw new ConflictException("当前饭局状态不允许认领掌勺");
      }

      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:cook", userId, event.diningGroupId, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:cook", userId, event.diningGroupId, requestHash);

      const participant = await tx.diningEventParticipant.findFirst({
        where: {
          diningEventId: eventId,
          userId
        }
      });
      if (event.userId !== userId && (!participant || participant.status === "DECLINED" || participant.status === "REMOVED")) {
        throw new ForbiddenException("无权认领这顿饭的掌勺");
      }

      const menuItem = await tx.diningEventMenuItem.findUnique({
        where: { id: menuItemId }
      });
      if (!menuItem || menuItem.diningEventId !== eventId) throw new NotFoundException("菜单项不存在");
      if (menuItem.version !== expectedVersion) throw new ConflictException("菜单项已被更新，请刷新后重试");

      if (normalizedAction === "CLAIM") {
        const claimed = await tx.diningEventMenuItem.updateMany({
          where: {
            id: menuItemId,
            diningEventId: eventId,
            version: expectedVersion,
            cookUserId: null
          },
          data: {
            cookUserId: userId,
            version: { increment: 1 }
          }
        });
        if (claimed.count !== 1) throw new ConflictException("这道菜已被其他成员认领");
      } else {
        if (menuItem.cookUserId !== userId) {
          throw new ForbiddenException("只能释放自己认领的菜");
        }
        const released = await tx.diningEventMenuItem.updateMany({
          where: {
            id: menuItemId,
            diningEventId: eventId,
            version: expectedVersion,
            cookUserId: userId
          },
          data: {
            cookUserId: null,
            version: { increment: 1 }
          }
        });
        if (released.count !== 1) throw new ConflictException("菜单项已被更新，请刷新后重试");
      }

      if (event.diningGroupId) {
        await this.writeActivity(tx, {
          diningGroupId: event.diningGroupId,
          kind: "COOK_CLAIMED",
          state: "DONE",
          actorUserId: userId,
          title: normalizedAction === "CLAIM" ? "认领了一道菜的掌勺" : "释放了一道菜的掌勺",
          detail: menuItem.title,
          diningEventId: eventId,
          dedupeKey: `cook-claimed:${eventId}:${menuItemId}:${userId}`
        });
      }

      const result = await this.getDiningEvent(userId, eventId, undefined, tx);
      await completeIdempotentOperation(tx, operationId, "dining-event:cook", userId, event.diningGroupId, requestHash, result);
      return result;
    });
  }

  async completeDiningEvent(userId: UUID, eventId: UUID, operationId: OperationId) {
    const requestHash = String(eventId);
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:complete", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:complete", userId, null, requestHash);

      const current = await this.loadDiningEventRow(tx, eventId);
      if (!current || current.userId !== userId) throw new NotFoundException("饭局不存在");
      if (current.status === "COMPLETED") {
        const result = this.toDiningEventSummary(current, null);
        await completeIdempotentOperation(tx, operationId, "dining-event:complete", userId, null, requestHash, result);
        return result;
      }
      if (current.status === "CANCELLED") {
        throw new ConflictException("已取消饭局不能完成");
      }

      const acceptedUserIds = current.participants
        .filter(item => item.status === "ACCEPTED" && item.userId !== null)
        .map(item => item.userId as UUID);

      if (!acceptedUserIds.length) {
        throw new BadRequestException("至少有一位接受参与人后才能完成饭局");
      }

      await tx.diningEvent.update({
        where: { id: current.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          version: { increment: 1 }
        }
      });

      const event = await this.loadDiningEventRow(tx, current.id);
      if (!event) throw new NotFoundException("饭局不存在");

      if (event.completedAt) {
        await this.medalService.awardDiningEventCompletion(tx, userId, acceptedUserIds, event.completedAt);
      }

      if (event.diningGroupId) {
        await this.writeActivity(tx, {
          diningGroupId: event.diningGroupId,
          kind: "MEAL_COMPLETED",
          state: "DONE",
          actorUserId: userId,
          title: "完成了这顿饭",
          detail: event.title,
          diningEventId: event.id,
          dedupeKey: `meal-completed:${event.id}`
        });
      }

      const result = this.toDiningEventSummary(event, null);
      await completeIdempotentOperation(tx, operationId, "dining-event:complete", userId, null, requestHash, result);
      return result;
    });
  }

  async createDiningMemoryShare(
    userId: UUID,
    eventId: UUID,
    operationId: OperationId,
    showParticipants: boolean,
    caption?: string | null
  ): Promise<DiningMemoryShareSnapshot> {
    const normalizedCaption = normalizeOptionalText(caption);
    const requestHash = `${eventId}:${showParticipants ? "1" : "0"}:${normalizedCaption ?? ""}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async tx => {
          const repeated = await getIdempotentResult<DiningMemoryShareSnapshot>(tx, operationId, "dining-memory-share:create", userId, null, requestHash);
          if (repeated) return repeated;
          await startIdempotentOperation(tx, operationId, "dining-memory-share:create", userId, null, requestHash);

          const event = await this.loadDiningEventRow(tx, eventId);
          if (!event || event.userId !== userId) throw new NotFoundException("饭局不存在");
          if (event.status !== "COMPLETED" || !event.completedAt) {
            throw new ConflictException("只有已完成的饭局才能生成饭搭子卡");
          }

          const latest = await tx.diningEventMemoryShare.findFirst({
            where: { diningEventId: eventId },
            orderBy: { snapshotVersion: "desc" },
            select: { snapshotVersion: true }
          });
          const snapshotVersion = (latest?.snapshotVersion ?? 0) + 1;
          const shareToken = createShareToken();
          const sharePath = buildMemorySharePath(shareToken);
          const menuItemsSnapshot = this.buildDiningMemoryMenuSnapshot(event);
          if (!menuItemsSnapshot.length) {
            throw new ConflictException("只有已确认最终菜单的饭局才能生成饭搭子卡");
          }
          const participantsSnapshot = showParticipants ? this.buildDiningMemoryParticipantSnapshot(event) : [];

          const snapshotPayload = {
            title: event.title,
            planDate: event.mealPlanItem?.planDate.toISOString().slice(0, 10) ?? null,
            mealSlot: event.mealPlanItem?.mealSlot ?? null,
            menuItems: menuItemsSnapshot,
            participants: participantsSnapshot,
            caption: normalizedCaption,
            sharedAt: new Date().toISOString(),
            snapshotVersion
          };
          await this.assertStorageWritable(tx, userId, sizeOfJson(snapshotPayload));

          const snapshot = await tx.diningEventMemoryShare.create({
            data: {
              diningEventId: event.id,
              diningGroupId: event.diningGroupId,
              createdByUserId: userId,
              snapshotVersion,
              title: event.title,
              planDate: event.mealPlanItem?.planDate ?? null,
              mealSlot: event.mealPlanItem?.mealSlot ?? null,
              menuItemsSnapshot: toJson(menuItemsSnapshot),
              participantsSnapshot: toJson(participantsSnapshot),
              caption: normalizedCaption,
              showParticipants,
              shareTokenHash: hashText(shareToken)
            }
          });

          await upsertStorageLedger(tx, userId, "TECHNICAL_SNAPSHOT", snapshot.id, sizeOfJson(snapshotPayload));

          if (event.diningGroupId) {
            await this.writeActivity(tx, {
              diningGroupId: event.diningGroupId,
              kind: "MEMORY_CREATED",
              state: "DONE",
              actorUserId: userId,
              title: "生成了一张饭搭子卡",
              detail: sharePath,
              diningEventId: event.id,
              dedupeKey: `memory-created:${snapshot.id}`
            });
          }

          const result = this.toDiningMemoryShareSnapshot(snapshot, sharePath);
          await completeIdempotentOperation(tx, operationId, "dining-memory-share:create", userId, null, requestHash, result);
          return result;
        });
      } catch (error) {
        if (isUniqueConstraintError(error) && attempt < 2) {
          continue;
        }
        if (isUniqueConstraintError(error)) {
          throw new ConflictException("饭搭子卡已被更新，请重试");
        }
        throw error;
      }
    }

    throw new ConflictException("饭搭子卡已被更新，请重试");
  }

  async getDiningEvent(
    userId: UUID,
    eventId: UUID,
    shareTokenPath?: string | null,
    db: MealDb = this.prisma
  ): Promise<DiningEventSummary> {
    const event = await this.loadDiningEventRow(db, eventId);
    if (!event) throw new NotFoundException("饭局不存在");
    const isParticipant = event.participants.some(item => item.userId === userId);
    if (event.userId !== userId && !isParticipant) throw new ForbiddenException("无权查看该饭局");
    return this.toDiningEventSummary(event, shareTokenPath);
  }

  async getDiningMemorySharePreview(shareToken: string): Promise<DiningMemorySharePreview> {
    const shareTokenHash = hashText(shareToken);
    const snapshot = await this.prisma.diningEventMemoryShare.findUnique({
      where: { shareTokenHash }
    });
    if (!snapshot) throw new NotFoundException("饭搭子卡分享已失效");
    return this.toDiningMemorySharePreview(snapshot);
  }

  async getSharePreview(shareToken: string): Promise<SharePreviewResponse> {
    const shareTokenHash = hashText(shareToken);
    const event = await this.prisma.diningEvent.findUnique({
      where: { shareTokenHash },
      include: {
        user: { select: { uid: true } }
      }
    });
    if (!event || !event.shareTokenExpiresAt || event.shareTokenExpiresAt <= new Date()) {
      throw new NotFoundException("分享已失效");
    }

    const menu = fromJson<RecipeContentSnapshot>(event.menuSnapshot);
    return {
      title: event.title,
      scheduledAt: toIsoDate(event.scheduledAt),
      location: event.location,
      menu: {
        name: menu.name,
        ingredients: menu.ingredients
      },
      organizerUid: event.user.uid
    };
  }

  async acceptShareInvite(userId: UUID, shareToken: string, operationId: OperationId, guestName: string) {
    const normalizedGuestName = guestName.trim();
    if (!normalizedGuestName) throw new BadRequestException("展示名称不能为空");
    const shareTokenHash = hashText(shareToken);
    const requestHash = `${shareTokenHash}:${normalizedGuestName}`;

    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "share:accept", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "share:accept", userId, null, requestHash);

      const event = await tx.diningEvent.findUnique({
        where: { shareTokenHash }
      });
      if (!event || !event.shareTokenExpiresAt || event.shareTokenExpiresAt <= new Date()) {
        throw new NotFoundException("分享已失效");
      }

      const existing = await tx.diningEventParticipant.findFirst({
        where: { diningEventId: event.id, userId }
      });
      if (existing) {
        await tx.diningEventParticipant.update({
          where: { id: existing.id },
          data: {
            guestName: normalizedGuestName,
            status: "ACCEPTED",
            respondedAt: new Date(),
            sourceType: "SHARE"
          }
        });
        const result = await this.getDiningEvent(userId, event.id, undefined, tx);
        await completeIdempotentOperation(tx, operationId, "share:accept", userId, null, requestHash, result);
        return result;
      }

      const participant = await tx.diningEventParticipant.create({
        data: {
          diningEventId: event.id,
          userId,
          guestName: normalizedGuestName,
          sourceType: "SHARE",
          status: "ACCEPTED",
          respondedAt: new Date()
        }
      });
      await upsertStorageLedger(tx, event.userId, "MEAL_GUEST", participant.id, sizeOfJson(participant));
      const result = await this.getDiningEvent(userId, event.id, undefined, tx);
      await completeIdempotentOperation(tx, operationId, "share:accept", userId, null, requestHash, result);
      return result;
    });
  }

  private async loadDiningEventRow(db: MealDb, eventId: UUID) {
    return db.diningEvent.findUnique({
      where: { id: eventId },
      include: {
        user: { select: { uid: true, nickname: true, avatarUrl: true } },
        mealPlanItem: { select: { planDate: true, mealSlot: true } },
        participants: {
          include: {
            user: { select: { uid: true, nickname: true, avatarUrl: true } },
            bringRecipe: true
          }
        },
        menuItems: {
          include: {
            cookUser: { select: { uid: true, nickname: true } },
            recipeVersion: {
              include: {
                currentRecipes: {
                  select: { id: true, coverImageUrl: true },
                  take: 1
                }
              }
            }
          },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
        }
      }
    });
  }

  private toMealPlanSummary(item: MealPlanRow): MealPlanSummary {
    const menu = fromJson<RecipeContentSnapshot>(item.menuSnapshot);
    return {
      id: item.id,
      planDate: item.planDate.toISOString().slice(0, 10),
      mealSlot: item.mealSlot,
      recipeId: item.recipeId,
      recipeVersionId: item.recipeVersionId,
      title: menu.name,
      status: item.status,
      completedAt: item.completedAt ? toIsoDate(item.completedAt) : null,
      hasDiningEvent: Boolean(item.diningEvent),
      diningEventId: item.diningEvent?.id ?? null,
      createdAt: toIsoDate(item.createdAt)
    };
  }

  private toMealPollSummary(poll: MealPollSummaryRow): MealPollSummary {
    return {
      id: poll.id,
      diningGroupId: poll.diningGroupId,
      title: buildMealPollTitle(poll.planDate.toISOString().slice(0, 10), poll.mealSlot),
      planDate: poll.planDate.toISOString().slice(0, 10),
      mealSlot: poll.mealSlot,
      status: poll.status,
      deadlineAt: toIsoDate(poll.deadlineAt),
      choiceLimit: poll.choiceLimit,
      note: poll.note,
      candidateCount: poll._count.candidates,
      responseCount: poll._count.responses,
      confirmedPlanItemId: poll.confirmedPlanItemId ?? null,
      confirmedDiningEventId: poll.confirmedDiningEventId ?? null,
      version: poll.version,
      createdAt: toIsoDate(poll.createdAt)
    };
  }

  private toMealPollDetail(poll: MealPollDetailRow): MealPollDetail {
    return {
      ...this.toMealPollSummary(poll),
      candidates: poll.candidates.map(item => ({
        id: item.id,
        recipeId: item.recipeVersion?.currentRecipes[0]?.id ?? null,
        recipeVersionId: item.recipeVersionId,
        title: item.title,
        coverUrl: item.recipeVersion?.currentRecipes[0]?.coverImageUrl ?? null,
        status: item.status,
        sourceType: item.sourceType,
        suggestedByUid: item.suggestedBy?.uid ?? null,
        voteCount: item._count.responseItems
      })),
      responses: poll.responses.map(item => {
        const suggestionItem = item.items.find(responseItem => responseItem.candidate.sourceType === "SUGGESTION");
        return {
          id: item.id,
          userUid: item.user.uid,
          selectedCandidateIds: item.items
            .filter(responseItem => responseItem.candidate.sourceType !== "SUGGESTION")
            .map(responseItem => responseItem.candidateId),
          suggestionCandidateId: suggestionItem?.candidateId ?? null,
          note: item.note,
          respondedAt: toIsoDate(item.respondedAt)
        };
      })
    };
  }

  private toActivitySummary(activity: ActivityRow): DiningGroupActivitySummary {
    return {
      id: activity.id,
      diningGroupId: activity.diningGroupId,
      kind: activity.kind,
      state: activity.state,
      actorUid: activity.actor?.uid ?? null,
      actorName: activity.actor?.nickname ?? null,
      title: activity.title,
      detail: activity.detail,
      pollId: activity.pollId,
      planItemId: activity.planItemId,
      diningEventId: activity.diningEventId,
      createdAt: toIsoDate(activity.createdAt)
    };
  }

  private toDiningEventSummary(event: DiningEventRow, shareTokenPath?: string | null): DiningEventSummary {
    const menu = fromJson<RecipeContentSnapshot>(event.menuSnapshot);
    return {
      id: event.id,
      title: event.title,
      scheduledAt: toIsoDate(event.scheduledAt),
      location: event.location,
      status: event.status,
      organizerUid: event.user?.uid ?? null,
      organizerName: event.user?.nickname ?? null,
      organizerAvatarUrl: event.user?.avatarUrl ?? null,
      planItemId: event.mealPlanItemId,
      diningGroupId: event.diningGroupId,
      menu,
      menuItems: event.menuItems.map(item => ({
        id: item.id,
        recipeId: item.recipeVersion.currentRecipes[0]?.id ?? null,
        recipeVersionId: item.recipeVersionId,
        title: item.title,
        cookUserUid: item.cookUser?.uid ?? null,
        cookName: item.cookUser?.nickname ?? null,
        version: item.version
      })),
      participants: event.participants.map(item => ({
        id: item.id,
        userUid: item.user?.uid ?? null,
        displayName: item.user?.nickname?.trim() || item.guestName || null,
        avatarUrl: item.user?.avatarUrl ?? null,
        guestName: item.guestName,
        sourceType: item.sourceType,
        status: item.status,
        bringRecipeId: item.bringRecipeId,
        bringRecipeTitle: item.bringRecipe?.title ?? null
      }) satisfies DiningEventParticipantSummary),
      shareTokenPath: shareTokenPath ?? null,
      completedAt: event.completedAt ? toIsoDate(event.completedAt) : null,
      version: event.version,
      createdAt: toIsoDate(event.createdAt)
    };
  }

  private toDiningMemoryShareSnapshot(snapshot: DiningEventMemoryShareRow, sharePath: string): DiningMemoryShareSnapshot {
    return {
      id: snapshot.id,
      diningEventId: snapshot.diningEventId,
      sharePath,
      ...this.toDiningMemorySharePreview(snapshot)
    };
  }

  private toDiningMemorySharePreview(snapshot: DiningEventMemoryShareRow): DiningMemorySharePreview {
    return {
      title: snapshot.title,
      planDate: snapshot.planDate ? snapshot.planDate.toISOString().slice(0, 10) : null,
      mealSlot: snapshot.mealSlot,
      menuItems: fromJson<DiningMemoryShareMenuItemSnapshot[]>(snapshot.menuItemsSnapshot),
      participants: fromJson<DiningMemoryShareParticipantSnapshot[]>(snapshot.participantsSnapshot),
      caption: snapshot.caption,
      sharedAt: toIsoDate(snapshot.createdAt),
      snapshotVersion: snapshot.snapshotVersion
    };
  }

  private buildDiningMemoryMenuSnapshot(event: DiningEventRow): DiningMemoryShareMenuItemSnapshot[] {
    return event.menuItems.map(item => ({
      title: item.title,
      coverUrl: item.recipeVersion.currentRecipes[0]?.coverImageUrl ?? null,
      cookName: item.cookUser ? this.resolveMemoryDisplayName(item.cookUser.nickname, "掌勺人") : null
    }));
  }

  private buildDiningMemoryParticipantSnapshot(event: DiningEventRow): DiningMemoryShareParticipantSnapshot[] {
    const participants: DiningMemoryShareParticipantSnapshot[] = [
      {
        displayName: this.resolveMemoryDisplayName(event.user.nickname, "主理人"),
        avatarUrl: event.user.avatarUrl ?? null,
        role: "ORGANIZER"
      }
    ];

    for (const item of event.participants) {
      if (item.status !== "ACCEPTED") continue;
      if (item.user) {
        participants.push({
          displayName: this.resolveMemoryDisplayName(item.user.nickname, "饭搭子"),
          avatarUrl: item.user.avatarUrl ?? null,
          role: "PARTICIPANT"
        });
        continue;
      }

      if (item.guestName) {
        participants.push({
          displayName: item.guestName,
          avatarUrl: null,
          role: "GUEST"
        });
      }
    }

    return participants;
  }

  private resolveMemoryDisplayName(nickname: string | null, fallback: string) {
    if (nickname?.trim()) return nickname.trim();
    return fallback;
  }

  private getEffectiveRecipeContent(recipe: Prisma.RecipeGetPayload<{
    include: { currentVersion: true };
  }>) {
    return versionToContent(recipe.currentVersion);
  }

  private async resolveRecipeVersion(
    _tx: Prisma.TransactionClient,
    recipe: Prisma.RecipeGetPayload<{
      include: { currentVersion: true };
    }>
  ) {
    return recipe.currentVersion;
  }

  private async resolveMenuVersions(tx: Prisma.TransactionClient, recipeVersionIds: UUID[]): Promise<ResolvedMenuVersion[]> {
    const versions = await tx.recipeContentVersion.findMany({
      where: { id: { in: recipeVersionIds } },
      include: {
        currentRecipes: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            coverImageUrl: true
          },
          take: 1
        }
      }
    });

    const versionMap = new Map(versions.map(item => [item.id, item]));
    return recipeVersionIds.map(recipeVersionId => {
      const version = versionMap.get(recipeVersionId);
      if (!version) throw new BadRequestException("存在无效菜谱版本");
      return {
        recipeId: version.currentRecipes[0]?.id ?? null,
        recipeVersionId: version.id,
        coverUrl: version.currentRecipes[0]?.coverImageUrl ?? null,
        title: version.name,
        content: versionToContent(version)
      };
    });
  }

  private async resolveConfirmedPollMenus(
    tx: Prisma.TransactionClient,
    pollId: UUID,
    recipeVersionIds: UUID[]
  ): Promise<ResolvedMenuVersion[]> {
    if (!recipeVersionIds.length) {
      throw new BadRequestException("最终菜单不能为空");
    }

    const candidates = await tx.mealPollCandidate.findMany({
      where: {
        pollId,
        sourceType: "RECIPE",
        status: "ACTIVE",
        recipeVersionId: {
          in: recipeVersionIds
        }
      },
      select: {
        recipeVersionId: true
      }
    });
    const allowedVersionIds = new Set(
      candidates
        .map(item => item.recipeVersionId)
        .filter((item): item is UUID => typeof item === "number" && item > 0)
    );
    if (allowedVersionIds.size !== recipeVersionIds.length) {
      throw new BadRequestException("最终菜单只能从当前征集的正式候选菜中确认");
    }

    return this.resolveMenuVersions(tx, recipeVersionIds);
  }

  private async requireOwnedRecipe(tx: Prisma.TransactionClient, userId: UUID, recipeId: UUID) {
    const recipe = await tx.recipe.findUnique({
      where: { id: recipeId },
      include: {
        currentVersion: true
      }
    });
    if (!recipe || recipe.ownerId !== userId || recipe.status !== "ACTIVE") {
      throw new NotFoundException("菜谱不存在");
    }
    return recipe;
  }

  private async requireActiveMembership(db: MealDb, userId: UUID, diningGroupId: UUID) {
    const member = await db.diningGroupMember.findUnique({
      where: {
        diningGroupId_userId: {
          diningGroupId,
          userId
        }
      }
    });
    if (!member || !isActiveMemberStatus(member.status)) {
      throw new NotFoundException("饭搭子不存在");
    }

    const diningGroup = await db.diningGroup.findUnique({
      where: { id: diningGroupId },
      select: { status: true }
    });
    if (!diningGroup || diningGroup.status !== "ACTIVE") {
      throw new NotFoundException("饭搭子不存在");
    }

    return member;
  }

  private async requireManagerMembership(db: MealDb, userId: UUID, diningGroupId: UUID) {
    const member = await this.requireActiveMembership(db, userId, diningGroupId);
    if (!groupManagerRoles.includes(member.role as (typeof groupManagerRoles)[number])) {
      throw new ForbiddenException("无权操作该饭搭子");
    }
    return member;
  }

  private async writeActivity(
    tx: Prisma.TransactionClient,
    params: {
      diningGroupId: UUID;
      kind:
        | "POLL_OPENED"
        | "POLL_VOTED"
        | "POLL_SUGGESTED"
        | "POLL_NOTED"
        | "MENU_CONFIRMED"
        | "COOK_CLAIMED"
        | "BRING_UPDATED"
        | "MEAL_COMPLETED"
        | "MEMORY_CREATED"
        | "MEMBER_JOINED"
        | "INVITE_PENDING";
      state: "PENDING" | "DONE" | "EXPIRED";
      actorUserId: UUID | null;
      title: string;
      detail?: string | null;
      pollId?: UUID | null;
      planItemId?: UUID | null;
      diningEventId?: UUID | null;
      dedupeKey: string;
    }
  ) {
    const payload = {
      kind: params.kind,
      state: params.state,
      actorUserId: params.actorUserId,
      title: params.title,
      detail: normalizeOptionalText(params.detail ?? null),
      pollId: params.pollId ?? null,
      planItemId: params.planItemId ?? null,
      diningEventId: params.diningEventId ?? null
    };
    return tx.diningGroupActivity.upsert({
      where: {
        diningGroupId_dedupeKey: {
          diningGroupId: params.diningGroupId,
          dedupeKey: params.dedupeKey
        }
      },
      create: {
        diningGroupId: params.diningGroupId,
        kind: params.kind,
        state: params.state,
        actorUserId: params.actorUserId,
        title: params.title,
        detail: payload.detail,
        pollId: payload.pollId,
        planItemId: payload.planItemId,
        diningEventId: payload.diningEventId,
        dedupeKey: params.dedupeKey
      },
      update: {
        kind: params.kind,
        state: params.state,
        actorUserId: params.actorUserId,
        title: params.title,
        detail: payload.detail,
        pollId: payload.pollId,
        planItemId: payload.planItemId,
        diningEventId: payload.diningEventId,
        createdAt: new Date()
      }
    });
  }

  private async upsertPollMealPlan(
    tx: Prisma.TransactionClient,
    poll: Prisma.MealPollGetPayload<{}>,
    menus: ResolvedMenuVersion[],
    menuSnapshot: RecipeContentSnapshot
  ) {
    await this.assertStorageWritable(tx, poll.createdByUserId, sizeOfJson(menuSnapshot));
    const existing = await tx.mealPlanItem.findUnique({
      where: {
        userId_planDate_mealSlot: {
          userId: poll.createdByUserId,
          planDate: poll.planDate,
          mealSlot: poll.mealSlot
        }
      },
      include: {
        diningEvent: true
      }
    });
    if (existing?.status === "COMPLETED") throw new ConflictException("已完成餐次不能再被征集确认覆盖");

    const primary = menus[0];
    const plan = existing
      ? await tx.mealPlanItem.update({
          where: { id: existing.id },
          data: {
            recipeId: primary.recipeId,
            recipeVersionId: primary.recipeVersionId,
            menuSnapshot: toJson(menuSnapshot),
            note: poll.note,
            version: { increment: 1 }
          },
          include: {
            diningEvent: true
          }
        })
      : await tx.mealPlanItem.create({
          data: {
            userId: poll.createdByUserId,
            planDate: poll.planDate,
            mealSlot: poll.mealSlot,
            recipeId: primary.recipeId,
            recipeVersionId: primary.recipeVersionId,
            menuSnapshot: toJson(menuSnapshot),
            note: poll.note
          },
          include: {
            diningEvent: true
          }
        });

    await upsertStorageLedger(tx, poll.createdByUserId, "MEAL", plan.id, sizeOfJson(plan));
    return plan;
  }

  private async upsertPollDiningEvent(
    tx: Prisma.TransactionClient,
    poll: Prisma.MealPollGetPayload<{}>,
    plan: MealPlanRow,
    menus: ResolvedMenuVersion[],
    menuSnapshot: RecipeContentSnapshot,
    scheduledAt: string | null,
    location: string | null
  ) {
    const resolvedScheduledAt = scheduledAt ? parseDateTime(scheduledAt, "开饭时间格式错误") : plan.diningEvent?.scheduledAt ?? buildFallbackScheduledAt(plan.planDate.toISOString().slice(0, 10), plan.mealSlot);
    const shareToken = createShareToken();

    if (plan.diningEvent?.status === "COMPLETED" || plan.diningEvent?.status === "CANCELLED") {
      throw new ConflictException("当前饭局状态不允许被征集确认覆盖");
    }

    const event = plan.diningEvent
      ? await tx.diningEvent.update({
          where: { id: plan.diningEvent.id },
          data: {
            diningGroupId: poll.diningGroupId,
            title: menuSnapshot.name,
            scheduledAt: resolvedScheduledAt,
            location,
            status: "CONFIRMED",
            menuSnapshot: toJson(menuSnapshot),
            shareTokenHash: plan.diningEvent.shareTokenHash ?? hashText(shareToken),
            shareTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            version: { increment: 1 }
          }
        })
      : await tx.diningEvent.create({
          data: {
            userId: poll.createdByUserId,
            mealPlanItemId: plan.id,
            diningGroupId: poll.diningGroupId,
            title: menuSnapshot.name,
            scheduledAt: resolvedScheduledAt,
            location,
            status: "CONFIRMED",
            menuSnapshot: toJson(menuSnapshot),
            shareTokenHash: hashText(shareToken),
            shareTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        });

    await tx.diningEventMenuItem.deleteMany({
      where: { diningEventId: event.id }
    });
    await tx.diningEventMenuItem.createMany({
      data: menus.map((item, index) => ({
        diningEventId: event.id,
        recipeVersionId: item.recipeVersionId,
        title: item.title,
        sortOrder: index
      }))
    });

    await upsertStorageLedger(tx, poll.createdByUserId, "MEAL", event.id, sizeOfJson(event));
    return event;
  }

  private async syncPollParticipants(tx: Prisma.TransactionClient, poll: Prisma.MealPollGetPayload<{}>, eventId: UUID) {
    const members = await tx.diningGroupMember.findMany({
      where: {
        diningGroupId: poll.diningGroupId,
        status: { in: ["ACTIVE", "RESTRICTED"] },
        userId: { not: poll.createdByUserId }
      },
      select: { userId: true }
    });
    const respondedUsers = await tx.mealPollResponse.findMany({
      where: { pollId: poll.id },
      select: { userId: true }
    });
    const respondedUserIds = new Set(respondedUsers.map(item => item.userId));
    const existing = await tx.diningEventParticipant.findMany({
      where: {
        diningEventId: eventId,
        userId: { in: members.map(item => item.userId) }
      }
    });
    const existingMap = new Map(existing.filter(item => item.userId !== null).map(item => [item.userId as UUID, item]));

    for (const member of members) {
      const current = existingMap.get(member.userId);
      const nextAccepted = respondedUserIds.has(member.userId);
      if (!current) {
        const created = await tx.diningEventParticipant.create({
          data: {
            diningEventId: eventId,
            userId: member.userId,
            sourceType: "DINING_GROUP",
            status: nextAccepted ? "ACCEPTED" : "INVITED",
            respondedAt: nextAccepted ? new Date() : null
          }
        });
        await upsertStorageLedger(tx, poll.createdByUserId, "MEAL_GUEST", created.id, sizeOfJson(created));
        continue;
      }

      if (nextAccepted && current.status === "INVITED") {
        await tx.diningEventParticipant.update({
          where: { id: current.id },
          data: {
            status: "ACCEPTED",
            respondedAt: current.respondedAt ?? new Date()
          }
        });
      }
    }
  }

  private async assertStorageWritable(tx: Prisma.TransactionClient, userId: UUID, expectedDeltaBytes: number) {
    const entitlements = await this.entitlementService.resolveForUser(tx, userId);
    const current = await tx.storageLedger.aggregate({
      where: { userId },
      _sum: { usedBytes: true }
    });
    const usedBytes = current._sum.usedBytes ?? 0;
    if (usedBytes > entitlements.storageLimitBytes || usedBytes + expectedDeltaBytes > entitlements.storageLimitBytes) {
      throw new ForbiddenException("当前个人空间不足");
    }
  }
}
