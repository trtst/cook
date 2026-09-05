import { createHash, randomUUID } from "node:crypto";
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { assetKey, AssetStorageService } from "../../common/asset-storage.service";
import { completeAdminIdempotentOperation, getAdminIdempotentResult, startAdminIdempotentOperation } from "../../common/idempotency";
import { PrismaService } from "../../common/prisma.service";
import type { AdminMaterialImageDeleteResult, AdminMaterialImageItem, OperationId, PageResult, UUID } from "../../contracts/types";

type ImageKind = "jpeg" | "png" | "webp";
type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};
type ImageMeta = {
  kind: ImageKind;
  contentType: string;
  extension: string;
  width: number;
  height: number;
};
type MaterialImageRow = Prisma.AdminMaterialImageGetPayload<{ include: { uploader: { select: { id: true; displayName: true } } } }>;
type AdminAccessDb = {
  adminAccount: {
    findUnique: (args: { where: { id: number }; select: { status: true; roles: true } }) => Promise<{ status: string; roles: string[] } | null>;
  };
};

const maxImageBytes = 8 * 1024 * 1024;
const maxImageEdge = 4096;
const maxImagePixels = 16_777_216;
const materialStoreFolder = "material-store";
const legacyMaterialStoreFolder = "admin-material-images";

function pngMeta(buffer: Buffer): ImageMeta | null {
  if (
    buffer.length < 24 ||
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4e ||
    buffer[3] !== 0x47 ||
    buffer[4] !== 0x0d ||
    buffer[5] !== 0x0a ||
    buffer[6] !== 0x1a ||
    buffer[7] !== 0x0a
  ) {
    return null;
  }
  return {
    kind: "png",
    contentType: "image/png",
    extension: "png",
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function jpegMeta(buffer: Buffer): ImageMeta | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb)) {
      return {
        kind: "jpeg",
        contentType: "image/jpeg",
        extension: "jpg",
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5)
      };
    }
    offset += 2 + length;
  }
  return null;
}

function webpMeta(buffer: Buffer): ImageMeta | null {
  if (buffer.length < 30 || buffer.subarray(0, 4).toString("ascii") !== "RIFF" || buffer.subarray(8, 12).toString("ascii") !== "WEBP") {
    return null;
  }
  const chunk = buffer.subarray(12, 16).toString("ascii");
  if (chunk === "VP8X") {
    return {
      kind: "webp",
      contentType: "image/webp",
      extension: "webp",
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    };
  }
  if (chunk === "VP8 " && buffer.length >= 30) {
    return {
      kind: "webp",
      contentType: "image/webp",
      extension: "webp",
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    };
  }
  if (chunk === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      kind: "webp",
      contentType: "image/webp",
      extension: "webp",
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    };
  }
  return null;
}

function imageMeta(buffer: Buffer) {
  const meta = pngMeta(buffer) ?? jpegMeta(buffer) ?? webpMeta(buffer);
  if (!meta) throw new BadRequestException("仅支持 JPG、PNG、WEBP 图片");
  if (meta.width <= 0 || meta.height <= 0 || meta.width > maxImageEdge || meta.height > maxImageEdge || meta.width * meta.height > maxImagePixels) {
    throw new BadRequestException("图片尺寸不能超过 4096x4096");
  }
  return meta;
}

function cleanNote(note: string) {
  const value = note.trim();
  if (!value) throw new BadRequestException("备注不能为空");
  if (value.length > 120) throw new BadRequestException("备注最多 120 个字");
  return value;
}

function publicStorageKey(storageKey: string) {
  const legacyPrefix = `uploads/${legacyMaterialStoreFolder}/`;
  if (storageKey.startsWith(legacyPrefix)) {
    return `uploads/${materialStoreFolder}/${storageKey.slice(legacyPrefix.length)}`;
  }
  return storageKey;
}

