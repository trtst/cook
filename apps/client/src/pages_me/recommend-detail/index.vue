<template>
  <page-meta :page-style="pageStyle" />
  <Layout
    title=""
    full-screen
    :navbar-transparent="isIngredientType"
    :navbar-placeholder="!isIngredientType"
    :show-left="isIngredientType"
    :navbar-layout="isIngredientType ? 'title' : 'custom-left'"
  >
    <template v-if="!isIngredientType" #navbar-left>
      <view class="header-tabs">
        <view class="cookfont icon-back header-tabs__back" hover-class="header-tabs__back--hover" hover-stay-time="100" @click="goBack" />
        <view class="nav-tabs">
          <view
            v-for="item in inviteStatusTabs"
            :key="item.key"
            class="nav-tabs__item"
            :class="{ 'nav-tabs__item--active': activeStatus === item.key }"
            @click="changeStatus(item.key)"
          >
            {{ item.name }}
          </view>
        </view>
      </view>
    </template>
    <template v-if="isIngredientType" #navbar-center>
      <text class="detail-navbar__title">{{ currentType.name }}</text>
    </template>

    <view v-if="isIngredientType" class="detail-nav-backdrop" :style="navBackdropStyle" />

    <view class="detail-page">
      <view class="detail-scroll-wrap">
        <RecipeSearchLoading
          :pull-distance="pullDistance"
          :refreshing="refreshing"
          :show-success="showSuccess"
          :refresher-text="refresherText"
          :threshold="refresherThreshold"
        />
        <scroll-view
          scroll-y
          class="detail-scroll"
          refresher-enabled
          refresher-default-style="none"
          :show-scrollbar="false"
          :refresher-threshold="refresherThreshold"
          :refresher-triggered="refresherTriggered"
          @scroll="handleScroll"
          @refresherpulling="onRefresherPulling"
          @refresherrefresh="handleRefresherRefresh"
          @refresherrestore="onRefresherRestore"
          @refresherabort="onRefresherRestore"
        >
          <view class="detail-body" :style="detailBodyStyle">
          <view v-if="currentStatusTabs.length" class="sticky-wrap" :style="stickyStyle">
            <view class="status-panel">
              <view
                v-for="item in currentStatusTabs"
                :key="item.key"
                class="status-chip"
                :class="{ 'status-chip--active': activeStatus === item.key }"
                @click="changeStatus(item.key)"
              >
                {{ item.name }}
              </view>
            </view>
          </view>

          <view v-if="loading && !currentItems.length" class="notice">加载中...</view>
          <view v-else-if="errorText && !currentItems.length" class="notice notice--error" @click="loadPage()">
            {{ errorText }}
          </view>
          <view v-else-if="!currentItems.length" class="empty-state">
            <image class="empty-state__art" :src="emptyStateArt" mode="aspectFit" />
            <text class="empty-state__title">{{ emptyTitle }}</text>
            <text class="empty-state__desc">{{ emptyDesc }}</text>
          </view>
          <view v-else class="recommend-list">
            <view v-if="errorText" class="inline-notice" @click="loadPage()">
              <text>{{ errorText }}</text>
              <text class="inline-notice__action">重试</text>
            </view>

            <template v-if="isIngredientType">
              <view v-for="item in filteredIngredients" :key="item.id" class="recommend-card">
                <view class="recommend-card__head">
                  <view class="recommend-card__head-main">
                    <text class="recommend-card__name">{{ item.ingredientName }}</text>
                    <text class="recommend-card__meta">{{ item.category.name }} · {{ item.defaultUnit.name }}</text>
                  </view>
                  <text class="recommend-card__status" :class="`recommend-card__status--${statusTone(item.status)}`">
                    {{ statusText(item.status) }}
                  </text>
                </view>

                <text class="recommend-card__time">推荐时间 {{ formatDetailTime(item.createdAt) }}</text>

                <text v-if="item.status === 'PENDING'" class="recommend-card__desc">等待审核中，当前仍可在菜谱编辑里继续使用这份个人食材。</text>
                <view v-else-if="item.status === 'REJECTED'" class="recommend-card__reject">
                  <text class="recommend-card__desc">
                    {{ item.reviewNote || "审核未通过，可修改名称、分类或默认单位后重新推荐。" }}
                  </text>
                  <text v-if="item.reviewAdvice" class="recommend-card__advice">建议：{{ item.reviewAdvice }}</text>
                </view>
                <text v-else-if="item.status === 'ADOPTED'" class="recommend-card__desc">
                  已收录为系统食材{{ item.adoptedIngredient ? `：${item.adoptedIngredient.name}` : "" }}
                </text>
                <text v-else class="recommend-card__desc">
                  已归并到现有系统食材{{ item.mergedIngredient ? `：${item.mergedIngredient.name}` : "" }}
                </text>

                <view v-if="item.status === 'REJECTED'" class="recommend-card__actions">
                  <button class="recommend-button" :disabled="editorSubmitting" @click="openEditor(item)">修改后重新推荐</button>
                </view>
              </view>
            </template>

            <template v-else>
              <view
                v-for="item in filteredInvites"
                :key="item.id"
                class="recommend-card invite-card"
                :class="{ 'invite-card--pending': item.inviteStatus === 'PENDING' }"
                hover-class="recommend-card--hover"
                hover-stay-time="100"
              >
                <view class="recommend-card__head">
                  <view class="recommend-card__head-main">
                    <text class="recommend-card__eyebrow">{{ inviteOwnerLine(item) }}</text>
                    <text class="recommend-card__name">{{ item.name }}</text>
                  </view>
                  <view class="recommend-card__time-box">
                    <text class="recommend-card__time-label">{{ inviteTimeLabel(item) }}</text>
                    <text class="recommend-card__time-value">{{ formatDetailTime(invitePrimaryTime(item)) }}</text>
                  </view>
                </view>

                <view class="recommend-card__summary">
                  <text class="recommend-card__status" :class="`recommend-card__status--${inviteStatusTone(item)}`">
                    {{ inviteStatusText(item) }}
                  </text>
                  <text class="recommend-card__summary-text">{{ item.memberCount }}/{{ item.memberLimit }} 人协作</text>
                  <text class="recommend-card__summary-dot" />
                  <text class="recommend-card__summary-text">{{ item.itemCount }} 个食材项</text>
                </view>

                <text class="recommend-card__desc">{{ inviteDesc(item) }}</text>

                <view v-if="showInviteActions(item)" class="recommend-card__actions">
                  <button class="editor-button invite-card__button invite-card__button--cancel" :disabled="inviteSubmittingId === item.id" @click.stop="declineInvite(item)">
                    忽略邀请
                  </button>
                  <button class="editor-button invite-card__button invite-card__button--confirm" :disabled="inviteSubmittingId === item.id || !item.canJoin" @click.stop="acceptInvite(item)">
                    {{ item.canJoin ? "确认邀请" : "当前不可加入" }}
                  </button>
                </view>
                <view v-else-if="item.inviteStatus === 'ACCEPTED'" class="recommend-card__actions">
                  <button class="editor-button invite-card__button invite-card__button--confirm" :disabled="inviteSubmittingId === item.id" @click.stop="openInviteList(item)">查看清单</button>
                </view>
              </view>
            </template>

            <view v-if="isIngredientType && hasNext" class="recommend-footer">
              <text class="recommend-footer__action" @click="loadMore">点击加载更多</text>
            </view>
          </view>
          </view>
        </scroll-view>
      </view>

      <view v-if="editorVisible" class="editor-mask" @click="closeEditor" @touchmove.stop.prevent>
        <view class="editor-panel" @click.stop>
          <view class="editor-panel__head">
            <text class="editor-panel__title">修改并重新推荐</text>
            <text class="editor-panel__close" @click="closeEditor">×</text>
          </view>

          <view class="editor-field">
            <text class="editor-field__label">食材名称</text>
            <input
              v-model="editorForm.name"
              class="editor-input"
              maxlength="30"
              placeholder="请输入食材名称"
              :disabled="editorSubmitting"
            />
          </view>

          <view class="editor-field">
            <text class="editor-field__label">分类</text>
            <view class="chip-row">
              <view
                v-for="item in categories"
                :key="item.id"
                class="chip"
                :class="{ 'chip--active': editorForm.categoryId === item.id }"
                @click="editorForm.categoryId = item.id"
              >
                {{ item.name }}
              </view>
            </view>
          </view>

          <view class="editor-field">
            <text class="editor-field__label">默认单位</text>
            <view class="chip-row">
              <view
                v-for="item in units"
                :key="item.id"
                class="chip"
                :class="{ 'chip--active': editorForm.defaultUnitId === item.id }"
                @click="editorForm.defaultUnitId = item.id"
              >
                {{ item.name }}
              </view>
            </view>
          </view>

          <view class="editor-actions">
            <button class="editor-button editor-button--ghost" :disabled="editorSubmitting" @click="closeEditor">取消</button>
            <button class="editor-button" :loading="editorSubmitting" :disabled="editorSubmitting" @click="submitEditor">
              保存并推荐
            </button>
          </view>
        </view>
      </view>

    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import emptyStateArt from "@/assets/me-page/notification-empty-state.svg";
