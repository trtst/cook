<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="" full-screen :show-left="false" navbar-layout="custom-left">
    <template #navbar-left>
      <view class="cookfont icon-back detail-nav__back" hover-class="detail-nav__back--hover" hover-stay-time="100" @click="goBack" />
    </template>
    <template #navbar-center>
      <text class="detail-nav__title">{{ currentTypeName }}</text>
    </template>

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
          :lower-threshold="120"
          @refresherpulling="onRefresherPulling"
          @refresherrefresh="handleRefresherRefresh"
          @refresherrestore="onRefresherRestore"
          @refresherabort="onRefresherRestore"
          @scrolltolower="handleScrollToLower"
        >
          <view class="detail-body">
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

              <template v-if="isRecommendType">
                <template v-for="item in recommendationItems" :key="`${item.kind}-${item.id}`">
                  <view v-if="item.kind === 'ingredient'" class="recommend-card">
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

                  <view v-else class="recommend-card">
                    <view class="recommend-card__head">
                      <view class="recommend-card__head-main">
                        <text class="recommend-card__name">{{ item.unitName }}</text>
                        <text class="recommend-card__meta">{{ unitTypeText(item.unitType) }}</text>
                      </view>
                      <text class="recommend-card__status" :class="`recommend-card__status--${statusTone(item.status)}`">
                        {{ statusText(item.status) }}
                      </text>
                    </view>

                    <text class="recommend-card__time">提交时间 {{ formatDetailTime(item.createdAt) }}</text>

                    <text v-if="item.status === 'PENDING'" class="recommend-card__desc">等待审核中，审核通过后会进入系统单位。</text>
                    <view v-else-if="item.status === 'REJECTED'" class="recommend-card__reject">
                      <text class="recommend-card__desc">
                        {{ item.reviewNote || "审核未通过，可换成更准确、常用的单位后再提交。" }}
                      </text>
                      <text v-if="item.reviewAdvice" class="recommend-card__advice">建议：{{ item.reviewAdvice }}</text>
                    </view>
                    <text v-else-if="item.status === 'ADOPTED'" class="recommend-card__desc">
                      已收录为系统单位{{ item.targetUnit ? `：${item.targetUnit.name}` : "" }}
                    </text>
                    <text v-else class="recommend-card__desc">
                      已归并到现有系统单位{{ item.targetUnit ? `：${item.targetUnit.name}` : "" }}
                    </text>
                  </view>
                </template>
              </template>

              <template v-else>
                <view
                  v-for="item in visibleInviteItems"
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

              <view v-if="showFooter" class="recommend-footer">
                <text v-if="loadingMore" class="recommend-footer__text">加载中...</text>
                <text v-else-if="canLoadMore" class="recommend-footer__action" @click="loadMore">上拉加载更多</text>
                <text v-else class="recommend-footer__text">没有更多了</text>
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
  type UnitRecommendationSummary,
  type UnitSummary
} from "@/apis/recipe";
import type { UUID } from "@/apis/http";
import { shoppingApi, type ShoppingListInviteSummary } from "../apis/shopping";
import Layout from "@/components/Layout/Layout.vue";
import RecipeSearchLoading from "@/components/Recipe/RecipeSearchLoading.vue";
import { useCustomRefresher } from "@/composables/useCustomRefresher";
import { usePageScrollLock, usePageScrollStyle } from "@/composables/usePageScrollLock";
import { uniPlatform } from "@/platform/uni";
import { createOperationId } from "@/utils/operation-id";

type MessageTypeKey = "recommend" | "shoppingInvite";
type ReadState = Partial<Record<MessageTypeKey, string>>;
type RecommendationListItem =
  | (IngredientRecommendationSummary & { kind: "ingredient" })
  | (UnitRecommendationSummary & { kind: "unit" });

const READ_STORAGE_KEY = "cook_meal_notification_category_read_v1";

const pageStyle = usePageScrollStyle();
const { setLocked: setPageLocked } = usePageScrollLock(Symbol("recommend-detail-editor"));
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
    canRelease: ["松手刷新通知", "更新通知消息"],
    success: "通知已刷新"
  }
});

const typeMap = {
  recommend: {
    key: "recommend" as MessageTypeKey,
    name: "推荐审核"
  },
  shoppingInvite: {
    key: "shoppingInvite" as MessageTypeKey,
    name: "清单协作"
  }
} as const;

