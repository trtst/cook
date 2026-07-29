<template>
  <page-meta :page-style="pageStyle" />
  <Layout
    title=""
    full-screen
    :show-left="false"
    navbar-layout="custom-left"
    :navbar-transparent="true"
    :navbar-opacity="navOpacity"
    :navbar-placeholder="false"
  >
    <template #navbar-left>
      <view class="detail-nav">
        <view class="cookfont icon-back detail-nav__back" hover-class="detail-nav__back--hover" hover-stay-time="100" @click="goBack" />
        <view v-if="showAnchorTabs" class="detail-nav-tabs">
          <view
            v-for="item in anchorTabs"
            :key="item.value"
            class="detail-nav-tabs__item"
            :class="{ 'detail-nav-tabs__item--active': activeAnchor === item.value }"
            @click="scrollToSection(item.value)"
          >
            {{ item.label }}
          </view>
        </view>
      </view>
    </template>

    <view class="detail-nav-backdrop" :style="navBackdropStyle" />

    <view v-if="loading" class="notice notice--floating">加载中...</view>
    <view v-else-if="errorText" class="notice notice--floating" @click="loadDetail">{{ errorText }}</view>
    <Empty
      v-else-if="!detail"
      :title="mode === 'preview' ? '预览已失效' : '未找到菜谱'"
      :description="mode === 'preview' ? '请返回编辑页重新打开预览。' : '可能已被删除、下架，或当前访问路径不正确。'"
    />

    <template v-else>
      <view class="detail-page">
        <view class="hero" :style="heroStyle">
          <view class="hero__cover">
            <image v-if="coverImageUrl" class="hero__image" :src="coverImageUrl" mode="aspectFill" />
            <view v-else class="hero__cover-fill">
              <view class="hero__cover-copy">
                <text class="hero__cover-title">菜谱封面图</text>
                <text class="hero__cover-sub">4:3 封面图位置，当前版本先保留展示位。</text>
              </view>
            </view>
          </view>
        </view>

        <view class="content">
          <view class="summary-card">
            <text id="detail-title" class="summary-card__title">{{ detailTitle }}</text>
            <text class="summary-card__story" :class="{ 'summary-card__story--placeholder': !detailContent.story }">
              {{ detailContent.story || "暂未填写菜谱描述" }}
            </text>

            <view v-if="detailCategoryName || detailSceneLabels.length" class="summary-card__facts">
              <view v-if="detailCategoryName" class="summary-card__fact">
                <text class="summary-card__fact-label">分类:</text>
                <text class="summary-card__fact-value">{{ detailCategoryName }}</text>
              </view>
              <view v-if="detailSceneLabels.length" class="summary-card__fact summary-card__fact--scenes">
                <text class="summary-card__fact-label">场景:</text>
                <view class="summary-card__scene-list">
                  <text v-for="item in detailSceneLabels" :key="item" class="summary-card__scene">{{ item }}</text>
                </view>
              </view>
            </view>

            <view v-if="summaryMetaList.length" class="summary-card__meta">
              <text v-for="item in summaryMetaList" :key="item" class="summary-card__meta-item">{{ item }}</text>
            </view>

            <view class="summary-info">
              <view v-for="item in infoItems" :key="item.key" class="summary-info__item">
                <view class="summary-info__icon" :class="[`summary-info__icon--${item.key}`, item.iconClass]" />
                <text class="summary-info__label" :class="{ 'summary-info__label--muted': item.muted }">{{ item.label }}</text>
              </view>
            </view>
          </view>

          <view id="detail-ingredients" class="section section--first">
            <view class="section__head">
              <text class="section__label">食材清单</text>
              <text class="section__caption">{{ ingredientCountText }}</text>
            </view>
            <view v-if="detailContent.ingredients.length" class="ingredient-list">
              <view
                v-for="item in detailContent.ingredients"
                :key="`${item.ingredientId}-${item.ingredientName}`"
                class="ingredient-row"
              >
                <text class="ingredient-row__name">{{ item.ingredientName }}</text>
                <text class="ingredient-row__amount">{{ formatAmount(item.amount) }}</text>
              </view>
            </view>
            <text v-else class="section__empty">暂未添加食材</text>
          </view>

          <view id="detail-steps" class="section">
            <view class="section__head">
              <text class="section__label">步骤</text>
              <text class="section__caption">{{ stepCountText }}</text>
            </view>
            <view v-if="detailContent.steps.length" class="step-list">
              <view v-for="(item, index) in detailContent.steps" :key="index" class="step-card">
                <text class="step-card__index">{{ `${index + 1}/${detailContent.steps.length}` }}</text>
                <view class="step-card__cover" />
                <text class="step-card__text">{{ item.text || "暂未填写步骤描述" }}</text>
              </view>
            </view>
            <text v-else class="section__empty">暂未填写步骤</text>
          </view>

          <view v-if="detailContent.tips" class="section">
            <view class="section__head">
              <text class="section__label">小贴士</text>
            </view>
            <text class="tips-text">{{ detailContent.tips }}</text>
          </view>

          <view v-if="mode === 'published' && kind === 'inspiration' && showCollectPanel" class="section">
            <text class="section__label">收藏到合集</text>
            <text class="section__note">收藏会固定保存当前灵感版本快照。可一次加入 1 个或多个合集，已存在的归属会自动跳过。</text>

            <template v-if="!sessionStore.isLoggedIn">
              <button class="primary" @click="openLogin">打开登录</button>
            </template>

            <template v-else>
              <view v-if="sceneLoading" class="panel-note">合集中...</view>
              <view v-else-if="sceneError" class="panel-note" @click="loadScenes">{{ sceneError }}</view>
              <template v-else>
                <view v-if="scenes.length" class="chip-row">
                  <view
                    v-for="item in scenes"
                    :key="item.id"
                    class="chip"
                    :class="{ 'chip--active': selectedSceneIds.includes(item.id) }"
                    @click="toggleScene(item.id)"
                  >
                    {{ item.name }}
                  </view>
                </view>
                <text v-else class="section__empty">你还没有合集，先创建一个再继续。</text>

                <view class="create-row">
                  <input
                    v-model="sceneName"
                    class="create-row__input"
                    maxlength="20"
                    placeholder="新建合集名称"
                    :disabled="sceneSubmitting"
                  />
                  <button class="light create-row__button" :disabled="sceneSubmitting || !sceneName.trim()" @click="createScene">
                    {{ sceneSubmitting ? "创建中" : "新建合集" }}
                  </button>
                </view>

                <button class="secondary" :disabled="collecting || !selectedSceneIds.length" @click="collectRecipe">
                  {{ collecting ? "处理中..." : "确认收藏" }}
                </button>
              </template>
            </template>
          </view>

          <view v-if="mode === 'published' && kind === 'inspiration' && sessionStore.isLoggedIn" class="section">
            <text class="section__label">举报说明</text>
            <textarea
              v-model="reportReason"
              class="report-box"
              maxlength="255"
              placeholder="仅在违规、侵权或明显不当时提交举报"
            />
            <button class="danger" :disabled="submitting || !reportReason.trim()" @click="handleReport">提交举报</button>
          </view>
        </view>
      </view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { onHide, onLoad, onPageScroll, onUnload } from "@dcloudio/uni-app";
