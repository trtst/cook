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
            class="detail-nav-tabs__item font-medium"
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

        <view class="content" :class="{ 'content--with-actions': showStickyActions }">
	          <view class="summary-card">
	            <text id="detail-title" class="summary-card__title">{{ detailTitle }}</text>
	            <text v-if="detailStory" class="summary-card__story">{{ detailStory }}</text>
            <view v-if="detailFactText || showReportEntry" class="summary-card__facts">
              <view class="summary-card__fact-row">
                <view v-if="detailFactText" class="summary-card__fact-block">
                  <text class="summary-card__fact-title">分类/场景</text>
                  <text class="summary-card__fact-text">{{ detailFactText }}</text>
                </view>
                <text
                  v-if="showReportEntry"
                  class="summary-card__report-entry"
                  hover-class="summary-card__report-entry--hover"
                  hover-stay-time="100"
                  @click="openReportSheet"
                >
                  举报
                </text>
              </view>
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
              <view class="section__head-main">
                <text class="section__label">食材清单</text>
                <text class="section__caption">{{ ingredientCountText }}</text>
              </view>
              <button
                v-if="showShoppingEntry"
                class="section__action"
                :disabled="shoppingSubmitting"
                @click="addToShoppingList"
              >
                <text class="cookfont icon-add-list section__action-icon" />
                <text>{{ shoppingSubmitting ? "添加中..." : "添加清单" }}</text>
              </button>
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
            <view v-if="detailSteps.length" class="step-list">
              <view v-for="(item, index) in detailSteps" :key="index" class="step-card">
                <text class="step-card__index font-medium">
                  <text class="step-card__index-current font-black">{{ index + 1 }} </text>
                  <text class="step-card__index-total">{{ `/ ${detailSteps.length}` }}</text>
                </text>
                <image v-if="item.imageUrl" class="step-card__cover-image" :src="item.imageUrl" mode="widthFix" />
                <text v-if="hasStepText(item.text)" class="step-card__text">{{ item.text.trim() }}</text>
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

            <text v-if="curatedText" class="detail-curated">{{ curatedText }}</text>

	        </view>
      </view>

      <view
        v-if="showStickyActions"
        class="detail-actions-shell"
        :class="{ 'detail-actions-shell--visible': detailActionsVisible }"
      >
        <view class="detail-actions" :class="{ 'detail-actions--visible': detailActionsVisible }">
          <button class="detail-actions__item" open-type="share">
            <view class="cookfont icon-share detail-actions__icon" />
            <view class="detail-actions__text">分享</view>
          </button>
          <template v-if="kind === 'inspiration'">
            <button class="detail-actions__item" @click="handleAdaptRecipe">
              <view class="cookfont icon-edit detail-actions__icon" />
              <view class="detail-actions__text">改编</view>
            </button>
            <button class="detail-actions__item" @click="openAddSheet">
              <view class="cookfont icon-add-owner detail-actions__icon" />
              <view class="detail-actions__text">添加到我的</view>
            </button>
          </template>
          <template v-else-if="kind === 'my'">
            <button class="detail-actions__item" @click="handleEditRecipe">
              <view class="cookfont icon-edit detail-actions__icon" />
              <view class="detail-actions__text">编辑</view>
            </button>
            <button
              class="detail-actions__item"
              :class="{ 'detail-actions__item--disabled': recommendActionDisabled }"
              :disabled="recommendActionDisabled"
              @click="openRecommendSheet"
            >
              <view class="cookfont icon-recommend detail-actions__icon" />
              <view class="detail-actions__text">{{ recommendActionLabel }}</view>
            </button>
          </template>
        </view>
      </view>

      <SheetShell
        v-if="kind === 'inspiration'"
        :visible="addSheetVisible"
        title="添加到我的"
        subtitle="至少选择一个。选个人分类会带着当前菜谱内容进入“我的”，选合集会固定保存当前灵感版本。"
        @close="closeAddSheet"
      >
          <view v-if="addSheetLoading" class="panel-note panel-note--sheet">加载中...</view>
          <view v-else-if="addSheetError" class="panel-note panel-note--sheet" @click="loadAddOptions(true)">{{ addSheetError }}</view>
          <template v-else>
            <view class="sheet-section">
              <view class="sheet-section__head">
                <view class="sheet-section__meta">
                  <text class="sheet-section__title">个人分类</text>
                  <text class="sheet-section__tag">最多4字</text>
                </view>
                <view class="sheet-section__action" @click="toggleAddCategoryCreator">
                  {{ showAddCategoryCreator ? "取消" : "创建" }}
                </view>
              </view>
              <view v-if="showAddCategoryCreator" class="sheet-creator">
                <input
                  v-model="addCategoryDraftName"
                  class="sheet-creator__input"
                  maxlength="4"
                  placeholder="输入分类名称"
                  :disabled="addCategorySubmitting"
                />
                <button
                  class="sheet-creator__button"
                  :disabled="addCategorySubmitting || !addCategoryDraftName.trim()"
                  @click="createAddCategoryTag"
                >
                  {{ addCategorySubmitting ? "创建中" : "确定" }}
                </button>
              </view>
              <view v-if="categories.length" class="chip-row">
                <view
                  v-for="item in categories"
                  :key="item.id"
                  class="chip"
                  :class="{ 'chip--active': selectedCategoryId === item.id }"
                  @click="toggleCategory(item.id)"
                >
                  {{ item.name }}
                </view>
              </view>
              <text v-else class="sheet-section__hint">还没有个人分类，可先只选合集。</text>
            </view>

            <view class="sheet-section">
              <view class="sheet-section__head">
                <view class="sheet-section__meta">
                  <text class="sheet-section__title">合集</text>
                  <text class="sheet-section__tag">最多6字</text>
                </view>
                <view class="sheet-section__action" @click="toggleAddSceneCreator">
                  {{ showAddSceneCreator ? "取消" : "创建" }}
                </view>
              </view>
              <view v-if="showAddSceneCreator" class="sheet-creator">
                <input
                  v-model="addSceneDraftName"
                  class="sheet-creator__input"
                  maxlength="6"
                  placeholder="输入合集名称"
                  :disabled="addSceneSubmitting"
                />
                <button
                  class="sheet-creator__button"
                  :disabled="addSceneSubmitting || !addSceneDraftName.trim()"
                  @click="createAddSceneTag"
                >
                  {{ addSceneSubmitting ? "创建中" : "确定" }}
                </button>
              </view>
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
              <text v-else class="sheet-section__hint">还没有合集，可先只选个人分类。</text>
            </view>

          </template>
          <template #footer>
            <view class="sheet-actions">
              <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="addSheetSubmitting" @click="closeAddSheet">取消</button>
              <button
                class="sheet-actions__button sheet-actions__button--confirm"
                :disabled="addSheetSubmitting || !canSubmitAddSheet"
                @click="confirmAddSheet"
              >
                {{ addSheetSubmitting ? "处理中..." : "确定" }}
              </button>
            </view>
          </template>
      </SheetShell>

      <SheetShell
        v-if="kind === 'my'"
        :visible="recommendSheetVisible"
        title="投稿灵感"
        subtitle="选择一个建议的系统分类。审核通过后，会收录到灵感里，个人菜谱仍保留在“我的”中。"
        @close="closeRecommendSheet"
      >
	          <view v-if="recommendSheetLoading" class="panel-note panel-note--sheet">加载中...</view>
	          <view v-else-if="recommendSheetError" class="panel-note panel-note--sheet" @click="loadRecommendCategories(true)">{{ recommendSheetError }}</view>
	          <template v-else>
	            <view class="sheet-section">
	              <text class="sheet-section__title">系统菜谱分类</text>
	              <view v-if="recommendCategories.length" class="chip-row">
	                <view
	                  v-for="item in recommendCategories"
	                  :key="item.id"
	                  class="chip"
	                  :class="{ 'chip--active': selectedRecommendCategoryId === item.id }"
	                  @click="selectedRecommendCategoryId = item.id"
	                >
	                  {{ item.name }}
	                </view>
	              </view>
	              <text v-else class="sheet-section__hint">当前还没有可选的系统菜谱分类。</text>
	            </view>
	          </template>
          <template #footer>
            <view class="sheet-actions">
              <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="recommendSubmitting" @click="closeRecommendSheet">取消</button>
              <button
                class="sheet-actions__button sheet-actions__button--confirm"
                :disabled="recommendSubmitting || !selectedRecommendCategoryId"
                @click="handleRecommendRecipe"
              >
                {{ recommendSubmitting ? "提交中..." : "投稿" }}
              </button>
            </view>
          </template>
      </SheetShell>

      <SheetShell
        v-if="kind === 'inspiration'"
        :visible="reportSheetVisible"
        title="举报菜谱"
        subtitle="如果这份菜谱让你觉得不合适，可以选一个最接近的原因告诉我们；选“其他”时再补充几句说明就可以。"
        @close="closeReportSheet"
      >
          <picker :range="reportReasonOptions" range-key="label" @change="handleReasonChange">
            <view class="report-picker">
              <text class="report-picker__label">举报原因</text>
              <view class="report-picker__value">
                <text
                  class="report-picker__text"
                  :class="{ 'report-picker__text--placeholder': !selectedReportReasonLabel }"
                >
                  {{ selectedReportReasonLabel || "请选择原因" }}
                </text>
                <text class="cookfont icon-arrow-right report-picker__icon" />
              </view>
            </view>
          </picker>

          <textarea
            v-if="needsReportDetail"
            v-model="reportReason"
            class="report-box"
            maxlength="255"
            placeholder="请填写具体说明"
          />
          <button class="danger" :disabled="submitting || !canSubmitReport" @click="handleReport">提交举报</button>
      </SheetShell>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { onHide, onLoad, onPageScroll, onShareAppMessage, onUnload } from "@dcloudio/uni-app";