const typeKey = ref<MessageTypeKey>("recommend");
const loading = ref(false);
const loadingMore = ref(false);
const errorText = ref("");
const editorVisible = ref(false);
const editorSubmitting = ref(false);
const inviteSubmittingId = ref<UUID | null>(null);
const ingredientItems = ref<IngredientRecommendationSummary[]>([]);
const unitItems = ref<UnitRecommendationSummary[]>([]);
const inviteItems = ref<ShoppingListInviteSummary[]>([]);
const visibleInviteCount = ref(0);
const categories = ref<IngredientCategorySummary[]>([]);
const units = ref<UnitSummary[]>([]);
const page = ref(1);
const pageSize = ref(20);
const hasNext = ref(false);
const unitPage = ref(1);
const unitHasNext = ref(false);
const editorForm = reactive({
  ingredientId: "" as UUID | "",
  expectedVersion: 0,
  name: "",
  categoryId: "" as UUID | "",
  defaultUnitId: "" as UUID | ""
});

const isRecommendType = computed(() => typeKey.value === "recommend");
const currentTypeName = computed(() => typeMap[typeKey.value].name);
const recommendationItems = computed<RecommendationListItem[]>(() =>
  [
    ...ingredientItems.value.map(item => ({ ...item, kind: "ingredient" as const })),
    ...unitItems.value.map(item => ({ ...item, kind: "unit" as const }))
  ].sort((left, right) => new Date(getRecommendSortTime(right)).getTime() - new Date(getRecommendSortTime(left)).getTime())
);
const sortedInviteItems = computed(() =>
  [...inviteItems.value].sort((left, right) => new Date(invitePrimaryTime(right)).getTime() - new Date(invitePrimaryTime(left)).getTime())
);
const visibleInviteItems = computed(() => sortedInviteItems.value.slice(0, visibleInviteCount.value));
const currentItems = computed(() => (isRecommendType.value ? recommendationItems.value : visibleInviteItems.value));
const recommendHasMore = computed(() => hasNext.value || unitHasNext.value);
const inviteHasMore = computed(() => visibleInviteCount.value < sortedInviteItems.value.length);
const canLoadMore = computed(() => (isRecommendType.value ? recommendHasMore.value : inviteHasMore.value));
const showFooter = computed(() => currentItems.value.length > 0);
const emptyTitle = computed(() => (isRecommendType.value ? "还没有审核通知" : "还没有协作通知"));
const emptyDesc = computed(() =>
  isRecommendType.value
    ? "食材推荐和单位建议会按时间倒序展示在这里。"
    : "新的清单协作邀请和已处理记录会按时间倒序展示在这里。"
);

let loadPromise: Promise<void> | null = null;