import {
  recipeApi,
  type CollectedRecipeDetail,
  type InspirationRecipeDetail,
  type MyRecipeDetail,
  type RecipeAmountSnapshot,
  type RecipeContentSnapshot,
  type RecipeDifficulty,
  type RecipeDuration,
  type RecipeSceneSummary
} from "@/apis/recipe";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useLoginModalStore } from "@/stores/login-modal";
import { useRecipePreviewStore, type RecipePreviewAmount, type RecipePreviewDetail } from "@/stores/recipe-preview";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";

type DetailKind = "my" | "inspiration" | "collection";
type DetailMode = "published" | "preview";
type AnchorKey = "ingredients" | "steps";
type PublishedDetail = MyRecipeDetail | InspirationRecipeDetail | CollectedRecipeDetail;
type DetailContent = RecipeContentSnapshot | RecipePreviewDetail["content"];

interface InfoItem {
  key: "time" | "difficulty" | "ingredients";
  label: string;
  iconClass?: string;
  muted?: boolean;
}

const pageStyle = usePageScrollStyle();

const anchorTabs = [
  { value: "ingredients" as const, label: "食材" },
  { value: "steps" as const, label: "步骤" }
];

const sessionStore = useSessionStore();
const loginModalStore = useLoginModalStore();
const recipePreviewStore = useRecipePreviewStore();
const { navBarTotalHeight } = useSystemInfo();
const NAV_FADE_RANGE = 132;
const recipeId = ref("");
const kind = ref<DetailKind>("my");
const mode = ref<DetailMode>("published");
const detail = ref<PublishedDetail | RecipePreviewDetail | null>(null);
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const reportReason = ref("");
const showCollectPanel = ref(false);
const sceneLoading = ref(false);
const sceneSubmitting = ref(false);
const collecting = ref(false);
const sceneError = ref("");
const sceneName = ref("");
const scenes = ref<RecipeSceneSummary[]>([]);
const selectedSceneIds = ref<string[]>([]);
const navOpacity = ref(0);
const scrollTop = ref(0);
const titleThreshold = ref(Number.POSITIVE_INFINITY);
const ingredientTop = ref(0);
const stepTop = ref(Number.POSITIVE_INFINITY);