import type { UUID } from "@/apis/http";
	import {
		recipeApi,
		type CollectedRecipeDetail,
		type InspirationCategorySummary,
		type InspirationRecipeDetail,
		type MyRecipeDetail,
		type RecipeAmountSnapshot,
		type RecipeCategorySummary,
		type RecipeContentSnapshot,
		type RecipeDifficulty,
		type RecipeDraftContentInput,
		type RecipeDuration,
		type RecipeRecommendationSummary,
		type RecipeSceneSummary
	} from "@/apis/recipe";
import { shoppingApi } from "../apis/shopping";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { usePageScrollLock } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { markRecipeHomeDirty, markRecipeManageDirty } from "@/pages/recipe/utils/recipe-view-sync";
import { uniPlatform } from "@/platform/uni";
import { useLoginModalStore } from "@/stores/login-modal";
import { useRecipePreviewStore, type RecipePreviewAmount, type RecipePreviewDetail } from "../stores/recipe-preview";
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

interface ReportReasonOption {
  value: "AD" | "FALSE" | "INFRINGEMENT" | "ILLEGAL" | "OTHER";
  label: string;
}

function isSeedCoverUrl(value: string) {
  return value.startsWith("https://example.com/recipe/") || value.startsWith("http://example.com/recipe/");
}

