<template>
  <page-meta :page-style="pageStyle" />
  <Layout
    :title="cropTitle"
    full-screen
    :navbar-transparent="true"
    :navbar-opacity="1"
    :navbar-placeholder="false"
  >
    <view class="crop-nav-backdrop" :style="navBackdropStyle" />

    <view v-if="loading" class="crop-state" :style="cropPageStyle">图片加载中...</view>
    <view v-else-if="errorText" class="crop-state crop-state--error" :style="cropPageStyle" @click="reloadSource">{{ errorText }}</view>

    <view v-else class="crop-page" :style="cropPageStyle">
      <view class="crop-stage" :style="cropStageStyle">
        <view
          class="crop-image"
          :style="cropImageStyle"
        >
          <image class="crop-image__img" :src="image.src" mode="aspectFit" />

          <view
            class="crop-box"
            :style="cropBoxStyle"
            @touchstart.stop="startMove"
            @touchmove.stop.prevent="handleMove"
            @touchend.stop="stopDrag"
            @touchcancel.stop="stopDrag"
          >
            <view class="crop-box__grid crop-box__grid--h top" />
            <view class="crop-box__grid crop-box__grid--h middle" />
            <view class="crop-box__grid crop-box__grid--h bottom" />
            <view class="crop-box__grid crop-box__grid--v left" />
            <view class="crop-box__grid crop-box__grid--v middle" />
            <view class="crop-box__grid crop-box__grid--v right" />

            <view
              v-if="canFreeResize"
              class="crop-box__line crop-box__line--top"
              @touchstart.stop="startResize($event, 'top')"
              @touchmove.stop.prevent="handleResize"
              @touchend.stop="stopDrag"
              @touchcancel.stop="stopDrag"
            />
            <view
              v-if="canFreeResize"
              class="crop-box__line crop-box__line--right"
              @touchstart.stop="startResize($event, 'right')"
              @touchmove.stop.prevent="handleResize"
              @touchend.stop="stopDrag"
              @touchcancel.stop="stopDrag"
            />
            <view
              v-if="canFreeResize"
              class="crop-box__line crop-box__line--bottom"
              @touchstart.stop="startResize($event, 'bottom')"
              @touchmove.stop.prevent="handleResize"
              @touchend.stop="stopDrag"
              @touchcancel.stop="stopDrag"
            />
            <view
              v-if="canFreeResize"
              class="crop-box__line crop-box__line--left"
              @touchstart.stop="startResize($event, 'left')"
              @touchmove.stop.prevent="handleResize"
              @touchend.stop="stopDrag"
              @touchcancel.stop="stopDrag"
            />

            <view
              class="crop-box__handle crop-box__handle--rb"
              @touchstart.stop="startResize($event, 'rightBottom')"
              @touchmove.stop.prevent="handleResize"
              @touchend.stop="stopDrag"
              @touchcancel.stop="stopDrag"
            />
          </view>
        </view>
      </view>

      <view v-if="showRatioPresets" class="crop-ratio-tabs">
        <view
          v-for="item in ratioOptions"
          :key="item.key"
          class="crop-ratio-tabs__item"
          :class="{ 'crop-ratio-tabs__item--active': activeRatioKey === item.key }"
          @click="applyRatioPreset(item.ratio, item.key)"
        >
          {{ item.label }}
        </view>
      </view>

      <view class="crop-tip">
        {{ cropTip }}
      </view>

      <view class="crop-actions">
        <button class="crop-actions__button crop-actions__button--light" :disabled="exporting" @click="cancelCrop">取消</button>
        <button class="crop-actions__button crop-actions__button--primary" :disabled="exporting" @click="finishCrop">
          {{ exporting ? "处理中..." : "完成" }}
        </button>
      </view>

      <canvas
        canvas-id="recipe-crop-canvas"
        class="crop-canvas"
        :style="canvasStyle"
      />
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, reactive, ref } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import {
  readRecipeCropRequest,
  writeRecipeCropResult,
  type RecipeCropMode,
  type RecipeCropRequest
} from "@/utils/recipe-image-crop";

type DragEdge = "" | "move" | "top" | "right" | "bottom" | "left" | "rightBottom";

const CANVAS_ID = "recipe-crop-canvas";
const MIN_BOX_RPX = 120;
const FOOTER_RPX = 320;
const FRAME_PADDING = 10;