let measureTimer: ReturnType<typeof setTimeout> | null = null;

const previewDetail = computed(() => {
  if (mode.value !== "preview" || !detail.value) return null;
  return detail.value as RecipePreviewDetail;
});

const publishedDetail = computed(() => {
  if (mode.value !== "published" || !detail.value) return null;
  return detail.value as PublishedDetail;
});

const inspirationDetail = computed(() => {
  if (mode.value !== "published" || kind.value !== "inspiration" || !detail.value) return null;
  return detail.value as InspirationRecipeDetail;
});

const detailTitle = computed(() => detail.value?.title || "");
const coverImageUrl = computed(() => publishedDetail.value?.coverImageUrl || "");
const navTopOffset = computed(() => `${navBarTotalHeight.value}px`);
const heroStyle = computed(() => ({
  "--hero-header-offset": navTopOffset.value
}));
const navBackdropStyle = computed(() => ({
  height: navTopOffset.value,
  opacity: navOpacity.value
}));

const detailContent = computed<DetailContent>(() => {
  if (!detail.value) {
    return {
      story: null,
      baseServings: null,
      difficulty: null,
      duration: null,
      tips: null,
      ingredients: [],
      steps: []
    };
  }
  return detail.value.content;
});

const detailCategoryName = computed(() => {
  if (!detail.value) return "";
  if (previewDetail.value) {
    return previewDetail.value.categoryName || "";
  }
  return publishedDetail.value?.category.name || "";
});

const detailSceneNames = computed(() => {
  if (!detail.value) return [];
  if (previewDetail.value) {
    return previewDetail.value.sceneNames.filter(Boolean);
  }
  if (!publishedDetail.value || kind.value === "inspiration") {
    return [];
  }
  if (kind.value === "my") {
    return (publishedDetail.value as MyRecipeDetail).scenes.map((item) => item.name).filter(Boolean);
  }
  return (publishedDetail.value as CollectedRecipeDetail).scenes.map((item) => item.name).filter(Boolean);
});

const detailSceneLabels = computed(() => detailSceneNames.value.map(item => limitSceneName(item)).filter(Boolean));

function formatDuration(value: RecipeDuration | null) {
  if (value === "WITHIN_15") return "15分钟内";
  if (value === "BETWEEN_15_30") return "15~30分钟";
  if (value === "BETWEEN_30_60") return "30~60分钟";
  if (value === "OVER_60") return "1小时以上";
  return "";
}

const difficultyText = computed(() => {
  const difficulty = detailContent.value.difficulty;
  const labelMap: Record<RecipeDifficulty, string> = {
    BEGINNER: "新手友好",
    EASY: "轻松上手",
    SKILLED: "需要经验",
    CHALLENGING: "进阶挑战"
  };
  return difficulty ? labelMap[difficulty] : "";
});