function resolveCoverImageUrl(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed || isSeedCoverUrl(trimmed)) {
    return "";
  }
  return trimmed;
}

const pageStyle = usePageScrollStyle();
const DETAIL_ACTIONS_SHOW_OFFSET = 24;
const reportReasonOptions: ReportReasonOption[] = [
  { value: "AD", label: "广告营销" },
  { value: "FALSE", label: "内容不实" },
  { value: "INFRINGEMENT", label: "侵犯权益" },
  { value: "ILLEGAL", label: "违法违规" },
  { value: "OTHER", label: "其他" }
];

const anchorTabs = [
  { value: "ingredients" as const, label: "食材" },
  { value: "steps" as const, label: "步骤" }
];

const sessionStore = useSessionStore();
const loginModalStore = useLoginModalStore();
const recipePreviewStore = useRecipePreviewStore();
const { navBarTotalHeight } = useSystemInfo();
const NAV_FADE_RANGE = 132;
const recipeId = ref<UUID | "">("");
const kind = ref<DetailKind>("my");
const mode = ref<DetailMode>("published");
const detail = ref<PublishedDetail | RecipePreviewDetail | null>(null);
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const reportReason = ref("");
const reportSheetVisible = ref(false);
const addSheetVisible = ref(false);
const recommendSheetVisible = ref(false);
const selectedReportReason = ref<ReportReasonOption["value"] | "">("");
const addSheetLoading = ref(false);
const addSheetSubmitting = ref(false);
const addSheetError = ref("");
const recommendSheetLoading = ref(false);
const recommendSubmitting = ref(false);
const recommendSheetError = ref("");
const shoppingSubmitting = ref(false);
const categories = ref<RecipeCategorySummary[]>([]);
const scenes = ref<RecipeSceneSummary[]>([]);
const recommendCategories = ref<InspirationCategorySummary[]>([]);
const selectedCategoryId = ref<UUID | "">("");
const selectedSceneIds = ref<UUID[]>([]);
const selectedRecommendCategoryId = ref<UUID | "">("");
const showAddCategoryCreator = ref(false);
const showAddSceneCreator = ref(false);
const addCategoryDraftName = ref("");
const addSceneDraftName = ref("");
const addCategorySubmitting = ref(false);
const addSceneSubmitting = ref(false);
const navOpacity = ref(0);
const scrollTop = ref(0);
const titleThreshold = ref(Number.POSITIVE_INFINITY);
const ingredientTop = ref(0);
const stepTop = ref(Number.POSITIVE_INFINITY);
const { setLocked: setPageLocked } = usePageScrollLock(Symbol("recipe-detail-report-sheet"));

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
const myDetail = computed(() => {
	if (mode.value !== "published" || kind.value !== "my" || !detail.value) return null;
	return detail.value as MyRecipeDetail;
});