import {
  recipeApi,
  type IngredientCategorySummary,
  type IngredientRecommendationStatus,
  type IngredientRecommendationSummary,
  type UnitSummary
} from "@/apis/recipe";
import type { UUID } from "@/apis/http";
import { shoppingApi, type ShoppingListInviteFilter, type ShoppingListInviteSummary } from "@/apis/shopping";
import Layout from "@/components/Layout/Layout.vue";
import RecipeSearchLoading from "@/components/Recipe/RecipeSearchLoading.vue";
import { useCustomRefresher } from "@/composables/useCustomRefresher";
import { usePageScrollLock, usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { createOperationId } from "@/utils/operation-id";

type MessageTypeKey = "ingredient" | "shoppingInvite";
type IngredientStatusFilterKey = "ALL" | IngredientRecommendationStatus;
type InviteStatusFilterKey = "ALL" | "PENDING" | "RESOLVED";
type StatusFilterKey = IngredientStatusFilterKey | InviteStatusFilterKey;
type ReadState = Partial<Record<MessageTypeKey, string>>;

const READ_STORAGE_KEY = "cook_meal_notification_category_read_v1";
const NAV_FADE_DISTANCE = 88;

const pageStyle = usePageScrollStyle();
const { setLocked: setPageLocked } = usePageScrollLock(Symbol("recommend-detail-editor"));
const { navBarTotalHeight } = useSystemInfo();
const {
  threshold: refresherThreshold,
  pullDistance,
  refreshing,
  showSuccess,
  refresherText,
  refresherTriggered,
  onRefresherPulling,
  onRefresherRefresh,
  onRefreshComplete,
  onRefresherRestore
} = useCustomRefresher({
  text: {
    pulling: "下拉刷新通知",
    canRelease: ["松手刷新通知", "更新协作消息"],
    success: "通知已刷新"
  }
});

const typeMap = {
  ingredient: {
    key: "ingredient" as MessageTypeKey,
    name: "推荐审核"
  },
  shoppingInvite: {
    key: "shoppingInvite" as MessageTypeKey,
    name: "清单协作"
  }
} as const;

const ingredientStatusTabs = [
  { key: "ALL", name: "全部" },
  { key: "PENDING", name: "审核中" },
  { key: "REJECTED", name: "已拒绝" },
  { key: "ADOPTED", name: "已收录" },
  { key: "MERGED", name: "已归并" }
] as const satisfies Array<{ key: IngredientStatusFilterKey; name: string }>;
const inviteStatusTabs = [
  { key: "ALL", name: "全部" },
  { key: "PENDING", name: "未处理" },
  { key: "RESOLVED", name: "已处理" }
] as const satisfies Array<{ key: InviteStatusFilterKey; name: string }>;

const typeKey = ref<MessageTypeKey>("ingredient");
const loading = ref(false);
const loadingMore = ref(false);
const errorText = ref("");
const editorVisible = ref(false);
const editorSubmitting = ref(false);
const inviteSubmittingId = ref<UUID | null>(null);
const activeStatus = ref<StatusFilterKey>("ALL");
const scrollTop = ref(0);
const ingredientItems = ref<IngredientRecommendationSummary[]>([]);
const inviteItems = ref<ShoppingListInviteSummary[]>([]);
const categories = ref<IngredientCategorySummary[]>([]);
const units = ref<UnitSummary[]>([]);
const page = ref(1);
const pageSize = ref(20);
const hasNext = ref(false);
const editorForm = reactive({
  ingredientId: "" as UUID | "",
  expectedVersion: 0,
  name: "",
  categoryId: "" as UUID | "",
  defaultUnitId: "" as UUID | ""
});

const currentType = computed(() => typeMap[typeKey.value]);
const isIngredientType = computed(() => typeKey.value === "ingredient");
const navProgress = computed(() => Math.min(1, Math.max(0, scrollTop.value / NAV_FADE_DISTANCE)));
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: `${navProgress.value}`
}));
const detailBodyStyle = computed(() => ({
  paddingTop: isIngredientType.value ? `${navBarTotalHeight.value + 20}px` : "20px"
}));
const stickyStyle = computed(() => ({
  top: isIngredientType.value ? `${navBarTotalHeight.value}px` : "0px"
}));
const currentStatusTabs = computed(() => (isIngredientType.value ? ingredientStatusTabs : []));
const filteredIngredients = computed(() => {
  if (activeStatus.value === "ALL") return ingredientItems.value;
  return ingredientItems.value.filter(item => item.status === activeStatus.value);
});
const filteredInvites = computed(() => inviteItems.value);
const currentItems = computed(() => (isIngredientType.value ? filteredIngredients.value : filteredInvites.value));
const emptyTitle = computed(() => {
  if (!isIngredientType.value) {
    if (activeStatus.value === "PENDING") return "还没有未处理邀请";
    if (activeStatus.value === "RESOLVED") return "还没有已处理邀请";
    return "还没有清单协作消息";
  }
  return activeStatus.value === "ALL" ? "还没有推荐审核" : "这个状态下还没有记录";
});
const emptyDesc = computed(() => {
  if (isIngredientType.value) {
    return activeStatus.value === "ALL"
      ? "你在菜谱编辑里推荐个人食材后，会先在这里看到审核结果。"
      : "换个状态看看，或者稍后再回来。";
  }
  if (activeStatus.value === "RESOLVED") return "你处理过的协作邀请会在这里保留 7 天。";
  if (activeStatus.value === "PENDING") return "新的清单协作邀请，会先收口到这里等待你处理。";
  return "饭搭子分享给你的清单协作消息，会先收口到这里。";
});