onLoad(query => {
  const nextType = typeof query?.type === "string" ? decodeURIComponent(query.type) : "recommend";
  typeKey.value = nextType === "shoppingInvite" ? "shoppingInvite" : "recommend";
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

async function handleScrollToLower() {
  if (!canLoadMore.value) return;
  await loadMore();
}

async function loadMore() {
  if (!canLoadMore.value || loading.value || loadingMore.value) return;

  if (!isRecommendType.value) {
    visibleInviteCount.value = Math.min(visibleInviteCount.value + pageSize.value, sortedInviteItems.value.length);
    return;
  }

  await doLoadPage(false);
}

async function doLoadPage(reset: boolean) {
  if (reset) {
    loading.value = true;
    errorText.value = "";
  } else {
    loadingMore.value = true;
  }

  try {
    if (!isRecommendType.value) {
      const inviteResult = await shoppingApi.listInvites("ALL");
      inviteItems.value = inviteResult.items;
      visibleInviteCount.value = Math.min(pageSize.value, inviteResult.items.length);
      markTypeRead();
      return;
    }

    const [ingredientResult, unitResult] = await Promise.all([
      reset || hasNext.value ? recipeApi.listIngredientRecommendations({ page: reset ? 1 : page.value + 1, pageSize: pageSize.value }) : Promise.resolve(null),
      reset || unitHasNext.value ? recipeApi.listUnitRecommendations({ page: reset ? 1 : unitPage.value + 1, pageSize: pageSize.value }) : Promise.resolve(null)
    ]);

    if (ingredientResult) {
      page.value = ingredientResult.page;
      hasNext.value = ingredientResult.hasNext;
      ingredientItems.value = reset ? ingredientResult.items : [...ingredientItems.value, ...ingredientResult.items];
    } else if (reset) {
      page.value = 1;
      hasNext.value = false;
      ingredientItems.value = [];
    }

    if (unitResult) {
      unitPage.value = unitResult.page;
      unitHasNext.value = unitResult.hasNext;
      unitItems.value = reset ? unitResult.items : [...unitItems.value, ...unitResult.items];
    } else if (reset) {
      unitPage.value = 1;
      unitHasNext.value = false;
      unitItems.value = [];
    }

    markTypeRead();
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "加载失败，请重试";
  } finally {
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
    units.value.length ? Promise.resolve({ items: units.value }) : recipeApi.listUnits({ page: 1, pageSize: 100, source: "SYSTEM" })
  ]);
  categories.value = categoryList;
  units.value = unitResult.items;
}

function getIngredientSortTime(item: IngredientRecommendationSummary) {
  return item.reviewedAt || item.updatedAt || item.createdAt;
}

function getUnitSortTime(item: UnitRecommendationSummary) {
  return item.reviewedAt || item.updatedAt || item.createdAt;
}

function getRecommendSortTime(item: RecommendationListItem) {
  return item.kind === "ingredient" ? getIngredientSortTime(item) : getUnitSortTime(item);
}

function markTypeRead() {
  const latestTime = isRecommendType.value
    ? recommendationItems.value.reduce<string>((current, item) => {
        const nextTime = getRecommendSortTime(item);
        if (!current) return nextTime;
        return new Date(nextTime).getTime() > new Date(current).getTime() ? nextTime : current;
      }, "")
    : sortedInviteItems.value.reduce<string>((current, item) => {
        const nextTime = invitePrimaryTime(item);
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

function statusText(status: IngredientRecommendationStatus) {
  if (status === "PENDING") return "审核中";
  if (status === "REJECTED") return "已拒绝";
  return "审核通过";
}

function statusTone(status: IngredientRecommendationStatus) {
  if (status === "PENDING") return "pending";
  if (status === "REJECTED") return "rejected";
  if (status === "MERGED") return "merged";
  return "adopted";
}

function unitTypeText(type: UnitSummary["type"]) {
  if (type === "WEIGHT") return "重量单位";
  if (type === "VOLUME") return "体积单位";
  if (type === "COMMON") return "常用单位";
  if (type === "PACKAGE") return "包装单位";
  return "常用单位";
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
  if (item.inviteStatus === "DECLINED" || item.inviteStatus === "REVOKED") return "处理时间";
  return "邀请时间";
}

function inviteStatusText(item: ShoppingListInviteSummary) {
  if (item.inviteStatus === "ACCEPTED") return "已加入";
  if (item.inviteStatus === "DECLINED") return "已忽略";
  if (item.inviteStatus === "REVOKED") return "已撤回";
  return item.canJoin ? "待确认" : "暂不可加";
}

function inviteStatusTone(item: ShoppingListInviteSummary) {
  if (item.inviteStatus === "ACCEPTED") return "adopted";
  if (item.inviteStatus === "DECLINED") return "rejected";
  if (item.inviteStatus === "REVOKED") return "merged";
  return item.canJoin ? "pending" : "merged";
}

function inviteDesc(item: ShoppingListInviteSummary) {
  if (item.inviteStatus === "ACCEPTED") return "你已加入这张清单协作，可以继续查看并一起维护。";
  if (item.inviteStatus === "DECLINED") return "你已忽略这条协作邀请；后续若对方再次邀请，会生成新的待处理消息。";
  if (item.inviteStatus === "REVOKED") return "发起人已撤回这条协作邀请，这里仅保留通知记录。";
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
    content: `忽略后，“${item.name}” 会留在通知里，方便你后续回看。`
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

function goBack() {
  if (getCurrentPages().length > 1) {
    void uniPlatform.navigation.navigateBack();
    return;
  }
  void uniPlatform.navigation.navigateTo("/pages_me/recommend/index");
}

async function openEditor(item: IngredientRecommendationSummary) {
  if (!isRecommendType.value) return;
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
.detail-nav__back {
  display: flex;
  align-items: center;
  width: 64rpx;
  height: 64rpx;
  color: var(--color-text);
  font-size: 34rpx;
  line-height: 1;
}

.detail-nav__back--hover {
  opacity: 0.82;
}

.detail-nav__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  text-align: center;
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
.recommend-card__advice,
.recommend-footer__text,
.recommend-footer__action {
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
  padding-bottom: 8rpx;
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