const detailTitle = computed(() => detail.value?.title || "");
const coverImageUrl = computed(() =>
  resolveCoverImageUrl(previewDetail.value?.coverImageUrl || publishedDetail.value?.coverImageUrl || "")
);
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
const detailStory = computed(() => detailContent.value.story?.trim() || "");
const currentRecommendation = computed(() => myDetail.value?.recommendation ?? null);
const curatedText = computed(() => {
  const name = inspirationDetail.value?.curatedByName?.trim();
  if (!name) return "";
  const dateText = inspirationDetail.value?.updatedAt?.slice(0, 10) || "";
  return dateText ? `由${name}整理 · ${dateText}` : `由${name}整理`;
});
const canOpenRecommendSheet = computed(() => {
	const status = currentRecommendation.value?.status;
	return !status || status === "REJECTED" || status === "WITHDRAWN";
});
const recommendActionText = computed(() => {
	if (currentRecommendation.value?.status === "REJECTED") return "修改后重新投稿";
	if (currentRecommendation.value?.status === "WITHDRAWN") return "重新投稿";
	return "投稿灵感";
});
const detailSteps = computed(() => detailContent.value.steps.filter(item => Boolean(item.imageUrl || hasStepText(item.text))));
const showReportEntry = computed(() => mode.value === "published" && kind.value === "inspiration" && sessionStore.isLoggedIn);
const selectedReportReasonLabel = computed(
  () => reportReasonOptions.find(item => item.value === selectedReportReason.value)?.label || ""
);
const needsReportDetail = computed(() => selectedReportReason.value === "OTHER");
const canSubmitReport = computed(() => {
  if (!selectedReportReason.value) return false;
  if (!needsReportDetail.value) return true;
  return Boolean(reportReason.value.trim());
});
const recommendActionLabel = computed(() => {
	const status = currentRecommendation.value?.status;
	if (status === "PENDING") return "审核中";
	if (status === "ADOPTED") return "已收录";
	if (status === "REJECTED") return "重新投稿";
	if (status === "WITHDRAWN") return "重新投稿";
	return "投稿灵感";
});
const recommendActionDisabled = computed(() => {
	const status = currentRecommendation.value?.status;
	return status === "PENDING" || status === "ADOPTED";
});
const showStickyActions = computed(
  () => mode.value === "published" && (kind.value === "inspiration" || kind.value === "my") && Boolean(detail.value)
);
const detailActionsVisible = computed(
  () =>
    showStickyActions.value &&
    scrollTop.value > DETAIL_ACTIONS_SHOW_OFFSET &&
    !addSheetVisible.value &&
    !reportSheetVisible.value &&
    !recommendSheetVisible.value
);
const showShoppingEntry = computed(() => mode.value === "published" && detailContent.value.ingredients.length > 0);
const canSubmitAddSheet = computed(() => Boolean(selectedCategoryId.value || selectedSceneIds.value.length));
const detailFactText = computed(() => {
  const parts: string[] = [];
  if (detailCategoryName.value) {
    parts.push(detailCategoryName.value);
  }
  if (detailSceneLabels.value.length) {
    parts.push(detailSceneLabels.value.map(item => `#${item}`).join(" "));
  }
  return parts.join("  ·  ");
});

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

const ingredientCountText = computed(() => `${detailContent.value.ingredients.length}项食材`);
const stepCountText = computed(() => `${detailSteps.value.length}个步骤`);
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

function parseQueryId(value: unknown): UUID | "" {
  const raw = Array.isArray(value) ? value[0] : value;
  const decoded = typeof raw === "string" ? Number(decodeURIComponent(raw)) : Number(raw);
  return Number.isInteger(decoded) && decoded > 0 ? decoded : "";
}

function hasStepText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

watch([reportSheetVisible, addSheetVisible, recommendSheetVisible], ([reportVisible, addVisible, recommendVisible]) => {
  setPageLocked(reportVisible || addVisible || recommendVisible);
}, { immediate: true });