const metaLine = computed(() => {
  if (!detail.value) return "";
  if (previewDetail.value) {
    return "";
  }
  if (!publishedDetail.value) {
    return "";
  }
  if (kind.value === "my") {
    return `我的菜谱 · 更新于 ${publishedDetail.value.updatedAt.slice(0, 10)}`;
  }
  if (kind.value === "collection") {
    const collectionDetail = publishedDetail.value as CollectedRecipeDetail;
    return `合集快照 · 收藏于 ${collectionDetail.collectedAt.slice(0, 10)}`;
  }
  return `灵感菜谱 · 更新于 ${inspirationDetail.value?.updatedAt.slice(0, 10) || ""}`;
});

const sourceLine = computed(() => {
  if (!inspirationDetail.value?.curatedByName) return "";
  return `由${inspirationDetail.value.curatedByName}整理`;
});

const summaryMetaList = computed(() => [sourceLine.value, metaLine.value].filter(Boolean));

const ingredientCountText = computed(() => `${detailContent.value.ingredients.length}项食材`);
const stepCountText = computed(() => `${detailContent.value.steps.length}个步骤`);
const durationText = computed(() => formatDuration(detailContent.value.duration));

const infoItems = computed<InfoItem[]>(() => [
  {
    key: "time",
    label: durationText.value || "未设时长",
    iconClass: "cookfont icon-time",
    muted: !durationText.value
  },
  {
    key: "difficulty",
    label: difficultyText.value || "未设难度",
    iconClass: "cookfont icon-difficulty",
    muted: !difficultyText.value
  },
  {
    key: "ingredients",
    label: ingredientCountText.value,
    iconClass: "cookfont icon-dining-event"
  }
]);

const showAnchorTabs = computed(() => scrollTop.value >= titleThreshold.value);

const activeAnchor = computed<AnchorKey>(() => {
  const currentLine = scrollTop.value + navBarTotalHeight.value + 36;
  if (currentLine >= stepTop.value) return "steps";
  return "ingredients";
});

onLoad((query) => {
  const rawId = Array.isArray(query?.recipeId) ? query.recipeId[0] : query?.recipeId;
  const rawKind = Array.isArray(query?.kind) ? query.kind[0] : query?.kind;
  const rawMode = Array.isArray(query?.mode) ? query.mode[0] : query?.mode;
  recipeId.value = typeof rawId === "string" ? decodeURIComponent(rawId) : "";
  kind.value = rawKind === "inspiration" || rawKind === "collection" ? rawKind : "my";
  mode.value = rawMode === "preview" ? "preview" : "published";

  if (mode.value === "preview") {
    detail.value = recipePreviewStore.detail ? { ...recipePreviewStore.detail } : null;
    scheduleMeasure();
    return;
  }

  if (recipeId.value) {
    void loadDetail();
  }
});

onPageScroll((event) => {
  scrollTop.value = event.scrollTop;
  navOpacity.value = Math.max(0, Math.min(1, event.scrollTop / NAV_FADE_RANGE));
});

onHide(() => {
  if (mode.value === "preview") {
    recipePreviewStore.clearPreview();
  }
});

onUnload(() => {
  clearMeasureTimer();
  if (mode.value === "preview") {
    recipePreviewStore.clearPreview();
  }
});

async function loadDetail() {
  if (!recipeId.value || loading.value || mode.value !== "published") return;
  loading.value = true;
  errorText.value = "";
  try {
    detail.value =
      kind.value === "inspiration"
        ? await recipeApi.getInspirationRecipe(recipeId.value)
        : kind.value === "collection"
          ? await recipeApi.getCollectionRecipe(recipeId.value)
          : await recipeApi.getMyRecipe(recipeId.value);
    scheduleMeasure();
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "菜谱加载失败";
  } finally {
    loading.value = false;
  }
}

function scheduleMeasure() {
  clearMeasureTimer();
  measureTimer = setTimeout(() => {
    void updateAnchorMetrics();
  }, 80);
}

function clearMeasureTimer() {
  if (!measureTimer) return;
  clearTimeout(measureTimer);
  measureTimer = null;
}