let loadPromise: Promise<void> | null = null;
let inviteLoadSeq = 0;

onLoad(query => {
  const nextType = typeof query?.type === "string" ? decodeURIComponent(query.type) : "ingredient";
  typeKey.value = nextType === "shoppingInvite" ? "shoppingInvite" : "ingredient";
  activeStatus.value = "ALL";
});

onShow(() => {
  void loadPage();
});

watch(
  () => editorVisible.value,
  visible => {
    setPageLocked(visible);
  },
  { immediate: true }
);

async function loadPage() {
  if (!isIngredientType.value) {
    await doLoadPage(true);
    return;
  }

  if (loadPromise) {
    await loadPromise;
    return;
  }

  loadPromise = doLoadPage(true).finally(() => {
    loadPromise = null;
  });

  await loadPromise;
}

async function handleRefresherRefresh() {
  const shouldRefresh = onRefresherRefresh();
  if (!shouldRefresh) {
    onRefresherRestore();
    return;
  }

  try {
    await loadPage();
    await onRefreshComplete();
  } finally {
    onRefresherRestore();
  }
}

async function loadMore() {
  if (!isIngredientType.value || loading.value || loadingMore.value || !hasNext.value) return;
  await doLoadPage(false);
}

async function doLoadPage(reset: boolean) {
  const inviteSeq = !isIngredientType.value ? inviteLoadSeq + 1 : 0;

  if (reset) {
    loading.value = true;
    errorText.value = "";
  } else {
    loadingMore.value = true;
  }

  try {
    if (!isIngredientType.value) {
      inviteLoadSeq = inviteSeq;
      const inviteResult = await shoppingApi.listInvites(resolveInviteFilter());
      if (inviteSeq !== inviteLoadSeq) return;
      inviteItems.value = inviteResult.items;
      hasNext.value = false;
      markTypeRead();
      return;
    }

    const nextPage = reset ? 1 : page.value + 1;
    const recommendationResult = await recipeApi.listIngredientRecommendations({ page: nextPage, pageSize: pageSize.value });
    page.value = recommendationResult.page;
    hasNext.value = recommendationResult.hasNext;
    ingredientItems.value = reset ? recommendationResult.items : [...ingredientItems.value, ...recommendationResult.items];
    markTypeRead();
  } catch (error) {
    if (!isIngredientType.value && inviteSeq !== inviteLoadSeq) return;
    errorText.value = error instanceof Error ? error.message : "加载失败，请重试";
  } finally {
    if (!isIngredientType.value && inviteSeq !== inviteLoadSeq) return;
    if (reset) {
      loading.value = false;
    } else {
      loadingMore.value = false;
    }
  }
}

