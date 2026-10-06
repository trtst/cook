import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";

type ImageCompressionLimit = {
  maxInputBytes: number;
  maxOutputBytes: number;
  maxDimension?: number;
  cropRatio?: number;
  inputSizeMessage: string;
  outputSizeMessage: string;
};

export type CompressedImage = {
  buffer: Buffer;
  contentType: "image/jpeg" | "image/webp";
  extension: "jpg" | "webp";
  width: number;
  height: number;
};

const supportedFormats = new Set(["jpeg", "png", "webp"]);
const outputQualities = [82, 68, 54, 40];
const maxResizePasses = 10;
const maxInputPixels = 40_000_000;

export async function compressUploadedImage(buffer: Buffer, limit: ImageCompressionLimit): Promise<CompressedImage> {
  if (!buffer.length || buffer.length > limit.maxInputBytes) {
    throw new BadRequestException(limit.inputSizeMessage);
  }

  try {
    const pixelLimit = maxInputPixels;
    const metadata = await sharp(buffer, { failOn: "truncated", limitInputPixels: pixelLimit }).metadata();
    if (!metadata.format || !supportedFormats.has(metadata.format) || !metadata.width || !metadata.height) {
      throw new BadRequestException("仅支持有效的 JPG、PNG、WEBP 图片");
    }
    if (metadata.width * metadata.height > pixelLimit) {
      throw new BadRequestException("图片像素不能超过 4000 万");
    }

    const rotated = [5, 6, 7, 8].includes(metadata.orientation ?? 0);
    const sourceWidth = rotated ? metadata.height : metadata.width;
    const sourceHeight = rotated ? metadata.width : metadata.height;
    const dimensionScale = limit.maxDimension
      ? Math.min(1, limit.maxDimension / Math.max(sourceWidth, sourceHeight))
      : 1;
    let targetWidth = Math.max(1, Math.round(sourceWidth * dimensionScale));
    let targetHeight = Math.max(1, Math.round(sourceHeight * dimensionScale));
    if (limit.cropRatio && Number.isFinite(limit.cropRatio) && limit.cropRatio > 0) {
      if (targetWidth / targetHeight > limit.cropRatio) {
        targetWidth = Math.max(1, Math.round(targetHeight * limit.cropRatio));
      } else {
        targetHeight = Math.max(1, Math.round(targetWidth / limit.cropRatio));
      }
    }

    // 先保持裁切比例，再逐级降低尺寸和质量，直到满足成品大小限制。
    for (let pass = 0; pass < maxResizePasses; pass += 1) {
      const scale = 0.82 ** pass;
      const width = Math.max(1, Math.round(targetWidth * scale));
      const height = Math.max(1, Math.round(targetHeight * scale));

      for (const quality of outputQualities) {
        const result = await sharp(buffer, { failOn: "truncated", limitInputPixels: pixelLimit })
          .rotate()
          .resize({
            width,
            height,
            fit: limit.cropRatio ? "cover" : "inside",
            position: "centre",
            withoutEnlargement: true
          })
          .toFormat(metadata.hasAlpha ? "webp" : "jpeg", metadata.hasAlpha ? { quality } : { quality, mozjpeg: true })
          .toBuffer({ resolveWithObject: true });

        if (result.data.length <= limit.maxOutputBytes) {
          return {
            buffer: result.data,
            contentType: metadata.hasAlpha ? "image/webp" : "image/jpeg",
            extension: metadata.hasAlpha ? "webp" : "jpg",
            width: result.info.width,
            height: result.info.height
          };
        }
      }
    }

    throw new BadRequestException(limit.outputSizeMessage);
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException("图片损坏或无法压缩，请更换图片后重试");
  }
}
