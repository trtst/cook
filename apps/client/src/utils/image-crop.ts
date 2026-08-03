import { APP_STORAGE_KEYS, uniPlatform } from "@/platform/uni";
import { createOperationId } from "@/utils/operation-id";

export type ImageCropMode = "fixed" | "free";

export interface ImageCropPolicy {
  title: string;
  mode: ImageCropMode;
  aspectRatio: number | null;
  outputWidth: number | null;
  outputHeight: number | null;
  maxWidth: number;
  maxHeight: number;
  quality: number;
  fileType: "jpg" | "png";
}

export interface ImageCropRequest extends ImageCropPolicy {
  token: string;
  sourcePath: string;
}

export interface ImageCropResult {
  token: string;
  status: "done" | "cancel";
  croppedPath: string | null;
  width: number | null;
  height: number | null;
}

type ImageCropSession = {
  request: ImageCropRequest | null;
  result: ImageCropResult | null;
};

export const imageCropPresets = Object.freeze({
  recipeCover: {
    title: "裁剪封面图",
    mode: "fixed",
    aspectRatio: 4 / 3,
    outputWidth: 1200,
    outputHeight: 900,
    maxWidth: 1200,
    maxHeight: 900,
    quality: 0.84,
    fileType: "jpg"
  } satisfies ImageCropPolicy,
  recipeStep: {
    title: "裁剪步骤图",
    mode: "free",
    aspectRatio: null,
    outputWidth: null,
    outputHeight: null,
    maxWidth: 1280,
    maxHeight: 1280,
    quality: 0.8,
    fileType: "jpg"
  } satisfies ImageCropPolicy,
  profileAvatar: {
    title: "裁剪头像",
    mode: "fixed",
    aspectRatio: 1,
    outputWidth: 720,
    outputHeight: 720,
    maxWidth: 720,
    maxHeight: 720,
    quality: 0.82,
    fileType: "jpg"
  } satisfies ImageCropPolicy
});

function buildCropStorageKey(token: string) {
  return APP_STORAGE_KEYS.imageCrop(token);
}

export function buildImageCropToken(prefix = "image-crop") {
  return `${prefix}-${createOperationId()}`;
}

export function createImageCropRequest(
  sourcePath: string,
  policy: ImageCropPolicy,
  options: {
    token?: string;
    tokenPrefix?: string;
  } = {}
): ImageCropRequest {
  return {
    token: options.token ?? buildImageCropToken(options.tokenPrefix),
    sourcePath,
    title: policy.title,
    mode: policy.mode,
    aspectRatio: policy.aspectRatio,
    outputWidth: policy.outputWidth,
    outputHeight: policy.outputHeight,
    maxWidth: policy.maxWidth,
    maxHeight: policy.maxHeight,
    quality: policy.quality,
    fileType: policy.fileType
  };
}

export function writeImageCropRequest(request: ImageCropRequest) {
  const key = buildCropStorageKey(request.token);
  const current = uniPlatform.storage.getSync<ImageCropSession>(key);
  uniPlatform.storage.setSync<ImageCropSession>(key, {
    request,
    result: current?.result ?? null
  });
}

export function readImageCropRequest(token: string) {
  const value = uniPlatform.storage.getSync<ImageCropSession>(buildCropStorageKey(token));
  return value?.request ?? null;
}

export function writeImageCropResult(result: ImageCropResult) {
  const key = buildCropStorageKey(result.token);
  const current = uniPlatform.storage.getSync<ImageCropSession>(key);
  uniPlatform.storage.setSync<ImageCropSession>(key, {
    request: current?.request ?? null,
    result
  });
}

export function readImageCropResult(token: string) {
  const value = uniPlatform.storage.getSync<ImageCropSession>(buildCropStorageKey(token));
  return value?.result ?? null;
}

export function clearImageCropSession(token: string) {
  uniPlatform.storage.removeSync(buildCropStorageKey(token));
}

export function releaseImageFile(filePath: string) {
  const normalizedPath = String(filePath || "").trim();
  if (!normalizedPath) return;
  void uniPlatform.media.removeSavedFile(normalizedPath).catch(() => undefined);
}