onLoad((query) => {
  const rawKind = Array.isArray(query?.kind) ? query.kind[0] : query?.kind;
  const rawMode = Array.isArray(query?.mode) ? query.mode[0] : query?.mode;
  recipeId.value = parseQueryId(query?.recipeId);
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

onShareAppMessage(() => ({
  title: detailTitle.value || "菜谱分享",
  path: recipeId.value
    ? `/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(recipeId.value))}&kind=${kind.value}&mode=${mode.value}`
    : "/pages/recipe/index",
  imageUrl: coverImageUrl.value || undefined
}));

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

function scrollToSection(section: AnchorKey) {
  const top = section === "steps" ? stepTop.value : ingredientTop.value;
  void uniPlatform.navigation.pageScrollTo({
    scrollTop: Math.max(0, top - navBarTotalHeight.value - 18),
    duration: 260
  });
}

function openLogin(afterLogin?: () => void) {
  loginModalStore.open(null, afterLogin);
}

function openReportSheet() {
  if (!showReportEntry.value) return;
  reportSheetVisible.value = true;
}

function closeReportSheet() {
  reportSheetVisible.value = false;
}

function handleReasonChange(event: { detail?: { value?: number | string } }) {
  const raw = event.detail?.value;
  const index = typeof raw === "string" ? Number(raw) : Number(raw ?? NaN);
  if (!Number.isInteger(index) || index < 0) return;
  const option = reportReasonOptions[index];
  if (!option) return;
  selectedReportReason.value = option.value;
  if (option.value !== "OTHER") {
    reportReason.value = "";
  }
}

function buildReportPayload() {
  if (!selectedReportReasonLabel.value) return "";
  if (!needsReportDetail.value) return selectedReportReasonLabel.value;
  return reportReason.value.trim() ? `${selectedReportReasonLabel.value}：${reportReason.value.trim()}` : "";
}

async function loadAddOptions(force = false) {
  if (!sessionStore.isLoggedIn || (addSheetLoading.value && !force)) return;
  addSheetLoading.value = true;
  addSheetError.value = "";
  try {
    const [categoryList, sceneList] = await Promise.all([
      recipeApi.listCategories(),
      recipeApi.listScenes()
    ]);
    categories.value = categoryList;
    scenes.value = sceneList;
    if (selectedCategoryId.value && !categories.value.some(item => item.id === selectedCategoryId.value)) {
      selectedCategoryId.value = "";
    }
    selectedSceneIds.value = selectedSceneIds.value.filter(sceneId => scenes.value.some(item => item.id === sceneId));
  } catch (error) {
    addSheetError.value = error instanceof Error ? error.message : "分类加载失败";
  } finally {
    addSheetLoading.value = false;
  }
}

function resetAddSelection() {
  selectedCategoryId.value = "";
  selectedSceneIds.value = [];
}

function resetAddCreatorState() {
  showAddCategoryCreator.value = false;
  showAddSceneCreator.value = false;
  addCategoryDraftName.value = "";
  addSceneDraftName.value = "";
  addCategorySubmitting.value = false;
  addSceneSubmitting.value = false;
}

function toggleAddCategoryCreator() {
  showAddCategoryCreator.value = !showAddCategoryCreator.value;
  if (!showAddCategoryCreator.value) {
    addCategoryDraftName.value = "";
  }
}

function toggleAddSceneCreator() {
  showAddSceneCreator.value = !showAddSceneCreator.value;
  if (!showAddSceneCreator.value) {
    addSceneDraftName.value = "";
  }
}

async function createAddCategoryTag() {
  const name = addCategoryDraftName.value.trim();
  if (!name || addCategorySubmitting.value) return;
  if (name.length > 4) {
    await uniPlatform.feedback.toast({ title: "分类最多4个字", icon: "none" });
    return;
  }
  addCategorySubmitting.value = true;
  try {
    const created = await recipeApi.createCategory({
      operationId: createOperationId(),
      name
    });
    categories.value = [...categories.value, created];
    selectedCategoryId.value = created.id;
    markRecipeHomeDirty(["my"]);
    addCategoryDraftName.value = "";
    showAddCategoryCreator.value = false;
    await uniPlatform.feedback.toast({ title: "分类已创建", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "创建分类失败", icon: "none" });
  } finally {
    addCategorySubmitting.value = false;
  }
}

async function createAddSceneTag() {
  const name = addSceneDraftName.value.trim();
  if (!name || addSceneSubmitting.value) return;
  if (name.length > 6) {
    await uniPlatform.feedback.toast({ title: "合集最多6个字", icon: "none" });
    return;
  }
  addSceneSubmitting.value = true;
  try {
    const created = await recipeApi.createScene({
      operationId: createOperationId(),
      name
    });
    scenes.value = [...scenes.value, created];
    selectedSceneIds.value = [...selectedSceneIds.value, created.id];
    markRecipeHomeDirty(["collection"]);
    addSceneDraftName.value = "";
    showAddSceneCreator.value = false;
    await uniPlatform.feedback.toast({ title: "合集已创建", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "创建合集失败", icon: "none" });
  } finally {
    addSceneSubmitting.value = false;
  }
}

function openAddSheet() {
  if (!showStickyActions.value || kind.value !== "inspiration") return;
  if (!sessionStore.isLoggedIn) {
    openLogin(() => {
      openAddSheet();
    });
    return;
  }
  resetAddSelection();
  resetAddCreatorState();
  addSheetVisible.value = true;
	void loadAddOptions(true);
}

async function loadRecommendCategories(force = false) {
	if (recommendSheetLoading.value && !force) return;
	recommendSheetLoading.value = true;
	recommendSheetError.value = "";
	try {
		recommendCategories.value = await recipeApi.listInspirationCategories();
		if (selectedRecommendCategoryId.value && !recommendCategories.value.some(item => item.id === selectedRecommendCategoryId.value)) {
			selectedRecommendCategoryId.value = "";
		}
		if (!selectedRecommendCategoryId.value) {
			selectedRecommendCategoryId.value =
				currentRecommendation.value?.suggestedCategory.id ||
				recommendCategories.value[0]?.id ||
				"";
		}
	} catch (error) {
		recommendSheetError.value = error instanceof Error ? error.message : "分类加载失败";
	} finally {
		recommendSheetLoading.value = false;
	}
}

function syncMyRecommendation(next: RecipeRecommendationSummary | null) {
	if (!myDetail.value) return;
	detail.value = {
		...myDetail.value,
		recommendation: next
	};
}

function openRecommendSheet() {
	if (!myDetail.value || !canOpenRecommendSheet.value) return;
	selectedRecommendCategoryId.value = currentRecommendation.value?.suggestedCategory.id || "";
	recommendSheetVisible.value = true;
	void loadRecommendCategories(true);
}

function closeRecommendSheet() {
	recommendSheetVisible.value = false;
}

function closeAddSheet() {
  addSheetVisible.value = false;
  resetAddCreatorState();
}

async function handleRecommendRecipe() {
	if (!recipeId.value || !selectedRecommendCategoryId.value || recommendSubmitting.value) return;
	recommendSubmitting.value = true;
	try {
		const result = await recipeApi.recommendRecipe(recipeId.value, {
			operationId: createOperationId(),
			inspirationCategoryId: selectedRecommendCategoryId.value
		});
		syncMyRecommendation(result);
		closeRecommendSheet();
		await uniPlatform.feedback.toast({ title: "已提交投稿", icon: "success" });
	} catch (error) {
		await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "投稿失败", icon: "none" });
	} finally {
		recommendSubmitting.value = false;
	}
}

