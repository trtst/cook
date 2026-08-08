import { createHash } from "node:crypto";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, TableTopicStatus as TopicStatus } from "@prisma/client";
import { completeAdminIdempotentOperation, completeIdempotentOperation, getAdminIdempotentResult, getIdempotentResult, startAdminIdempotentOperation, startIdempotentOperation } from "../../common/idempotency";
import { PrismaService } from "../../common/prisma.service";
import { UserTokenService } from "../../common/security/user-token.service";
import type {
  AdminTableTopicItem,
  AdminTableTopicsResponse,
  CreateTableTopicRequest,
  OperationId,
  SetTableTopicStatusRequest,
  TableTopicDetail,
  TableTopicDetailResponse,
  TableTopicListItem,
  TableTopicListResponse,
  UUID,
  UpdateTableTopicRequest
} from "../../contracts/types";
import { TableTopicImageService } from "./table-topic-image.service";

type TableTopicDb = Prisma.TransactionClient | PrismaService;
type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
  headers?: {
    authorization?: string;
  };
};

type TableTopicRow = Prisma.TableTopicGetPayload<{
  include: {
    _count: {
      select: {
        participants: true;
      };
    };
  };
}>;

const topicImagePath = /^\/api\/public-assets\/table-topics\/\d+$/i;

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

function readBearerToken(authorization?: string) {
  if (!authorization?.startsWith("Bearer ")) return "";
  return authorization.slice("Bearer ".length).trim();
}