async function ensureEditorMeta() {
  if (categories.value.length && units.value.length) return;
  const [categoryList, unitResult] = await Promise.all([
    categories.value.length ? Promise.resolve(categories.value) : recipeApi.listIngredientCategories(),
    units.value.length ? Promise.resolve({ items: units.value }) : recipeApi.listUnits({ page: 1, pageSize: 100 })
  ]);
  categories.value = categoryList;
  units.value = unitResult.items;
}

function getItemSortTime(item: IngredientRecommendationSummary) {
  return item.reviewedAt || item.updatedAt || item.createdAt;
}

function markTypeRead() {
  const latestTime = isIngredientType.value
    ? ingredientItems.value.reduce<string>((current, item) => {
        const nextTime = getItemSortTime(item);
        if (!current) return nextTime;
        return new Date(nextTime).getTime() > new Date(current).getTime() ? nextTime : current;
      }, "")
    : inviteItems.value.reduce<string>((current, item) => {
        const nextTime = item.handledAt || item.invitedAt;
        if (!current) return nextTime;
        return new Date(nextTime).getTime() > new Date(current).getTime() ? nextTime : current;
      }, "");
  if (!latestTime) return;
  const readState = uniPlatform.storage.getSync<ReadState>(READ_STORAGE_KEY) ?? {};
  uniPlatform.storage.setSync(READ_STORAGE_KEY, {
    ...readState,
    [typeKey.value]: latestTime
  });
}

