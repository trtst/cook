<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="活动回忆卡">
    <template>
      <view v-if="errorText" class="notice" @click="loadPage">
        <text>{{ errorText }}</text><text>重新加载</text>
      </view>
      <view v-else-if="loading && !cardData" class="notice"><text>活动回忆卡加载中...</text></view>
      <view v-else-if="!cardData" class="empty-wrap">
        <Empty title="还没有可展示的活动回忆卡" description="从已到开饭时间的饭局进入，即可预览并分享这次相聚。" />
      </view>
      <template v-else-if="posterView">
        <view class="preview-head">
          <view><text class="preview-head__title">实时预览</text><text class="preview-head__hint">这里看到的内容会按同一模板生成分享图片</text></view>
          <button v-if="canPreparePoster || posterFilePath" class="preview-head__action" @click="previewPoster">查看大图</button>
        </view>
        <view class="poster-shell"><MemoryPoster :view="posterView" :mini-code-url="cardData.miniCodeUrl" /></view>
        <LoginEmptyState v-if="mode === 'event' && !sessionStore.isLoggedIn" class="action-panel" title="登录后分享活动回忆" description="登录后可设置公开内容，并生成带小程序码的分享图片。" @success="handleLoginSuccess" />
        <view v-else-if="mode === 'event' && canManageEventShare" class="action-panel">
          <text class="action-panel__title">分享设置</text>
          <view class="setting-row">
            <view><text class="setting-row__title">展示参与成员</text><text class="setting-row__desc">只公开已确认成员的昵称和角色</text></view>
            <switch :checked="showParticipants" color="var(--color-support-action)" @change="handleParticipantsChange" />
          </view>
          <view class="field-block">
            <view class="field-block__head"><text>留一句话</text><text class="field-block__count">{{ caption.length }}/120</text></view>
            <textarea v-model="caption" class="textarea" maxlength="120" placeholder="例如：今天这一顿，终于把大家都约齐了。（可选）" />
          </view>
          <text class="action-panel__hint">{{ generateHintText }}</text>
        </view>
        <view v-else-if="mode === 'event'" class="public-hint"><text class="public-hint__title">仅主理人可生成回忆卡</text><text class="public-hint__text">你可以查看当前预览；分享图片需要由饭局主理人生成。</text></view>
        <view v-else class="public-hint"><text class="public-hint__title">这是一张公开回忆卡</text><text class="public-hint__text">图片中的内容已固定，不会随原饭局后续修改而变化。</text></view>
        <view class="share-actions">
          <button class="share-actions__primary" :class="{ 'share-actions__primary--disabled': !canPreparePoster }" @click="sharePoster">{{ posterBusy ? "正在生成..." : "分享给朋友" }}</button>
          <button class="share-actions__secondary" :class="{ 'share-actions__secondary--disabled': !canPreparePoster }" @click="savePoster">保存图片发朋友圈</button>
          <button v-if="mode === 'event'" class="share-actions__text" @click="openPlan">回到当前餐次</button>
        </view>
        <canvas id="memory-poster-canvas" canvas-id="memory-poster-canvas" type="2d" class="poster-canvas" :width="1080" :height="posterView.height" :style="posterCanvasStyle" />
      </template>
    </template>
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
const posterView = computed(() => cardData.value ? buildMemoryPosterView({ ...cardData.value, metaText: metaText.value }) : null);
const generateReady = computed(() => isEventTimeUp(eventDetail.value, nowMs.value));
const canManageEventShare = computed(() => Boolean(eventDetail.value && eventDetail.value.organizerUid === sessionStore.uid));
const generateHintText = computed(() => {
  if (eventDetail.value?.status === "CANCELLED") return "已取消的饭局不能生成分享图片。";
  if (!canManageEventShare.value) return "只有饭局主理人可以生成这次活动回忆。";
  if (shareSnapshot.value) return "当前图片内容已生成；修改设置后会重新生成一个分享版本。";
  return generateReady.value ? "点击分享或保存时，会固定当前内容并生成可识别的小程序码。" : "到开饭时间后，主理人即可分享这次活动回忆。";
});
const canPreparePoster = computed(() => !posterBusy.value && !submitting.value && Boolean(posterView.value) && (mode.value === "token" ? Boolean(cardData.value?.miniCodeUrl) : Boolean(eventId.value && generateReady.value && canManageEventShare.value)));
const posterCanvasStyle = computed(() => ({ width: "1080px", height: `${posterView.value?.height ?? 1030}px` }));

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
    const view = posterView.value;
    const miniCodeUrl = cardData.value?.miniCodeUrl;
    if (!view || !miniCodeUrl) throw new Error("分享内容还未准备好");
    const result = await uniPlatform.media.getCanvas2d("#memory-poster-canvas", instance?.proxy);
    const nativeCanvas = result.canvas;
    const canvas = nativeCanvas as unknown as PosterCanvas;
    canvas.width = 1080; canvas.height = view.height;
    const [logo, cover, miniCode] = await Promise.all([loadCanvasImage(canvas, MEMORY_POSTER_TEMPLATE.brandLogoUrl), view.coverImageUrl ? loadCanvasImage(canvas, view.coverImageUrl) : Promise.resolve(null), loadCanvasImage(canvas, miniCodeUrl)]);
    drawMemoryPoster(canvas.getContext("2d") as never, view, { logo, cover, miniCode });
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
async function previewPoster() { if (!canPreparePoster.value && !posterFilePath.value) return; const path = posterFilePath.value || await preparePoster(); if (path) await uniPlatform.media.previewImage({ urls: [path], current: path }); }
async function sharePoster() { if (!canPreparePoster.value) return; const path = posterFilePath.value || await preparePoster(); if (!path) return; try { await uniPlatform.media.showShareImageMenu(path); } catch (error) { await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "分享失败", icon: "none" }); } }
async function savePoster() { if (!canPreparePoster.value) return; const path = posterFilePath.value || await preparePoster(); if (!path) return; try { await uniPlatform.media.saveImageToPhotosAlbum(path); await uniPlatform.feedback.toast({ title: "已保存，可前往朋友圈发布", icon: "success" }); } catch { await uniPlatform.feedback.toast({ title: "保存失败，请检查相册权限", icon: "none" }); } }
function handleParticipantsChange(event: Event) {
  const rawValue = (event as Event & { detail?: { value?: boolean | string } }).detail?.value;
  showParticipants.value = rawValue === true || rawValue === "true";
  invalidateGeneratedPoster();
}
function openPlan() { void uniPlatform.navigation.navigateTo("/pages_meal/plan/index"); }
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
.notice,.action-panel,.public-hint{margin:var(--space-md) var(--space-page) 0;padding:var(--space-md);background:var(--material-card-bg)}
.notice{display:flex;justify-content:space-between;color:var(--color-state-warning-text);background:var(--color-state-warning-soft)}
.empty-wrap{margin:var(--space-md) var(--space-page) 0}.preview-head{display:flex;justify-content:space-between;align-items:center;margin:var(--space-md) var(--space-page) var(--space-sm)}
.preview-head__title,.action-panel__title,.setting-row__title,.public-hint__title{display:block;font-weight:var(--font-weight-heavy)}.preview-head__hint,.setting-row__desc,.field-block__count,.action-panel__hint,.public-hint__text{display:block;margin-top:var(--space-xs);color:var(--color-text-secondary);font-size:var(--font-size-sm)}
.preview-head__action,.share-actions__text{width:auto;margin:0;padding:0;color:var(--color-support-action);font-size:var(--font-size-sm);background:transparent}.poster-shell{margin:0 var(--space-page);overflow:hidden;box-shadow:0 18rpx 54rpx rgb(74 50 31 / 12%)}
.setting-row{display:flex;align-items:center;justify-content:space-between;margin-top:var(--space-md);padding-bottom:var(--space-md);border-bottom:1rpx solid var(--color-border-subtle)}.field-block{margin-top:var(--space-md)}.field-block__head{display:flex;justify-content:space-between}.textarea{box-sizing:border-box;width:100%;min-height:164rpx;margin-top:var(--space-sm);padding:var(--space-sm);color:var(--color-text);background:var(--color-surface-muted)}.action-panel__hint{line-height:1.6}
.share-actions{display:grid;gap:var(--space-sm);margin:var(--space-md) var(--space-page) calc(var(--space-xl) + env(safe-area-inset-bottom))}.share-actions__primary,.share-actions__secondary{width:100%;margin:0}.share-actions__primary{color:var(--button-primary-text);background:var(--button-primary-bg)}.share-actions__secondary{color:var(--button-secondary-text);background:var(--button-secondary-bg)}.share-actions__primary--disabled,.share-actions__secondary--disabled{opacity:.48}.share-actions__text{justify-self:center;padding:var(--space-xs) var(--space-sm)}.poster-canvas{position:fixed;top:0;left:-12000px;pointer-events:none}
</style>
