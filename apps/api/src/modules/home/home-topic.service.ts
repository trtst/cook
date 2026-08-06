import { createHash } from "node:crypto";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { HomeTopicStatus as TopicStatus, HomeTopicType as TopicType, Prisma } from "@prisma/client";
import { completeAdminIdempotentOperation, getAdminIdempotentResult, startAdminIdempotentOperation } from "../../common/idempotency";
import { PrismaService } from "../../common/prisma.service";
import type {
  AdminHomeTopicItem,
  AdminHomeTopicsResponse,
  CreateHomeTopicRequest,
  HomeTopicStatus,
  HomeTopicCurrentResponse,
  HomeTopicDetail,
  HomeTopicDetailResponse,
  HomeTopicHistoryItem,
  HomeTopicRecipeItem,
  HomeTopicRecipeSearchResponse,
  HomeTopicType,
  HomeTopicTypeOption,
  OperationId,
  RecipeDifficulty,
  RecipeDuration,
  SetHomeTopicStatusRequest,
  UUID,
  UpdateHomeTopicRequest
} from "../../contracts/types";
import { HomeTopicImageService } from "./home-topic-image.service";

type TopicDb = Prisma.TransactionClient | PrismaService;
type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

type TopicRow = Prisma.HomeTopicGetPayload<{
  include: {
    items: {
      include: {
        recipe: {
          include: {
            inspirationCategory: true;
            currentVersion: true;
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

const topicTypes: HomeTopicTypeOption[] = [
  { label: "周末聚餐", value: "WEEKEND_GATHERING" },
  { label: "下班快做", value: "QUICK_AFTER_WORK" },
  { label: "家常下饭", value: "HOME_STYLE" },
  { label: "一人食", value: "ONE_PERSON" },
  { label: "早餐灵感", value: "BREAKFAST" },
  { label: "轻松一餐", value: "LIGHT_DINNER" }
];
const topicImagePath = /^\/api\/public-assets\/home-topics\/\d+$/i;
const recipeWhere: Prisma.RecipeWhereInput = {
  ownerId: null,
  inspirationCategoryId: { not: null },
  status: "ACTIVE"
};

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

function isTopicImagePath(value: string | null | undefined) {
  return Boolean(value && topicImagePath.test(value));
}

@Injectable()
export class HomeTopicService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(HomeTopicImageService) private readonly imageService: HomeTopicImageService
  ) {}

  async getCurrentTopic(request: RequestLike): Promise<HomeTopicCurrentResponse> {
    const topics = await this.listPublicTopics(this.prisma);
    const current = topics[0];
    return {
      topic: current ? this.toTopicDetail(request, current, topics) : null
    };
  }

  async getTopic(request: RequestLike, topicId: UUID): Promise<HomeTopicDetailResponse> {
    const topics = await this.listPublicTopics(this.prisma);
    const current = topics.find(item => item.id === topicId);
    if (!current) {
      throw new NotFoundException("本周灵感专题不存在");
    }
    return {
      topic: this.toTopicDetail(request, current, topics)
    };
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
      orderBy: [{ collectCount: "desc" }, { likeCount: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
      take: 20
    });
    return {
      items: items.map((item, index) => this.toTopicRecipe(item, index + 1))
    };
  }

  async createTopic(adminId: UUID, operationId: OperationId, body: CreateHomeTopicRequest): Promise<AdminHomeTopicsResponse> {
    const data = this.topicData(body);
    const requestHash = hashText(JSON.stringify(data));

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminHomeTopicsResponse>(tx, operationId, "admin-home-topics:create", adminId, requestHash);
      if (repeated) return repeated;

      await startAdminIdempotentOperation(tx, operationId, "admin-home-topics:create", adminId, requestHash);
      const recipes = await this.loadRecipes(tx, data.recipeIds);

      try {
        await tx.homeTopic.create({
          data: {
            title: data.title,
            subTitle: data.subTitle,
            recType: data.recType as TopicType,
            status: "UNLISTED",
            issueNo: data.issueNo,
            description: data.description,
            coverImageUrl: null,
            publishedAt: new Date(),
            items: {
              createMany: {
                data: recipes.map((item, index) => ({
                  recipeId: item.id,
                  sortOrder: index + 1
                }))
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

      if ((current.status as HomeTopicStatus) !== body.status) {
        await tx.homeTopic.update({
          where: { id: topicId },
          data: {
            status: body.status as TopicStatus,
            ...(body.status === "LISTED" ? { publishedAt: new Date() } : {}),
            version: { increment: 1 }
          }
        });
      }

      const result = await this.loadAdminTopic(tx, topicId);
      await completeAdminIdempotentOperation(tx, operationId, "admin-home-topics:status", adminId, requestHash, result);
      return result;
    });
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

      const recipes = await this.loadRecipes(tx, data.recipeIds);
      try {
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
              deleteMany: {},
              createMany: {
                data: recipes.map((item, index) => ({
                  recipeId: item.id,
                  sortOrder: index + 1
                }))
              }
            }
          }
        });
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
              coverImageUrl: this.imageService.buildImagePath(topicId),
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

      const backupPath =
        current.coverImageUrl === this.imageService.buildImagePath(topicId) ? await this.imageService.stageClear(topicId) : null;

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
    if (topic.coverImageUrl !== this.imageService.buildImagePath(topicId)) {
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

  private async listPublicTopics(db: TopicDb) {
    return db.homeTopic.findMany({
      where: { status: "LISTED" },
      include: {
        items: {
          where: { recipe: recipeWhere },
          include: {
            recipe: {
              include: {
                inspirationCategory: true,
                currentVersion: true
              }
            }
          },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
        }
      },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }]
    });
  }

  private async listAdminTopics(db: TopicDb) {
    return db.homeTopic.findMany({
      include: {
        items: {
          where: { recipe: recipeWhere },
          include: {
            recipe: {
              include: {
                inspirationCategory: true,
                currentVersion: true
              }
            }
          },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
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
          where: { recipe: recipeWhere },
          include: {
            recipe: {
              include: {
                inspirationCategory: true,
                currentVersion: true
              }
            }
          },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
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
      recipeIds: body.recipeIds
    };
  }

  private toTopicDetail(request: RequestLike, topic: TopicRow, allTopics: TopicRow[]): HomeTopicDetail {
    const currentIndex = allTopics.findIndex(item => item.id === topic.id);
    const historyItems = currentIndex >= 0 ? allTopics.slice(currentIndex + 1) : allTopics.filter(item => item.id !== topic.id);

    return {
      id: topic.id,
      title: topic.title,
      subTitle: topic.subTitle,
      recType: topic.recType as HomeTopicType,
      issueNo: topic.issueNo,
      description: topic.description,
      coverImageUrl: this.resolveImageUrl(request, topic.coverImageUrl, topic.updatedAt),
      recipeCount: topic.items.length,
      publishedAt: toIso(topic.publishedAt),
      updatedAt: toIso(topic.updatedAt),
      items: topic.items.map(item => this.toTopicRecipe(item.recipe, item.sortOrder)),
      history: historyItems.map(item => this.toHistoryItem(request, item))
    };
  }

  private toAdminTopic(topic: TopicRow): AdminHomeTopicItem {
    return {
      id: topic.id,
      title: topic.title,
      subTitle: topic.subTitle,
      recType: topic.recType as HomeTopicType,
      status: topic.status as HomeTopicStatus,
      issueNo: topic.issueNo,
      description: topic.description,
      coverImageUrl: topic.coverImageUrl,
      recipeCount: topic.items.length,
      publishedAt: toIso(topic.publishedAt),
      updatedAt: toIso(topic.updatedAt),
      items: topic.items.map(item => this.toTopicRecipe(item.recipe, item.sortOrder)),
      version: topic.version
    };
  }

  private toHistoryItem(request: RequestLike, topic: TopicRow): HomeTopicHistoryItem {
    return {
      id: topic.id,
      title: topic.title,
      subTitle: topic.subTitle,
      recType: topic.recType as HomeTopicType,
      issueNo: topic.issueNo,
      description: topic.description,
      coverImageUrl: this.resolveImageUrl(request, topic.coverImageUrl, topic.updatedAt),
      recipeCount: topic.items.length,
      publishedAt: toIso(topic.publishedAt),
      updatedAt: toIso(topic.updatedAt)
    };
  }

  private toTopicRecipe(recipe: RecipeRow, sort: number): HomeTopicRecipeItem {
    const category = recipe.inspirationCategory;
    return {
      id: recipe.id,
      sort,
      title: recipe.title,
      coverImageUrl: recipe.coverImageUrl,
      difficulty: (recipe.currentVersion.difficulty ?? null) as RecipeDifficulty | null,
      duration: (recipe.currentVersion.duration ?? null) as RecipeDuration | null,
      category: {
        id: category!.id,
        name: category!.name,
        iconKey: category!.iconKey ?? null
      },
      likeCount: recipe.likeCount,
      collectCount: recipe.collectCount,
      updatedAt: toIso(recipe.updatedAt)
    };
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
      throw new ConflictException(`第 ${issueNo} 期已存在，请调整期数后重试`);
    }
    throw error;
  }
}
