import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, UploadAsset, UploadAssetScene, UploadAssetStatus } from "@prisma/client";
import { completeIdempotentOperation, getIdempotentResult, startIdempotentOperation } from "../../common/idempotency";
import { PrismaService } from "../../common/prisma.service";
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

const maxImageBytes = 10 * 1024 * 1024;
const tempTtlMs = 24 * 60 * 60 * 1000;

function getAssetRoot() {
  return resolve(process.env.APP_ASSET_DIR || join(process.cwd(), "var", "app-assets"));
}

function getContentTypeExtension(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
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

function detectImageMeta(file: FileUpload): ImageMeta {
  if (!file.buffer || typeof file.size !== "number") {
    throw new BadRequestException("请上传图片");
  }
  if (file.size <= 0 || file.size > maxImageBytes) {
    throw new BadRequestException("图片大小不能超过 10 MB");
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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  buildRecipeImageUrl(request: RequestLike, publicId: string, updatedAt: Date) {
    const protocol = request.protocol || "http";
    const host = request.get?.("host");
    const path = `/api/public-assets/recipe-images/${encodeURIComponent(publicId)}?v=${encodeURIComponent(updatedAt.toISOString())}`;
    if (!host) return path;
    return `${protocol}://${host}${path}`;
  }

  buildDiningGroupCoverUrl(request: RequestLike, diningGroupId: UUID, updatedAt: Date) {
    const protocol = request.protocol || "http";
    const host = request.get?.("host");
    const path = `/api/public-assets/dining-group-covers/${encodeURIComponent(String(diningGroupId))}?v=${encodeURIComponent(updatedAt.toISOString())}`;
    if (!host) return path;
    return `${protocol}://${host}${path}`;
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
    const imageMeta = detectImageMeta(file);
    const requestHash = `${draftId}:${scene}:${slotKey}:${imageMeta.sourceHash}`;
    const tempPath = await this.writeTempFile(file.buffer as Buffer, imageMeta.extension);

    try {
      return await this.prisma.$transaction(async tx => {
        const repeated = await getIdempotentResult<UploadImageResponse>(tx, operationId, "upload:recipe-image", userId, null, requestHash);
        if (repeated) {
          await rm(tempPath, { force: true });
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

        if (existing && existing.sourceHash === imageMeta.sourceHash && existing.status === "TEMP") {
          await rm(tempPath, { force: true });
          const result = {
            upload: this.toUploadSummary(request, existing)
          } satisfies UploadImageResponse;
          await completeIdempotentOperation(tx, operationId, "upload:recipe-image", userId, null, requestHash, result);
          return result;
        }

        const publicId = existing?.publicId ?? randomUUID();
        const storageKey = existing?.storageKey ?? this.buildDraftStorageKey(draftId, scene, publicId, imageMeta.contentType);
        await this.moveTempFile(tempPath, storageKey);

        const expiresAt = new Date(Date.now() + tempTtlMs);
        const persisted = existing
          ? await tx.uploadAsset.update({
              where: { id: existing.id },
              data: {
                type: "RECIPE",
                scene,
                slotKey,
                storageKey,
                contentType: imageMeta.contentType,
                sizeBytes: file.size as number,
                width: imageMeta.width,
                height: imageMeta.height,
                sourceHash: imageMeta.sourceHash,
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
                contentType: imageMeta.contentType,
                sizeBytes: file.size as number,
                width: imageMeta.width,
                height: imageMeta.height,
                sourceHash: imageMeta.sourceHash,
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
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }
  }

  async getRecipeImageAsset(publicId: string) {
    const asset = await this.prisma.uploadAsset.findFirst({
      where: {
        publicId,
        status: { not: "DELETED" },
        type: "RECIPE"
      }
    });
    if (!asset) {
      throw new NotFoundException("图片不存在");
    }

    const filePath = this.getStoragePath(asset.storageKey);
    try {
      return {
        contentType: asset.contentType,
        stream: createReadStream(filePath),
        stat: await stat(filePath)
      };
    } catch {
      throw new NotFoundException("图片不存在");
    }
  }

  async storeDiningGroupCover(file: FileUpload, diningGroupId: UUID) {
    const imageMeta = detectImageMeta(file);
    const tempPath = await this.writeTempFile(file.buffer as Buffer, imageMeta.extension);
    const storageKey = this.buildDiningGroupCoverStorageKey(diningGroupId);

    try {
      await this.moveTempFile(tempPath, storageKey);
      return {
        storageKey,
        contentType: imageMeta.contentType,
        sizeBytes: file.size as number
      };
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }
  }

  async getDiningGroupCoverAsset(diningGroupId: UUID) {
    const diningGroup = await this.prisma.diningGroup.findFirst({
      where: {
        id: diningGroupId,
        status: "ACTIVE",
        coverStorageKey: { not: null },
        coverContentType: { not: null }
      },
      select: {
        coverStorageKey: true,
        coverContentType: true
      }
    });
    if (!diningGroup?.coverStorageKey || !diningGroup.coverContentType) {
      throw new NotFoundException("图片不存在");
    }

    const filePath = this.getStoragePath(diningGroup.coverStorageKey);
    try {
      return {
        contentType: diningGroup.coverContentType,
        stream: createReadStream(filePath),
        stat: await stat(filePath)
      };
    } catch {
      throw new NotFoundException("图片不存在");
    }
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
    const bytes = items.reduce((sum, item) => sum + item.sizeBytes, 0);
    return {
      items,
      byId,
      bySlot,
      bytes,
      buildUrl: (item: UploadAsset) => this.buildRecipeImageUrl(request, item.publicId, item.updatedAt)
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

  async removeStorageFiles(storageKeys: Iterable<string>) {
    const uniqueKeys = Array.from(new Set(Array.from(storageKeys).filter(Boolean)));
    if (!uniqueKeys.length) return;

    // Database changes have already committed at this stage. Cleanup failures
    // must not turn a successful save/publish/delete into a user-visible error.
    await Promise.allSettled(uniqueKeys.map(storageKey => this.removeStorageFile(storageKey)));
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
      bytes: items.reduce((sum, item) => sum + item.sizeBytes, 0),
      buildUrl: (item: UploadAsset) => this.buildRecipeImageUrl(request, item.publicId, item.updatedAt)
    };
  }

  toUploadSummary(request: RequestLike, asset: UploadAsset): UploadImageSummary {
    return {
      id: asset.id,
      publicId: asset.publicId,
      scene: asset.scene as UploadAssetScene,
      slotKey: asset.slotKey,
      status: asset.status as UploadAssetStatus,
      imageUrl: this.buildRecipeImageUrl(request, asset.publicId, asset.updatedAt),
      contentType: asset.contentType,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
      createdAt: toIsoDate(asset.createdAt),
      expiresAt: asset.expiresAt ? toIsoDate(asset.expiresAt) : null
    };
  }

  private async writeTempFile(buffer: Buffer, extension: string) {
    const tempDir = join(getAssetRoot(), "recipe-temp");
    await mkdir(tempDir, { recursive: true });
    const tempPath = join(tempDir, `${randomUUID()}.${extension}`);
    await writeFile(tempPath, buffer);
    return tempPath;
  }

  private async moveTempFile(tempPath: string, storageKey: string) {
    const filePath = this.getStoragePath(storageKey);
    await mkdir(dirname(filePath), { recursive: true });
    await rename(tempPath, filePath);
  }

  private async removeStorageFile(storageKey: string) {
    await rm(this.getStoragePath(storageKey), { force: true });
  }

  private getStoragePath(storageKey: string) {
    return join(getAssetRoot(), storageKey);
  }

  private buildDraftStorageKey(draftId: UUID, scene: UploadAssetScene, publicId: string, contentType: string) {
    const extension = getContentTypeExtension(contentType);
    return join("recipe-drafts", String(draftId), scene.toLowerCase(), `${publicId}.${extension}`);
  }

  private buildDiningGroupCoverStorageKey(diningGroupId: UUID) {
    return join("dining-group-covers", String(diningGroupId), randomUUID());
  }

}
