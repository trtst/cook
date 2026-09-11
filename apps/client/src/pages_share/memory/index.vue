<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="活动回忆卡">
    <scroll-view class="memory-page" scroll-y>
      <view v-if="errorText" class="notice" @click="loadPage">
        <text>{{ errorText }}</text><text>重新加载</text>
      </view>
      <view v-else-if="loading && !cardData" class="notice"><text>活动回忆卡加载中...</text></view>
      <view v-else-if="!cardData" class="empty-wrap">
        <Empty title="还没有可展示的活动回忆卡" description="从已到开饭时间的饭局进入，即可预览并分享这次相聚。" />
      </view>
      <template v-else-if="posterView">
        <view class="preview-head">
          <view><text class="preview-head__title">分享这次相聚</text><text class="preview-head__hint">把餐桌的热闹，也送给没能到场的人。</text></view>
          <button v-if="canPreparePoster || posterFilePath" class="preview-head__action" hover-class="none" @click="previewPoster">预览</button>
        </view>
        <view class="poster-shell">
          <MemoryPoster
            :view="posterView"
            :mini-code-url="cardData.miniCodeUrl"
            :editable="mode === 'event' && canManageEventShare"
            :show-participants="showParticipants"
            :caption-value="caption"
            @toggle-participants="toggleParticipants"
            @update:caption="caption = $event"
          />
        </view>
        <LoginEmptyState v-if="mode === 'event' && !sessionStore.isLoggedIn" class="login-state" title="登录后分享活动回忆" description="登录后可设置公开内容，并生成带小程序码的分享图片。" @success="handleLoginSuccess" />
        <view v-if="shareTips.length" class="share-tips">
          <text class="share-tips__title">分享前的小提醒</text>
          <view v-for="tip in shareTips" :key="tip" class="share-tips__item"><view class="share-tips__dot" /><text>{{ tip }}</text></view>
        </view>
      </template>
    </scroll-view>
    <view v-if="posterView" class="share-actions">
      <button class="share-actions__primary" :class="{ 'share-actions__primary--disabled': !canPreparePoster }" hover-class="none" @click="sharePoster">{{ posterBusy ? "正在生成..." : "分享给朋友" }}</button>
      <button class="share-actions__secondary" :class="{ 'share-actions__secondary--disabled': !canPreparePoster }" hover-class="none" @click="savePoster">保存图片发朋友圈</button>
    </view>
    <view v-if="posterView" class="poster-theme-probe" aria-hidden="true" />
    <canvas v-if="exportPosterView" id="memory-poster-canvas" canvas-id="memory-poster-canvas" type="2d" class="poster-canvas" :width="1080" :height="exportPosterView.height" :style="posterCanvasStyle" />
  </Layout>
</template>

<script setup lang="ts">
import { onLoad, onShareAppMessage, onShow, onUnload } from "@dcloudio/uni-app";
import { computed, getCurrentInstance, nextTick, ref, watch } from "vue";
import type { UUID } from "@/apis/http";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import LoginEmptyState from "@/components/Login/LoginEmptyState.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { formatMealSlot } from "@/utils/meal-slot";
import { createOperationId } from "@/utils/operation-id";
import { mealApi, type DiningEventSummary } from "../apis/meal";
import { shareApi, type MemoryShareParticipant, type MemorySharePreviewResponse, type MemoryShareSnapshotResponse } from "../apis/share";
import { formatDateTimeMinute } from "../utils/date";
import MemoryPoster from "./MemoryPoster.vue";
import { buildMemoryPosterView, MEMORY_POSTER_TEMPLATE, type MemoryPosterSource } from "./memory-poster";
import { drawMemoryPoster } from "./memory-poster-renderer";

type PageMode = "empty" | "event" | "token";
interface MemoryCardView extends Omit<MemoryPosterSource, "metaText"> { miniCodeUrl: string | null; }
interface PosterImage { src: string; onload: (() => void) | null; onerror: ((error: unknown) => void) | null; }
interface PosterCanvas { width: number; height: number; createImage(): PosterImage; getContext(type: "2d"): unknown; }

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const sessionStore = useSessionStore();
const instance = getCurrentInstance();
const mode = ref<PageMode>("empty");
const loading = ref(false);
const submitting = ref(false);
const posterBusy = ref(false);
const errorText = ref("");
const eventId = ref<UUID | "">("");
const shareToken = ref("");
const showParticipants = ref(true);
const caption = ref("");
const eventDetail = ref<DiningEventSummary | null>(null);
const sharePreview = ref<MemoryCardView | null>(null);
const shareSnapshot = ref<MemoryShareSnapshotResponse | null>(null);
const posterFilePath = ref("");
const nowMs = ref(Date.now());
let clockTimer: ReturnType<typeof setInterval> | null = null;