async function updateAnchorMetrics() {
  await nextTick();
  const [titleRect, ingredientRect, stepRect] = await Promise.all([
    uniPlatform.system.measure("#detail-title"),
    uniPlatform.system.measure("#detail-ingredients"),
    uniPlatform.system.measure("#detail-steps")
  ]);

  if (titleRect) {
    titleThreshold.value = Math.max(0, titleRect.bottom - navBarTotalHeight.value - 16);
  }
  if (ingredientRect) {
    ingredientTop.value = Math.max(0, ingredientRect.top - 20);
  }
  if (stepRect) {
    stepTop.value = Math.max(0, stepRect.top - 20);
  }
}

function goBack() {
  void uniPlatform.navigation.navigateBack();
}

function editRecipe() {
  if (!recipeId.value) return;
  void uniPlatform.navigation.navigateTo(`/pages_recipe/edit/index?recipeId=${encodeURIComponent(recipeId.value)}`);
}

function backToEdit() {
  void uniPlatform.navigation.navigateBack();
}

async function copyRecipeName() {
  if (!detailTitle.value) return;
  await uniPlatform.clipboard.set(detailTitle.value);
  await uniPlatform.feedback.toast({ title: "已复制", icon: "success" });
}

function scrollToSection(section: AnchorKey) {
  const top = section === "steps" ? stepTop.value : ingredientTop.value;
  void uniPlatform.navigation.pageScrollTo({
    scrollTop: Math.max(0, top - navBarTotalHeight.value - 18),
    duration: 260
  });
}

function toggleCollectPanel() {
  if (!sessionStore.isLoggedIn) {
    openLogin();
    return;
  }
  showCollectPanel.value = !showCollectPanel.value;
  if (showCollectPanel.value) {
    void loadScenes();
  }
}

function openLogin() {
  loginModalStore.open(null, () => {
    showCollectPanel.value = true;
    void loadScenes();
  });
}

async function loadScenes() {
  if (!sessionStore.isLoggedIn || sceneLoading.value) return;
  sceneLoading.value = true;
  sceneError.value = "";
  try {
    scenes.value = await recipeApi.listScenes();
    selectedSceneIds.value = selectedSceneIds.value.filter(sceneId => scenes.value.some(item => item.id === sceneId));
    if (!selectedSceneIds.value.length && scenes.value.length) {
      selectedSceneIds.value = [scenes.value[0].id];
    }
  } catch (error) {
    sceneError.value = error instanceof Error ? error.message : "合集加载失败";
  } finally {
    sceneLoading.value = false;
  }
}

async function createScene() {
  const name = sceneName.value.trim();
  if (!name || sceneSubmitting.value) return;
  sceneSubmitting.value = true;
  try {
    const scene = await recipeApi.createScene({
      operationId: createOperationId(),
      name
    });
    scenes.value = [...scenes.value, scene];
    selectedSceneIds.value = [...selectedSceneIds.value, scene.id];
    sceneName.value = "";
    await uniPlatform.feedback.toast({ title: "合集已创建", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "创建失败", icon: "none" });
  } finally {
    sceneSubmitting.value = false;
  }
}

async function collectRecipe() {
  if (!inspirationDetail.value || !selectedSceneIds.value.length || collecting.value) return;
  collecting.value = true;
  try {
    await recipeApi.collectRecipe({
      operationId: createOperationId(),
      sourceRecipeId: inspirationDetail.value.id,
      sourceVersionId: inspirationDetail.value.contentVersionId,
      sceneIds: selectedSceneIds.value
    });
    showCollectPanel.value = false;
    await uniPlatform.feedback.toast({ title: "已收藏到合集", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "收藏失败", icon: "none" });
  } finally {
    collecting.value = false;
  }
}

function toggleScene(sceneId: string) {
  if (selectedSceneIds.value.includes(sceneId)) {
    selectedSceneIds.value = selectedSceneIds.value.filter(item => item !== sceneId);
    return;
  }
  selectedSceneIds.value = [...selectedSceneIds.value, sceneId];
}

