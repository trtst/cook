import { createHash } from "node:crypto";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { HomeTopicStatus as TopicStatus, HomeTopicType as TopicType, Prisma } from "@prisma/client";
import { recipeDifficultyText, recipeDurationText, topicTypeOptions, topicTypeText } from "../../common/display-text";
import { completeAdminIdempotentOperation, getAdminIdempotentResult, startAdminIdempotentOperation } from "../../common/idempotency";
import { PrismaService } from "../../common/prisma.service";
import { UserTokenService } from "../../common/security/user-token.service";
import type {
  AdminHomeTopicItem,
  AdminHomeTopicTodoItem,
  AdminHomeTopicsResponse,
  CreateHomeTopicRequest,
  DeleteHomeTopicRequest,
  HomeTopicStatus,
  HomeTopicCurrentResponse,
  HomeTopicDetail,
  HomeTopicDetailResponse,
  HomeTopicHistoryItem,
  PageResult,
  HomeTopicRecipeItem,
  HomeTopicRecipeSearchItem,
  HomeTopicRecipeSearchResponse,
  HomeTopicType,
  HomeTopicTypeOption,
  HomeTopicWeekday,
  OperationId,
  RecipeDifficulty,
  RecipeDuration,
  SetHomeTopicStatusRequest,
  SetHomeTopicScheduleRequest,
  ReplaceHomeTopicItemRequest,
  DismissHomeTopicTodoRequest,
  UUID,
  UpdateHomeTopicRequest
} from "../../contracts/types";
import { HomeTopicImageService } from "./home-topic-image.service";
import { beijingWeekEnd, isoDate, nextBeijingWeekStart } from "./home-topic-week";
import { publicInspirationRecipeWhere } from "../recipe/public-content-user-pool";

type TopicDb = Prisma.TransactionClient | PrismaService;
type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
  headers?: {
    authorization?: string;
  };
};

type TopicRow = Prisma.HomeTopicGetPayload<{
  include: {
    items: {
      include: {
        sourceVersion: true;
        recipe: {
          include: {
            inspirationCategory: true;
          };
        };
      };
    };
  };
}>;

type RecipeRow = Prisma.RecipeGetPayload<{
  include: {
    inspirationCategory: true;
    currentVersion: true;
  };
}>;

const topicTypes: HomeTopicTypeOption[] = topicTypeOptions;
const activeOwnedRecipeStatus = "ACTIVE";
const topicImagePath = /^(?:https?:\/\/[^/]+)?\/(?:static\/)?uploads\/home-topics\/\d+(?:\.(?:jpg|png|webp))?$/i;
const recipeWhere: Prisma.RecipeWhereInput = publicInspirationRecipeWhere("ACTIVE");
const publicTopicInclude = {
  items: {
    where: { recipe: recipeWhere },
    include: {
      sourceVersion: true,
      recipe: { include: { inspirationCategory: true } }
    },
    orderBy: [{ weekday: "asc" }, { sortOrder: "asc" }, { id: "asc" }]
  }
} satisfies Prisma.HomeTopicInclude;
const historyTopicSelect = {
  id: true,
  title: true,
  subTitle: true,
  recType: true,
  issueNo: true,
  periodStartDate: true,
  description: true,
  coverImageUrl: true,
  publishedAt: true,
  updatedAt: true,
  _count: { select: { items: { where: { recipe: recipeWhere } } } }
} satisfies Prisma.HomeTopicSelect;
type HistoryTopicRow = Prisma.HomeTopicGetPayload<{ select: typeof historyTopicSelect }>;