function toggleCategory(categoryId: UUID) {
  selectedCategoryId.value = selectedCategoryId.value === categoryId ? "" : categoryId;
}

async function collectIntoScenes(sceneIds: UUID[]) {
  if (!inspirationDetail.value || !sceneIds.length) return;
  await recipeApi.collectRecipe({
    operationId: createOperationId(),
    sourceRecipeId: inspirationDetail.value.id,
    sourceVersionId: inspirationDetail.value.contentVersionId,
    sceneIds
  });
}

function buildDraftSeedContent(categoryId: UUID | null, sceneIds: UUID[]) {
  if (!inspirationDetail.value) return null;
  const contentSnapshot = inspirationDetail.value.content;
  const slotSeed = Date.now();
  const content: RecipeDraftContentInput = {
    name: detailTitle.value || contentSnapshot.name || "未命名菜谱",
    story: contentSnapshot.story,
    categoryId,
    sceneIds,
    originVersionId: inspirationDetail.value.contentVersionId,
    originCoverImageUrl: coverImageUrl.value || null,
    coverUploadId: null,
    coverImageUrl: coverImageUrl.value || null,
    baseServings: contentSnapshot.baseServings ?? null,
    difficulty: contentSnapshot.difficulty,
    duration: contentSnapshot.duration,
    tips: contentSnapshot.tips,
    ingredients: contentSnapshot.ingredients.map(item => ({
      ingredientId: item.ingredientId,
      name: item.ingredientName,
      quantity: item.amount.kind === "EXACT" ? item.amount.quantity : "",
      unitId: item.amount.kind === "EXACT" ? item.amount.unitId : null,
      fuzzyText: item.amount.kind === "FUZZY" ? item.amount.text : null,
      categoryId: item.categoryId,
      defaultUnitId: item.amount.kind === "EXACT" ? item.amount.unitId : null,
      source: item.source
    })),
    steps: contentSnapshot.steps.map((item, index) => ({
      slotKey: `detail-${slotSeed}-${index + 1}`,
      text: item.text,
      uploadId: null,
      imageUrl: item.imageUrl ?? null
    }))
  };
  return content;
}

async function handleAdaptRecipe() {
  if (!showStickyActions.value || kind.value !== "inspiration") return;
  if (!sessionStore.isLoggedIn) {
    openLogin(() => {
      void handleAdaptRecipe();
    });
    return;
  }
  const content = buildDraftSeedContent(null, []);
  if (!content) return;
  recipePreviewStore.setDraftSeed({ content });
  void uniPlatform.navigation.navigateTo("/pages_recipe/edit/index");
}

