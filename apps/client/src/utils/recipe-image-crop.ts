import { APP_STORAGE_KEYS, uniPlatform } from "@/platform/uni";

export type RecipeCropMode = "fixed" | "free";

export interface RecipeCropRequest {
  token: string;
  title: string;
  sourcePath: string;
  mode: RecipeCropMode;
  aspectRatio: number | null;
  outputWidth: number | null;
  outputHeight: number | null;
  maxWidth: number;
  maxHeight: number;
  quality: number;
  fileType: "jpg" | "png";
}

export interface RecipeCropResult {
  token: string;
  status: "done" | "cancel";
  croppedPath: string | null;
  width: number | null;
  height: number | null;
}

type RecipeCropSession = {
  request: RecipeCropRequest | null;
  result: RecipeCropResult | null;
};

function buildCropStorageKey(token: string) {
  return APP_STORAGE_KEYS.recipeCrop(token);
}

export function writeRecipeCropRequest(request: RecipeCropRequest) {
  const key = buildCropStorageKey(request.token);
  const current = uniPlatform.storage.getSync<RecipeCropSession>(key);
  uniPlatform.storage.setSync<RecipeCropSession>(key, {
    request,
    result: current?.result ?? null
  });
}

export function readRecipeCropRequest(token: string) {
  const value = uniPlatform.storage.getSync<RecipeCropSession>(buildCropStorageKey(token));
  return value?.request ?? null;
}

export function writeRecipeCropResult(result: RecipeCropResult) {
  const key = buildCropStorageKey(result.token);
  const current = uniPlatform.storage.getSync<RecipeCropSession>(key);
  uniPlatform.storage.setSync<RecipeCropSession>(key, {
    request: current?.request ?? null,
    result
  });
}

export function readRecipeCropResult(token: string) {
  const value = uniPlatform.storage.getSync<RecipeCropSession>(buildCropStorageKey(token));
  return value?.result ?? null;
}

export function clearRecipeCropSession(token: string) {
  uniPlatform.storage.removeSync(buildCropStorageKey(token));
}