function cleanText(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return text ? text : null;
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function toIso(value: Date) {
  return value.toISOString();
}

function toPositiveInt(value: number, fallback: number) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function isTopicImagePath(value: string | null | undefined) {
  return Boolean(value && topicImagePath.test(value));
}

@Injectable()
export class HomeTopicService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(HomeTopicImageService) private readonly imageService: HomeTopicImageService,
    @Inject(UserTokenService) private readonly userTokenService: UserTokenService
  ) {}

  async getCurrentTopic(request: RequestLike): Promise<HomeTopicCurrentResponse> {
    const current = await this.prisma.homeTopic.findFirst({
      where: { status: TopicStatus.PUBLISHED },
      include: publicTopicInclude,
      orderBy: [{ periodStartDate: "desc" }, { issueNo: "desc" }]
    });
    if (!current) return { topic: null };

    const ownedRecipeMap = await this.loadOwnedRecipeMap(request, current.items.map(item => item.sourceVersionId));
    const history = await this.queryTopicHistory(request, current.periodStartDate, 1, 5);
    return {
      topic: this.toTopicDetail(request, current, ownedRecipeMap, history.items)
    };
  }

  async getTopic(request: RequestLike, topicId: UUID): Promise<HomeTopicDetailResponse> {
    const current = await this.prisma.homeTopic.findFirst({
      where: { id: topicId, status: TopicStatus.PUBLISHED },
      include: publicTopicInclude
    });
    if (!current) {
      throw new NotFoundException("本周灵感专题不存在");
    }
    const ownedRecipeMap = await this.loadOwnedRecipeMap(request, current.items.map(item => item.sourceVersionId));
    const history = await this.queryTopicHistory(request, current.periodStartDate, 1, 5);
    return {
      topic: this.toTopicDetail(request, current, ownedRecipeMap, history.items)
    };
  }

  async listTopicHistory(request: RequestLike, page: number, pageSize: number): Promise<PageResult<HomeTopicHistoryItem>> {
    const current = await this.prisma.homeTopic.findFirst({
      where: { status: TopicStatus.PUBLISHED },
      orderBy: [{ periodStartDate: "desc" }, { issueNo: "desc" }],
      select: { periodStartDate: true }
    });
    const nextPage = toPositiveInt(page, 1);
    const nextPageSize = Math.min(toPositiveInt(pageSize, 20), 100);
    if (!current) return { items: [], page: nextPage, pageSize: nextPageSize, total: 0, hasNext: false };
    return this.queryTopicHistory(request, current.periodStartDate, nextPage, nextPageSize);
  }

  async getAdminTopics(): Promise<AdminHomeTopicsResponse> {
    const topics = await this.listAdminTopics(this.prisma);
    return {
      topics: topics.map(item => this.toAdminTopic(item)),
      recTypes: topicTypes
    };
  }

  async searchRecipes(keyword?: string): Promise<HomeTopicRecipeSearchResponse> {
    const searchKey = keyword?.trim() ?? "";
    const recipeId = /^\d+$/.test(searchKey) ? Number(searchKey) : null;
    const items = await this.prisma.recipe.findMany({
      where: {
        ...recipeWhere,
        ...(searchKey
          ? recipeId
            ? {
                OR: [{ id: recipeId }, { searchText: { contains: searchKey } }]
              }
            : { searchText: { contains: searchKey } }
          : {})
      },
      include: {
        inspirationCategory: true,
        currentVersion: true
      },
      orderBy: [{ collectCount: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
      take: 20
    });
    return {
      items: items.map((item, index) => this.toSearchRecipe(item, index + 1))
    };
  }

  async createTopic(adminId: UUID, operationId: OperationId, body: CreateHomeTopicRequest): Promise<AdminHomeTopicsResponse> {
    const data = this.topicData(body);
    const requestHash = hashText(JSON.stringify(data));

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminHomeTopicsResponse>(tx, operationId, "admin-home-topics:create", adminId, requestHash);
      if (repeated) return repeated;

      await startAdminIdempotentOperation(tx, operationId, "admin-home-topics:create", adminId, requestHash);
      const recipes = await this.loadRecipes(tx, data.items.map(item => item.recipeId));
      const recipeMap = new Map(recipes.map(recipe => [recipe.id, recipe]));

      try {
        await tx.homeTopic.create({
          data: {
            title: data.title,
            subTitle: data.subTitle,
            recType: data.recType as TopicType,
            status: "DRAFT",
            issueNo: data.issueNo,
            description: data.description,
            coverImageUrl: null,
            periodStartDate: nextBeijingWeekStart(new Date()),
            publishedAt: null,
            items: {
              createMany: {
                data: data.items.map(item => {
                  const recipe = recipeMap.get(item.recipeId);
                  if (!recipe) throw new BadRequestException("本期推荐里包含不可用的灵感菜谱");
                  return {
                    recipeId: recipe.id,
                    sourceVersionId: recipe.currentVersionId,
                    weekday: item.weekday,
                    sortOrder: item.sortOrder,
                    recommendNote: item.recommendNote
                  };
                })
              }
            }
          }
        });
      } catch (error) {
        this.raiseTopicWriteError(error, data.issueNo);
      }

      const result = await this.getAdminTopicsFromTx(tx);
      await completeAdminIdempotentOperation(tx, operationId, "admin-home-topics:create", adminId, requestHash, result);
      return result;
    });
  }

  async setTopicStatus(
    adminId: UUID,
    topicId: UUID,
    operationId: OperationId,
    body: SetHomeTopicStatusRequest
  ): Promise<AdminHomeTopicItem> {
    const requestHash = hashText(JSON.stringify({ topicId, status: body.status, expectedVersion: body.expectedVersion }));

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminHomeTopicItem>(tx, operationId, "admin-home-topics:status", adminId, requestHash);
      if (repeated) return repeated;

      await startAdminIdempotentOperation(tx, operationId, "admin-home-topics:status", adminId, requestHash);

      const current = await this.requireTopic(tx, topicId);
      if (current.version !== body.expectedVersion) {
        throw new ConflictException("本周灵感专题已被更新，请刷新后重试");
      }

      const fromStatus = current.status as HomeTopicStatus;
      if (fromStatus !== body.status) {
        const now = new Date();
        let updateData: Prisma.HomeTopicUpdateInput;
        if (fromStatus === "DRAFT" && body.status === "PUBLISHED") {
          this.assertPublishReady(current.items.filter(item => this.isPublicTopicItem(item)));
          updateData = {
            status: "PUBLISHED",
            periodStartDate: nextBeijingWeekStart(now),
            scheduledPublishAt: null,
            publishedAt: now,
            version: { increment: 1 }
          };
        } else if (fromStatus === "PUBLISHED" && body.status === "UNLISTED") {
          updateData = { status: "UNLISTED", scheduledPublishAt: null, version: { increment: 1 } };
        } else if (fromStatus === "UNLISTED" && body.status === "DRAFT") {
          updateData = { status: "DRAFT", scheduledPublishAt: null, publishedAt: null, version: { increment: 1 } };
        } else {
          throw new BadRequestException("周刊状态不能按此方向切换");
        }
        try {
          await tx.homeTopic.update({ where: { id: topicId }, data: updateData });
        } catch (error) {
          this.raiseTopicWriteError(error, current.issueNo);
        }
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: body.status === "PUBLISHED" ? "HOME_TOPIC_PUBLISHED" : body.status === "UNLISTED" ? "HOME_TOPIC_UNLISTED" : "HOME_TOPIC_RESTORED_TO_DRAFT",
            objectType: "HOME_TOPIC",
            objectId: topicId,
            payload: { title: current.title, issueNo: current.issueNo, fromStatus, toStatus: body.status }
          }
        });
      }

      const result = await this.loadAdminTopic(tx, topicId);
      await completeAdminIdempotentOperation(tx, operationId, "admin-home-topics:status", adminId, requestHash, result);
      return result;
    });
  }

  async setTopicSchedule(
    adminId: UUID,
    topicId: UUID,
    operationId: OperationId,
    body: SetHomeTopicScheduleRequest
  ): Promise<AdminHomeTopicItem> {
    const scheduledPublishAt = body.scheduledPublishAt === null ? null : new Date(body.scheduledPublishAt);
    if (scheduledPublishAt && scheduledPublishAt.getTime() <= Date.now()) {
      throw new BadRequestException("预约发布时间必须晚于当前时间");
    }
    const requestHash = hashText(JSON.stringify({ topicId, scheduledPublishAt: scheduledPublishAt?.toISOString() ?? null, expectedVersion: body.expectedVersion }));

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminHomeTopicItem>(tx, operationId, "admin-home-topics:schedule", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-home-topics:schedule", adminId, requestHash);

      const current = await this.requireTopic(tx, topicId);
      if (current.version !== body.expectedVersion) throw new ConflictException("本周灵感专题已被更新，请刷新后重试");
      if (current.status !== "DRAFT") throw new BadRequestException("只有草稿周刊可以设置或取消预约");
      if (scheduledPublishAt) this.assertPublishReady(current.items.filter(item => this.isPublicTopicItem(item)));
      else if (!current.scheduledPublishAt) throw new BadRequestException("该草稿当前没有预约发布");

      try {
        await tx.homeTopic.update({
          where: { id: topicId },
          data: {
            scheduledPublishAt,
            ...(scheduledPublishAt ? { periodStartDate: nextBeijingWeekStart(scheduledPublishAt) } : {}),
            version: { increment: 1 }
          }
        });
      } catch (error) {
        this.raiseTopicWriteError(error, current.issueNo);
      }
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: scheduledPublishAt ? "HOME_TOPIC_SCHEDULED" : "HOME_TOPIC_SCHEDULE_CANCELLED",
          objectType: "HOME_TOPIC",
          objectId: topicId,
          payload: { title: current.title, issueNo: current.issueNo, scheduledPublishAt: scheduledPublishAt?.toISOString() ?? null }
        }
      });
      const result = await this.loadAdminTopic(tx, topicId);
      await completeAdminIdempotentOperation(tx, operationId, "admin-home-topics:schedule", adminId, requestHash, result);
      return result;
    });
  }

  async listTopicTodos(page: number, pageSize: number): Promise<PageResult<AdminHomeTopicTodoItem>> {
    const currentPage = toPositiveInt(page, 1);
    const currentPageSize = Math.min(toPositiveInt(pageSize, 20), 100);
    const skip = (currentPage - 1) * currentPageSize;
    const where: Prisma.HomeTopicItemWhereInput = {
      todoDismissedAt: null,
      recipe: {
        is: {
          OR: [
            { isInspiration: false },
            { inspirationCategoryId: null },
            { status: { not: "ACTIVE" } }
          ]
        }
      }
    };
    const [rows, total] = await Promise.all([
      this.prisma.homeTopicItem.findMany({
        where,
        select: {
          id: true,
          topicId: true,
          weekday: true,
          recipeId: true,
          sourceVersionId: true,
          topic: { select: { title: true, issueNo: true, periodStartDate: true, version: true } },
          sourceVersion: { select: { name: true } }
        },
        orderBy: [{ topic: { periodStartDate: "desc" } }, { weekday: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
        skip,
        take: currentPageSize
      }),
      this.prisma.homeTopicItem.count({ where })
    ]);
    return {
      items: rows.map(row => ({
        itemId: row.id,
        topicId: row.topicId,
        topicTitle: row.topic.title,
        issueNo: row.topic.issueNo,
        periodStartDate: isoDate(row.topic.periodStartDate),
        topicVersion: row.topic.version,
        weekday: row.weekday as HomeTopicWeekday,
        recipeId: row.recipeId,
        recipeName: row.sourceVersion.name,
        sourceVersionId: row.sourceVersionId
      })),
      page: currentPage,
      pageSize: currentPageSize,
      total,
      hasNext: skip + rows.length < total
    };
  }

  async replaceTopicItem(
    adminId: UUID,
    itemId: UUID,
    operationId: OperationId,
    body: ReplaceHomeTopicItemRequest
  ): Promise<AdminHomeTopicItem> {
    const requestHash = hashText(JSON.stringify({ itemId, replacementRecipeId: body.replacementRecipeId, expectedVersion: body.expectedVersion }));
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminHomeTopicItem>(tx, operationId, "admin-home-topic-items:replace", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-home-topic-items:replace", adminId, requestHash);

      const current = await tx.homeTopicItem.findUnique({ where: { id: itemId }, include: { topic: true } });
      if (!current) throw new NotFoundException("周刊菜谱项不存在");
      if (current.topic.version !== body.expectedVersion) throw new ConflictException("本周灵感专题已被更新，请刷新后重试");
      const [recipe] = await this.loadRecipes(tx, [body.replacementRecipeId]);
      const updatedTopic = await tx.homeTopic.updateMany({
        where: { id: current.topicId, version: body.expectedVersion },
        data: { version: { increment: 1 } }
      });
      if (updatedTopic.count !== 1) throw new ConflictException("本周灵感专题已被更新，请刷新后重试");
      try {
        await tx.homeTopicItem.update({
          where: { id: itemId },
          data: { recipeId: recipe.id, sourceVersionId: recipe.currentVersionId, todoDismissedAt: null }
        });
      } catch (error) {
        this.raiseTopicWriteError(error, current.topic.issueNo);
      }
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "HOME_TOPIC_ITEM_REPLACED",
          objectType: "HOME_TOPIC_ITEM",
          objectId: itemId,
          payload: { topicId: current.topicId, oldRecipeId: current.recipeId, newRecipeId: recipe.id }
        }
      });
      const result = await this.loadAdminTopic(tx, current.topicId);
      await completeAdminIdempotentOperation(tx, operationId, "admin-home-topic-items:replace", adminId, requestHash, result);
      return result;
    });
  }

  async dismissTopicTodo(
    adminId: UUID,
    itemId: UUID,
    operationId: OperationId,
    body: DismissHomeTopicTodoRequest
  ): Promise<AdminHomeTopicItem> {
    const requestHash = hashText(JSON.stringify({ itemId, expectedVersion: body.expectedVersion }));
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminHomeTopicItem>(tx, operationId, "admin-home-topic-items:dismiss", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-home-topic-items:dismiss", adminId, requestHash);

      const current = await tx.homeTopicItem.findUnique({ where: { id: itemId }, include: { topic: true, recipe: true } });
      if (!current) throw new NotFoundException("周刊菜谱项不存在");
      if (current.topic.version !== body.expectedVersion) throw new ConflictException("本周灵感专题已被更新，请刷新后重试");
      if (current.todoDismissedAt) throw new ConflictException("该失效菜谱待办已经忽略");
      if (current.recipe.isInspiration && current.recipe.inspirationCategoryId !== null && current.recipe.status === "ACTIVE") {
        throw new BadRequestException("该菜谱当前仍可公开展示，无需忽略待办");
      }
      const dismissedAt = new Date();
      const updatedTopic = await tx.homeTopic.updateMany({
        where: { id: current.topicId, version: body.expectedVersion },
        data: { version: { increment: 1 } }
      });
      if (updatedTopic.count !== 1) throw new ConflictException("本周灵感专题已被更新，请刷新后重试");
      await tx.homeTopicItem.update({ where: { id: itemId }, data: { todoDismissedAt: dismissedAt } });
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "HOME_TOPIC_ITEM_TODO_DISMISSED",
          objectType: "HOME_TOPIC_ITEM",
          objectId: itemId,
          payload: { topicId: current.topicId, recipeId: current.recipeId, dismissedAt: dismissedAt.toISOString() }
        }
      });
      const result = await this.loadAdminTopic(tx, current.topicId);
      await completeAdminIdempotentOperation(tx, operationId, "admin-home-topic-items:dismiss", adminId, requestHash, result);
      return result;
    });
  }

  async deleteTopic(
    adminId: UUID,
    topicId: UUID,
    operationId: OperationId,
    body: DeleteHomeTopicRequest
  ): Promise<AdminHomeTopicsResponse> {
    const requestHash = hashText(JSON.stringify({ topicId, expectedVersion: body.expectedVersion }));
    let backupPath: string | null = null;
    let stagedClear = false;

    let result: AdminHomeTopicsResponse;
    try {
      result = await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminHomeTopicsResponse>(tx, operationId, "admin-home-topics:delete", adminId, requestHash);
        if (repeated) return repeated;

        await startAdminIdempotentOperation(tx, operationId, "admin-home-topics:delete", adminId, requestHash);

        const current = await this.requireTopic(tx, topicId);
        if (current.version !== body.expectedVersion) {
          throw new ConflictException("本周灵感专题已被更新，请刷新后重试");
        }
        if (current.status !== "DRAFT") {
          throw new BadRequestException("只有草稿周刊可以删除；已下架周刊请先转为草稿");
        }

        backupPath = isTopicImagePath(current.coverImageUrl) ? await this.imageService.stageClear(topicId) : null;
        stagedClear = backupPath !== null;

        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "HOME_TOPIC_DELETED",
            objectType: "HOME_TOPIC",
            objectId: topicId,
            payload: { title: current.title, issueNo: current.issueNo }
          }
        });
        await tx.homeTopic.delete({
          where: { id: topicId }
        });

        const result = await this.getAdminTopicsFromTx(tx);
        await completeAdminIdempotentOperation(tx, operationId, "admin-home-topics:delete", adminId, requestHash, result);
        return result;
      });

    } catch (error) {
      if (stagedClear) {
        await this.imageService.rollbackClear(topicId, backupPath);
      }
      throw error;
    }

    if (stagedClear) {
      await this.imageService.finishClear(backupPath).catch(() => {});
    }
    return result;
  }

  async updateTopic(
    adminId: UUID,
    topicId: UUID,
    operationId: OperationId,
    body: UpdateHomeTopicRequest
  ): Promise<AdminHomeTopicsResponse> {
    const data = this.topicData(body);
    const requestHash = hashText(JSON.stringify({ topicId, ...data, expectedVersion: body.expectedVersion }));

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminHomeTopicsResponse>(tx, operationId, "admin-home-topics:update", adminId, requestHash);
      if (repeated) return repeated;

      await startAdminIdempotentOperation(tx, operationId, "admin-home-topics:update", adminId, requestHash);

      const current = await this.requireTopic(tx, topicId);
      if (current.version !== body.expectedVersion) {
        throw new ConflictException("本周灵感专题已被更新，请刷新后重试");
      }

      const unavailableItems = current.items.filter(item => !this.isPublicTopicItem(item));
      const unavailableIds = new Set(unavailableItems.map(item => item.recipeId));
      const editableItems = data.items.filter(item => !unavailableIds.has(item.recipeId));
      const recipes = await this.loadRecipes(tx, editableItems.map(item => item.recipeId));
      const sourceVersionMap = new Map(current.items.map(item => [item.recipeId, item.sourceVersionId]));
      const recipeMap = new Map(recipes.map(recipe => [recipe.id, recipe]));
      if (current.scheduledPublishAt) this.assertPublishReady(data.items.filter(item => !unavailableIds.has(item.recipeId)));
      try {
        for (let index = 0; index < unavailableItems.length; index += 1) {
          await tx.homeTopicItem.update({ where: { id: unavailableItems[index].id }, data: { sortOrder: 1_000_000 + index } });
        }
        await tx.homeTopic.update({
          where: { id: topicId },
          data: {
            title: data.title,
            subTitle: data.subTitle,
            recType: data.recType as TopicType,
            issueNo: data.issueNo,
            description: data.description,
            version: { increment: 1 },
            items: {
              deleteMany: unavailableItems.length ? { recipeId: { notIn: [...unavailableIds] } } : {},
              createMany: {
                data: editableItems.map(item => {
                  const recipe = recipeMap.get(item.recipeId);
                  if (!recipe) throw new BadRequestException("本期推荐里包含不可用的灵感菜谱");
                  return {
                    recipeId: recipe.id,
                    sourceVersionId: sourceVersionMap.get(recipe.id) ?? recipe.currentVersionId,
                    weekday: item.weekday,
                    sortOrder: item.sortOrder,
                    recommendNote: item.recommendNote
                  };
                })
              }
            }
          }
        });
        const nextSortByWeekday = new Map<HomeTopicWeekday, number>();
        for (const item of editableItems) nextSortByWeekday.set(item.weekday, Math.max(nextSortByWeekday.get(item.weekday) ?? 0, item.sortOrder));
        for (let index = 0; index < unavailableItems.length; index += 1) {
          const item = unavailableItems[index];
          const nextSort = (nextSortByWeekday.get(item.weekday as HomeTopicWeekday) ?? 0) + 1;
          await tx.homeTopicItem.update({ where: { id: item.id }, data: { sortOrder: nextSort } });
          nextSortByWeekday.set(item.weekday as HomeTopicWeekday, nextSort);
        }
      } catch (error) {
        this.raiseTopicWriteError(error, data.issueNo);
      }

      const result = await this.getAdminTopicsFromTx(tx);
      await completeAdminIdempotentOperation(tx, operationId, "admin-home-topics:update", adminId, requestHash, result);
      return result;
    });
  }

  async uploadTopicImage(
    adminId: UUID,
    topicId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    file: { buffer?: Buffer; size?: number } | undefined
  ): Promise<AdminHomeTopicItem> {
    const staged = await this.imageService.stageUpload(file);
    const requestHash = createHash("sha256")
      .update("upload:")
      .update(String(topicId))
      .update(":")
      .update(String(expectedVersion))
      .update(":")
      .update(staged.kind)
      .update(":")
      .update(file?.buffer ?? Buffer.alloc(0))
      .digest("hex");

    try {
      return await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminHomeTopicItem>(tx, operationId, "admin-home-topics:image:upload", adminId, requestHash);
        if (repeated) return repeated;

        await startAdminIdempotentOperation(tx, operationId, "admin-home-topics:image:upload", adminId, requestHash);

        const current = await this.requireTopic(tx, topicId);
        if (current.version !== expectedVersion) {
          throw new ConflictException("本周灵感专题已被更新，请刷新后重试");
        }

        const backupPath = await this.imageService.replaceImage(topicId, staged.tempPath, staged.kind);
        try {
          await tx.homeTopic.update({
            where: { id: topicId },
            data: {
              coverImageUrl: this.imageService.buildImagePath(topicId, staged.kind),
              version: { increment: 1 }
            }
          });
          await this.imageService.finishReplace(backupPath);
          const result = await this.loadAdminTopic(tx, topicId);
          await completeAdminIdempotentOperation(tx, operationId, "admin-home-topics:image:upload", adminId, requestHash, result);
          return result;
        } catch (error) {
          await this.imageService.rollbackReplace(topicId, backupPath);
          throw error;
        }
      });
    } finally {
      await this.imageService.discardTemp(staged.tempPath);
    }
  }

  async clearTopicImage(adminId: UUID, topicId: UUID, operationId: OperationId, expectedVersion: number): Promise<AdminHomeTopicItem> {
    const requestHash = `clear:${topicId}:${expectedVersion}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminHomeTopicItem>(tx, operationId, "admin-home-topics:image:clear", adminId, requestHash);
      if (repeated) return repeated;

      await startAdminIdempotentOperation(tx, operationId, "admin-home-topics:image:clear", adminId, requestHash);

      const current = await this.requireTopic(tx, topicId);
      if (current.version !== expectedVersion) {
        throw new ConflictException("本周灵感专题已被更新，请刷新后重试");
      }

      const backupPath = isTopicImagePath(current.coverImageUrl) ? await this.imageService.stageClear(topicId) : null;

      try {
        await tx.homeTopic.update({
          where: { id: topicId },
          data: {
            coverImageUrl: null,
            version: { increment: 1 }
          }
        });
        await this.imageService.finishClear(backupPath);
        const result = await this.loadAdminTopic(tx, topicId);
        await completeAdminIdempotentOperation(tx, operationId, "admin-home-topics:image:clear", adminId, requestHash, result);
        return result;
      } catch (error) {
        await this.imageService.rollbackClear(topicId, backupPath);
        throw error;
      }
    });
  }

  async getTopicImage(topicId: UUID) {
    const topic = await this.requireTopic(this.prisma, topicId);
    if (!isTopicImagePath(topic.coverImageUrl)) {
      throw new NotFoundException("本周灵感专题封面图不存在");
    }
    return this.imageService.getImage(topicId);
  }

  private async getAdminTopicsFromTx(tx: TopicDb) {
    const topics = await this.listAdminTopics(tx);
    return {
      topics: topics.map(item => this.toAdminTopic(item)),
      recTypes: topicTypes
    } satisfies AdminHomeTopicsResponse;
  }

  private async loadAdminTopic(db: TopicDb, topicId: UUID) {
    const topic = await this.loadTopic(db, topicId);
    return this.toAdminTopic(topic);
  }

  private async queryTopicHistory(
    request: RequestLike,
    currentPeriodStartDate: Date,
    page: number,
    pageSize: number
  ): Promise<PageResult<HomeTopicHistoryItem>> {
    const where = { status: TopicStatus.PUBLISHED, periodStartDate: { lt: currentPeriodStartDate } } satisfies Prisma.HomeTopicWhereInput;
    const skip = (page - 1) * pageSize;
    const [topics, total] = await Promise.all([
      this.prisma.homeTopic.findMany({
        where,
        select: historyTopicSelect,
        orderBy: [{ periodStartDate: "desc" }, { issueNo: "desc" }],
        skip,
        take: pageSize
      }),
      this.prisma.homeTopic.count({ where })
    ]);
    return {
      items: topics.map(item => this.toHistoryItem(request, item)),
      page,
      pageSize,
      total,
      hasNext: skip + topics.length < total
    };
  }

  private async listAdminTopics(db: TopicDb) {
    return db.homeTopic.findMany({
      include: {
        items: {
          include: {
            sourceVersion: true,
            recipe: {
              include: {
                inspirationCategory: true
              }
            }
          },
          orderBy: [{ weekday: "asc" }, { sortOrder: "asc" }, { id: "asc" }]
        }
      },
      orderBy: [{ status: "asc" }, { publishedAt: "desc" }, { id: "desc" }]
    });
  }

  private async loadTopic(db: TopicDb, topicId: UUID) {
    const topic = await db.homeTopic.findUnique({
      where: { id: topicId },
      include: {
        items: {
          include: {
            sourceVersion: true,
            recipe: {
              include: {
                inspirationCategory: true
              }
            }
          },
          orderBy: [{ weekday: "asc" }, { sortOrder: "asc" }, { id: "asc" }]
        }
      }
    });
    if (!topic) {
      throw new NotFoundException("本周灵感专题不存在");
    }
    return topic;
  }

  private async requireTopic(db: TopicDb, topicId: UUID) {
    return this.loadTopic(db, topicId);
  }

  private async loadRecipes(db: TopicDb, recipeIds: UUID[]) {
    const items = await db.recipe.findMany({
      where: {
        ...recipeWhere,
        id: { in: recipeIds }
      },
      include: {
        inspirationCategory: true,
        currentVersion: true
      }
    });
    if (items.length !== recipeIds.length) {
      throw new BadRequestException("本期推荐里包含不可用的灵感菜谱");
    }
    const itemMap = new Map(items.map(item => [item.id, item]));
    return recipeIds.map(recipeId => {
      const item = itemMap.get(recipeId);
      if (!item || !item.inspirationCategory) {
        throw new BadRequestException("本期推荐里包含不可用的灵感菜谱");
      }
      return item;
    });
  }

  private topicData(body: CreateHomeTopicRequest | UpdateHomeTopicRequest) {
    return {
      title: body.title.trim(),
      subTitle: cleanText(body.subTitle),
      recType: body.recType,
      issueNo: body.issueNo,
      description: body.description.trim(),
      items: body.items.map(item => ({
        recipeId: item.recipeId,
        weekday: item.weekday,
        sortOrder: item.sortOrder,
        recommendNote: cleanText(item.recommendNote)
      }))
    };
  }

  private assertPublishReady(items: Array<{ weekday: HomeTopicWeekday }>) {
    const configured = new Set(items.map(item => item.weekday));
    const missing = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].filter(day => !configured.has(day as HomeTopicWeekday));
    if (missing.length) {
      const names = { MONDAY: "周一", TUESDAY: "周二", WEDNESDAY: "周三", THURSDAY: "周四", FRIDAY: "周五", SATURDAY: "周六", SUNDAY: "周日" } as const;
      throw new BadRequestException(`周刊发布前每天至少需要一道可公开菜谱：${missing.map(day => names[day as keyof typeof names]).join("、")}`);
    }
  }

  private isPublicTopicItem(item: { recipe: { isInspiration: boolean; inspirationCategoryId: number | null; status: string } }) {
    return item.recipe.isInspiration && item.recipe.inspirationCategoryId !== null && item.recipe.status === "ACTIVE";
  }

  private toTopicDetail(
    request: RequestLike,
    topic: TopicRow,
    ownedRecipeMap: Map<UUID, UUID>,
    historyItems: HomeTopicHistoryItem[]
  ): HomeTopicDetail {
    return {
      id: topic.id,
      title: topic.title,
      subTitle: topic.subTitle,
      recType: topic.recType as HomeTopicType,
      recTypeText: topicTypeText(topic.recType as HomeTopicType),
      issueNo: topic.issueNo,
      periodStartDate: isoDate(topic.periodStartDate),
      periodEndDate: isoDate(beijingWeekEnd(topic.periodStartDate)),
      description: topic.description,
      coverImageUrl: this.resolveImageUrl(request, topic.coverImageUrl, topic.updatedAt),
      recipeCount: topic.items.length,
      publishedAt: toIso(topic.publishedAt!),
      updatedAt: toIso(topic.updatedAt),
      items: topic.items.map(item =>
        this.toTopicRecipe(item, ownedRecipeMap.get(item.sourceVersionId) ?? null)
      ),
      history: historyItems
    };
  }

  private toAdminTopic(topic: TopicRow): AdminHomeTopicItem {
    return {
      id: topic.id,
      title: topic.title,
      subTitle: topic.subTitle,
      recType: topic.recType as HomeTopicType,
      recTypeText: topicTypeText(topic.recType as HomeTopicType),
      status: topic.status as HomeTopicStatus,
      issueNo: topic.issueNo,
      periodStartDate: isoDate(topic.periodStartDate),
      periodEndDate: isoDate(beijingWeekEnd(topic.periodStartDate)),
      scheduledPublishAt: topic.scheduledPublishAt ? toIso(topic.scheduledPublishAt) : null,
      description: topic.description,
      coverImageUrl: topic.coverImageUrl,
      recipeCount: topic.items.length,
      publishedAt: topic.publishedAt ? toIso(topic.publishedAt) : null,
      updatedAt: toIso(topic.updatedAt),
      items: topic.items.map(item => ({ ...this.toTopicRecipe(item, null), publiclyAvailable: this.isPublicTopicItem(item) })),
      version: topic.version
    };
  }

  private toHistoryItem(request: RequestLike, topic: HistoryTopicRow): HomeTopicHistoryItem {
    return {
      id: topic.id,
      title: topic.title,
      subTitle: topic.subTitle,
      recType: topic.recType as HomeTopicType,
      recTypeText: topicTypeText(topic.recType as HomeTopicType),
      issueNo: topic.issueNo,
      periodStartDate: isoDate(topic.periodStartDate),
      periodEndDate: isoDate(beijingWeekEnd(topic.periodStartDate)),
      description: topic.description,
      coverImageUrl: this.resolveImageUrl(request, topic.coverImageUrl, topic.updatedAt),
      recipeCount: topic._count.items,
      publishedAt: toIso(topic.publishedAt!),
      updatedAt: toIso(topic.updatedAt)
    };
  }

  private toTopicRecipe(item: TopicRow["items"][number], ownedRecipeId: UUID | null): HomeTopicRecipeItem {
    const category = item.recipe.inspirationCategory;
    const sourceVersion = item.sourceVersion;
    return {
      id: item.recipe.id,
      sourceVersionId: item.sourceVersionId,
      weekday: item.weekday as HomeTopicWeekday,
      sort: item.sortOrder,
      title: sourceVersion.name,
      coverImageUrl: item.recipe.coverImageUrl,
      ownedRecipeId,
      recommendNote: item.recommendNote ?? null,
      difficulty: (sourceVersion.difficulty ?? null) as RecipeDifficulty | null,
      duration: (sourceVersion.duration ?? null) as RecipeDuration | null,
      difficultyText: recipeDifficultyText((sourceVersion.difficulty ?? null) as RecipeDifficulty | null),
      durationText: recipeDurationText((sourceVersion.duration ?? null) as RecipeDuration | null),
      category: {
        id: category?.id ?? 0,
        name: category?.name ?? "菜谱已失效",
        iconKey: category?.iconKey ?? null
      },
      collectCount: item.recipe.collectCount,
      updatedAt: toIso(sourceVersion.createdAt)
    };
  }

  private toSearchRecipe(recipe: RecipeRow, sort: number): HomeTopicRecipeSearchItem {
    const category = recipe.inspirationCategory;
    return {
      id: recipe.id,
      sourceVersionId: recipe.currentVersionId,
      sort,
      title: recipe.title,
      coverImageUrl: recipe.coverImageUrl,
      ownedRecipeId: null,
      recommendNote: null,
      difficulty: (recipe.currentVersion.difficulty ?? null) as RecipeDifficulty | null,
      duration: (recipe.currentVersion.duration ?? null) as RecipeDuration | null,
      difficultyText: recipeDifficultyText((recipe.currentVersion.difficulty ?? null) as RecipeDifficulty | null),
      durationText: recipeDurationText((recipe.currentVersion.duration ?? null) as RecipeDuration | null),
      category: {
        id: category!.id,
        name: category!.name,
        iconKey: category!.iconKey ?? null
      },
      collectCount: recipe.collectCount,
      updatedAt: toIso(recipe.updatedAt)
    };
  }

  private async loadOwnedRecipeMap(request: RequestLike, sourceVersionIds: UUID[]) {
    const userId = await this.resolveOptionalUserId(request);
    if (!userId || !sourceVersionIds.length) return new Map<UUID, UUID>();

    const ownedItems = await this.prisma.recipe.findMany({
      where: {
        ownerId: userId,
        status: activeOwnedRecipeStatus,
        originVersionId: { in: Array.from(new Set(sourceVersionIds)) }
      },
      select: {
        id: true,
        originVersionId: true,
        updatedAt: true
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }]
    });

    const result = new Map<UUID, UUID>();
    for (const item of ownedItems) {
      if (!item.originVersionId || result.has(item.originVersionId)) continue;
      result.set(item.originVersionId, item.id);
    }
    return result;
  }

  private async resolveOptionalUserId(request: RequestLike) {
    const token = readBearerToken(request.headers?.authorization);
    if (!token) return null;

    try {
      const payload = this.userTokenService.verifyToken(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { status: true, sessionVersion: true }
      });
      if (!user || user.status !== "ACTIVE" || user.sessionVersion !== payload.ver) {
        return null;
      }
      return payload.sub;
    } catch {
      return null;
    }
  }

  private resolveImageUrl(request: RequestLike, value: string | null, updatedAt: Date) {
    if (!value) return null;
    if (isTopicImagePath(value)) {
      const path = `${value}?v=${encodeURIComponent(updatedAt.toISOString())}`;
      return this.toAbsUrl(request, path);
    }
    return value;
  }

  private toAbsUrl(request: RequestLike, path: string) {
    const host = request.get?.("host");
    const proto = request.get?.("x-forwarded-proto") || request.protocol || "https";
    if (!host) return path;
    return `${proto}://${host}${path}`;
  }

  private raiseTopicWriteError(error: unknown, issueNo: number): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : String(error.meta?.target ?? "");
      if (target.includes("period_start_date")) throw new ConflictException("该自然周已存在周刊，请编辑已有期数或调整预约时间");
      if (target.includes("topic_id") && target.includes("weekday") && target.includes("sort_order")) {
        throw new ConflictException("同一天的菜单顺序重复，请刷新后重试");
      }
      throw new ConflictException(`第 ${issueNo} 期已存在，请调整期数后重试`);
    }
    throw error;
  }
}

function readBearerToken(authorization?: string) {
  if (!authorization?.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice("Bearer ".length).trim();
}