function handleScroll(event: { detail: { scrollTop?: number } }) {
  scrollTop.value = event.detail.scrollTop ?? 0;
}

function changeStatus(status: StatusFilterKey) {
  if (activeStatus.value === status) return;
  activeStatus.value = status;
  if (!isIngredientType.value) {
    void doLoadPage(true);
  }
}

function resolveInviteFilter(): ShoppingListInviteFilter {
  if (activeStatus.value === "PENDING" || activeStatus.value === "RESOLVED") {
    return activeStatus.value;
  }
  return "ALL";
}

function statusText(status: IngredientRecommendationStatus) {
  if (status === "PENDING") return "审核中";
  if (status === "REJECTED") return "已拒绝";
  if (status === "ADOPTED") return "已收录";
  return "已归并";
}

function statusTone(status: IngredientRecommendationStatus) {
  if (status === "PENDING") return "pending";
  if (status === "REJECTED") return "rejected";
  if (status === "ADOPTED") return "adopted";
  return "merged";
}

function formatDetailTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}

function inviteOwnerName(item: ShoppingListInviteSummary) {
  return item.ownerNickname || `UID ${item.ownerUid}`;
}

function inviteOwnerLine(item: ShoppingListInviteSummary) {
  return `来自 ${inviteOwnerName(item)}`;
}

function invitePrimaryTime(item: ShoppingListInviteSummary) {
  return item.handledAt || item.invitedAt;
}

function inviteTimeLabel(item: ShoppingListInviteSummary) {
  if (item.inviteStatus === "ACCEPTED") return "加入时间";
  if (item.inviteStatus === "DECLINED") return "处理时间";
  return "邀请时间";
}

function inviteStatusText(item: ShoppingListInviteSummary) {
  if (item.inviteStatus === "ACCEPTED") return "已加入";
  if (item.inviteStatus === "DECLINED") return "已忽略";
  return item.canJoin ? "待确认" : "暂不可加";
}

