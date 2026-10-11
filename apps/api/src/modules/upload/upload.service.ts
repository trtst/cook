import { createHash, randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import type { Prisma, UploadAsset, UploadAssetScene, UploadAssetStatus } from "@prisma/client";
import { assetKey, AssetStorageService } from "../../common/asset-storage.service";
import { compressUploadedImage, type CompressedImage } from "../../common/image-compression";
import { completeIdempotentOperation, getIdempotentResult, startIdempotentOperation } from "../../common/idempotency";
import { PrismaService } from "../../common/prisma.service";
import { recipeImageFileName, type RecipeImagePosition } from "../../common/recipe-image-name";
import type { IsoDateTime, OperationId, UploadImageResponse, UploadImageSummary, UUID } from "../../contracts/types";

type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

type FileUpload = {
  buffer?: Buffer;
  size?: number;
};

type RecipeDb = Prisma.TransactionClient | PrismaService;

type ImageMeta = {
  contentType: string;
  extension: string;
  width: number;
  height: number;
  sourceHash: string;
};

const maxRecipeImageBytes = 5 * 1024 * 1024;
const maxAvatarImageBytes = 2 * 1024 * 1024;
const recipeCoverRatio = 3 / 4;
const recipeCoverRatioTolerance = 0.02;
const tempTtlMs = 24 * 60 * 60 * 1000;

function getContentTypeExtension(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

function contentTypeOfFileName(fileName: string) {
  if (fileName.endsWith(".png")) return "image/png";
  if (fileName.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function publicIdFromFileName(value: string) {
  const match = /^([0-9a-f-]+)\.(?:jpg|png|webp)$/i.exec(value);
  if (!match) {
    throw new NotFoundException("图片不存在");
  }
  return match[1];
}

function recipeImageKeyFromFileName(recipeId: UUID, fileName: string) {
  const legacyName = /^[0-9a-f-]+\.(?:jpg|png|webp)$/i.test(fileName);
  const recipeKey = String(recipeId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const currentName = new RegExp(`^${recipeKey}_[1-9]\\d*(?:_step-[1-9]\\d*|_wiki-step-[1-9]\\d*)?\\.(?:jpg|png|webp)$`, "i").test(fileName);
  if (!legacyName && !currentName) throw new NotFoundException("图片不存在");
  return assetKey("uploads", "recipe-images", recipeId, fileName);
}

function toIsoDate(value: Date): IsoDateTime {
  return value.toISOString();
}

function readPngSize(buffer: Buffer) {
  if (
    buffer.length < 24 ||
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4e ||
    buffer[3] !== 0x47 ||
    buffer.subarray(12, 16).toString("ascii") !== "IHDR"
  ) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function readJpegSize(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const blockSize = buffer.readUInt16BE(offset + 2);
    if (blockSize < 2 || offset + blockSize + 2 > buffer.length) break;
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }
    offset += blockSize + 2;
  }
  return null;
}

function readWebpSize(buffer: Buffer) {
  if (
    buffer.length < 30 ||
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    return null;
  }

  const chunkType = buffer.subarray(12, 16).toString("ascii");
  if (chunkType === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    };
  }

  if (chunkType === "VP8 " && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    };
  }

  if (chunkType === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    };
  }

  return null;
}

function detectImageMeta(file: FileUpload, maxImageBytes: number): ImageMeta {
  if (!file.buffer || typeof file.size !== "number") {
    throw new BadRequestException("请上传图片");
  }
  if (file.size <= 0 || file.size > maxImageBytes) {
    throw new BadRequestException(`图片大小不能超过 ${Math.round(maxImageBytes / (1024 * 1024))} MB`);
  }

  const png = readPngSize(file.buffer);
  if (png) {
    return {
      contentType: "image/png",
      extension: "png",
      width: png.width,
      height: png.height,
      sourceHash: createHash("sha256").update(file.buffer).digest("hex")
    };
  }

  const jpeg = readJpegSize(file.buffer);
  if (jpeg) {
    return {
      contentType: "image/jpeg",
      extension: "jpg",
      width: jpeg.width,
      height: jpeg.height,
      sourceHash: createHash("sha256").update(file.buffer).digest("hex")
    };
  }

  const webp = readWebpSize(file.buffer);
  if (webp) {
    return {
      contentType: "image/webp",
      extension: "webp",
      width: webp.width,
      height: webp.height,
      sourceHash: createHash("sha256").update(file.buffer).digest("hex")
    };
  }

  throw new BadRequestException("仅支持 JPG、PNG、WEBP 图片");
}

@Injectable()
export class UploadService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AssetStorageService) private readonly assetStorage: AssetStorageService
  ) {}

  buildRecipeImageUrl(request: RequestLike, storageKey: string, updatedAt: Date) {
    return this.assetStorage.publicUrl(request, storageKey, updatedAt);
  }

  buildDiningEventCoverUrl(request: RequestLike, storageKey: string, updatedAt: Date) {
    return this.assetStorage.publicUrl(request, storageKey, updatedAt);
  }

  buildDiningMemoryAssetUrl(request: RequestLike, storageKey: string) {
    return this.assetStorage.publicUrl(request, storageKey);
  }

  buildProfileAvatarUrl(request: RequestLike, userUid: UUID, fileName: string, updatedAt: Date) {
    return this.assetStorage.publicUrl(request, this.buildAvatarStorageKey(userUid, fileName), updatedAt);
  }

  async uploadUserAvatar(
    request: RequestLike,
    userId: UUID,
    operationId: OperationId,
    file?: FileUpload
  ) {
    if (!file) throw new BadRequestException("请上传图片");
    const account = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, status: true } });
    if (!account || account.status !== "ACTIVE") throw new UnauthorizedException("未登录或 token 失效");
    const sourceMeta = detectImageMeta(file, maxAvatarImageBytes);
    const image = await compressUploadedImage(file.buffer as Buffer, {
      maxInputBytes: maxAvatarImageBytes,
      maxOutputBytes: 150 * 1024,
      inputSizeMessage: "头像图片不能超过 2 MB",
      outputSizeMessage: "头像图片无法压缩到 150 KB 以内，请更换图片"
    });
    const requestHash = `${userId}:${sourceMeta.sourceHash}`;

    return await this.prisma.$transaction(async tx => {
        const repeated = await getIdempotentResult<{ avatarUrl: string }>(tx, operationId, "upload:user-avatar", userId, null, requestHash);
        if (repeated) {
          return repeated;
        }
        await startIdempotentOperation(tx, operationId, "upload:user-avatar", userId, null, requestHash);

        const current = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, uid: true, status: true }
        });
        if (!current || current.status !== "ACTIVE") {
          throw new UnauthorizedException("未登录或 token 失效");
        }

        const fileName = `${randomUUID()}.${image.extension}`;
        const storageKey = this.buildAvatarStorageKey(current.uid, fileName);
        await this.assetStorage.writeObject(storageKey, image.buffer, image.contentType);
        const now = new Date();
        const avatarUrl = this.buildProfileAvatarUrl(request, current.uid, fileName, now);
        await tx.user.update({
          where: { id: userId },
          data: { avatarUrl },
        select: { id: true }
        });
        const result = { avatarUrl };
        await completeIdempotentOperation(tx, operationId, "upload:user-avatar", userId, null, requestHash, result);
        return result;
      });
  }

  async uploadRecipeImage(
    request: RequestLike,
    userId: UUID,
    operationId: OperationId,
    draftId: UUID,
    scene: UploadAssetScene,
    slotKey: string,
    file: FileUpload
  ): Promise<UploadImageResponse> {
    const draft = await this.prisma.recipeDraft.findFirst({ where: { id: draftId, userId }, select: { id: true } });
    if (!draft) throw new NotFoundException("草稿不存在");
    const sourceMeta = detectImageMeta(file, maxRecipeImageBytes);
    const image = await compressUploadedImage(file.buffer as Buffer, {
      maxInputBytes: maxRecipeImageBytes,
      maxOutputBytes: 500 * 1024,
      inputSizeMessage: "菜谱图片不能超过 5 MB",
      outputSizeMessage: "菜谱图片无法压缩到 500 KB 以内，请更换图片"
    });
    if (scene === "RECIPE_COVER" && Math.abs(image.width / image.height - recipeCoverRatio) > recipeCoverRatioTolerance) {
      throw new BadRequestException("菜谱封面图必须为 3:4");
    }
    const requestHash = `${draftId}:${scene}:${slotKey}:${sourceMeta.sourceHash}`;

    return await this.prisma.$transaction(async tx => {
        const repeated = await getIdempotentResult<UploadImageResponse>(tx, operationId, "upload:recipe-image", userId, null, requestHash);
        if (repeated) {
          return repeated;
        }
        await startIdempotentOperation(tx, operationId, "upload:recipe-image", userId, null, requestHash);

        const draft = await tx.recipeDraft.findFirst({
          where: { id: draftId, userId },
          select: { id: true }
        });
        if (!draft) throw new NotFoundException("草稿不存在");

        const existing = await tx.uploadAsset.findUnique({
          where: {
            draftId_scene_slotKey: {
              draftId,
              scene,
              slotKey
            }
          }
        });

        if (existing && existing.sourceHash === sourceMeta.sourceHash && existing.status === "TEMP") {
          const result = {
            upload: this.toUploadSummary(request, existing)
          } satisfies UploadImageResponse;
          await completeIdempotentOperation(tx, operationId, "upload:recipe-image", userId, null, requestHash, result);
          return result;
        }

        const publicId = existing?.publicId ?? randomUUID();
        const storageKey = this.buildDraftRecipeImageStorageKey(draftId, publicId, image.contentType);
        await this.assetStorage.writeObject(storageKey, image.buffer, image.contentType);

        const expiresAt = new Date(Date.now() + tempTtlMs);
        const persisted = existing
          ? await tx.uploadAsset.update({
              where: { id: existing.id },
              data: {
                type: "RECIPE",
                scene,
                slotKey,
                storageKey,
                contentType: image.contentType,
                sizeBytes: image.buffer.length,
                width: image.width,
                height: image.height,
                sourceHash: sourceMeta.sourceHash,
                status: "TEMP",
                expiresAt,
                recipeVersionId: null
              }
            })
          : await tx.uploadAsset.create({
              data: {
                publicId,
                userId,
                draftId,
                type: "RECIPE",
                scene,
                slotKey,
                storageKey,
                contentType: image.contentType,
                sizeBytes: image.buffer.length,
                width: image.width,
                height: image.height,
                sourceHash: sourceMeta.sourceHash,
                status: "TEMP",
                expiresAt
              }
            });

        const result = {
          upload: this.toUploadSummary(request, persisted)
        } satisfies UploadImageResponse;
        await completeIdempotentOperation(tx, operationId, "upload:recipe-image", userId, null, requestHash, result);
        return result;
      });
  }

  async getDraftRecipeImageAsset(userId: UUID, draftId: UUID, fileName: string) {
    const publicId = publicIdFromFileName(fileName);
    const draft = await this.prisma.recipeDraft.findFirst({ where: { id: draftId, userId }, select: { id: true } });
    if (!draft) throw new NotFoundException("图片不存在");
    const asset = await this.prisma.uploadAsset.findFirst({
      where: { userId, draftId, publicId, status: "TEMP", type: "RECIPE" },
      select: { storageKey: true, contentType: true }
    });
    if (!asset) throw new NotFoundException("图片不存在");
    const stored = await this.assetStorage.readObject(asset.storageKey, asset.contentType).catch(() => null);
    if (!stored) {
      throw new NotFoundException("图片不存在");
    }
    return {
      contentType: stored.contentType,
      stream: stored.stream,
      stat: { size: stored.size }
    };
  }

  async getRecipeImageAsset(recipeId: UUID, fileName: string) {
    const expectedStorageKey = recipeImageKeyFromFileName(recipeId, fileName);
    const stored = await this.assetStorage.readObject(expectedStorageKey, contentTypeOfFileName(fileName)).catch(() => null);
    if (!stored) throw new NotFoundException("图片不存在");
    return {
      contentType: stored.contentType,
      stream: stored.stream,
      stat: { size: stored.size }
    };
  }

  async getProfileAvatarAsset(userUid: UUID, fileName: string) {
    if (!/^[0-9a-f-]+\.(jpg|png|webp)$/.test(fileName)) {
      throw new NotFoundException("图片不存在");
    }
    const stored = await this.assetStorage.readObject(this.buildAvatarStorageKey(userUid, fileName), contentTypeOfFileName(fileName)).catch(() => null);
    if (!stored) {
      throw new NotFoundException("图片不存在");
    }
    return {
      contentType: stored.contentType,
      stream: stored.stream,
      stat: { size: stored.size }
    };
  }

  async prepareDiningEventCover(file: FileUpload): Promise<CompressedImage> {
    detectImageMeta(file, 5 * 1024 * 1024);
    return compressUploadedImage(file.buffer as Buffer, {
      maxInputBytes: 5 * 1024 * 1024,
      maxOutputBytes: 500 * 1024,
      cropRatio: 4 / 3,
      inputSizeMessage: "饭局封面图片不能超过 5 MB",
      outputSizeMessage: "饭局封面图片无法压缩到 500 KB 以内，请更换图片"
    });
  }

  async storeDiningEventCover(image: CompressedImage, eventId: UUID) {
    const storageKey = this.buildDiningEventCoverStorageKey(eventId, image.extension);

    await this.assetStorage.writeObject(storageKey, image.buffer, image.contentType);
    return {
      storageKey,
      contentType: image.contentType
    };
  }

  async copyDiningEventCoverToMemory(
    sourceStorageKey: string,
    contentType: string,
    eventId: UUID,
    snapshotVersion: number
  ) {
    const storageKey = this.buildDiningMemoryCoverStorageKey(eventId, snapshotVersion, contentType);
    const source = await this.assetStorage.readObject(sourceStorageKey, contentType);
    source.stream.destroy();
    await this.assetStorage.copyObject(sourceStorageKey, storageKey);
    return { storageKey, contentType };
  }

  async storeDiningMemoryMiniCode(shareTokenHash: string, buffer: Buffer, contentType: "image/png" | "image/jpeg") {
    const storageKey = this.buildDiningMemoryMiniCodeStorageKey(shareTokenHash, contentType);
    await this.assetStorage.writeObject(storageKey, buffer, contentType);
    return storageKey;
  }

  buildDiningMemoryCoverStorageKey(eventId: UUID, snapshotVersion: number, contentType: string) {
    const extension = getContentTypeExtension(contentType);
    return assetKey("uploads", "dining-event-memory-covers", eventId, `${snapshotVersion}.${extension}`);
  }

  async getDiningMemoryCoverAsset(eventId: UUID, fileName: string) {
    if (!/^\d+\.(jpg|png|webp)$/iu.test(fileName)) {
      throw new NotFoundException("图片不存在");
    }
    const snapshot = await this.prisma.diningEventMemoryShare.findFirst({
      where: {
        diningEventId: eventId,
        coverStorageKey: { endsWith: `/${fileName}` },
        coverContentType: { not: null }
      },
      orderBy: { snapshotVersion: "desc" },
      select: {
        coverStorageKey: true,
        coverContentType: true
      }
    });
    if (!snapshot?.coverStorageKey || !snapshot.coverContentType) {
      throw new NotFoundException("图片不存在");
    }
    const stored = await this.assetStorage.readObject(snapshot.coverStorageKey, snapshot.coverContentType).catch(() => null);
    if (!stored) throw new NotFoundException("图片不存在");
    return {
      contentType: stored.contentType,
      stream: stored.stream,
      stat: { size: stored.size }
    };
  }

  async getDiningMemoryMiniCodeAsset(fileName: string) {
    if (!/^[0-9a-f]{64}\.(jpg|png)$/iu.test(fileName)) {
      throw new NotFoundException("图片不存在");
    }
    const contentType = fileName.endsWith(".png") ? "image/png" : "image/jpeg";
    const storageKey = this.buildDiningMemoryMiniCodeStorageKey(fileName.slice(0, fileName.lastIndexOf(".")), contentType);
    const snapshot = await this.prisma.diningEventMemoryShare.findFirst({
      where: { miniCodeStorageKey: storageKey },
      select: { miniCodeStorageKey: true }
    });
    if (!snapshot?.miniCodeStorageKey) {
      throw new NotFoundException("图片不存在");
    }
    const stored = await this.assetStorage.readObject(storageKey, contentType).catch(() => null);
    if (!stored) throw new NotFoundException("图片不存在");
    return {
      contentType: stored.contentType,
      stream: stored.stream,
      stat: { size: stored.size }
    };
  }

  buildDiningMemoryMiniCodeStorageKey(shareTokenHash: string, contentType: "image/png" | "image/jpeg") {
    return assetKey("uploads", "dining-event-memory-codes", `${shareTokenHash}.${getContentTypeExtension(contentType)}`);
  }

  async getDiningEventCoverAsset(eventId: UUID) {
    const event = await this.prisma.diningEvent.findFirst({
      where: {
        id: eventId,
        coverStorageKey: { not: null },
        coverContentType: { not: null }
      },
      select: {
        coverStorageKey: true,
        coverContentType: true
      }
    });
    if (!event?.coverStorageKey || !event.coverContentType) {
      throw new NotFoundException("图片不存在");
    }

    const stored = await this.assetStorage.readObject(event.coverStorageKey, event.coverContentType).catch(() => null);
    if (!stored) {
      throw new NotFoundException("图片不存在");
    }
    return {
      contentType: stored.contentType,
      stream: stored.stream,
      stat: { size: stored.size }
    };
  }

  async resolveDraftUploads(tx: RecipeDb, request: RequestLike, draftId: UUID) {
    const items = await tx.uploadAsset.findMany({
      where: {
        draftId,
        status: "TEMP",
        type: "RECIPE"
      }
    });
    const byId = new Map(items.map(item => [item.id, item]));
    const bySlot = new Map(items.map(item => [`${item.scene}:${item.slotKey}`, item]));
    return {
      items,
      byId,
      bySlot,
      buildUrl: (item: UploadAsset) => this.buildRecipeImageUrl(request, item.storageKey, item.updatedAt)
    };
  }

  async assertDraftUploadOwnership(
    tx: RecipeDb,
    userId: UUID,
    draftId: UUID,
    uploadIds: UUID[]
  ): Promise<Map<UUID, UploadAsset>> {
    if (!uploadIds.length) return new Map();
    const items = await tx.uploadAsset.findMany({
      where: {
        id: { in: uploadIds },
        userId,
        draftId,
        status: "TEMP",
        type: "RECIPE"
      }
    });
    if (items.length !== uploadIds.length) {
      throw new BadRequestException("草稿图片状态已变更，请重新保存后再试");
    }
    return new Map(items.map(item => [item.id, item]));
  }

  async removeUnusedDraftUploads(tx: RecipeDb, draftId: UUID, keepIds: Set<UUID>) {
    const items = await tx.uploadAsset.findMany({
      where: {
        draftId,
        status: "TEMP",
        type: "RECIPE"
      }
    });
    const stale = items.filter(item => !keepIds.has(item.id));
    if (!stale.length) return;

    await tx.uploadAsset.deleteMany({
      where: {
        id: { in: stale.map(item => item.id) }
      }
    });
    return stale.map(item => item.storageKey);
  }

  async deleteDraftUploads(tx: RecipeDb, draftId: UUID) {
    const items = await tx.uploadAsset.findMany({
      where: {
        draftId,
        type: "RECIPE"
      }
    });
    if (!items.length) return;
    await tx.uploadAsset.deleteMany({
      where: {
        id: { in: items.map(item => item.id) }
      }
    });
    return items.map(item => item.storageKey);
  }

  async bindDraftUploads(
    tx: RecipeDb,
    draftId: UUID,
    recipeVersionId: UUID,
    uploadIds: UUID[]
  ) {
    if (!uploadIds.length) {
      return new Map<UUID, UploadAsset>();
    }
    const items = await tx.uploadAsset.findMany({
      where: {
        draftId,
        id: { in: uploadIds },
        status: "TEMP",
        type: "RECIPE"
      }
    });
    const nextMap = new Map<UUID, UploadAsset>();
    for (const item of items) {
      const updated = await tx.uploadAsset.update({
        where: { id: item.id },
        data: {
          draftId: null,
          recipeVersionId,
          status: "BOUND",
          expiresAt: null
        }
      });
      nextMap.set(updated.id, updated);
    }
    return nextMap;
  }

  async copyDraftUploads(
    userId: UUID,
    draftId: UUID,
    recipeId: UUID,
    contentVersionId: number,
    uploadIds: UUID[],
    promotedStorageKeys: string[],
    temporaryStorageKeys: string[],
    imagePositions: Map<UUID, RecipeImagePosition>
  ) {
    const keys = new Map<UUID, {
      sourceStorageKey: string;
      sourcePublicId: string;
      sourceUpdatedAt: Date;
      sourceHash: string;
      targetPublicId: string;
      targetStorageKey: string;
    }>();
    if (!uploadIds.length) return keys;
    const items = await this.prisma.uploadAsset.findMany({
      where: { id: { in: uploadIds }, userId, draftId, status: "TEMP", type: "RECIPE" }
    });
    if (items.length !== uploadIds.length) {
      throw new BadRequestException("草稿图片状态已变更，请重新保存后再试");
    }
    for (const item of items) {
      const position = imagePositions.get(item.id);
      if (!position) throw new BadRequestException("草稿图片步骤信息缺失，请重新保存后再试");
      const targetPublicId = randomUUID();
      const targetStorageKey = this.buildRecipeImageStorageKey(recipeId, contentVersionId, position, item.contentType);
      promotedStorageKeys.push(targetStorageKey);
      temporaryStorageKeys.push(item.storageKey);
      await this.assetStorage.copyObject(item.storageKey, targetStorageKey);
      keys.set(item.id, {
        sourceStorageKey: item.storageKey,
        sourcePublicId: item.publicId,
        sourceUpdatedAt: item.updatedAt,
        sourceHash: item.sourceHash,
        targetPublicId,
        targetStorageKey
      });
    }
    return keys;
  }

  async promoteDraftUploads(
    tx: RecipeDb,
    request: RequestLike,
    userId: UUID,
    draftId: UUID,
    recipeId: UUID,
    uploadIds: UUID[],
    preparedStorageKeys: Map<UUID, {
      sourceStorageKey: string;
      sourcePublicId: string;
      sourceUpdatedAt: Date;
      sourceHash: string;
      targetPublicId: string;
      targetStorageKey: string;
    }>
  ) {
    if (!uploadIds.length) return new Map<UUID, string>();
    const items = await tx.uploadAsset.findMany({
      where: {
        id: { in: uploadIds },
        userId,
        draftId,
        status: "TEMP",
        type: "RECIPE"
      }
    });
    if (items.length !== uploadIds.length) {
      throw new BadRequestException("草稿图片状态已变更，请重新保存后再试");
    }

    const urls = new Map<UUID, string>();
    for (const item of items) {
      const prepared = preparedStorageKeys.get(item.id);
      if (
        !prepared ||
        prepared.sourceStorageKey !== item.storageKey ||
        prepared.sourcePublicId !== item.publicId ||
        prepared.sourceUpdatedAt.getTime() !== item.updatedAt.getTime() ||
        prepared.sourceHash !== item.sourceHash
      ) {
        throw new BadRequestException("草稿图片状态已变更，请重新保存后再试");
      }
      const updated = await tx.uploadAsset.update({
        where: { id: item.id },
        data: { publicId: prepared.targetPublicId, storageKey: prepared.targetStorageKey }
      });
      urls.set(item.id, this.buildRecipeImageUrl(request, prepared.targetStorageKey, updated.updatedAt));
    }
    return urls;
  }

  private buildDraftRecipeImageStorageKey(draftId: UUID, publicId: string, contentType: string) {
    const extension = getContentTypeExtension(contentType);
    return assetKey("uploads", "recipe-images", ".tmp", draftId, `${publicId}.${extension}`);
  }

  private buildRecipeImageStorageKey(recipeId: UUID, contentVersionId: number, position: RecipeImagePosition, contentType: string) {
    const extension = getContentTypeExtension(contentType);
    return assetKey("uploads", "recipe-images", recipeId, recipeImageFileName(recipeId, contentVersionId, position, extension));
  }

  async removeStorageFiles(storageKeys: Iterable<string>) {
    const uniqueKeys = Array.from(new Set(Array.from(storageKeys).filter(Boolean)));
    if (!uniqueKeys.length) return [];

    const results = await Promise.all(
      uniqueKeys.map(async storageKey => {
        try {
          await this.assetStorage.deleteObject(storageKey);
          return null;
        } catch {
          return storageKey;
        }
      })
    );
    return results.filter((storageKey): storageKey is string => Boolean(storageKey));
  }

  async loadVersionUploads(tx: RecipeDb, request: RequestLike, recipeVersionId: UUID) {
    const items = await tx.uploadAsset.findMany({
      where: {
        recipeVersionId,
        status: "BOUND",
        type: "RECIPE"
      }
    });
    return {
      byId: new Map(items.map(item => [item.id, item])),
      bySlot: new Map(items.map(item => [`${item.scene}:${item.slotKey}`, item])),
      buildUrl: (item: UploadAsset) => this.buildRecipeImageUrl(request, item.storageKey, item.updatedAt)
    };
  }

  toUploadSummary(request: RequestLike, asset: UploadAsset): UploadImageSummary {
    return {
      id: asset.id,
      publicId: asset.publicId,
      scene: asset.scene as UploadAssetScene,
      slotKey: asset.slotKey,
      status: asset.status as UploadAssetStatus,
      imageUrl: this.buildRecipeImageUrl(request, asset.storageKey, asset.updatedAt),
      contentType: asset.contentType,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
      createdAt: toIsoDate(asset.createdAt),
      expiresAt: asset.expiresAt ? toIsoDate(asset.expiresAt) : null
    };
  }

  private buildDiningEventCoverStorageKey(eventId: UUID, extension: string) {
    return assetKey("uploads", "dining-event-covers", eventId, `${randomUUID()}.${extension}`);
  }

  private buildAvatarStorageKey(userUid: UUID, fileName: string) {
    return assetKey("uploads", "profile-avatars", userUid, fileName);
  }

}