const normalizedCaption = computed(() => caption.value.trim() || null);
const cardData = computed<MemoryCardView | null>(() => {
  if (shareSnapshot.value) return toCardView(shareSnapshot.value);
  if (sharePreview.value) return sharePreview.value;
  return eventDetail.value ? buildDraftCard(eventDetail.value, normalizedCaption.value, showParticipants.value) : null;
});
const metaText = computed(() => {
  if (cardData.value?.planDate || cardData.value?.mealSlot) return [cardData.value.planDate, cardData.value.mealSlot ? formatMealSlot(cardData.value.mealSlot) : null].filter(Boolean).join(" · ");
  return eventDetail.value ? [formatDateTimeMinute(eventDetail.value.scheduledAt), eventDetail.value.location].filter(Boolean).join(" · ") : "一次相聚 · 一份回忆";
});
const exportPosterView = computed(() => cardData.value ? buildMemoryPosterView({ ...cardData.value, metaText: metaText.value }) : null);
const posterView = computed(() => {
  if (!cardData.value) return null;
  const participants = mode.value === "event" && canManageEventShare.value && eventDetail.value
    ? buildDraftParticipants(eventDetail.value, true)
    : cardData.value.participants;
  return buildMemoryPosterView({ ...cardData.value, metaText: metaText.value, participants });
});
const generateReady = computed(() => isEventTimeUp(eventDetail.value, nowMs.value));
const canManageEventShare = computed(() => Boolean(eventDetail.value && eventDetail.value.organizerUid === sessionStore.uid));
const shareTips = computed(() => {
  if (mode.value !== "event" || !canManageEventShare.value) return [];
  const tips: string[] = [];
  if (!cardData.value?.coverImageUrl) tips.push("可在饭局详情上传封面图，让这次相聚更有画面。");
  if (showParticipants.value) tips.push("会展示参与成员，分享前再确认一下。");
  return tips;
});
const canPreparePoster = computed(() => !posterBusy.value && !submitting.value && Boolean(exportPosterView.value) && (mode.value === "token" ? Boolean(cardData.value?.miniCodeUrl) : Boolean(eventId.value && generateReady.value && canManageEventShare.value)));
const posterCanvasStyle = computed(() => ({ width: "1080px", height: `${exportPosterView.value?.height ?? 1030}px` }));

onLoad(query => {
  const rawScene = Array.isArray(query?.scene) ? query.scene[0] : query?.scene;
  const rawToken = rawScene || (Array.isArray(query?.token) ? query.token[0] : query?.token);
  const nextToken = typeof rawToken === "string" ? decodeURIComponent(rawToken) : "";
  if (nextToken) { mode.value = "token"; shareToken.value = nextToken; return; }
  const rawEventId = Array.isArray(query?.eventId) ? query.eventId[0] : query?.eventId;
  const nextEventId = typeof rawEventId === "string" ? Number.parseInt(decodeURIComponent(rawEventId), 10) : NaN;
  if (Number.isFinite(nextEventId) && nextEventId > 0) { mode.value = "event"; eventId.value = nextEventId; }
});
onShow(() => { startClock(); void loadPage(); });
onUnload(stopClock);
onShareAppMessage(() => ({
  title: `${cardData.value?.title || "这次相聚"} · 活动回忆卡`,
  path: shareSnapshot.value?.sharePath || (mode.value === "token" && shareToken.value ? `/pages_share/memory/index?token=${encodeURIComponent(shareToken.value)}` : "/pages/home/index"),
  imageUrl: posterFilePath.value || cardData.value?.coverImageUrl || undefined
}));
watch(normalizedCaption, invalidateGeneratedPoster);

