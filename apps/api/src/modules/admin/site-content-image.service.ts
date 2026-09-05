import { randomUUID } from "node:crypto";
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { assetKey, AssetStorageService } from "../../common/asset-storage.service";
import { completeAdminIdempotentOperation, getAdminIdempotentResult, startAdminIdempotentOperation } from "../../common/idempotency";
import { PrismaService } from "../../common/prisma.service";
import type { AdminSiteContentImageUploadResult, OperationId, UUID } from "../../contracts/types";

type ImageKind = "jpeg" | "png" | "webp";
type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

const maxImageBytes = 8 * 1024 * 1024;

function detectImageKind(buffer: Buffer): ImageKind | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

function fileExtension(kind: ImageKind) {
  if (kind === "jpeg") return "jpg";
  if (kind === "png") return "png";
  return "webp";
}

function contentType(kind: ImageKind) {
  if (kind === "jpeg") return "image/jpeg";
  if (kind === "png") return "image/png";
  return "image/webp";
}

@Injectable()
export class SiteContentImageService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AssetStorageService) private readonly assetStorage: AssetStorageService
  ) {}

  async uploadImage(
    request: RequestLike,
    adminId: UUID,
    operationId: OperationId,
    file: { buffer?: Buffer; size?: number } | undefined
  ): Promise<AdminSiteContentImageUploadResult> {
    await this.requireSuperAdmin(adminId);
    if (!file?.buffer || typeof file.size !== "number") {
      throw new BadRequestException("请上传图片");
    }
    if (file.size <= 0 || file.size > maxImageBytes) {
      throw new BadRequestException("图片大小不能超过 8 MB");
    }

    const kind = detectImageKind(file.buffer);
    if (!kind) {
      throw new BadRequestException("仅支持 JPG、PNG、WEBP 图片");
    }

    const buffer = file.buffer;
    const requestHash = `${kind}:${file.size}:${Buffer.from(buffer).toString("base64url")}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminSiteContentImageUploadResult>(
        tx,
        operationId,
        "admin-site-content-image:upload",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-site-content-image:upload", adminId, requestHash);

      const fileName = `${randomUUID()}.${fileExtension(kind)}`;
      await this.assetStorage.writeObject(this.imageKey(fileName), buffer, contentType(kind));

      const result = {
        imageUrl: this.buildImageUrl(request, fileName)
      };
      await completeAdminIdempotentOperation(tx, operationId, "admin-site-content-image:upload", adminId, requestHash, result);
      return result;
    });
  }

  async getImageAsset(fileName: string) {
    if (!/^[a-z0-9-]+\.(jpg|png|webp)$/i.test(fileName)) {
      throw new NotFoundException("图片不存在");
    }

    const lower = fileName.toLowerCase();
    const kind: ImageKind = lower.endsWith(".png") ? "png" : lower.endsWith(".webp") ? "webp" : "jpeg";
    const asset = await this.assetStorage.readObject(this.imageKey(fileName), contentType(kind)).catch(() => null);
    if (!asset) throw new NotFoundException("图片不存在");
    return {
      contentType: contentType(kind),
      stream: asset.stream,
      stat: { size: asset.size }
    };
  }

  private imageDir() {
    return assetKey("uploads", "site-content-images");
  }

  private imageKey(fileName: string) {
    return assetKey(this.imageDir(), fileName);
  }

  private buildImageUrl(request: RequestLike, fileName: string) {
    return this.assetStorage.publicUrl(request, this.imageKey(fileName));
  }

  private async requireSuperAdmin(adminId: UUID) {
    const admin = await this.prisma.adminAccount.findUnique({
      where: { id: adminId },
      select: { status: true, roles: true }
    });
    if (!admin || admin.status !== "ACTIVE" || !admin.roles.includes("SUPER_ADMIN")) {
      throw new ForbiddenException("无权执行该操作");
    }
  }
}