@Injectable()
export class TableTopicService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TableTopicImageService) private readonly imageService: TableTopicImageService,
    @Inject(UserTokenService) private readonly userTokenService: UserTokenService
  ) {}

  async listTopics(request: RequestLike): Promise<TableTopicListResponse> {
    const topics = await this.listPublicTopics(this.prisma);
    return {
      items: topics.map(item => this.toListItem(request, item))
    };
  }

  async getTopic(request: RequestLike, topicId: UUID): Promise<TableTopicDetailResponse> {
    const topic = await this.prisma.tableTopic.findFirst({
      where: { id: topicId, status: TopicStatus.LISTED },
      include: {
        _count: {
          select: {
            participants: true
          }
        }
      }
    });
    if (!topic) {
      throw new NotFoundException("餐桌话题不存在");
    }

    const userId = await this.resolveOptionalUserId(request);
    const joined = userId ? await this.hasJoined(this.prisma, topic.id, userId) : false;
    return {
      topic: this.toTopicDetail(request, topic, joined)
    };
  }

  async participate(request: RequestLike, userId: UUID, topicId: UUID, operationId: OperationId): Promise<TableTopicDetailResponse> {
    return this.prisma.$transaction(async tx => {
      const requestHash = JSON.stringify({ topicId });
      const repeated = await getIdempotentResult<TableTopicDetailResponse>(tx, operationId, "table-topics:participate", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "table-topics:participate", userId, null, requestHash);

      const topic = await tx.tableTopic.findFirst({
        where: { id: topicId, status: TopicStatus.LISTED },
        include: {
          _count: {
            select: {
              participants: true
            }
          }
        }
      });
      if (!topic) {
        throw new NotFoundException("餐桌话题不存在");
      }

      await tx.tableTopicParticipant.createMany({
        data: [
          {
            topicId,
            userId
          }
        ],
        skipDuplicates: true
      });

      const fresh = await tx.tableTopic.findFirst({
        where: { id: topicId, status: TopicStatus.LISTED },
        include: {
          _count: {
            select: {
              participants: true
            }
          }
        }
      });
      if (!fresh) {
        throw new NotFoundException("餐桌话题不存在");
      }

      const result = {
        topic: this.toTopicDetail(request, fresh, true)
      } satisfies TableTopicDetailResponse;
      await completeIdempotentOperation(tx, operationId, "table-topics:participate", userId, null, requestHash, result);
      return result;
    });
  }

  async getAdminTopics(request: RequestLike): Promise<AdminTableTopicsResponse> {
    const topics = await this.listAdminTopics(this.prisma);
    return {
      topics: topics.map(item => this.toAdminTopic(request, item))
    };
  }

  async createTopic(
    request: RequestLike,
    adminId: UUID,
    operationId: OperationId,
    body: CreateTableTopicRequest
  ): Promise<AdminTableTopicsResponse> {
    return this.prisma.$transaction(async tx => {
      const requestHash = hashText(JSON.stringify(body));
      const repeated = await getAdminIdempotentResult<AdminTableTopicsResponse>(tx, operationId, "admin-table-topics:create", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-table-topics:create", adminId, requestHash);

      await tx.tableTopic.create({
        data: this.topicData(body)
      });

      const result = await this.buildAdminTopicsResponse(request, tx);
      await completeAdminIdempotentOperation(tx, operationId, "admin-table-topics:create", adminId, requestHash, result);
      return result;
    });
  }

  async updateTopic(
    request: RequestLike,
    adminId: UUID,
    topicId: UUID,
    operationId: OperationId,
    body: UpdateTableTopicRequest
  ): Promise<AdminTableTopicsResponse> {
    return this.prisma.$transaction(async tx => {
      const requestHash = hashText(JSON.stringify({ topicId, ...body }));
      const repeated = await getAdminIdempotentResult<AdminTableTopicsResponse>(tx, operationId, "admin-table-topics:update", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-table-topics:update", adminId, requestHash);

      const current = await tx.tableTopic.findUnique({
        where: { id: topicId },
        select: { version: true }
      });
      if (!current) {
        throw new NotFoundException("餐桌话题不存在");
      }
      if (current.version !== body.expectedVersion) {
        throw new ConflictException("餐桌话题已被更新，请刷新后重试");
      }

      await tx.tableTopic.update({
        where: { id: topicId },
        data: {
          ...this.topicData(body),
          version: {
            increment: 1
          }
        }
      });

      const result = await this.buildAdminTopicsResponse(request, tx);
      await completeAdminIdempotentOperation(tx, operationId, "admin-table-topics:update", adminId, requestHash, result);
      return result;
    });
  }

  async setTopicStatus(
    request: RequestLike,
    adminId: UUID,
    topicId: UUID,
    operationId: OperationId,
    body: SetTableTopicStatusRequest
  ): Promise<AdminTableTopicItem> {
    return this.prisma.$transaction(async tx => {
      const requestHash = hashText(JSON.stringify({ topicId, ...body }));
      const repeated = await getAdminIdempotentResult<AdminTableTopicItem>(tx, operationId, "admin-table-topics:status", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-table-topics:status", adminId, requestHash);

      const current = await this.findAdminTopic(tx, topicId);
      if (current.version !== body.expectedVersion) {
        throw new ConflictException("餐桌话题已被更新，请刷新后重试");
      }

      const next = await tx.tableTopic.update({
        where: { id: topicId },
        data: {
          status: body.status,
          version: {
            increment: 1
          }
        },
        include: {
          _count: {
            select: {
              participants: true
            }
          }
        }
      });

      const result = this.toAdminTopic(request, next);
      await completeAdminIdempotentOperation(tx, operationId, "admin-table-topics:status", adminId, requestHash, result);
      return result;
    });
  }

  async uploadTopicImage(
    request: RequestLike,
    adminId: UUID,
    topicId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    file?: { buffer?: Buffer; size?: number }
  ): Promise<AdminTableTopicItem> {
    const staged = await this.imageService.stageUpload(file);
    try {
      return await this.prisma.$transaction(async tx => {
        const requestHash = hashText(JSON.stringify({ topicId, expectedVersion, hasFile: true }));
        const repeated = await getAdminIdempotentResult<AdminTableTopicItem>(tx, operationId, "admin-table-topics:image:upload", adminId, requestHash);
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, operationId, "admin-table-topics:image:upload", adminId, requestHash);

        const current = await this.findAdminTopic(tx, topicId);
        if (current.version !== expectedVersion) {
          throw new ConflictException("餐桌话题已被更新，请刷新后重试");
        }

        const backupPath = await this.imageService.replaceImage(topicId, staged.tempPath, staged.kind);
        try {
          const next = await tx.tableTopic.update({
            where: { id: topicId },
            data: {
              coverImageUrl: this.imageService.buildImagePath(topicId),
              version: {
                increment: 1
              }
            },
            include: {
              _count: {
                select: {
                  participants: true
                }
              }
            }
          });
          await this.imageService.finishReplace(backupPath);
          const result = this.toAdminTopic(request, next);
          await completeAdminIdempotentOperation(tx, operationId, "admin-table-topics:image:upload", adminId, requestHash, result);
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

  async clearTopicImage(
    request: RequestLike,
    adminId: UUID,
    topicId: UUID,
    operationId: OperationId,
    expectedVersion: number
  ): Promise<AdminTableTopicItem> {
    return this.prisma.$transaction(async tx => {
      const requestHash = hashText(JSON.stringify({ topicId, expectedVersion, clear: true }));
      const repeated = await getAdminIdempotentResult<AdminTableTopicItem>(tx, operationId, "admin-table-topics:image:clear", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-table-topics:image:clear", adminId, requestHash);

      const current = await this.findAdminTopic(tx, topicId);
      if (current.version !== expectedVersion) {
        throw new ConflictException("餐桌话题已被更新，请刷新后重试");
      }

      const backupPath = await this.imageService.stageClear(topicId);
      try {
        const next = await tx.tableTopic.update({
          where: { id: topicId },
          data: {
            coverImageUrl: null,
            version: {
              increment: 1
            }
          },
          include: {
            _count: {
              select: {
                participants: true
              }
            }
          }
        });
        await this.imageService.finishClear(backupPath);
        const result = this.toAdminTopic(request, next);
        await completeAdminIdempotentOperation(tx, operationId, "admin-table-topics:image:clear", adminId, requestHash, result);
        return result;
      } catch (error) {
        await this.imageService.rollbackClear(topicId, backupPath);
        throw error;
      }
    });
  }

  getTopicImage(topicId: UUID) {
    return this.imageService.getImage(topicId);
  }

  private async buildAdminTopicsResponse(request: RequestLike, db: TableTopicDb): Promise<AdminTableTopicsResponse> {
    const topics = await this.listAdminTopics(db);
    return {
      topics: topics.map(item => this.toAdminTopic(request, item))
    };
  }

  private topicData(body: CreateTableTopicRequest | UpdateTableTopicRequest) {
    this.assertTarget(body.targetType, body.targetValue);
    return {
      title: body.title.trim(),
      summary: body.summary.trim(),
      activityAt: new Date(body.activityAt),
      targetType: body.targetType,
      targetValue: cleanText(body.targetValue)
    };
  }

  private assertTarget(targetType: "PAGE" | "WEB_VIEW", targetValue: string | null) {
    const value = cleanText(targetValue);
    if (!value) {
      if (targetType === "WEB_VIEW") {
        throw new BadRequestException("活动详情外链不能为空");
      }
      return;
    }

    if (targetType === "PAGE") {
      if (!value.startsWith("/")) {
        throw new BadRequestException("站内页面必须以 / 开头");
      }
      return;
    }

    if (!/^https:\/\//iu.test(value)) {
      throw new BadRequestException("活动详情外链必须以 https:// 开头");
    }
  }

  private async listPublicTopics(db: TableTopicDb) {
    return db.tableTopic.findMany({
      where: {
        status: TopicStatus.LISTED
      },
      include: {
        _count: {
          select: {
            participants: true
          }
        }
      },
      orderBy: [{ activityAt: "desc" }, { id: "desc" }]
    });
  }

  private async listAdminTopics(db: TableTopicDb) {
    return db.tableTopic.findMany({
      include: {
        _count: {
          select: {
            participants: true
          }
        }
      },
      orderBy: [{ status: "asc" }, { activityAt: "desc" }, { id: "desc" }]
    });
  }

  private async findAdminTopic(db: TableTopicDb, topicId: UUID) {
    const topic = await db.tableTopic.findUnique({
      where: { id: topicId },
      include: {
        _count: {
          select: {
            participants: true
          }
        }
      }
    });
    if (!topic) {
      throw new NotFoundException("餐桌话题不存在");
    }
    return topic;
  }

  private toListItem(request: RequestLike, topic: TableTopicRow): TableTopicListItem {
    return {
      id: topic.id,
      title: topic.title,
      coverImageUrl: this.resolveImageUrl(request, topic.coverImageUrl, topic.updatedAt),
      activityAt: toIso(topic.activityAt),
      participantCount: topic._count.participants
    };
  }

  private toTopicDetail(request: RequestLike, topic: TableTopicRow, joined: boolean): TableTopicDetail {
    return {
      ...this.toListItem(request, topic),
      summary: topic.summary,
      joined,
      targetType: topic.targetType,
      targetValue: topic.targetValue
    };
  }

  private toAdminTopic(request: RequestLike, topic: TableTopicRow): AdminTableTopicItem {
    return {
      ...this.toTopicDetail(request, topic, false),
      status: topic.status,
      version: topic.version,
      updatedAt: toIso(topic.updatedAt)
    };
  }

  private async hasJoined(db: TableTopicDb, topicId: UUID, userId: UUID) {
    const item = await db.tableTopicParticipant.findUnique({
      where: {
        topicId_userId: {
          topicId,
          userId
        }
      },
      select: {
        id: true
      }
    });
    return Boolean(item);
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
}
