import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { completeAdminIdempotentOperation, getAdminIdempotentResult, startAdminIdempotentOperation } from "../../common/idempotency";
import { PrismaService } from "../../common/prisma.service";
import type { AdminSiteContentImageUploadResult, OperationId, UUID } from "../../contracts/types";

type ImageKind = "jpeg" | "png" | "webp";
type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

const maxImageBytes = 8 * 1024 * 1024;

function getAssetRoot() {
  return resolve(process.env.APP_ASSET_DIR || join(process.cwd(), "var", "app-assets"));
}

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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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

      await mkdir(this.imageDir(), { recursive: true });
      const fileName = `${randomUUID()}.${fileExtension(kind)}`;
      await writeFile(join(this.imageDir(), fileName), buffer);

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
    const path = join(this.imageDir(), fileName);
    const stats = await stat(path).catch(() => null);
    if (!stats) throw new NotFoundException("图片不存在");

    const lower = fileName.toLowerCase();
    const kind: ImageKind = lower.endsWith(".png") ? "png" : lower.endsWith(".webp") ? "webp" : "jpeg";
    return {
      contentType: contentType(kind),
      stream: createReadStream(path),
      stat: stats
    };
  }

  private imageDir() {
    return join(getAssetRoot(), "site-content-images");
  }

  private buildImageUrl(request: RequestLike, fileName: string) {
    const protocol = request.protocol || "http";
    const host = request.get?.("host");
    const path = `/api/public-assets/site-content-images/${fileName}`;
    if (!host) return path;
    return `${protocol}://${host}${path}`;
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