function inviteStatusTone(item: ShoppingListInviteSummary) {
  if (item.inviteStatus === "ACCEPTED") return "adopted";
  if (item.inviteStatus === "DECLINED") return "rejected";
  return item.canJoin ? "pending" : "merged";
}

function inviteDesc(item: ShoppingListInviteSummary) {
  if (item.inviteStatus === "ACCEPTED") return "你已加入这张清单协作，可以继续查看并一起维护。";
  if (item.inviteStatus === "DECLINED") return "你已忽略这条协作邀请；后续若对方再次邀请，会生成新的待处理消息。";
  if (item.canJoin) return `${inviteOwnerName(item)} 邀请你一起维护这张购物清单，确认后即可加入协作。`;
  return "当前协作者名额已满，这条邀请暂时不能继续加入。";
}

function showInviteActions(item: ShoppingListInviteSummary) {
  return item.inviteStatus === "PENDING";
}

async function acceptInvite(item: ShoppingListInviteSummary) {
  if (!item.canJoin || inviteSubmittingId.value) return;
  const confirmed = await uniPlatform.feedback.confirm({
    title: "确认加入",
    content: `确认加入“${item.name}”吗？加入后你可以一起维护这张清单。`
  });
  if (!confirmed) return;
  inviteSubmittingId.value = item.id;
  try {
    const detail = await shoppingApi.acceptInvite(item.id, createOperationId());
    await uniPlatform.feedback.toast({ title: "已加入共享清单", icon: "success" });
    await loadPage();
    void uniPlatform.navigation.navigateTo(`/pages_pantry/list-detail/index?listId=${encodeURIComponent(String(detail.id))}`);
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "加入失败", icon: "none" });
  } finally {
    inviteSubmittingId.value = null;
  }
}

async function declineInvite(item: ShoppingListInviteSummary) {
  if (inviteSubmittingId.value) return;
  const confirmed = await uniPlatform.feedback.confirm({
    title: "忽略邀请",
    content: `忽略后，“${item.name}” 会移到已处理，方便你后续回看。`
  });
  if (!confirmed) return;
  inviteSubmittingId.value = item.id;
  try {
    await shoppingApi.declineInvite(item.id, createOperationId());
    await uniPlatform.feedback.toast({ title: "已忽略邀请", icon: "success" });
    await loadPage();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "操作失败", icon: "none" });
  } finally {
    inviteSubmittingId.value = null;
  }
}

function openInviteList(item: ShoppingListInviteSummary) {
  void uniPlatform.navigation.navigateTo(`/pages_pantry/list-detail/index?listId=${encodeURIComponent(String(item.listId))}`);
}

function shareStatusText(nextStatus: "ACTIVE" | "COMPLETED" | "VOIDED") {
  if (nextStatus === "COMPLETED") return "已完成";
  if (nextStatus === "VOIDED") return "已作废";
  return "采购中";
}

function goBack() {
  if (getCurrentPages().length > 1) {
    void uniPlatform.navigation.navigateBack();
    return;
  }
  void uniPlatform.navigation.navigateTo("/pages_me/recommend/index");
}

async function openEditor(item: IngredientRecommendationSummary) {
  if (!isIngredientType.value) return;
  try {
    await ensureEditorMeta();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "选项加载失败", icon: "none" });
    return;
  }
  editorForm.ingredientId = item.ingredientId;
  editorForm.expectedVersion = item.ingredientVersion;
  editorForm.name = item.ingredientName;
  editorForm.categoryId = item.category.id;
  editorForm.defaultUnitId = item.defaultUnit.id;
  editorVisible.value = true;
}

function closeEditor() {
  if (editorSubmitting.value) return;
  editorVisible.value = false;
}