function handleEditRecipe() {
  if (!showStickyActions.value || kind.value !== "my" || !recipeId.value) return;
  void uniPlatform.navigation.navigateTo(`/pages_recipe/edit/index?recipeId=${encodeURIComponent(String(recipeId.value))}`);
}

async function confirmAddSheet() {
  if (!inspirationDetail.value || addSheetSubmitting.value || !canSubmitAddSheet.value) return;
  addSheetSubmitting.value = true;
  try {
    const sceneIds = [...selectedSceneIds.value];
    if (sceneIds.length) {
      await collectIntoScenes(sceneIds);
    }
    if (selectedCategoryId.value) {
      await recipeApi.createMyRecipeFromInspiration({
        operationId: createOperationId(),
        sourceRecipeId: inspirationDetail.value.id,
        sourceVersionId: inspirationDetail.value.contentVersionId,
        categoryId: selectedCategoryId.value,
        sceneIds
      });
      markRecipeHomeDirty(["my"]);
      markRecipeManageDirty(["recipes"]);
      if (sceneIds.length) {
        markRecipeHomeDirty(["collection"]);
      }
      closeAddSheet();
      await uniPlatform.feedback.toast({
        title: sceneIds.length ? "已加入合集并添加到我的" : "已添加到我的",
        icon: "success"
      });
      return;
    }
    markRecipeHomeDirty(["collection"]);
    closeAddSheet();
    await uniPlatform.feedback.toast({ title: "已加入合集", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "添加失败", icon: "none" });
  } finally {
    addSheetSubmitting.value = false;
  }
}

function toggleScene(sceneId: UUID) {
  if (selectedSceneIds.value.includes(sceneId)) {
    selectedSceneIds.value = selectedSceneIds.value.filter(item => item !== sceneId);
    return;
  }
  selectedSceneIds.value = [...selectedSceneIds.value, sceneId];
}

async function addToShoppingList() {
  if (!showShoppingEntry.value || shoppingSubmitting.value) return;
  if (!sessionStore.isLoggedIn) {
    openLogin(() => {
      void addToShoppingList();
    });
    return;
  }
  shoppingSubmitting.value = true;
  try {
    await Promise.all(
      detailContent.value.ingredients.map(item =>
        shoppingApi.create({
          operationId: createOperationId(),
          name: item.ingredientName,
          quantityText: formatAmount(item.amount)
        })
      )
    );
    await uniPlatform.feedback.toast({ title: "已添加到购物清单", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "添加失败", icon: "none" });
  } finally {
    shoppingSubmitting.value = false;
  }
}