async function handleLoginSuccess() { await loadPage(); }
function invalidateGeneratedPoster() { if (mode.value === "event") { shareSnapshot.value = null; posterFilePath.value = ""; } }
async function loadPage() {
  if (mode.value === "token") {
    loading.value = true; errorText.value = "";
    try { sharePreview.value = toCardView(await shareApi.getMemoryPreview(shareToken.value)); }
    catch (error) { errorText.value = error instanceof Error ? error.message : "活动回忆卡加载失败"; sharePreview.value = null; }
    finally { loading.value = false; }
    return;
  }
  if (mode.value !== "event" || !sessionStore.isLoggedIn || !eventId.value) { eventDetail.value = null; return; }
  loading.value = true; errorText.value = "";
  try { eventDetail.value = await mealApi.getDiningEvent(eventId.value); shareSnapshot.value = null; posterFilePath.value = ""; }
  catch (error) { errorText.value = error instanceof Error ? error.message : "活动回忆卡加载失败"; eventDetail.value = null; }
  finally { loading.value = false; }
}
async function createShareSnapshot() {
  if (!eventId.value || !generateReady.value || !canManageEventShare.value || submitting.value) return null;
  submitting.value = true;
  try { const result = await shareApi.createMemoryShare(eventId.value, createOperationId(), showParticipants.value, normalizedCaption.value); shareSnapshot.value = result; return result; }
  catch (error) { await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "分享图片生成失败", icon: "none" }); return null; }
  finally { submitting.value = false; }
}
async function preparePoster() {
  if (posterBusy.value) return "";
  posterBusy.value = true;
  try {
    if (mode.value === "event" && !shareSnapshot.value) { if (!await createShareSnapshot()) return ""; await nextTick(); }
    const view = exportPosterView.value;
    const miniCodeUrl = cardData.value?.miniCodeUrl;
    if (!view || !miniCodeUrl) throw new Error("分享内容还未准备好");
    const result = await uniPlatform.media.getCanvas2d("#memory-poster-canvas", instance?.proxy);
    const nativeCanvas = result.canvas;
    const canvas = nativeCanvas as unknown as PosterCanvas;
    canvas.width = 1080; canvas.height = view.height;
    const [logo, cover, miniCode] = await Promise.all([loadCanvasImage(canvas, MEMORY_POSTER_TEMPLATE.brandLogoUrl), view.coverImageUrl ? loadCanvasImage(canvas, view.coverImageUrl) : Promise.resolve(null), loadCanvasImage(canvas, miniCodeUrl)]);
    drawMemoryPoster(canvas.getContext("2d") as never, view, { logo, cover, miniCode }, await readPosterColors());
    const file = await uniPlatform.media.canvasToTempFilePath({ canvas: nativeCanvas, width: 1080, height: view.height, destWidth: 1080, destHeight: view.height, fileType: "jpg", quality: 0.94 }, instance?.proxy);
    posterFilePath.value = file.tempFilePath;
    return file.tempFilePath;
  } catch (error) { await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "分享图片生成失败", icon: "none" }); return ""; }
  finally { posterBusy.value = false; }
}
async function loadCanvasImage(canvas: PosterCanvas, src: string) {
  const info = await uniPlatform.media.getImageInfo(src);
  const image = canvas.createImage();
  await new Promise<void>((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = info.path || src; });
  return image;
}
async function readPosterColors() {
  const styles = await uniPlatform.system.readStyles(".poster-theme-probe", ["color", "backgroundColor"], instance?.proxy);
  return {
    accent: styles.color || MEMORY_POSTER_TEMPLATE.colors.accent,
    orb: styles.backgroundColor || MEMORY_POSTER_TEMPLATE.colors.orb
  };
}
async function previewPoster() { if (!canPreparePoster.value && !posterFilePath.value) return; const path = posterFilePath.value || await preparePoster(); if (path) await uniPlatform.media.previewImage({ urls: [path], current: path }); }
async function sharePoster() { if (!canPreparePoster.value) return; const path = posterFilePath.value || await preparePoster(); if (!path) return; try { await uniPlatform.media.showShareImageMenu(path); } catch (error) { await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "分享失败", icon: "none" }); } }
async function savePoster() { if (!canPreparePoster.value) return; const path = posterFilePath.value || await preparePoster(); if (!path) return; try { await uniPlatform.media.saveImageToPhotosAlbum(path); await uniPlatform.feedback.toast({ title: "已保存，可前往朋友圈发布", icon: "success" }); } catch { await uniPlatform.feedback.toast({ title: "保存失败，请检查相册权限", icon: "none" }); } }
function toggleParticipants() {
  showParticipants.value = !showParticipants.value;
  invalidateGeneratedPoster();
}
function toCardView(source: MemorySharePreviewResponse): MemoryCardView { return { title: source.title, planDate: source.planDate, mealSlot: source.mealSlot, coverImageUrl: source.coverImageUrl, menuItems: source.menuItems, participants: source.participants, caption: source.caption, sharedAt: source.sharedAt, snapshotVersion: source.snapshotVersion, miniCodeUrl: source.miniCodeUrl }; }
function buildDraftParticipants(event: DiningEventSummary, visible: boolean): MemoryShareParticipant[] {
  if (!visible) return [];
  const people: MemoryShareParticipant[] = [{ displayName: event.organizerName?.trim() || "主理人", avatarUrl: event.organizerAvatarUrl, role: "ORGANIZER" }];
  event.participants.forEach(item => { if (item.status === "ACCEPTED") people.push({ displayName: item.sourceType === "SHARE" ? item.guestName?.trim() || "来客" : item.displayName?.trim() || "参与人", avatarUrl: item.avatarUrl, role: item.sourceType === "SHARE" ? "GUEST" : "PARTICIPANT" }); });
  return people;
}
function buildDraftCard(event: DiningEventSummary, nextCaption: string | null, visible: boolean): MemoryCardView { return { title: event.title, planDate: null, mealSlot: null, coverImageUrl: event.coverImageUrl, menuItems: event.menuItems.map(item => ({ title: item.title, coverUrl: null })), participants: buildDraftParticipants(event, visible), caption: nextCaption, sharedAt: null, snapshotVersion: null, miniCodeUrl: null }; }
function isEventTimeUp(event: DiningEventSummary | null, currentMs: number) { if (!event || event.status === "CANCELLED") return false; if (event.status === "COMPLETED" || event.completedAt) return true; const scheduledMs = new Date(event.scheduledAt).getTime(); return Number.isFinite(scheduledMs) && scheduledMs <= currentMs; }
function startClock() { nowMs.value = Date.now(); if (!clockTimer) clockTimer = setInterval(() => { nowMs.value = Date.now(); }, 30_000); }
function stopClock() { if (clockTimer) clearInterval(clockTimer); clockTimer = null; }
</script>