async function submitEditor() {
  if (editorSubmitting.value) return;

  const name = editorForm.name.trim();
  if (!name) {
    await uniPlatform.feedback.toast({ title: "请输入食材名称", icon: "none" });
    return;
  }
  if (!editorForm.categoryId) {
    await uniPlatform.feedback.toast({ title: "请选择分类", icon: "none" });
    return;
  }
  if (!editorForm.defaultUnitId) {
    await uniPlatform.feedback.toast({ title: "请选择默认单位", icon: "none" });
    return;
  }
  if (!editorForm.ingredientId) {
    await uniPlatform.feedback.toast({ title: "食材记录缺失，请重新打开", icon: "none" });
    return;
  }

  editorSubmitting.value = true;
  try {
    await recipeApi.updateIngredient(editorForm.ingredientId, {
      operationId: createOperationId(),
      expectedVersion: editorForm.expectedVersion,
      name,
      categoryId: editorForm.categoryId,
      defaultUnitId: editorForm.defaultUnitId
    });
    await recipeApi.recommendIngredient(editorForm.ingredientId, {
      operationId: createOperationId()
    });
    editorVisible.value = false;
    await uniPlatform.feedback.toast({ title: "已重新推荐", icon: "success" });
    await loadPage();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "提交失败", icon: "none" });
  } finally {
    editorSubmitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.header-tabs {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-width: 0;
}

.header-tabs__back {
  display: flex;
  align-items: center;
  width: 64rpx;
  height: 64rpx;
  color: var(--color-text);
  font-size: 34rpx;
  line-height: 1;
}

.header-tabs__back--hover {
  opacity: 0.82;
}

.nav-tabs {
  display: flex;
  gap: 44rpx;
  align-items: flex-end;
  min-width: 0;
  padding-top: 6rpx;
}

.nav-tabs__item {
  position: relative;
  z-index: 0;
  flex: 0 0 auto;
  padding: 8rpx 0 12rpx;
  color: var(--color-text-secondary);
  font-size: 36rpx;
  font-weight: var(--font-weight-bold);
  line-height: 1;
  white-space: nowrap;
}

.nav-tabs__item--active {
  color: var(--color-text);
}

.nav-tabs__item--active::after {
  content: "";
  position: absolute;
  right: -8rpx;
  bottom: 2rpx;
  left: -8rpx;
  z-index: -1;
  height: 18rpx;
  border-radius: var(--radius-pill);
  background: var(--theme-primary);
  opacity: 0.3;
  transform: rotate(-5deg);
}

.detail-navbar__title {
  overflow: hidden;
  max-width: 420rpx;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: 700;
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-nav-backdrop {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 790;
  background: var(--color-page);
  pointer-events: none;
}

.detail-page {
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--color-page);
}

.detail-scroll-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
}

.detail-scroll {
  flex: 1;
  height: 100%;
}

.detail-body {
  padding-right: var(--space-page);
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  padding-left: var(--space-page);
}

.sticky-wrap {
  position: sticky;
  z-index: 20;
  padding-bottom: 16rpx;
  background: var(--color-page);
}

.status-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 28rpx;
  padding: 0 4rpx;
}

.status-chip {
  position: relative;
  padding-bottom: 8rpx;
  color: var(--color-text-secondary);
  font-size: 26rpx;
  line-height: 1.4;
}

.status-chip--active {
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
}

.status-chip--active::after {
  content: "";
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 6rpx;
  border-radius: 999rpx;
  background: var(--theme-primary);
}