async function handleReport() {
  if (!recipeId.value || mode.value !== "published" || submitting.value || !reportReason.value.trim()) return;
  submitting.value = true;
  try {
    await recipeApi.reportRecipe(recipeId.value, createOperationId(), reportReason.value.trim());
    reportReason.value = "";
    await uniPlatform.feedback.toast({ title: "举报已提交", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "举报失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

function formatAmount(amount: RecipeAmountSnapshot | RecipePreviewAmount) {
  if (amount.kind === "FUZZY") {
    return amount.text || "未填用量";
  }
  const quantity = amount.quantity || "";
  const unitName = amount.unitName || "";
  return `${quantity}${unitName}`.trim() || "未填用量";
}

function limitSceneName(value: string) {
  const name = value.trim();
  if (!name) return "";
  return name.slice(0, 6);
}
</script>

<style scoped lang="scss">
.notice {
  padding: var(--space-md);
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18rpx 42rpx rgba(86, 63, 40, 0.06);
}

.notice--floating {
  margin: calc(v-bind(navTopOffset) + var(--space-page)) var(--space-page) 0;
}

.detail-nav-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9;
  background: rgba(255, 250, 244, 0.94);
  pointer-events: none;
}

.detail-nav {
  display: flex;
  align-items: center;
  min-width: 0;
}

.detail-nav__back {
  display: flex;
  align-items: center;
  width: 64rpx;
  height: 64rpx;
  color: var(--color-text);
  line-height: 1;
}

.detail-nav__back--hover {
  opacity: 0.68;
}

.detail-nav-tabs {
  display: flex;
  gap: 40rpx;
  align-items: flex-end;
  min-width: 0;
  margin-left: 22rpx;
  padding-top: 6rpx;
}

.detail-nav-tabs__item {
  position: relative;
  z-index: 0;
  flex: 0 0 auto;
  padding: 8rpx 0 12rpx;
  color: var(--color-text-secondary);
  font-size: 32rpx;
  font-weight: var(--font-weight-bold);
  line-height: 1;
  white-space: nowrap;
}

.detail-nav-tabs__item--active {
  color: var(--color-text);
}

.detail-nav-tabs__item--active::after {
  content: "";
  position: absolute;
  right: -6rpx;
  bottom: 2rpx;
  left: -6rpx;
  z-index: -1;
  height: 16rpx;
  border-radius: 999rpx;
  background: var(--theme-primary);
  opacity: 0.3;
  transform: rotate(-5deg);
}

.detail-page {
  --detail-step-index-color: var(--color-text-tertiary);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, var(--entry-side-aqua-bg) 0%, transparent 34%),
    linear-gradient(180deg, var(--entry-board-bg) 0%, var(--color-page) 260rpx);
}

.hero {
  padding: 0;
}

.hero__cover {
  position: relative;
  overflow: hidden;
  min-height: 0;
  padding-top: 75%;
  border-radius: 0;
  background: var(--entry-photo-bg);
  box-shadow: none;
}

.hero__image {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  background: var(--entry-photo-bg);
}

.hero__cover-fill {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36rpx;
  background:
    linear-gradient(140deg, var(--entry-side-mint-bg) 0%, var(--entry-board-bg) 48%, var(--entry-photo-bg) 100%),
    linear-gradient(180deg, var(--color-surface-mask-weak) 0%, var(--color-surface-mask-medium) 100%);
}

.hero__cover-copy {
  position: absolute;
  right: 36rpx;
  left: 36rpx;
  top: var(--hero-header-offset);
  bottom: 84rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.hero__cover-title,
.hero__cover-sub {
  display: block;
}

.hero__cover-title {
  color: var(--entry-ink);
  font-size: 34rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.2;
}

.hero__cover-sub {
  color: var(--entry-side-muted-text);
  font-size: 24rpx;
  line-height: 1.6;
}

.content {
  position: relative;
  flex: 1 1 auto;
  z-index: 1;
  margin-top: -54rpx;
  min-height: 0;
  padding: 32rpx 0 max(48rpx, env(safe-area-inset-bottom));
  background: var(--entry-board-bg);
  border-radius: 36rpx 36rpx 0 0;
}

.summary-card {
  padding: 0 32rpx 24rpx;
}

.summary-card__title,
.summary-card__story,
.summary-card__meta-item {
  display: block;
}

.summary-card__title {
  color: var(--color-text);
  font-size: 50rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.3;
}

.summary-card__story {
  margin-top: 18rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  line-height: 1.8;
}

.summary-card__story--placeholder {
  color: rgba(111, 98, 86, 0.66);
}

.summary-card__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx 32rpx;
  margin-top: 24rpx;
}

.summary-card__fact,
.summary-card__scene-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx 14rpx;
  align-items: center;
}

.summary-card__fact {
  min-width: 0;
}

.summary-card__fact--scenes {
  flex: 1;
}

.summary-card__fact-label,
.summary-card__fact-value,
.summary-card__scene {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.summary-card__fact-label {
  color: var(--color-text-tertiary);
}

.summary-card__fact-value,
.summary-card__scene {
  color: var(--color-text-secondary);
}

.summary-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx 20rpx;
  margin-top: 18rpx;
}

.summary-card__meta-item {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.summary-info {
  display: flex;
  gap: 12rpx;
  margin: 30rpx 0;
  padding-bottom: 20rpx;
}

.summary-info__item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  min-width: 0;
  padding: 10rpx 16rpx;
}

.summary-info__icon {
  position: relative;
  width: 42rpx;
  height: 42rpx;
  color: var(--color-text);
}

.summary-info__icon.cookfont {
  display: flex;
  align-items: center;
  justify-content: center;
  width: auto;
  height: auto;
  font-size: 40rpx;
  color: rgba(69, 61, 54, 0.88);
}

.summary-info__label {
  color: var(--color-text);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
  text-align: center;
}

.summary-info__label--muted {
  color: var(--color-text-secondary);
}

.section {
  margin-top: var(--space-md);
  padding: 0 32rpx;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.section--first {
  margin-top: 8rpx;
}

.section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 24rpx;
}

.section__label {
  color: var(--color-text);
  font-size: 34rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
}

.section__caption {
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  line-height: 1.2;
}

.section__note,
.section__empty,
.tips-text {
  display: block;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.8;
}

.ingredient-list {
  overflow: hidden;
}

.ingredient-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 22rpx 24rpx;
}

