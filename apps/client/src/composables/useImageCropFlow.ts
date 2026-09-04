import { ref } from "vue";
import { uniPlatform } from "@/platform/uni";
import {
  clearImageCropSession,
  createImageCropRequest,
  readImageCropResult,
  writeImageCropRequest,
  type ImageCropPolicy,
  type ImageCropResult
} from "../utils/image-crop";

type CropTask<TTarget> = {
  sourcePath: string;
  policy: ImageCropPolicy;
  target: TTarget;
};

interface UseImageCropFlowOptions<TTarget> {
  cropPagePath?: string;
  tokenPrefix?: string;
  onApply: (result: ImageCropResult, target: TTarget) => Promise<void> | void;
  onOpenError?: (error: unknown, task: CropTask<TTarget>) => Promise<void> | void;
}

export function useImageCropFlow<TTarget>(options: UseImageCropFlowOptions<TTarget>) {
  let queue: CropTask<TTarget>[] = [];
  const activeToken = ref("");
  let activeTarget: TTarget | null = null;

  function queueCrop(task: CropTask<TTarget>) {
    queue = [...queue, task];
    if (!activeToken.value) {
      void openNextCrop();
    }
  }

  function queueCrops(tasks: CropTask<TTarget>[]) {
    if (!tasks.length) return;
    queue = [...queue, ...tasks];
    if (!activeToken.value) {
      void openNextCrop();
    }
  }

  async function openNextCrop() {
    if (activeToken.value) return;
    const [nextTask, ...rest] = queue;
    if (!nextTask) return;
    queue = rest;

    const request = createImageCropRequest(nextTask.sourcePath, nextTask.policy, {
      tokenPrefix: options.tokenPrefix
    });

    activeToken.value = request.token;
    activeTarget = nextTask.target;
    writeImageCropRequest(request);

    try {
      await uniPlatform.navigation.navigateTo(
        `${options.cropPagePath ?? "/pages_recipe/crop/index"}?token=${encodeURIComponent(request.token)}`
      );
    } catch (error) {
      clearImageCropSession(request.token);
      activeToken.value = "";
      activeTarget = null;
      try {
        await options.onOpenError?.(error, nextTask);
      } finally {
        await openNextCrop();
      }
    }
  }

  async function consumeCropResult() {
    if (!activeToken.value) return;
    const result = readImageCropResult(activeToken.value);
    if (!result) return;

    const token = activeToken.value;
    const target = activeTarget;
    clearImageCropSession(token);
    activeToken.value = "";
    activeTarget = null;

    if (result.status === "done" && target) {
      await options.onApply(result, target);
    }

    await openNextCrop();
  }

  function clearCropQueue() {
    if (activeToken.value) {
      clearImageCropSession(activeToken.value);
    }
    queue = [];
    activeToken.value = "";
    activeTarget = null;
  }

  return {
    queueCrop,
    queueCrops,
    consumeCropResult,
    clearCropQueue,
    activeToken
  };
}