const ratioOptions = [
  { key: "4:3", label: "4:3", ratio: 4 / 3 },
  { key: "1:1", label: "1:1", ratio: 1 },
  { key: "16:9", label: "16:9", ratio: 16 / 9 },
  { key: "reset", label: "还原", ratio: null }
] as const;

const pageStyle = usePageScrollStyle();
const { navBarTotalHeight, systemInfo } = useSystemInfo();
const instance = getCurrentInstance();

const token = ref("");
const loading = ref(true);
const exporting = ref(false);
const errorText = ref("");
const cropRequest = ref<RecipeCropRequest | null>(null);
const finished = ref(false);
const activeRatioKey = ref<(typeof ratioOptions)[number]["key"]>("4:3");

const image = reactive({
  src: "",
  naturalWidth: 0,
  naturalHeight: 0,
  displayWidth: 0,
  displayHeight: 0,
  left: 0,
  top: 0
});

const crop = reactive({
  left: 0,
  top: 0,
  right: 0,
  bottom: 0
});

const canvasSize = reactive({
  width: 1,
  height: 1
});

let dragEdge: DragEdge = "";
let startTouchX = 0;
let startTouchY = 0;
let startBox = { left: 0, top: 0, right: 0, bottom: 0 };

const cropTitle = computed(() => cropRequest.value?.title || "裁剪图片");
const cropMode = computed<RecipeCropMode>(() => cropRequest.value?.mode || "free");
const showRatioPresets = computed(() => cropMode.value === "free");
const activeAspectRatio = computed(() => {
  if (cropMode.value === "fixed") {
    return cropRequest.value?.aspectRatio ?? null;
  }
  const current = ratioOptions.find(item => item.key === activeRatioKey.value);
  return current?.ratio ?? null;
});
const canFreeResize = computed(() => cropMode.value === "free" && !activeAspectRatio.value);
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`
}));
const cropPageStyle = computed(() => ({
  minHeight: `${Math.max(0, (systemInfo.value.windowHeight || 667) - navBarTotalHeight.value)}px`,
  marginTop: `${navBarTotalHeight.value}px`
}));
const cropStageHeight = computed(() => {
  const windowHeight = systemInfo.value.windowHeight || 667;
  return Math.max(360, windowHeight - navBarTotalHeight.value - rpxToPx(FOOTER_RPX));
});
const cropStageStyle = computed(() => ({
  height: `${cropStageHeight.value}px`
}));
const cropImageStyle = computed(() => ({
  width: `${image.displayWidth}px`,
  height: `${image.displayHeight}px`,
  left: `${image.left}px`,
  top: `${image.top}px`
}));
const cropBoxStyle = computed(() => ({
  left: `${crop.left}px`,
  top: `${crop.top}px`,
  right: `${crop.right}px`,
  bottom: `${crop.bottom}px`
}));
const cropTip = computed(() => {
  if (!cropRequest.value) return "";
  if (cropMode.value === "fixed") {
    return "建议突出成品主体，画面尽量简洁完整。";
  }
  return "建议保留关键步骤主体，避免内容太贴边。";
});
const canvasStyle = computed(() => {
  return `position:absolute;left:-9999px;top:-9999px;width:${canvasSize.width}px;height:${canvasSize.height}px;`;
});

onLoad((query) => {
  const rawToken = Array.isArray(query?.token) ? query?.token[0] : query?.token;
  token.value = typeof rawToken === "string" ? decodeURIComponent(rawToken) : "";
  void loadRequest();
});

onUnload(() => {
  if (finished.value || !token.value) return;
  writeRecipeCropResult({
    token: token.value,
    status: "cancel",
    croppedPath: null,
    width: null,
    height: null
  });
});

async function loadRequest() {
  if (!token.value) {
    errorText.value = "裁剪参数缺失";
    loading.value = false;
    return;
  }
  const request = readRecipeCropRequest(token.value);
  if (!request) {
    errorText.value = "裁剪任务已失效，请重新选择图片";
    loading.value = false;
    return;
  }
  cropRequest.value = request;
  await loadSource(request.sourcePath);
}

async function reloadSource() {
  if (!cropRequest.value?.sourcePath) return;
  await loadSource(cropRequest.value.sourcePath);
}

async function loadSource(path: string) {
  loading.value = true;
  errorText.value = "";
  try {
    const info = await uniPlatform.media.getImageInfo(path);
    image.src = path;
    image.naturalWidth = info.width;
    image.naturalHeight = info.height;
    fitImage();
    initCropBox();
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "图片加载失败";
  } finally {
    loading.value = false;
  }
}

function fitImage() {
  const areaWidth = Math.max(280, (systemInfo.value.windowWidth || 375) - FRAME_PADDING);
  const areaHeight = Math.max(280, cropStageHeight.value - FRAME_PADDING);
  const ratio = image.naturalWidth / image.naturalHeight;

  let displayWidth = areaWidth;
  let displayHeight = displayWidth / ratio;

  if (displayHeight > areaHeight) {
    displayHeight = areaHeight;
    displayWidth = displayHeight * ratio;
  }

  image.displayWidth = displayWidth;
  image.displayHeight = displayHeight;
  image.left = (areaWidth - displayWidth) / 2;
  image.top = (areaHeight - displayHeight) / 2;
}

function initCropBox() {
  if (activeAspectRatio.value) {
    let boxWidth = image.displayWidth;
    let boxHeight = boxWidth / activeAspectRatio.value;

    if (boxHeight > image.displayHeight) {
      boxHeight = image.displayHeight;
      boxWidth = boxHeight * activeAspectRatio.value;
    }

    crop.left = (image.displayWidth - boxWidth) / 2;
    crop.right = crop.left;
    crop.top = (image.displayHeight - boxHeight) / 2;
    crop.bottom = crop.top;
    return;
  }

  crop.left = 0;
  crop.top = 0;
  crop.right = 0;
  crop.bottom = 0;
}

function applyRatioPreset(ratio: number | null, key: (typeof ratioOptions)[number]["key"]) {
  if (!showRatioPresets.value || exporting.value) return;
  const nextKey = ratio === null ? "reset" : key;
  if (activeRatioKey.value === nextKey) return;
  activeRatioKey.value = nextKey;
  initCropBox();
}

function getTouchPoint(event: Event) {
  const payload = event as Event & {
    touches?: Array<{ pageX?: number; pageY?: number; clientX?: number; clientY?: number }>;
    changedTouches?: Array<{ pageX?: number; pageY?: number; clientX?: number; clientY?: number }>;
  };
  const point = payload.touches?.[0] || payload.changedTouches?.[0];
  if (!point) return null;
  return {
    x: point.pageX ?? point.clientX ?? 0,
    y: point.pageY ?? point.clientY ?? 0
  };
}

function startMove(event: Event) {
  const point = getTouchPoint(event);
  if (!point) return;
  dragEdge = "move";
  startTouchX = point.x;
  startTouchY = point.y;
  startBox = { left: crop.left, top: crop.top, right: crop.right, bottom: crop.bottom };
}

function handleMove(event: Event) {
  if (dragEdge !== "move") return;
  const point = getTouchPoint(event);
  if (!point) return;

  const deltaX = point.x - startTouchX;
  const deltaY = point.y - startTouchY;
  const boxWidth = image.displayWidth - startBox.left - startBox.right;
  const boxHeight = image.displayHeight - startBox.top - startBox.bottom;

  const nextLeft = clampNumber(startBox.left + deltaX, 0, image.displayWidth - boxWidth);
  const nextTop = clampNumber(startBox.top + deltaY, 0, image.displayHeight - boxHeight);

  crop.left = nextLeft;
  crop.right = image.displayWidth - boxWidth - nextLeft;
  crop.top = nextTop;
  crop.bottom = image.displayHeight - boxHeight - nextTop;
}

function startResize(event: Event, edge: Exclude<DragEdge, "" | "move">) {
  const point = getTouchPoint(event);
  if (!point) return;
  dragEdge = edge;
  startTouchX = point.x;
  startTouchY = point.y;
  startBox = { left: crop.left, top: crop.top, right: crop.right, bottom: crop.bottom };
}

function handleResize(event: Event) {
  if (!dragEdge || dragEdge === "move") return;
  const point = getTouchPoint(event);
  if (!point) return;
  const deltaX = point.x - startTouchX;
  const deltaY = point.y - startTouchY;

  if (activeAspectRatio.value && dragEdge === "rightBottom") {
    resizeFixed(deltaX);
    return;
  }

  resizeFree(deltaX, deltaY);
}

function resizeFixed(deltaX: number) {
  if (!activeAspectRatio.value) return;
  const minWidth = minBoxWidth();
  const startWidth = image.displayWidth - startBox.left - startBox.right;
  const maxWidth = Math.min(
    image.displayWidth - startBox.left,
    (image.displayHeight - startBox.top) * activeAspectRatio.value
  );
  const nextWidth = clampNumber(startWidth + deltaX, minWidth, maxWidth);
  const nextHeight = nextWidth / activeAspectRatio.value;
  crop.right = image.displayWidth - startBox.left - nextWidth;
  crop.bottom = image.displayHeight - startBox.top - nextHeight;
  crop.left = startBox.left;
  crop.top = startBox.top;
}

function resizeFree(deltaX: number, deltaY: number) {
  const minWidth = minBoxWidth();
  const minHeight = minBoxHeight();

  if (dragEdge === "left") {
    crop.left = clampNumber(startBox.left + deltaX, 0, image.displayWidth - startBox.right - minWidth);
    return;
  }

  if (dragEdge === "right") {
    crop.right = clampNumber(startBox.right - deltaX, 0, image.displayWidth - startBox.left - minWidth);
    return;
  }

  if (dragEdge === "top") {
    crop.top = clampNumber(startBox.top + deltaY, 0, image.displayHeight - startBox.bottom - minHeight);
    return;
  }

  if (dragEdge === "bottom") {
    crop.bottom = clampNumber(startBox.bottom - deltaY, 0, image.displayHeight - startBox.top - minHeight);
    return;
  }

  if (dragEdge === "rightBottom") {
    crop.right = clampNumber(startBox.right - deltaX, 0, image.displayWidth - startBox.left - minWidth);
    crop.bottom = clampNumber(startBox.bottom - deltaY, 0, image.displayHeight - startBox.top - minHeight);
  }
}

function stopDrag() {
  dragEdge = "";
}

function cancelCrop() {
  if (exporting.value) return;
  void uniPlatform.navigation.navigateBack();
}

async function finishCrop() {
  if (!cropRequest.value || exporting.value) return;
  exporting.value = true;
  try {
    const result = await exportCrop();
    writeRecipeCropResult({
      token: token.value,
      status: "done",
      croppedPath: result.path,
      width: result.width,
      height: result.height
    });
    finished.value = true;
    void uniPlatform.navigation.navigateBack();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "裁剪失败", icon: "none" });
  } finally {
    exporting.value = false;
  }
}

async function exportCrop() {
  if (!cropRequest.value) throw new Error("裁剪参数缺失");
  const sourceRect = resolveSourceRect();
  const exportSize = resolveExportSize(sourceRect.width, sourceRect.height);
  canvasSize.width = exportSize.width;
  canvasSize.height = exportSize.height;
  await nextTick();

  const context = uniPlatform.media.createCanvasContext(CANVAS_ID, instance?.proxy);
  context.clearRect(0, 0, exportSize.width, exportSize.height);
  context.drawImage(
    image.src,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    0,
    0,
    exportSize.width,
    exportSize.height
  );

  await new Promise<void>((resolve) => {
    context.draw(false, () => resolve());
  });

  const file = await uniPlatform.media.canvasToTempFilePath(
    {
      canvasId: CANVAS_ID,
      width: exportSize.width,
      height: exportSize.height,
      destWidth: exportSize.width,
      destHeight: exportSize.height,
      fileType: cropRequest.value.fileType,
      quality: cropRequest.value.quality
    },
    instance?.proxy
  );

  return {
    path: file.tempFilePath,
    width: exportSize.width,
    height: exportSize.height
  };
}

function resolveSourceRect() {
  const cropWidth = image.displayWidth - crop.left - crop.right;
  const cropHeight = image.displayHeight - crop.top - crop.bottom;
  return {
    x: Math.max(0, Math.round((crop.left / image.displayWidth) * image.naturalWidth)),
    y: Math.max(0, Math.round((crop.top / image.displayHeight) * image.naturalHeight)),
    width: Math.max(1, Math.round((cropWidth / image.displayWidth) * image.naturalWidth)),
    height: Math.max(1, Math.round((cropHeight / image.displayHeight) * image.naturalHeight))
  };
}

function resolveExportSize(sourceWidth: number, sourceHeight: number) {
  if (cropRequest.value?.outputWidth && cropRequest.value?.outputHeight) {
    return {
      width: cropRequest.value.outputWidth,
      height: cropRequest.value.outputHeight
    };
  }

  const maxWidth = cropRequest.value?.maxWidth ?? sourceWidth;
  const maxHeight = cropRequest.value?.maxHeight ?? sourceHeight;
  const scale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale))
  };
}

function minBoxWidth() {
  if (activeAspectRatio.value) {
    return minBoxHeight() * activeAspectRatio.value;
  }
  return rpxToPx(MIN_BOX_RPX);
}

function minBoxHeight() {
  return rpxToPx(MIN_BOX_RPX);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function rpxToPx(value: number) {
  const width = systemInfo.value.windowWidth || 375;
  return (width * value) / 750;
}
</script>

<style scoped lang="scss">
.crop-page {
  display: flex;
  flex-direction: column;
  background: #0c0f12;
}

.crop-nav-backdrop {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 799;
  background: rgba(12, 15, 18, 0.96);
}

.crop-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 48rpx;
  color: rgba(247, 244, 238, 0.92);
  background: #0c0f12;
  font-size: 28rpx;
  text-align: center;
}

.crop-state--error {
  color: rgba(255, 209, 209, 0.92);
}

.crop-stage {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.01) 100%),
    #050607;
}

.crop-image {
  position: absolute;
}

.crop-image__img {
  display: block;
  width: 100%;
  height: 100%;
}

.crop-box {
  position: absolute;
  box-shadow:
    0 0 0 9999px rgba(0, 0, 0, 0.56),
    inset 0 0 0 2px rgba(255, 255, 255, 0.9);
}

.crop-box__grid {
  position: absolute;
  opacity: 0.42;
}

.crop-box__grid--h {
  right: 0;
  left: 0;
  height: 1px;
  background: rgba(255, 255, 255, 0.72);
}

.crop-box__grid--h.top {
  top: 33.3333%;
}

.crop-box__grid--h.middle {
  top: 66.6666%;
}

.crop-box__grid--h.bottom {
  top: 50%;
  opacity: 0;
}

.crop-box__grid--v {
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(255, 255, 255, 0.72);
}

.crop-box__grid--v.left {
  left: 33.3333%;
}

.crop-box__grid--v.middle {
  left: 66.6666%;
}

.crop-box__grid--v.right {
  left: 50%;
  opacity: 0;
}

.crop-box__line {
  position: absolute;
}

.crop-box__line--top,
.crop-box__line--bottom {
  right: 24rpx;
  left: 24rpx;
  height: 36rpx;
}

.crop-box__line--top {
  top: -18rpx;
}

.crop-box__line--bottom {
  bottom: -18rpx;
}

.crop-box__line--left,
.crop-box__line--right {
  top: 24rpx;
  bottom: 24rpx;
  width: 36rpx;
}

.crop-box__line--left {
  left: -18rpx;
}

.crop-box__line--right {
  right: -18rpx;
}

.crop-box__handle {
  position: absolute;
  width: 54rpx;
  height: 54rpx;
}

.crop-box__handle--rb {
  right: -22rpx;
  bottom: -22rpx;
  border-right: 6rpx solid #ffffff;
  border-bottom: 6rpx solid #ffffff;
}

.crop-tip {
  padding: 26rpx 36rpx 12rpx;
  color: rgba(247, 244, 238, 0.7);
  font-size: 24rpx;
  line-height: 1.6;
  text-align: center;
}

.crop-ratio-tabs {
  display: flex;
  gap: 16rpx;
  padding: 24rpx 24rpx 0;
}

.crop-ratio-tabs__item {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 64rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.14);
  border-radius: var(--radius-pill);
  color: rgba(247, 244, 238, 0.76);
  background: rgba(255, 255, 255, 0.04);
  font-size: 24rpx;
  line-height: 1;
}

.crop-ratio-tabs__item--active {
  border-color: rgba(240, 143, 80, 0.72);
  color: #fff2e8;
  background: rgba(240, 143, 80, 0.24);
}

.crop-actions {
  display: flex;
  gap: 18rpx;
  padding: 16rpx 24rpx calc(36rpx + env(safe-area-inset-bottom));
}

.crop-actions__button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 84rpx;
  border: 0;
  border-radius: var(--radius-pill);
  font-size: 28rpx;
  font-weight: 600;
}

.crop-actions__button--light {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(247, 244, 238, 0.92);
}

.crop-actions__button--primary {
  background: linear-gradient(135deg, #f08f50 0%, #e26a2c 100%);
  color: #fff9f4;
}

.crop-canvas {
  pointer-events: none;
}
</style>