.ingredient-row + .ingredient-row {
  border-top: 1rpx solid rgba(111, 98, 86, 0.08);
}

.ingredient-row__name,
.ingredient-row__amount {
  color: var(--color-text);
  font-size: 28rpx;
  line-height: 1.5;
}

.ingredient-row__amount {
  color: var(--color-text-secondary);
  text-align: right;
}

.step-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.step-card {
  padding: 6rpx 0 0;
}

.step-card__index,
.step-card__text {
  display: block;
}

.step-card__index {
  color: var(--detail-step-index-color);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
}

.step-card__cover {
  margin-top: 16rpx;
  height: 320rpx;
  border-radius: 20rpx;
  background:
    linear-gradient(160deg, rgba(255, 247, 240, 0.98) 0%, rgba(244, 228, 212, 0.98) 100%);
}

.step-card__text {
  margin-top: 16rpx;
  color: var(--color-text);
  font-size: 28rpx;
  line-height: 1.8;
}

.create-row,
.chip-row {
  display: flex;
  gap: var(--space-sm);
}

.chip-row {
  flex-wrap: wrap;
  margin-top: var(--space-sm);
}

.chip {
  padding: 14rpx 24rpx;
  border-radius: 999rpx;
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.chip--active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.panel-note {
  padding: 20rpx 24rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.create-row {
  margin-top: var(--space-md);
  align-items: center;
}

.create-row__input {
  flex: 1;
  min-width: 0;
  padding: 20rpx 24rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.create-row__button {
  flex: 0 0 auto;
}

.report-box {
  width: 100%;
  min-height: 180rpx;
  margin-top: var(--space-sm);
  padding: 20rpx 24rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  box-sizing: border-box;
}

.primary,
.secondary,
.light,
.danger {
  border-radius: var(--radius-md);
}

.primary {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.light {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1rpx solid var(--color-border);
}

.danger {
  margin-top: var(--space-md);
  background: var(--color-danger);
  color: #ffffff;
}
</style>