.notice,
.empty-state,
.recommend-card,
.invite-sheet-card,
.editor-panel,
.inline-notice {
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.notice,
.empty-state,
.recommend-card,
.invite-sheet-card,
.editor-panel {
  padding: 28rpx;
}

.notice,
.empty-state {
  margin-top: 20rpx;
  text-align: center;
}

.notice--error,
.inline-notice__action,
.recommend-footer__action {
  color: var(--color-primary);
}

.empty-state__art {
  display: block;
  width: 320rpx;
  height: 220rpx;
  margin: 0 auto;
}

.empty-state__title,
.recommend-card__name,
.editor-panel__title {
  color: #1f2740;
  font-size: 34rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.3;
}

.recommend-card__name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state__title {
  display: block;
  margin-top: 12rpx;
}

.empty-state__desc,
.notice,
.recommend-card__meta,
.recommend-card__time,
.recommend-card__desc,
.inline-notice,
.recommend-card__advice {
  color: #8d97b5;
  font-size: 24rpx;
  line-height: 1.6;
}

.empty-state__desc {
  display: block;
  margin-top: 12rpx;
}

.recommend-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.inline-notice {
  padding: 24rpx 28rpx;
}

.recommend-card {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.recommend-card--hover {
  opacity: 0.94;
}

.recommend-card__head,
.invite-sheet-card__head,
.editor-panel__head,
.editor-actions,
.inline-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.recommend-card__head {
  align-items: flex-start;
}

.recommend-card__head-main {
  min-width: 0;
}

.recommend-card__eyebrow,
.recommend-card__time-label,
.invite-sheet-card__owner,
.invite-sheet-card__time {
  display: block;
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.5;
}

.recommend-card__time-box {
  flex: 0 0 auto;
  min-width: 180rpx;
  text-align: right;
}

.recommend-card__time-value {
  display: block;
  margin-top: 4rpx;
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
}

.recommend-card__meta,
.recommend-card__time {
  display: block;
  margin-top: 8rpx;
}

.recommend-card__summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10rpx;
}

.recommend-card__summary-text {
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.4;
}

.recommend-card__summary-dot {
  width: 6rpx;
  height: 6rpx;
  border-radius: 50%;
  background: var(--color-divider);
}

.recommend-card__status {
  flex-shrink: 0;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: var(--font-weight-semibold);
}

.recommend-card__status--pending {
  color: #8c5a13;
  background: #fdf2d5;
}

.recommend-card__status--rejected {
  color: #a5412a;
  background: #fde4dd;
}

.recommend-card__status--adopted {
  color: #1d7a4f;
  background: #dff4e9;
}

.recommend-card__status--merged {
  color: #2a5d93;
  background: #e1eefb;
}

.recommend-card__reject {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.recommend-card__advice {
  color: #d29322;
}

.recommend-card__actions {
  display: flex;
  gap: 16rpx;
  justify-content: flex-end;
}

.recommend-button,
.editor-button {
  height: 76rpx;
  padding: 0 30rpx;
  border: 0;
  border-radius: 999rpx;
  color: var(--color-primary-foreground);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 76rpx;
  background: var(--color-primary);
}

.invite-card {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 86%, var(--theme-primary) 14%), var(--color-surface));
}

.invite-card--pending {
  border: 1rpx solid color-mix(in srgb, var(--theme-primary) 18%, transparent);
}

.invite-card .recommend-card__actions {
  justify-content: stretch;
}

.invite-card .recommend-card__actions .editor-button {
  flex: 1;
  min-width: 0;
}

.invite-card__button::after {
  border: 0;
}

.invite-card__button--cancel {
  background: var(--color-surface);
  color: var(--color-text);
}

.invite-card__button--confirm {
  background: linear-gradient(
    135deg,
    var(--button-primary-gradient-start) 0%,
    var(--button-primary-gradient-end) 100%
  );
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow);
}

.recommend-footer {
  text-align: center;
}

.editor-mask {
  position: fixed;
  inset: 0;
  z-index: 900;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(26, 26, 26, 0.42);
}

.editor-panel {
  width: calc(100% - 40rpx);
  margin-right: 20rpx;
  margin-bottom: calc(20rpx + env(safe-area-inset-bottom));
  margin-left: 20rpx;
}

.editor-panel__close {
  color: #a0a8c0;
  font-size: 40rpx;
  line-height: 1;
}

.editor-field {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 24rpx;
}

.editor-field__label {
  color: #1f2740;
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
}

.editor-input {
  height: 88rpx;
  padding: 0 24rpx;
  border-radius: 18rpx;
  background: #f6f7fb;
  color: #1f2740;
  font-size: 28rpx;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.chip {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 56rpx;
  padding: 0 28rpx;
  border: 1rpx solid #e7eaf4;
  border-radius: 18rpx;
  box-sizing: border-box;
  background: #f6f7fb;
  color: #68718d;
  font-size: 24rpx;
}

.chip--active {
  border-color: rgba(255, 114, 87, 0.35);
  background: rgba(255, 114, 87, 0.12);
  color: var(--color-primary);
}

.editor-actions {
  margin-top: 28rpx;
}

.editor-button--ghost {
  color: var(--color-text);
  background: var(--color-surface-muted);
}
</style>