async function handleReport() {
  const reasonText = buildReportPayload();
  if (!recipeId.value || mode.value !== "published" || submitting.value || !reasonText) return;
  submitting.value = true;
  try {
    await recipeApi.reportRecipe(recipeId.value, createOperationId(), reasonText);
    selectedReportReason.value = "";
    reportReason.value = "";
    closeReportSheet();
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
  border-radius: var(--radius-pill);
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

.content--with-actions {
  padding-bottom: calc(220rpx + env(safe-area-inset-bottom));
}

.summary-card {
  padding: 0 32rpx 24rpx;
}

.summary-card__title,
.summary-card__story {
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

.summary-card__facts {
  margin-top: 24rpx;
}

.summary-card__fact-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}

.summary-card__fact-block {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.summary-card__fact-title,
.summary-card__fact-text,
.summary-card__report-entry {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.summary-card__fact-title {
  color: var(--color-text-tertiary);
}

.summary-card__fact-text {
  color: var(--color-text-secondary);
}

.summary-card__report-entry {
  flex: 0 0 auto;
  color: var(--color-text-tertiary);
  opacity: 0.78;
}

.summary-card__report-entry--hover {
  opacity: 0.56;
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

.section__head-main {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  min-width: 0;
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

.section__action {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  flex: 0 0 auto;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--theme-primary);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
}

.section__action::after {
  border: 0;
}

.section__action-icon {
  color: inherit;
  font-size: 26rpx;
  line-height: 1;
}

.section__note,
.section__empty,
.tips-text {
  display: block;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.8;
}

.detail-curated {
  display: block;
  margin: 8rpx 32rpx 0;
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  line-height: 1.6;
}

.ingredient-list {
  overflow: hidden;
}

.ingredient-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 22rpx 0;
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
  color: var(--color-text);
  font-size: 24rpx;
  line-height: 1;
}

.step-card__index-current,
.step-card__index-total {
  display: inline-block;
  font-style: italic;
  vertical-align: baseline;
}

.step-card__index-current {
  font-size: 36rpx;
  padding-right: 10rpx;
  font-weight: var(--font-weight-semibold);
}

.step-card__index-total {
  font-size: 24rpx;
  font-weight: var(--font-weight-medium);
}

.step-card__cover-image {
  display: block;
  width: 100%;
  margin-top: 16rpx;
  border-radius: 20rpx;
  overflow: hidden;
}

.step-card__text {
  margin-top: 16rpx;
  color: var(--color-text);
  font-size: 28rpx;
  line-height: 1.8;
}

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
  border-radius: var(--radius-pill);
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

.panel-note--sheet {
  margin-top: 24rpx;
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

.sheet-section {
  margin-top: 28rpx;
}

.sheet-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 18rpx;
}

.sheet-section__meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
}

.sheet-section__title {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.4;
}

.sheet-section__tag {
  flex: 0 0 auto;
  color: var(--color-text-tertiary);
  font-size: 22rpx;
  line-height: 1.2;
}

.sheet-section__action {
  flex: 0 0 auto;
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
}

.sheet-section__hint {
  display: block;
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  line-height: 1.6;
}

.sheet-creator {
  display: flex;
  gap: 14rpx;
  margin-bottom: 18rpx;
}

.sheet-creator__input {
  flex: 1;
  height: 76rpx;
  padding: 0 22rpx;
  border: 1rpx solid rgba(109, 92, 72, 0.1);
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-sizing: border-box;
  color: var(--color-text);
  font-size: 26rpx;
}

.sheet-creator__button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 132rpx;
  height: 76rpx;
  border-radius: var(--radius-pill);
  background: linear-gradient(
    135deg,
    var(--button-primary-gradient-start) 0%,
    var(--button-primary-gradient-end) 100%
  );
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.sheet-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 22rpx;
}

.sheet-actions__button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 88rpx;
  height: 88rpx;
  border: 0;
  border-radius: var(--radius-pill);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.sheet-actions__button::after {
  border: 0;
}

.sheet-actions__button--confirm {
  background: linear-gradient(
    135deg,
    var(--button-primary-gradient-start) 0%,
    var(--button-primary-gradient-end) 100%
  );
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}

.sheet-actions__button--cancel {
  background: rgba(255, 255, 255, 0.78);
  color: var(--color-text-secondary);
}

.detail-actions-shell {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1200;
  height: calc(152rpx + env(safe-area-inset-bottom));
  pointer-events: none;
  opacity: 0;
  transition: opacity 320ms ease;
}

.detail-actions-shell::after {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--color-tabbar-bg);
  -webkit-mask-image: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.1) 36%, rgba(0, 0, 0, 1) 100%);
  mask-image: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.1) 36%, rgba(0, 0, 0, 1) 100%);
  -webkit-backdrop-filter: saturate(180%) blur(22rpx);
  backdrop-filter: saturate(180%) blur(22rpx);
  pointer-events: none;
  content: "";
}

.detail-actions-shell--visible {
  opacity: 1;
}

.detail-actions {
  position: absolute;
  right: 24rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  left: 24rpx;
  z-index: 1;
  display: flex;
  gap: 16rpx;
  padding: 10rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-tabbar-bg);
  overflow: hidden;
  pointer-events: auto;
  -webkit-backdrop-filter: saturate(180%) blur(28rpx);
  backdrop-filter: saturate(180%) blur(28rpx);
  transform: translateY(calc(100% + env(safe-area-inset-bottom) + 40rpx));
  transition:
    transform 420ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 320ms ease;
}

.detail-actions--visible {
  transform: translateY(0);
  pointer-events: auto;
}

.detail-actions__item {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  min-height: 88rpx;
  margin: 0;
  padding: 0 20rpx;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
}

.detail-actions__item::after {
  border: 0;
}

.detail-actions__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34rpx;
  height: 34rpx;
  flex: 0 0 34rpx;
  color: inherit;
  font-size: 34rpx;
  line-height: 1;
}

.detail-actions__text {
  display: flex;
  align-items: center;
  color: inherit;
  line-height: 1;
  white-space: nowrap;
}

.detail-actions__item--disabled {
  opacity: 0.52;
}

.report-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 24rpx;
  padding: 24rpx 28rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.report-picker__label {
  color: var(--color-text);
  font-size: 28rpx;
  line-height: 1.4;
}

.report-picker__value {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-width: 0;
}

.report-picker__text {
  color: var(--color-text);
  font-size: 26rpx;
  line-height: 1.4;
  text-align: right;
}

.report-picker__text--placeholder,
.report-picker__icon {
  color: var(--color-text-tertiary);
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
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}
</style>