<style scoped lang="scss">
.memory-page { height: 100%; padding-bottom: calc(120rpx + env(safe-area-inset-bottom)); box-sizing: border-box; }
.notice, .login-state { margin: var(--space-md) var(--space-page) 0; padding: var(--space-md); background: var(--material-card-bg); }
.notice { display: flex; justify-content: space-between; color: var(--color-state-warning-text); background: var(--color-state-warning-soft); }
.empty-wrap { margin: var(--space-md) var(--space-page) 0; }
.preview-head { display: flex; align-items: center; justify-content: space-between; margin: var(--space-md) var(--space-page) var(--space-sm); }
.preview-head__title, .share-tips__title { display: block; font-weight: var(--font-weight-heavy); }
.preview-head__title { font-size: 42rpx; line-height: 1.2; }
.preview-head__hint { display: block; margin-top: var(--space-xs); color: var(--color-text-secondary); font-size: var(--font-size-sm); }
.preview-head__action { width: 120rpx; min-height: 64rpx; line-height: 64rpx; margin: 0; padding: 0 20rpx; border-radius: var(--radius-pill); color: var(--button-primary-text); font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); background: var(--button-primary-bg); -webkit-backdrop-filter: var(--button-secondary-filter); backdrop-filter: var(--button-secondary-filter); }
.preview-head__action::after { border: 0; }
.poster-shell { margin: 0 var(--space-page); overflow: hidden; box-shadow: 0 18rpx 54rpx rgb(74 50 31 / 12%); }
.share-tips { margin: var(--space-md) var(--space-page) 0; color: var(--color-text-secondary); font-size: var(--font-size-sm); }
.share-tips__item { display: flex; align-items: flex-start; margin-top: var(--space-xs); line-height: 1.65; }
.share-tips__dot { width: 8rpx; height: 8rpx; flex: none; margin: 13rpx 14rpx 0 4rpx; border-radius: 50%; background: var(--color-support-action); }
.poster-theme-probe { position: fixed; top: 0; left: -12000px; width: 1px; height: 1px; color: var(--color-primary); background: var(--color-primary-soft); pointer-events: none; }
.share-actions { position: fixed; right: 0; bottom: 0; left: 0; z-index: 40; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-sm); padding: 18rpx var(--space-page) calc(18rpx + env(safe-area-inset-bottom)); background: var(--material-tabbar-bg); box-shadow: var(--material-tabbar-shadow); -webkit-backdrop-filter: var(--material-tabbar-filter); backdrop-filter: var(--material-tabbar-filter); }
.share-actions__primary, .share-actions__secondary { display: flex; width: 100%; min-height: 84rpx; align-items: center; justify-content: center; margin: 0; border-radius: var(--radius-pill); font-size: 28rpx; font-weight: var(--font-weight-semibold); box-sizing: border-box; }
.share-actions__primary::after, .share-actions__secondary::after { border: 0; }
.share-actions__primary { color: var(--button-primary-text); background: var(--button-primary-bg); box-shadow: var(--button-primary-shadow); -webkit-backdrop-filter: var(--button-primary-filter); backdrop-filter: var(--button-primary-filter); }
.share-actions__secondary { color: var(--button-secondary-text); background: var(--button-secondary-bg); -webkit-backdrop-filter: var(--button-secondary-filter); backdrop-filter: var(--button-secondary-filter); }
.share-actions__primary--disabled, .share-actions__secondary--disabled { opacity: .48; }
.poster-canvas { position: fixed; top: 0; left: -12000px; pointer-events: none; }
</style>