@Injectable()
export class AdminMaterialImageService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AssetStorageService) private readonly assetStorage: AssetStorageService
  ) {}

  async listImages(request: RequestLike, page: number, pageSize: number): Promise<PageResult<AdminMaterialImageItem>> {
    const [items, total] = await Promise.all([
      this.prisma.adminMaterialImage.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { uploader: { select: { id: true, displayName: true } } }
      }),
      this.prisma.adminMaterialImage.count()
    ]);
    return {
      items: items.map(item => this.toItem(request, item)),
      page,
      pageSize,
      total,
      hasNext: page * pageSize < total
    };
  }

  async uploadImage(
    request: RequestLike,
    adminId: UUID,
    operationId: OperationId,
    note: string,
    file: { buffer?: Buffer; size?: number } | undefined
  ): Promise<AdminMaterialImageItem> {
    const clean = cleanNote(note);
    if (!file?.buffer || typeof file.size !== "number") {
      throw new BadRequestException("请上传图片");
    }
    if (file.size <= 0 || file.size > maxImageBytes) {
      throw new BadRequestException("图片大小不能超过 8 MB");
    }
    const fileSize = file.size;
    const meta = imageMeta(file.buffer);
    const requestHash = createHash("sha256")
      .update(clean)
      .update(":")
      .update(file.buffer)
      .digest("hex");

    let storageKey = "";
    try {
      return await this.prisma.$transaction(async tx => {
        await this.requireSuperAdminAccess(tx, adminId);
        const repeated = await getAdminIdempotentResult<AdminMaterialImageItem>(tx, operationId, "admin-material-image:upload", adminId, requestHash);
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, operationId, "admin-material-image:upload", adminId, requestHash);

        storageKey = assetKey("uploads", materialStoreFolder, `${randomUUID()}.${meta.extension}`);
        await this.assetStorage.writeObject(storageKey, file.buffer as Buffer, meta.contentType);
        const item = await tx.adminMaterialImage.create({
          data: {
            storageKey,
            note: clean,
            contentType: meta.contentType,
            sizeBytes: fileSize,
            width: meta.width,
            height: meta.height,
            uploadedByAdminId: adminId
          },
          include: { uploader: { select: { id: true, displayName: true } } }
        });
        const result = this.toItem(request, item);
        await completeAdminIdempotentOperation(tx, operationId, "admin-material-image:upload", adminId, requestHash, result);
        return result;
      });
    } catch (error) {
      if (storageKey) {
        await this.assetStorage.deleteObject(storageKey);
      }
      throw error;
    }
  }

  async deleteImage(adminId: UUID, operationId: OperationId, imageId: UUID): Promise<AdminMaterialImageDeleteResult> {
    let storageKey = "";
    const result = await this.prisma.$transaction(async tx => {
      await this.requireSuperAdminAccess(tx, adminId);
      const repeated = await getAdminIdempotentResult<AdminMaterialImageDeleteResult>(
        tx,
        operationId,
        "admin-material-image:delete",
        adminId,
        `delete:${imageId}`
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-material-image:delete", adminId, `delete:${imageId}`);

      const current = await tx.adminMaterialImage.findUnique({ where: { id: imageId } });
      if (!current) throw new NotFoundException("图片素材不存在");
      storageKey = current.storageKey;
      await tx.adminMaterialImage.delete({ where: { id: imageId } });
      const payload = { id: imageId, deleted: true };
      await completeAdminIdempotentOperation(tx, operationId, "admin-material-image:delete", adminId, `delete:${imageId}`, payload);
      return payload;
    });
    if (storageKey) {
      await this.assetStorage.deleteObject(storageKey);
    }
    return result;
  }

  async getImageAsset(fileName: string) {
    if (!/^[a-z0-9-]+\.(jpg|png|webp)$/i.test(fileName)) {
      throw new NotFoundException("图片不存在");
    }
    const storageKey = assetKey("uploads", materialStoreFolder, fileName);
    const legacyStorageKey = assetKey("uploads", legacyMaterialStoreFolder, fileName);
    const item =
      (await this.prisma.adminMaterialImage.findUnique({ where: { storageKey } })) ??
      (await this.prisma.adminMaterialImage.findUnique({ where: { storageKey: legacyStorageKey } }));
    if (!item) throw new NotFoundException("图片不存在");
    const asset = await this.assetStorage.readObject(item.storageKey, item.contentType).catch(() => null);
    if (!asset) throw new NotFoundException("图片不存在");
    return {
      contentType: item.contentType,
      stream: asset.stream,
      stat: { size: asset.size }
    };
  }

  private toItem(request: RequestLike, item: MaterialImageRow): AdminMaterialImageItem {
    return {
      id: item.id,
      imageUrl: this.assetStorage.publicUrl(request, publicStorageKey(item.storageKey), item.updatedAt),
      note: item.note,
      contentType: item.contentType,
      sizeBytes: item.sizeBytes,
      width: item.width,
      height: item.height,
      uploader: {
        id: item.uploader.id,
        displayName: item.uploader.displayName
      },
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    };
  }

  private async requireSuperAdminAccess(db: AdminAccessDb, adminId: UUID) {
    const admin = await db.adminAccount.findUnique({
      where: { id: adminId },
      select: { status: true, roles: true }
    });
    if (!admin || admin.status !== "ACTIVE" || !admin.roles.includes("SUPER_ADMIN")) {
      throw new ForbiddenException("无权执行该操作");
    }
  }
}
