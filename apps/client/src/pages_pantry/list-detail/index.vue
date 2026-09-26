<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses"
    title=""
    full-screen
    :navbar-capsule-guard="true"
    :navbar-transparent="sessionStore.isLoggedIn"
    :navbar-placeholder="!sessionStore.isLoggedIn"
  >
    <template #navbar-center>
      <view class="detail-nav">
        <text class="detail-nav__title" :style="navTitleStyle">{{ detail?.name || "采购清单" }}</text>
      </view>
    </template>
    <template #navbar-right>
      <view v-if="canVoid" class="detail-nav-settings" hover-class="detail-nav-settings--hover" @click="openSettingsSheet">
        <text class="cookfont icon-manage detail-nav-settings__icon" />
      </view>
    </template>

    <view class="detail-page">
      <view class="detail-nav-backdrop" :style="navBackdropStyle" />
      <Empty
        v-if="!sessionStore.isLoggedIn"
        class="detail-empty"
        :art="emptyStateArt"
        title="登录后查看清单详情"
        description="顶部清单标题会继续保留；登录后再看采购进度、勾选和食材来源。"
        clickable
        @click="openLogin"
      />

      <template v-else-if="loading">
        <view class="notice">加载中...</view>
      </template>
      <view v-else-if="errorText" class="detail-empty">
        <Empty
          :art="emptyStateArt"
          clickable
          title="清单详情加载遇到问题"
          description="请检查网络后重新加载。"
          @click="loadDetail"
        />
      </view>
      <template v-else-if="!detail">
        <view class="detail-empty">
          <Empty
            :art="emptyStateArt"
            title="清单不存在"
            description="这张清单可能已删除、无权访问或分享链接已失效。"
          />
        </view>
      </template>

      <template v-else>
        <scroll-view scroll-y class="detail-scroll" :show-scrollbar="false" @scroll="handleScroll">
          <view class="detail-body">
            <view class="detail-hero" :style="heroStyle">
              <view class="detail-hero__title-row">
                <text class="detail-hero__title" :style="heroTitleStyle">{{ detail.name }}</text>
              </view>
              <text class="detail-hero__meta">{{ heroMeta }}</text>
              <view v-if="detailStatusTagText" class="detail-hero__tags">
                <text class="detail-hero__tag" :class="detailStatusTagClass">{{ detailStatusTagText }}</text>
              </view>
            </view>

            <view class="detail-content">
              <view class="detail-panel" :style="detailPanelStyle">
                <view class="summary-card">
                  <view class="summary-card__head">
                    <view class="summary-card__progress">
                      <text class="summary-card__progress-text">采购进度</text>
                      <text class="summary-card__progress-dot">·</text>
                      <text class="summary-card__progress-value">{{ progressText }}</text>
                      <template v-if="showCollaborationMeta">
                        <text class="summary-card__progress-dot">·</text>
                        <text class="summary-card__progress-meta">{{ collaborationText }}</text>
                      </template>
                    </view>
                    <text class="summary-card__percent">{{ progressPercent }}%</text>
                  </view>
                  <view class="progress-card__track">
                    <view class="progress-card__bar" :style="{ width: `${progressPercent}%` }" />
                  </view>
                </view>
                <view v-if="showEndedCard" class="store-card" :class="endedCardClass">
                  <view class="store-card__head">
                    <text class="store-card__title">{{ endedCardTitle }}</text>
                    <view v-if="canOpenPantryHome" class="store-card__button store-card__button--plain" @click="openPantryHome">
                      看看食材库
                    </view>
                  </view>
                  <view class="store-card__detail">
                    <text class="store-card__desc">{{ endedCardDesc }}</text>
                  </view>
                </view>
              </view>

              <transition-group v-if="groups.length" name="group-list" tag="view" class="group-list">
                <view v-for="group in groups" :key="group.key" class="group-card">
                  <view
                    class="item-swipe"
                    @touchstart="handleItemTouchStart(group.id, $event)"
                    @touchmove.stop="handleItemTouchMove($event)"
                    @touchend="handleItemTouchEnd"
                    @touchcancel="handleItemTouchEnd"
                  >
                    <view v-if="canEditItems" class="item-swipe__action" @click.stop="removeItem(group)">删除</view>
                    <view
                      class="item-swipe__content"
                      :class="{ 'item-swipe__content--dragging': swipeState.itemId === group.id }"
                      :style="itemSwipeStyle(group.id)"
                    >
                      <view class="item-card">
                        <view
                          v-if="canEditItems"
                          class="purchase-check"
                          :class="{
                            'purchase-check--checked': isItemChecked(group)
                          }"
                          role="checkbox"
                          :aria-label="group.name"
                          :aria-checked="isItemChecked(group)"
                          @click.stop="toggleItem(group)"
                        >
                          <text v-if="isItemChecked(group)" class="purchase-check__icon">✓</text>
                        </view>
                        <view class="item-row__main" @click="canEditItems ? toggleItem(group) : undefined">
                          <view class="item-row__left">
                            <view class="item-row__identity">
                              <text class="item-row__title">{{ group.name }}</text>
                              <text v-if="group.categoryName" class="item-row__category">· {{ group.categoryName }}</text>
                            </view>
                            <text class="item-row__quantity">{{ group.quantityText }}</text>
                          </view>
                          <view class="item-row__right" @click.stop="group.sources.length ? toggleItemOrigin(group.id) : undefined">
                            <text class="item-row__fridge-hint">{{ group.fridgeHint }}</text>
                            <view
                              v-if="group.sources.length"
                              class="item-row__origin-toggle"
                              :class="{ 'item-row__origin-toggle--open': isOriginOpen(group.id) }"
                            >
                              <text class="cookfont icon-back item-row__origin-arrow" :class="{ 'item-row__origin-arrow--open': isOriginOpen(group.id) }" />
                            </view>
                          </view>
                        </view>
                      </view>
                      <view
                        v-if="group.sources.length"
                        class="item-origin-wrap"
                        :class="{ 'item-origin-wrap--open': isOriginOpen(group.id) }"
                      >
                        <view class="item-origin-list">
                          <view
                            v-for="source in orderedGroupSources(group)"
                            :key="sourceEntryKey(source)"
                            class="item-origin"
                            :class="{ 'item-origin--link': canOpenSource(source) }"
                            @click.stop="openSource(source)"
                          >
                            <text class="item-origin__tag">{{ sourceTypeLabel(source.sourceType) }}</text>
                            <text class="item-origin__text">{{ sourceEntryText(source) }}</text>
                          </view>
                        </view>
                      </view>
                    </view>
                  </view>
                </view>
              </transition-group>

              <Empty v-else class="detail-content__empty" title="这张清单还没有食材" description="可以在页面底部添加食材。" />
            </view>
          </view>
        </scroll-view>

        <view v-if="canAddItem" class="detail-footer">
          <view class="meal-footer__actions">
            <view
              class="meal-footer__quick"
              :class="{ 'meal-footer__quick--disabled': submitting }"
              @click="submitting ? undefined : openAddSheet()"
            >
              <text class="cookfont meal-footer__quick-icon icon-add" />
              <text class="meal-footer__quick-label">添加食材</text>
            </view>
            <view class="meal-footer__buttons meal-footer__buttons--single">
              <button
                class="meal-footer__button meal-footer__button--primary"
                :class="{ 'meal-footer__button--disabled': !pendingCheckCount || submitting }"
                :disabled="!pendingCheckCount || submitting"
                hover-class="none"
                @click="submitPendingChecks"
              >
                <text class="meal-footer__button-content">{{ submitting ? "提交中..." : "提交勾选" }}</text>
              </button>
            </view>
          </view>
        </view>

        <view v-if="canShowManageDock" class="floating-dock" :class="{ 'floating-dock--above-footer': canAddItem }">
          <view v-if="manageMenuOpen" class="floating-dock__backdrop" @click="closeManageMenu" />
          <view class="manage-dock">
            <view class="manage-dock__actions">
              <view
                v-for="(action, index) in manageActions"
                :key="action.key"
                class="manage-dock__action"
                :class="{
                  'manage-dock__action--open': manageMenuOpen,
                  'manage-dock__action--danger': action.tone === 'danger'
                }"
                :style="manageActionStyle(index)"
                @click="handleManageAction(action.key)"
              >
                <text
                  class="cookfont manage-dock__action-icon"
                  :class="[action.iconClass, { 'manage-dock__action-icon--danger': action.tone === 'danger' }]"
                />
                <text class="manage-dock__action-label" :class="{ 'manage-dock__action-label--danger': action.tone === 'danger' }">
                  {{ action.label }}
                </text>
              </view>
            </view>
            <view class="manage-dock__button" hover-class="manage-dock__button--hover" hover-stay-time="100" @click="toggleManageMenu">
              <text class="cookfont icon-manage manage-dock__icon" :class="{ 'manage-dock__icon--open': manageMenuOpen }" />
            </view>
          </view>
        </view>
      </template>
    </view>

    <SheetShell :visible="settingsSheetVisible" title="清单设置" @close="closeSettingsSheet">
      <view v-if="canVoid" class="settings-action" :class="{ 'settings-action--disabled': submitting }" @click="handleSettingsVoid">
        <view class="settings-action__icon-wrap">
          <text class="cookfont icon-close settings-action__icon" />
        </view>
        <view class="settings-action__copy">
          <text class="settings-action__title">作废清单</text>
          <text class="settings-action__hint">结束这张清单，并移入已作废列表</text>
        </view>
      </view>
    </SheetShell>

    <SheetShell
      :visible="addSheetVisible"
      title="添加食材"
      subtitle="支持多选食材，加入后按需购买。"
      body-padding="none"
      @close="closeAddSheet"
      @after-close="handleAddSheetAfterClose"
    >
      <IngredientPickerContent
        hint-text="选择要加入清单的食材，可以一次添加多项。"
        v-model:keyword="ingredientKeyword"
        :search-mode="ingredientSearchMode"
        :search-loading="ingredientSearchLoading"
        :search-items="ingredientSearchItems"
        :loading="ingredientLoading"
        :category-items="ingredientOptions"
        :categories="ingredientCategories"
        :category-id="ingredientCategoryId"
        :all-active="ingredientAllActive"
        :source-filter="ingredientSourceFilter"
        :show-personal-actions="false"
        :selected-ids="selectedIngredientIds"
        :selected-items="selectedIngredients"
        :existing-ids="existingIngredientIds"
        :footer-text="ingredientFooterText"
        :error-text="ingredientErrorText"
        empty-text="没有符合条件的食材。"
        :show-empty-create="false"
        :show-search-create="false"
        :confirm-disabled="!selectedIngredients.length || submitting"
        :confirm-text="submitting ? '添加中...' : `添加 ${selectedIngredients.length} 项`"
        :main-style="{ height: '320px' }"
        @search="searchIngredients"
        @clear-search="exitIngredientSearch"
        @clear-category="clearIngredientCategory"
        @change-source="changeIngredientSourceFilter"
        @change-category="changeIngredientCategory"
        @load-more="loadMoreIngredients"
        @toggle="selectIngredient"
        @remove="removeSelectedIngredient"
        @confirm="createItems"
      />
    </SheetShell>

    <InviteShareSheet
      :visible="shareSheetVisible"
      :title="shareSheetTitle"
      :subtitle="shareSheetSubtitle"
      single-share
      :friend-action="shareFriendAction"
      :error-text="shareLinkError"
      :show-close-action="canCloseShare"
      close-action-text="关闭分享"
      :close-action-disabled="submitting"
      @close="closeShareSheet"
      @friend="handleShareFriendClick"
      @close-action="closeShare"
    >
      <template #title-extra>
        <view class="sheet-help" @click.stop="openShareNotice">
          <text class="cookfont icon-qa sheet-help__icon" />
        </view>
      </template>
      <template #header>
        <view v-if="shareActive && detail" class="collaborator-strip">
          <view class="collaborator-strip__list">
            <view v-for="member in shareCollaborators" :key="member.userId" class="collaborator-chip">
              <view class="collaborator-chip__avatar-wrap">
                <image v-if="member.user.avatarUrl" class="collaborator-chip__avatar-image" :src="member.user.avatarUrl" mode="aspectFill" />
                <view v-else class="collaborator-chip__avatar">{{ shareAvatarText(member) }}</view>
                <view
                  v-if="canRemoveShareMember(member)"
                  class="collaborator-chip__remove"
                  @click.stop="removeShareMember(member)"
                >
                  <text class="cookfont icon-close collaborator-chip__remove-icon" />
                </view>
              </view>
              <text class="collaborator-chip__name">{{ shareMemberName(member) }}</text>
            </view>
            <view v-for="slot in shareEmptySlots" :key="`slot-${slot}`" class="collaborator-chip collaborator-chip--ghost">
              <view class="collaborator-chip__avatar collaborator-chip__avatar--ghost">+</view>
              <text class="collaborator-chip__name collaborator-chip__name--ghost">虚位待入</text>
            </view>
          </view>
          <text v-if="sharePendingText" class="collaborator-strip__hint">{{ sharePendingText }}</text>
        </view>
      </template>
    </InviteShareSheet>

    <SheetShell
      :visible="shareNoticeVisible"
      title="清单协作说明"
      @close="closeShareNotice"
    >
      <view class="sheet-facts">
        <view class="sheet-facts__item">
          <text class="sheet-facts__label">协作人数</text>
          <text class="sheet-facts__value">{{ shareNoticeLimitText }}</text>
        </view>
        <view class="sheet-facts__item">
          <text class="sheet-facts__label">加入方式</text>
          <text class="sheet-facts__value">直接转发给好友，对方确认后才会加入。</text>
        </view>
        <view class="sheet-facts__item">
          <text class="sheet-facts__label">关闭分享</text>
          <text class="sheet-facts__value">关闭后，好友入口和待确认邀请会失效，新的协作者不能再加入。</text>
        </view>
      </view>
    </SheetShell>

  </Layout>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { onLoad, onShareAppMessage, onShow } from "@dcloudio/uni-app";
import emptyStateArt from "@/assets/empty.png";
import type { UUID } from "@/apis/http";
import { recipeApi, type IngredientCategorySummary, type IngredientSummary } from "@/apis/recipe";
import { fridgeApi, type FridgeTraceSummary } from "../apis/fridge";
import Empty from "@/components/Empty/Empty.vue";
import IngredientPickerContent from "@/components/Ingredient/IngredientPickerContent.vue";
import Layout from "@/components/Layout/Layout.vue";
import InviteShareSheet from "@/components/Share/InviteShareSheet.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useLoginEmptyState } from "@/composables/useLoginEmptyState";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { createOperationId } from "@/utils/operation-id";
import { formatMonthDay } from "../utils/date";
import { loadAllFridgeTraces } from "../utils/fridge-traces";
import {
  shoppingApi,
  type ShoppingListCollaborator,
  type ShoppingListDetail,
  type ShoppingListDetailItem,
  type ShoppingItemSourceSummary,
  type ShoppingListItemPatchResponse
} from "../apis/shopping";

type DetailAction = "" | "share";
type ManageActionKey = "share" | "restore" | "delete" | "leave";

interface GroupView {
  key: string;
  id: string;
  items: ShoppingListDetailItem[];
  name: string;
  categoryName: string | null;
  quantityText: string;
  fridgeHint: string;
  checkedAt: string | null;
  sources: ShoppingItemSourceSummary[];
}

const NAV_FADE_DISTANCE = 132;
const SWIPE_DELETE_WIDTH = typeof uni !== "undefined" && typeof uni.upx2px === "function" ? uni.upx2px(156) : 78;

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();
const { openLogin } = useLoginEmptyState(handleLoginSuccess);
const userStore = useUserStore();

const listId = ref<UUID | "">("");
const pendingAction = ref<DetailAction>("");
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const detail = ref<ShoppingListDetail | null>(null);
const fridgeStates = ref<FridgeTraceSummary[]>([]);

const addSheetVisible = ref(false);
const ingredientLoading = ref(false);
const ingredientKeyword = ref("");
const ingredientErrorText = ref("");
const ingredientOptions = ref<IngredientSummary[]>([]);
const ingredientCategories = ref<IngredientCategorySummary[]>([]);
const ingredientCategoryId = ref<UUID | "">("");
const ingredientSourceFilter = ref<"ALL" | "PERSONAL">("ALL");
const ingredientPage = ref(1);
const ingredientHasNext = ref(false);
const ingredientLoadingMore = ref(false);
const ingredientRequestSeed = ref(0);
const ingredientLoadedKeyword = ref("");
const ingredientSearchPending = ref(false);
let ingredientSearchTimer: ReturnType<typeof setTimeout> | null = null;
const selectedIngredients = ref<IngredientSummary[]>([]);
const pendingCheckValues = ref<Record<string, boolean>>({});
const settingsSheetVisible = ref(false);
const shareSheetVisible = ref(false);
const shareNoticeVisible = ref(false);
const shareUrl = ref("");
const shareLinkLoading = ref(false);
const shareLinkError = ref("");
const scrollTop = ref(0);
const manageMenuOpen = ref(false);
const openSwipeItemId = ref<string>("");
const itemPendingId = ref<string>("");
const itemPendingAction = ref<"" | "remove">("");
const openOriginItemIds = ref<string[]>([]);
const swipeState = reactive({
  itemId: "",
  startX: 0,
  startY: 0,
  startOffset: 0,
  offset: 0,
  axis: "" as "" | "x" | "y"
});

const groups = computed<GroupView[]>(() => {
  const source = (detail.value?.items ?? []).filter(item => item.status !== "REMOVED");
  const bucket = new Map<string, ShoppingListDetailItem[]>();
  source.forEach((item) => {
    const key = buildGroupKey(item);
    const current = bucket.get(key) ?? [];
    current.push(item);
    bucket.set(key, current);
  });
  return [...bucket.entries()]
    .map(([key, items]) => buildGroupView(key, items));
});
const ingredientSearchMode = computed(() => Boolean(ingredientKeyword.value.trim()));
const ingredientSearchLoading = computed(() => ingredientSearchMode.value && (ingredientSearchPending.value || ingredientLoading.value));
const ingredientSearchItems = computed(() => ingredientLoadedKeyword.value === ingredientKeyword.value.trim() ? ingredientOptions.value : []);
const ingredientAllActive = computed(() => ingredientSourceFilter.value === "ALL" && !ingredientCategoryId.value);
const selectedIngredientIds = computed(() => selectedIngredients.value.map(item => item.id));
const existingIngredientIds = computed(() => [...new Set(
  (detail.value?.items ?? [])
    .filter(item => item.status !== "REMOVED" && item.ingredientId !== null)
    .map(item => item.ingredientId as UUID)
)]);
const ingredientFooterText = computed(() => {
  if (ingredientLoadingMore.value) return "加载中...";
  return ingredientHasNext.value ? "上滑加载更多" : "";
});
const pendingCheckCount = computed(() => {
  if (!detail.value) return 0;
  return detail.value.items.filter(item => {
    const pendingValue = pendingCheckValues.value[item.id];
    return pendingValue !== undefined && pendingValue !== isPersistedItemChecked(item);
  }).length;
});

watch(ingredientKeyword, () => {
  if (!addSheetVisible.value) return;
  if (ingredientSearchTimer) clearTimeout(ingredientSearchTimer);
  ingredientSearchPending.value = Boolean(ingredientKeyword.value.trim());
  ingredientSearchTimer = setTimeout(() => {
    ingredientSearchTimer = null;
    void loadIngredientOptions(true);
  }, 280);
});

const navProgress = computed(() => Math.min(1, Math.max(0, scrollTop.value / NAV_FADE_DISTANCE)));
const navTitleStyle = computed(() => ({
  opacity: sessionStore.isLoggedIn ? `${navProgress.value}` : "1"
}));
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: `${navProgress.value}`
}));
const heroStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + 12}px`
}));
const detailPanelStyle = computed(() => ({
  top: `${navBarTotalHeight.value + 12}px`
}));
const heroTitleStyle = computed(() => ({
  opacity: `${1 - navProgress.value * 0.56}`
}));
const progressTotalCount = computed(() => groups.value.length);
const progressDoneCount = computed(() => groups.value.filter(group => isGroupResolved(group)).length);
const progressPercent = computed(() => {
  if (!progressTotalCount.value) return 0;
  return Math.min(100, Math.round((progressDoneCount.value / progressTotalCount.value) * 100));
});
const progressText = computed(() => {
  return `${progressDoneCount.value}/${progressTotalCount.value}`;
});
const collaborationText = computed(() => {
  if (!detail.value) return "0/0人协作";
  return `${detail.value.memberCount}/${detail.value.memberLimit}人协作`;
});
const showCollaborationMeta = computed(() => (detail.value?.memberCount ?? 0) > 1);
const heroMeta = computed(() => {
  if (detail.value?.status === "COMPLETED") return "这一趟采购已经收好尾，买回来的食材也都安顿好了。";
  if (detail.value?.status === "VOIDED") return "这张清单先放一放，需要时随时可以回来继续采购。";
  return "把想买的食材记在这里，逛一圈就能安心带齐。";
});
const detailStatusTagText = computed(() => {
  if (detail.value?.status === "COMPLETED") return "已完成";
  if (detail.value?.status === "VOIDED") return "已作废";
  return "";
});
const detailStatusTagClass = computed(() => {
  if (detail.value?.status === "COMPLETED") return "detail-hero__tag--done";
  if (detail.value?.status === "VOIDED") return "detail-hero__tag--voided";
  return "";
});
const showEndedCard = computed(() => detail.value?.status === "COMPLETED" || detail.value?.status === "VOIDED");
const canOpenPantryHome = computed(() => detail.value?.status === "COMPLETED");
const endedCardClass = computed(() => {
  if (detail.value?.status === "COMPLETED") return "store-card--done";
  if (detail.value?.status === "VOIDED") return "store-card--voided";
  return "";
});
const endedCardTitle = computed(() => {
  if (detail.value?.status === "COMPLETED") return "这一趟采购完成啦";
  if (detail.value?.status === "VOIDED") return "这张清单先放一放";
  return "";
});
const endedCardDesc = computed(() => {
  if (!detail.value) return "";
  if (detail.value.status === "COMPLETED") {
    const dayText = detail.value.completedAt ? formatMonthDay(detail.value.completedAt) : "刚刚";
    return `${dayText} 完成了这次采购，买回来的食材都可以在食材库里找到。`;
  }
  if (detail.value.status === "VOIDED") {
    const dayText = detail.value.voidedAt ? formatMonthDay(detail.value.voidedAt) : "刚刚";
    return `${dayText} 暂停了这次采购，需要时随时可以恢复继续买。`;
  }
  return "";
});
const showShoppingShareEntrances = false;
const canOpenShare = computed(() => showShoppingShareEntrances && detail.value?.role === "OWNER" && detail.value.status === "ACTIVE");
const canVoid = computed(() => detail.value?.role === "OWNER" && detail.value.status === "ACTIVE");
const canRestore = computed(() => detail.value?.role === "OWNER" && detail.value.status === "VOIDED");
const canDelete = computed(() => detail.value?.role === "OWNER" && (detail.value.status === "COMPLETED" || detail.value.status === "VOIDED"));
const canLeave = computed(() => detail.value?.role === "COLLABORATOR");
const canEditItems = computed(() => Boolean(detail.value) && detail.value?.status === "ACTIVE");
const canAddItem = computed(() => Boolean(detail.value) && detail.value?.status === "ACTIVE");
const manageActions = computed(() => {
  const actions: Array<{ key: ManageActionKey; label: string; iconClass: string; tone?: "default" | "danger" }> = [];
  if (canOpenShare.value) actions.push({ key: "share", label: "协作", iconClass: "icon-share", tone: "default" });
  if (canRestore.value) actions.push({ key: "restore", label: "恢复采购", iconClass: "icon-back", tone: "default" });
  if (canDelete.value) actions.push({ key: "delete", label: "删除清单", iconClass: "icon-close", tone: "danger" });
  if (canLeave.value) actions.push({ key: "leave", label: "退出共享", iconClass: "icon-close", tone: "danger" });
  return actions;
});
const canShowManageDock = computed(() => manageActions.value.length > 0);
const shareActive = computed(() => Boolean(detail.value && (detail.value.memberCount > 1 || detail.value.pendingInviteCount > 0)));
const canUseShareFeature = computed(() => userStore.profile?.membership?.tier !== "FREE");
const shareMemberFull = computed(() => {
  if (!detail.value) return false;
  return detail.value.memberCount >= detail.value.memberLimit;
});
const shareCollaborators = computed(() => detail.value?.collaborators ?? []);
const shareEmptySlots = computed(() => {
  if (!detail.value) return [];
  const remain = Math.max(detail.value.memberLimit - shareCollaborators.value.length, 0);
  return Array.from({ length: remain }, (_, index) => index + 1);
});
const sharePendingText = computed(() => {
  if (!detail.value?.pendingInviteCount) return "";
  return `当前还有 ${detail.value.pendingInviteCount} 位待确认。`;
});
const shareSheetTitle = computed(() => "清单协作");
const shareSheetSubtitle = computed(() => {
  if (!detail.value) return "直接转发给好友，对方确认后一起维护。";
  if (shareActive.value) return `最多 ${detail.value.memberLimit} 人协作，先加入者优先。`;
  return "会生成好友分享入口，对方确认后加入。";
});
const canCloseShare = computed(() => detail.value?.role === "OWNER" && detail.value?.status === "ACTIVE" && shareActive.value);
const shareFriendDisabled = computed(() => !canUseShareFeature.value || shareMemberFull.value || shareLinkLoading.value || !shareUrl.value);
const shareFriendCardHint = computed(() => {
  if (!canUseShareFeature.value) return "协作分享属于会员权益，开通会员后可邀请一起维护。";
  if (shareMemberFull.value) return "当前协作者名额已满，暂时不能再通过好友加入。";
  if (shareLinkLoading.value) return "正在准备好友分享入口...";
  return "直接转发给好友，对方打开后确认加入。";
});
const shareFriendAction = computed(() => ({
  label: "分享给好友",
  hint: shareFriendCardHint.value,
  disabled: canUseShareFeature.value && (shareMemberFull.value || shareLinkLoading.value || !shareUrl.value),
  muted: shareFriendDisabled.value,
  openType: shareFriendOpenType()
}));
const shareNoticeLimitText = computed(() => {
  if (!detail.value) return "当前只支持小范围协作，先加入者优先。";
  return `当前最多支持 ${detail.value.memberLimit} 人一起维护，先加入者优先。`;
});
onShareAppMessage(() => ({
  title: detail.value?.name ? `${detail.value.name}，一起补齐这顿饭` : "邀请你一起维护采购清单",
  path: shareUrl.value || "/pages_pantry/list/index"
}));

onLoad((query) => {
  const rawId = Array.isArray(query?.id) ? query.id[0] : query?.id;
  const nextAction = Array.isArray(query?.action) ? query.action[0] : query?.action;
  listId.value = rawId ? Number(rawId) || "" : "";
  pendingAction.value = nextAction === "share" ? nextAction : "";
});

onShow(() => {
  if (!sessionStore.isLoggedIn || !listId.value) return;
  void loadDetail();
});

async function handleLoginSuccess() {
  await loadDetail();
}

function loadDetail() {
  return requestDetail();
}

async function requestDetail(options?: { silent?: boolean }) {
  const silent = options?.silent === true;
  if (!sessionStore.isLoggedIn || !listId.value || loading.value) return;
  if (!silent) {
    loading.value = true;
    errorText.value = "";
  }
  try {
    const [nextDetail, nextFridgeStates] = await Promise.all([
      shoppingApi.getListDetail(listId.value),
      loadAllFridgeTraces((page, pageSize) => fridgeApi.list(page, pageSize))
    ]);
    if (!silent) pendingCheckValues.value = {};
    detail.value = nextDetail;
    fridgeStates.value = nextFridgeStates;
    syncGroupUiState(detail.value.items);
    handlePendingAction();
  } catch (error) {
    if (silent) {
      throw error;
    }
    errorText.value = error instanceof Error ? error.message : "清单详情加载失败";
  } finally {
    if (!silent) {
      loading.value = false;
    }
  }
}

function handlePendingAction() {
  if (!pendingAction.value || !detail.value) return;
  const action = pendingAction.value;
  pendingAction.value = "";
  if (action === "share" && canOpenShare.value) {
    openShareSheet();
  }
}

function goBack() {
  void uniPlatform.navigation.navigateBack().catch(() => {
    void uniPlatform.navigation.navigateTo("/pages_pantry/list/index");
  });
}

function openPantryHome() {
  if (submitting.value) return;
  closeManageMenu();
  void uniPlatform.navigation.navigateTo("/pages_pantry/index/index");
}

function handleScroll(event: { detail: { scrollTop?: number } }) {
  scrollTop.value = event.detail.scrollTop ?? 0;
}

function isOriginOpen(itemId: string) {
  return openOriginItemIds.value.includes(itemId);
}

function toggleItemOrigin(itemId: string) {
  if (isOriginOpen(itemId)) {
    openOriginItemIds.value = openOriginItemIds.value.filter(currentId => currentId !== itemId);
    return;
  }
  openOriginItemIds.value = [...openOriginItemIds.value, itemId];
}

function isItemChecked(group: GroupView) {
  return group.items.length > 0 && group.items.every(item => {
    return pendingCheckValues.value[item.id] ?? isPersistedItemChecked(item);
  });
}

function isPersistedItemChecked(item: ShoppingListDetailItem) {
  return item.status === "CHECKED" || Boolean(item.checkedAt);
}

function isGroupResolved(group: GroupView) {
  return group.items.every(item => pendingCheckValues.value[item.id] ?? isResolvedItem(item));
}

function isResolvedItem(item: ShoppingListDetailItem) {
  return item.status === "CHECKED"
    || Boolean(item.checkedAt);
}

function applyItemPatch(patch: ShoppingListItemPatchResponse) {
  if (!detail.value || detail.value.id !== patch.listId) return;

  const nextItems = [...detail.value.items];
  if (patch.removedItemId !== null) {
    const removedIndex = nextItems.findIndex(item => item.id === patch.removedItemId);
    if (removedIndex >= 0) {
      nextItems.splice(removedIndex, 1);
    }
  }
  if (patch.item) {
    const patchedItem = patch.item;
    const targetIndex = nextItems.findIndex(item => item.id === patchedItem.id);
    if (targetIndex >= 0) {
      nextItems.splice(targetIndex, 1, patchedItem);
    } else {
      nextItems.unshift(patchedItem);
    }
  }

  detail.value = {
    ...detail.value,
    version: patch.version,
    progressDoneCount: patch.progressDoneCount,
    progressTotalCount: patch.progressTotalCount,
    items: nextItems
  };
  syncGroupUiState(nextItems);
}

function itemSwipeStyle(itemId: string) {
  const offset = swipeState.itemId === itemId
    ? swipeState.offset
    : openSwipeItemId.value === itemId
      ? -SWIPE_DELETE_WIDTH
      : 0;
  return {
    transform: `translateX(${offset}px)`
  };
}

type ItemTouchEvent = {
  touches?: ArrayLike<{ pageX: number; pageY: number }>;
  changedTouches?: ArrayLike<{ pageX: number; pageY: number }>;
};

function readTouch(event: ItemTouchEvent) {
  return event.touches?.[0] ?? event.changedTouches?.[0] ?? null;
}

function resetSwipeState() {
  swipeState.itemId = "";
  swipeState.startX = 0;
  swipeState.startY = 0;
  swipeState.startOffset = 0;
  swipeState.offset = 0;
  swipeState.axis = "";
}

function handleItemTouchStart(itemId: string, event: ItemTouchEvent) {
  if (!canEditItems.value) return;
  const touch = readTouch(event);
  if (!touch) return;
  if (openSwipeItemId.value && openSwipeItemId.value !== itemId) {
    openSwipeItemId.value = "";
  }
  swipeState.itemId = itemId;
  swipeState.startX = touch.pageX;
  swipeState.startY = touch.pageY;
  swipeState.startOffset = openSwipeItemId.value === itemId ? -SWIPE_DELETE_WIDTH : 0;
  swipeState.offset = swipeState.startOffset;
  swipeState.axis = "";
}

function handleItemTouchMove(event: ItemTouchEvent) {
  if (!canEditItems.value || !swipeState.itemId) return;
  const touch = readTouch(event);
  if (!touch) return;
  const deltaX = touch.pageX - swipeState.startX;
  const deltaY = touch.pageY - swipeState.startY;
  if (!swipeState.axis) {
    if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
    swipeState.axis = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
  }
  if (swipeState.axis !== "x") return;
  swipeState.offset = Math.min(0, Math.max(-SWIPE_DELETE_WIDTH, swipeState.startOffset + deltaX));
}

function handleItemTouchEnd() {
  if (!swipeState.itemId) return;
  if (swipeState.axis === "x") {
    openSwipeItemId.value = Math.abs(swipeState.offset) > SWIPE_DELETE_WIDTH / 2 ? swipeState.itemId : "";
  }
  resetSwipeState();
}

function toggleItem(group: GroupView) {
  if (!detail.value || submitting.value || itemPendingId.value) return;
  openSwipeItemId.value = "";
  const targetChecked = !isItemChecked(group);
  const nextValues = { ...pendingCheckValues.value };
  for (const item of group.items) {
    if (targetChecked === isPersistedItemChecked(item)) {
      delete nextValues[item.id];
    } else {
      nextValues[item.id] = targetChecked;
    }
  }
  pendingCheckValues.value = nextValues;
}

async function submitPendingChecks() {
  if (!detail.value || submitting.value || !pendingCheckCount.value) return;
  const changes = detail.value.items.flatMap(item => {
    const checked = pendingCheckValues.value[item.id];
    return checked === undefined || checked === isPersistedItemChecked(item)
      ? []
      : [{ itemId: item.id, checked }];
  });
  if (!changes.length) {
    pendingCheckValues.value = {};
    return;
  }

  submitting.value = true;
  try {
    const current = detail.value;
    const updated = await shoppingApi.checkListItems(current.id, {
      operationId: createOperationId(),
      version: current.version,
      items: changes
    });
    const updatedById = new Map(updated.items.map(item => [item.id, item]));
    detail.value = {
      ...updated,
      items: current.items.map(item => updatedById.get(item.id) ?? item)
    };
    pendingCheckValues.value = {};
    syncGroupUiState(detail.value.items);
    await uniPlatform.feedback.toast({ title: "勾选已提交", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "提交失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function removeItem(group: GroupView) {
  if (!detail.value || submitting.value || itemPendingId.value) return;
  openSwipeItemId.value = "";
  const confirmed = await uniPlatform.feedback.confirm({
    title: "移出食材",
    content: "移出后，这个食材会从当前有效采购项里消失。"
  });
  if (!confirmed) return;
  itemPendingId.value = group.id;
  itemPendingAction.value = "remove";
  try {
    const currentItems = getCurrentGroupItems(group.key);
    let changed = false;
    for (const currentItem of currentItems) {
      const patch = await shoppingApi.removeListItem(detail.value.id, currentItem.id, {
        operationId: createOperationId(),
        version: detail.value.version
      });
      applyItemPatch(patch);
      const nextValues = { ...pendingCheckValues.value };
      delete nextValues[currentItem.id];
      pendingCheckValues.value = nextValues;
      changed = true;
    }
    if (changed) {
      await refreshDetailSilently();
    }
    await uniPlatform.feedback.toast({ title: "已移出", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "移出失败", icon: "none" });
  } finally {
    itemPendingId.value = "";
    itemPendingAction.value = "";
  }
}

async function openAddSheet() {
  closeManageMenu();
  ingredientKeyword.value = "";
  ingredientCategoryId.value = "";
  ingredientSourceFilter.value = "ALL";
  selectedIngredients.value = [];
  ingredientErrorText.value = "";
  addSheetVisible.value = true;
  try {
    if (!ingredientCategories.value.length) {
      ingredientCategories.value = await recipeApi.listIngredientCategories();
    }
    await loadIngredientOptions(true);
  } catch (error) {
    ingredientErrorText.value = error instanceof Error ? error.message : "食材加载失败";
  }
}

function closeAddSheet() {
  addSheetVisible.value = false;
}

function buildGroupKey(item: Pick<ShoppingListDetailItem, "ingredientId" | "name" | "sources">) {
  return `${item.ingredientId || "none"}:${item.name.trim().toLowerCase()}`;
}

function buildGroupView(key: string, items: ShoppingListDetailItem[]): GroupView {
  const primary = items[0]!;
  const sources = mergeGroupSources(items);
  const checkedItems = items.map(item => item.checkedAt).filter((value): value is string => Boolean(value));
  const quantityText = buildGroupQuantityText(items);
  return {
    key,
    id: key,
    items,
    name: primary.name,
    categoryName: primary.categoryName,
    quantityText,
    fridgeHint: fridgeStateHint(primary.ingredientId, primary.name),
    checkedAt: items.every(item => Boolean(item.checkedAt))
      ? checkedItems.sort()[checkedItems.length - 1] ?? primary.checkedAt
      : null,
    sources
  };
}

function fridgeStateHint(ingredientId: UUID | null, name: string) {
  const normalizedName = name.trim().toLowerCase();
  const state = fridgeStates.value.find(item => ingredientId
    ? item.ingredientId === ingredientId
    : item.name.trim().toLowerCase() === normalizedName);
  if (!state || state.presence === "UNCONFIRMED") return "没有近期记录";
  if (state.presence === "EMPTY") return "已标记没有";
  return state.recentlyPurchased ? "最近买过" : "可能还有";
}

function mergeGroupSources(items: ShoppingListDetailItem[]) {
  const sourceMap = new Map<string, ShoppingItemSourceSummary>();
  for (const item of items) {
    for (const source of item.sources) {
      const key = [
        source.sourceType,
        source.planItemId ?? "",
        source.planDate ?? "",
        source.diningEventId ?? "",
        source.recipeId ?? "",
        source.recipeKind ?? "",
        source.sourceVersionId ?? "",
        source.sourceBatchKey ?? "",
        source.title ?? ""
      ].join(":");
      if (!sourceMap.has(key)) {
        sourceMap.set(key, source);
      }
    }
  }
  return [...sourceMap.values()];
}

function sourceOrderValue(source: ShoppingItemSourceSummary) {
  if (source.sourceType === "EVENT") return 0;
  if (source.sourceType === "PLAN") return 1;
  if (source.sourceType === "RECIPE") return 2;
  return 3;
}

function orderedGroupSources(group: GroupView) {
  return [...group.sources].sort((left, right) => {
    const orderDiff = sourceOrderValue(left) - sourceOrderValue(right);
    if (orderDiff !== 0) return orderDiff;
    return sourceEntryText(left).localeCompare(sourceEntryText(right), "zh-Hans-CN");
  });
}

function sourceEntryKey(source: ShoppingItemSourceSummary) {
  return [
    source.sourceType,
    source.planItemId ?? "",
    source.planDate ?? "",
    source.diningEventId ?? "",
    source.recipeId ?? "",
    source.recipeKind ?? "",
    source.sourceVersionId ?? "",
    source.sourceBatchKey ?? "",
    source.title ?? ""
  ].join(":");
}

function sourceTypeLabel(sourceType: ShoppingItemSourceSummary["sourceType"]) {
  if (sourceType === "EVENT") return "饭局";
  if (sourceType === "PLAN") return "计划";
  if (sourceType === "RECIPE") return "食谱";
  if (sourceType === "RANDOM_MENU") return "随机";
  if (sourceType === "BRING") return "带菜";
  return "其他";
}

function sourceEntryText(source: ShoppingItemSourceSummary) {
  const title = source.title?.trim();
  if (title) return title;
  if (source.sourceType === "EVENT") return "这场饭局";
  if (source.sourceType === "PLAN") return "这顿餐次";
  if (source.sourceType === "RECIPE") return "这道菜谱";
  return "手动添加";
}

function canOpenSource(source: ShoppingItemSourceSummary) {
  if (source.diningEventId && source.planItemId && source.planDate) return true;
  if (source.planItemId && source.planDate) return true;
  return Boolean(source.recipeId && source.recipeKind);
}

function openSource(source: ShoppingItemSourceSummary) {
  if (!canOpenSource(source)) return;
  if (source.diningEventId && source.planItemId && source.planDate) {
    void uniPlatform.navigation.navigateTo(
      `/pages_meal/detail/index?planItemId=${encodeURIComponent(String(source.planItemId))}&planDate=${encodeURIComponent(source.planDate)}&eventId=${encodeURIComponent(String(source.diningEventId))}`
    );
    return;
  }
  if (source.planItemId && source.planDate) {
    void uniPlatform.navigation.navigateTo(
      `/pages_meal/detail/index?planItemId=${encodeURIComponent(String(source.planItemId))}&planDate=${encodeURIComponent(source.planDate)}`
    );
    return;
  }
  if (source.recipeId && source.recipeKind) {
    void uniPlatform.navigation.navigateTo(
      `/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(source.recipeId))}&kind=${encodeURIComponent(source.recipeKind)}`
    );
  }
}

function manageActionStyle(index: number) {
  const total = manageActions.value.length;
  return {
    transitionDelay: manageMenuOpen.value ? `${index * 46}ms` : `${(total - index - 1) * 28}ms`
  };
}

function buildGroupQuantityText(items: ShoppingListDetailItem[]) {
  if (!items.length) return "按需购买";
  const lines = collectDistinctQuantityLines(items.map(item => item.quantityText));
  if (lines.length !== 1 || !parseExactQuantityText(lines[0] ?? "")) return "按需购买";
  return `本次约需 ${lines[0]}`;
}

function parseExactQuantityText(value: string) {
  const match = value.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*(.+)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unitText = match[2]?.trim();
  if (!Number.isFinite(amount) || !unitText) return null;
  return {
    amount,
    unitText,
    unitKey: unitText.toLowerCase()
  };
}

function formatQuantityNumber(value: number) {
  const normalized = Math.round((value + Number.EPSILON) * 1000) / 1000;
  return normalized.toFixed(3).replace(/\.?0+$/, "");
}

function collectDistinctQuantityLines(values: Array<string | null | undefined>) {
  const exactOrder: string[] = [];
  const exactMap = new Map<string, { unit: string; total: number }>();
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const value of values) {
    const text = value?.trim();
    if (!text) continue;
    const parsed = parseExactQuantityText(text);
    if (parsed) {
      const current = exactMap.get(parsed.unitKey);
      if (!current) {
        exactOrder.push(parsed.unitKey);
        exactMap.set(parsed.unitKey, {
          unit: parsed.unitText,
          total: parsed.amount
        });
      } else {
        current.total += parsed.amount;
      }
      continue;
    }
    const lineKey = `text:${text}`;
    if (seen.has(lineKey)) continue;
    seen.add(lineKey);
    lines.push(text);
  }
  return exactOrder
    .map(unitKey => {
      const current = exactMap.get(unitKey)!;
      return `${formatQuantityNumber(current.total)} ${current.unit}`.trim();
    })
    .concat(lines);
}

function getCurrentGroupItems(groupKey: string) {
  return (detail.value?.items ?? []).filter(item => buildGroupKey(item) === groupKey);
}

function collectGroupKeys(items: ShoppingListDetailItem[]) {
  return new Set(items.filter(item => item.status !== "REMOVED").map(item => buildGroupKey(item)));
}

function syncGroupUiState(items: ShoppingListDetailItem[]) {
  const validGroupKeys = collectGroupKeys(items);
  openOriginItemIds.value = openOriginItemIds.value.filter(groupId => validGroupKeys.has(groupId));
  if (openSwipeItemId.value && !validGroupKeys.has(openSwipeItemId.value)) {
    openSwipeItemId.value = "";
  }
  if (itemPendingId.value && !validGroupKeys.has(itemPendingId.value)) {
    itemPendingId.value = "";
    itemPendingAction.value = "";
  }
}

async function refreshDetailSilently() {
  try {
    await requestDetail({ silent: true });
  } catch {
    // Keep the local patch result when the silent sync fails.
  }
}

function handleAddSheetAfterClose() {
  if (ingredientSearchTimer) clearTimeout(ingredientSearchTimer);
  ingredientSearchTimer = null;
  ingredientKeyword.value = "";
  ingredientCategoryId.value = "";
  ingredientSourceFilter.value = "ALL";
  ingredientErrorText.value = "";
  ingredientOptions.value = [];
  selectedIngredients.value = [];
}

async function loadIngredientOptions(reset: boolean) {
  if (!reset && (ingredientLoading.value || ingredientLoadingMore.value || !ingredientHasNext.value)) return;
  const requestId = ingredientRequestSeed.value + 1;
  ingredientRequestSeed.value = requestId;
  const keyword = ingredientKeyword.value.trim();
  const searchMode = Boolean(keyword);
  const nextPage = reset ? 1 : ingredientPage.value + 1;
  if (reset) {
    ingredientLoading.value = true;
    ingredientOptions.value = [];
    ingredientLoadedKeyword.value = "";
    ingredientSearchPending.value = searchMode;
  }
  else ingredientLoadingMore.value = true;
  ingredientErrorText.value = "";
  try {
    const result = await recipeApi.listIngredients({
      page: nextPage,
      pageSize: searchMode ? 20 : 48,
      keyword: keyword || undefined,
      categoryId: searchMode ? undefined : ingredientCategoryId.value || undefined,
      source: searchMode ? undefined : ingredientSourceFilter.value
    });
    if (requestId !== ingredientRequestSeed.value) return;
    ingredientPage.value = result.page;
    ingredientHasNext.value = result.hasNext;
    ingredientLoadedKeyword.value = keyword;
    ingredientSearchPending.value = false;
    if (reset) {
      ingredientOptions.value = result.items;
    } else {
      const itemMap = new Map(ingredientOptions.value.map(item => [item.id, item]));
      result.items.forEach(item => itemMap.set(item.id, item));
      ingredientOptions.value = Array.from(itemMap.values());
    }
  } catch (error) {
    if (requestId === ingredientRequestSeed.value) {
      ingredientErrorText.value = error instanceof Error ? error.message : "食材加载失败";
      ingredientSearchPending.value = false;
    }
  } finally {
    if (requestId === ingredientRequestSeed.value) {
      ingredientLoading.value = false;
      ingredientLoadingMore.value = false;
    }
  }
}

function searchIngredients() {
  if (ingredientSearchTimer) clearTimeout(ingredientSearchTimer);
  ingredientSearchTimer = null;
  void loadIngredientOptions(true);
}

function exitIngredientSearch() {
  if (ingredientSearchTimer) clearTimeout(ingredientSearchTimer);
  ingredientSearchTimer = null;
  ingredientKeyword.value = "";
}

function clearIngredientCategory() {
  ingredientCategoryId.value = "";
  ingredientSourceFilter.value = "ALL";
  void loadIngredientOptions(true);
}

function changeIngredientCategory(categoryId: UUID) {
  ingredientCategoryId.value = ingredientCategoryId.value === categoryId ? "" : categoryId;
  void loadIngredientOptions(true);
}

function changeIngredientSourceFilter(source: "PERSONAL") {
  ingredientSourceFilter.value = ingredientSourceFilter.value === source ? "ALL" : source;
  void loadIngredientOptions(true);
}

function loadMoreIngredients() {
  void loadIngredientOptions(false);
}

function selectIngredient(ingredientId: UUID) {
  if (isIngredientAlreadyInList(ingredientId)) return;
  const selectedIndex = selectedIngredients.value.findIndex(item => item.id === ingredientId);
  const ingredient = ingredientOptions.value.find(item => item.id === ingredientId);
  if (!ingredient) return;
  if (selectedIndex >= 0) {
    selectedIngredients.value = selectedIngredients.value.filter(item => item.id !== ingredientId);
    return;
  }
  selectedIngredients.value = [...selectedIngredients.value, ingredient];
}

function removeSelectedIngredient(ingredientId: UUID) {
  selectedIngredients.value = selectedIngredients.value.filter(item => item.id !== ingredientId);
}

function isIngredientAlreadyInList(ingredientId: UUID) {
  return Boolean(
    detail.value?.items.some(item => item.status !== "REMOVED" && item.ingredientId === ingredientId)
  );
}

async function createItems() {
  if (!detail.value || submitting.value || !selectedIngredients.value.length) return;
  const selected = selectedIngredients.value.filter(item => !isIngredientAlreadyInList(item.id));
  if (!selected.length) {
    closeAddSheet();
    await uniPlatform.feedback.toast({ title: "食材已在清单中", icon: "none" });
    return;
  }
  submitting.value = true;
  try {
    let nextDetail = detail.value;
    for (const ingredient of selected) {
      nextDetail = await shoppingApi.createListItem(nextDetail.id, {
        operationId: createOperationId(),
        name: ingredient.name,
        ingredientId: ingredient.id,
        quantityText: null,
        note: null
      });
    }
    detail.value = nextDetail;
    syncGroupUiState(nextDetail.items);
    closeAddSheet();
    await uniPlatform.feedback.toast({ title: `已添加 ${selected.length} 项`, icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "添加失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

function openShareSheet() {
  closeManageMenu();
  shareSheetVisible.value = true;
  shareLinkError.value = "";
  if (!shareMemberFull.value && !shareUrl.value) {
    void prepareShareLink(true);
  }
}

function closeShareSheet() {
  shareSheetVisible.value = false;
  shareNoticeVisible.value = false;
}

function openShareNotice() {
  if (!shareSheetVisible.value) return;
  shareNoticeVisible.value = true;
}

function closeShareNotice() {
  shareNoticeVisible.value = false;
}

async function handleShareFeatureLocked() {
  await uniPlatform.feedback.toast({ title: "协作分享属于会员权益，暂时仅会员可用", icon: "none" });
}

function shareAvatarText(member: ShoppingListCollaborator) {
  return member.user.nickname?.trim().slice(0, 1) || "协";
}

function shareMemberName(member: ShoppingListCollaborator) {
  if (member.user.uid === sessionStore.uid) return "我";
  return member.user.nickname?.trim() || `UID ${member.user.uid}`;
}

function canRemoveShareMember(member: ShoppingListCollaborator) {
  return Boolean(
    detail.value
    && detail.value.role === "OWNER"
    && detail.value.status === "ACTIVE"
    && member.role === "COLLABORATOR"
    && member.user.uid !== sessionStore.uid
  );
}

async function prepareShareLink(silent = false) {
  if (!detail.value || !canUseShareFeature.value || submitting.value || shareLinkLoading.value || shareMemberFull.value) return;
  shareLinkLoading.value = true;
  shareLinkError.value = "";
  try {
    const result = await shoppingApi.createShareLink(detail.value.id, {
      operationId: createOperationId(),
      version: detail.value.version
    });
    shareUrl.value = result.shareUrl;
    detail.value = await shoppingApi.getListDetail(detail.value.id);
  } catch (error) {
    shareLinkError.value = error instanceof Error ? error.message : "好友分享入口准备失败";
    if (!silent) {
      await uniPlatform.feedback.toast({ title: shareLinkError.value, icon: "none" });
    }
  } finally {
    shareLinkLoading.value = false;
  }
}

function shareFriendOpenType() {
  if (!canUseShareFeature.value || shareMemberFull.value || shareLinkLoading.value || !shareUrl.value) return "";
  return "share";
}

function handleShareFriendClick() {
  if (!canUseShareFeature.value) {
    void handleShareFeatureLocked();
  }
}

async function removeShareMember(member: ShoppingListCollaborator) {
  if (!detail.value || !canRemoveShareMember(member) || submitting.value) return;
  const confirmed = await uniPlatform.feedback.confirm({
    title: "移除协作者",
    content: `移除后，${shareMemberName(member)} 将失去这张清单的协作权限。`
  });
  if (!confirmed) return;
  submitting.value = true;
  try {
    detail.value = await shoppingApi.removeListMember(detail.value.id, member.userId, {
      operationId: createOperationId(),
      version: detail.value.version
    });
    await uniPlatform.feedback.toast({ title: "已移除", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "移除失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function closeShare() {
  if (!detail.value || !canCloseShare.value || submitting.value) return;
  const confirmed = await uniPlatform.feedback.confirm({
    title: "关闭共享",
    content: "关闭后，好友链接和待确认邀请都会失效，新的协作者不能再加入。"
  });
  if (!confirmed) return;
  submitting.value = true;
  try {
    detail.value = await shoppingApi.closeShare(detail.value.id, {
      operationId: createOperationId(),
      version: detail.value.version
    });
    shareUrl.value = "";
    shareLinkError.value = "";
    closeShareSheet();
    await uniPlatform.feedback.toast({ title: "已关闭共享", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "操作失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

function toggleManageMenu() {
  if (!canShowManageDock.value) return;
  manageMenuOpen.value = !manageMenuOpen.value;
}

function closeManageMenu() {
  manageMenuOpen.value = false;
}

function handleManageShare() {
  openShareSheet();
}

async function handleManageRestore() {
  closeManageMenu();
  await restoreList();
}

async function handleManageDelete() {
  closeManageMenu();
  await deleteList();
}

async function handleManageLeave() {
  closeManageMenu();
  await leaveList();
}

async function handleManageAction(action: ManageActionKey) {
  if (action === "share") {
    handleManageShare();
    return;
  }
  if (action === "restore") {
    await handleManageRestore();
    return;
  }
  if (action === "delete") {
    await handleManageDelete();
    return;
  }
  await handleManageLeave();
}

async function voidList() {
  if (!detail.value || submitting.value) return;
  const confirmed = await uniPlatform.feedback.confirm({
    title: "作废清单",
    content: "作废后会结束当前共享，并把这张清单移到已作废列表。"
  });
  if (!confirmed) return;
  submitting.value = true;
  try {
    detail.value = await shoppingApi.voidList(detail.value.id, {
      operationId: createOperationId(),
      version: detail.value.version
    });
    await uniPlatform.feedback.toast({ title: "已作废", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "操作失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

function openSettingsSheet() {
  if (canVoid.value) settingsSheetVisible.value = true;
}

function closeSettingsSheet() {
  settingsSheetVisible.value = false;
}

async function handleSettingsVoid() {
  if (submitting.value || !canVoid.value) return;
  closeSettingsSheet();
  await voidList();
}

async function restoreList() {
  if (!detail.value || submitting.value) return;
  submitting.value = true;
  try {
    detail.value = await shoppingApi.restoreList(detail.value.id, {
      operationId: createOperationId(),
      version: detail.value.version
    });
    await uniPlatform.feedback.toast({ title: "已恢复采购", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "恢复失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function deleteList() {
  if (!detail.value || submitting.value) return;
  const confirmed = await uniPlatform.feedback.confirm({
    title: "删除清单",
    content: "删除后这张清单与清单内食材会一并移除，无法恢复。"
  });
  if (!confirmed) return;
  submitting.value = true;
  try {
    await shoppingApi.deleteList(detail.value.id, {
      operationId: createOperationId(),
      version: detail.value.version
    });
    await uniPlatform.feedback.toast({ title: "已删除", icon: "success" });
    void uniPlatform.navigation.redirectTo("/pages_pantry/list/index");
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "删除失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function leaveList() {
  if (!detail.value || submitting.value) return;
  const confirmed = await uniPlatform.feedback.confirm({
    title: "退出共享清单",
    content: "退出后，这张清单会从你的采购清单列表移除。"
  });
  if (!confirmed) return;
  submitting.value = true;
  try {
    await shoppingApi.leaveList(detail.value.id, {
      operationId: createOperationId(),
      version: detail.value.version
    });
    await uniPlatform.feedback.toast({ title: "已退出", icon: "success" });
    goBack();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "退出失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function automatorApplySession(snapshot: { token: string; uid?: number; expiresAt: string; refreshCheckedAt?: number }) {
  await sessionStore.setSession(snapshot);
  if (!listId.value) return;
  await requestDetail();
}

async function automatorHandleLoginSuccess() {
  await handleLoginSuccess();
  return automatorReadState();
}

function automatorReadState() {
  return {
    loggedIn: sessionStore.isLoggedIn,
    listId: listId.value,
    loading: loading.value,
    errorText: errorText.value,
    title: detail.value?.name || "",
    groupCount: groups.value.length,
    itemNames: groups.value.map(item => item.name)
  };
}

defineExpose({
  automatorApplySession,
  automatorHandleLoginSuccess,
  automatorReadState
});
</script>

<style scoped lang="scss">
.detail-page,
.detail-scroll {
  height: 100%;
}

.detail-page {
  position: relative;
  background: var(--color-page);
}

.detail-empty {
  display: flex;
  min-height: 100%;
  padding: 24rpx;
  box-sizing: border-box;
}

.detail-empty :deep(.empty-state--art) {
  width: 100%;
  margin-top: 0;
}

.detail-nav {
  display: flex;
  align-items: center;
  gap: 18rpx;
  width: 100%;
}

.detail-nav-backdrop {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 790;
  background: var(--material-tabbar-bg);
  box-shadow: var(--material-tabbar-shadow);
  pointer-events: none;
  -webkit-backdrop-filter: var(--material-tabbar-filter);
  backdrop-filter: var(--material-tabbar-filter);
  transition: opacity 180ms ease;
}

.detail-nav__back,
.detail-nav__title {
  color: var(--color-text);
}

.detail-nav__back {
  font-size: 32rpx;
}

.detail-nav__title {
  overflow: hidden;
  font-size: 34rpx;
  font-weight: var(--font-weight-heavy);
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: opacity 180ms ease;
}

.detail-nav-settings {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  color: var(--color-icon-active);
}

.detail-nav-settings--hover {
  background: var(--color-surface-overlay-weak);
}

.detail-nav-settings__icon {
  font-size: 34rpx;
}

.detail-hero {
  position: relative;
  overflow: hidden;
  min-height: 452rpx;
  padding-right: 32rpx;
  padding-bottom: 146rpx;
  padding-left: 32rpx;
  border-bottom-right-radius: 56rpx;
  border-bottom-left-radius: 56rpx;
  background: var(--page-hero-bg);
}

.detail-hero::before {
  position: absolute;
  top: 92rpx;
  right: -84rpx;
  z-index: 1;
  width: 320rpx;
  height: 228rpx;
  border-radius: 50%;
  background: var(--color-surface-mask-weak);
  content: "";
  pointer-events: none;
  transform: rotate(-16deg);
}

.detail-hero::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1;
  height: 248rpx;
  background: var(--color-page);
  content: "";
  mask-image: var(--page-bottom-mask-image);
  mask-size: 100% 100%;
  pointer-events: none;
  -webkit-mask-image: var(--page-bottom-mask-image);
  -webkit-mask-size: 100% 100%;
}

.summary-card__head,
.complete-card__head,
.picker-row {
  justify-content: space-between;
}

.summary-card__head,
.complete-card__head,
.picker-row {
  display: flex;
  align-items: center;
}

.detail-hero__meta,
.summary-card__progress-text,
.summary-card__progress-value,
.summary-card__progress-meta,
.summary-card__percent,
.item-origin__tag,
.item-origin__text,
.add-selection-summary__text,
.add-selection-summary__hint,
.share-card__label,
.share-card__path,
.share-card__hint,
.quick-days__label,
.complete-card__title,
.complete-card__meta,
.picker-row__label,
.picker-row__value,
.sheet-note {
  display: block;
}

.detail-hero__title-row {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
}

.detail-hero__title {
  display: block;
  min-width: 0;
  margin-top: 8rpx;
  color: var(--color-text);
  font-size: 62rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.08;
  transition: opacity 180ms ease;
}

.detail-hero__meta {
  position: relative;
  z-index: 2;
  margin-top: 14rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.detail-hero__tags {
  position: relative;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 20rpx;
}

.detail-hero__tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48rpx;
  padding: 0 20rpx;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.detail-hero__tag--done {
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
}

.detail-hero__tag--voided {
  background: var(--color-state-danger-soft);
  color: var(--color-state-danger-text);
}

.detail-content {
  position: relative;
  margin-top: -42rpx;
  padding: 126rpx var(--space-page) calc(184rpx + env(safe-area-inset-bottom));
  border-top-left-radius: 38rpx;
  border-top-right-radius: 38rpx;
  background: var(--color-surface-overlay-soft);
}

.detail-panel {
  position: sticky;
  z-index: 12;
  padding-bottom: 20rpx;
  margin-top: -168rpx;
}

.notice,
.summary-card,
.store-card,
.group-card,
.share-card,
.complete-card,
.add-selection-summary {
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.notice,
.group-list,
.share-card,
.complete-list,
.add-selection-summary {
  margin-top: 20rpx;
}

.notice {
  padding: 28rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.summary-card {
  padding: 28rpx 30rpx;
  background: var(--material-card-bg);
  box-shadow:
    var(--material-card-shadow),
    inset 0 0 0 1rpx var(--color-surface-muted-frost);
}

.store-card {
  margin-top: 18rpx;
  padding: 28rpx 30rpx;
  background: var(--color-state-warning-card-bg);
  box-shadow: var(--material-card-shadow);
}

.store-card--finish,
.store-card--done {
  background: var(--color-state-primary-card-bg);
  box-shadow: var(--material-card-shadow);
}

.store-card--voided {
  background: var(--color-state-danger-card-bg);
  box-shadow: var(--material-card-shadow);
}

.item-card,
.item-row__actions,
.search-box,
.sheet-actions,
.share-actions,
.quick-days__chips {
  display: flex;
  gap: 16rpx;
}

.summary-card__main,
.item-row__main {
  flex: 1;
  min-width: 0;
}

.store-card__head,
.store-card__detail {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  min-width: 0;
}

.store-card__head {
  align-items: center;
}

.store-card__detail {
  align-items: flex-start;
  margin-top: 18rpx;
}

.complete-card__title {
  color: var(--color-text);
  font-weight: var(--font-weight-heavy);
}

.day-chip,
.sheet-actions__button {
  border-radius: var(--radius-pill);
}

.summary-card__progress-text,
.summary-card__progress-value,
.summary-card__progress-meta,
.summary-card__percent,
.item-origin__text,
.share-card__label,
.share-card__hint,
.quick-days__label,
.complete-card__meta,
.picker-row__label,
.picker-row__value,
.sheet-note {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.share-card__hint {
  margin-top: 10rpx;
}

.summary-card__badge--active {
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
}

.summary-card__badge--shared {
  background: var(--color-state-info-soft);
  color: var(--color-state-info-text);
}

.summary-card__badge--done {
  background: var(--color-state-warning-soft);
  color: var(--color-state-warning-text);
}

.summary-card__badge--voided {
  background: var(--color-state-danger-soft);
  color: var(--color-state-danger-text);
}

.summary-card__head {
  gap: 20rpx;
}

.summary-card__progress {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 8rpx;
  min-width: 0;
}

.summary-card__progress-text,
.summary-card__progress-value,
.summary-card__progress-meta,
.summary-card__percent {
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: var(--font-weight-semibold);
}

.summary-card__progress-dot {
  color: var(--color-text-tertiary);
  font-size: 24rpx;
}

.summary-card__progress-meta {
  color: var(--color-text-secondary);
}

.summary-card__percent {
  flex: 0 0 auto;
  color: var(--color-support-action);
}

.store-card__title {
  display: block;
  flex: 1;
  min-width: 0;
  color: var(--color-text);
  font-size: 40rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.24;
}

.store-card__desc {
  display: block;
  flex: 1;
  min-width: 0;
  margin-top: 0;
  color: var(--color-text-secondary);
  font-size: 26rpx;
  line-height: 1.7;
}

.store-card__stat {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  min-width: 120rpx;
  color: var(--color-text);
}

.store-card__stat-number {
  font-size: 56rpx;
  line-height: 1;
  font-weight: var(--font-weight-heavy);
}

.store-card__stat-label {
  margin-top: 8rpx;
  font-size: 22rpx;
  line-height: 1.3;
  color: var(--color-text-secondary);
}

.store-card__button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-width: 196rpx;
  min-height: 72rpx;
  padding: 0 24rpx;
  border-radius: var(--radius-pill);
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  font-size: 24rpx;
  font-weight: var(--font-weight-heavy);
  -webkit-backdrop-filter: var(--button-primary-filter);
  backdrop-filter: var(--button-primary-filter);
}

.store-card__button--finish {
  background: var(--button-secondary-bg);
  box-shadow: var(--material-card-shadow);
  color: var(--button-secondary-text);
  -webkit-backdrop-filter: var(--button-secondary-filter);
  backdrop-filter: var(--button-secondary-filter);
}

.store-card__button--plain {
  background: var(--button-secondary-bg);
  box-shadow: var(--material-card-shadow);
  color: var(--button-secondary-text);
  -webkit-backdrop-filter: var(--button-secondary-filter);
  backdrop-filter: var(--button-secondary-filter);
}

.store-card__button--disabled {
  opacity: 0.58;
}

.progress-card__track {
  height: 16rpx;
  margin-top: 12rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-primary-panel-soft);
  overflow: hidden;
}

.progress-card__bar {
  height: 100%;
  border-radius: inherit;
  background: var(--button-primary-bg);
}

.share-actions {
  flex-wrap: wrap;
  margin-top: 24rpx;
}

.group-list {
  margin-top: 28rpx;
}

.group-list-move {
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.detail-content__empty {
  margin-top: 28rpx;
}

.sheet-actions__button,
.search-box__button {
  margin: 0;
  font-size: var(--font-size-sm);
}

.search-box__button,
.sheet-actions__button--cancel {
  background: var(--button-secondary-bg);
  color: var(--button-secondary-text);
  -webkit-backdrop-filter: var(--button-secondary-filter);
  backdrop-filter: var(--button-secondary-filter);
}

.sheet-actions__button {
  min-width: 168rpx;
}

.sheet-actions__button--confirm {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  -webkit-backdrop-filter: var(--button-primary-filter);
  backdrop-filter: var(--button-primary-filter);
}

.group-card + .group-card {
  margin-top: 18rpx;
}

.day-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.item-swipe + .item-swipe {
  margin-top: 16rpx;
}

.item-swipe {
  position: relative;
  overflow: hidden;
}

.item-swipe__action {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 156rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: var(--color-state-danger-soft);
  color: var(--color-state-danger-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.item-swipe__content {
  position: relative;
  z-index: 1;
  padding: 24rpx;
  background: var(--color-surface-soft-card);
  transition: transform 180ms ease;
}

.item-swipe__content--dragging {
  transition: none;
}

.item-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.item-row__main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  min-width: 0;
}

.purchase-check {
  display: flex;
  flex: 0 0 58rpx;
  align-items: center;
  justify-content: center;
  width: 58rpx;
  height: 58rpx;
  margin-top: 2rpx;
  border: 3rpx solid var(--color-text);
  border-radius: 18rpx 24rpx 16rpx 22rpx / 22rpx 16rpx 24rpx 18rpx;
  background: var(--color-surface-raised);
  box-shadow: 4rpx 4rpx 0 var(--color-text);
  box-sizing: border-box;
  transition:
    transform 180ms cubic-bezier(0.175, 0.885, 0.32, 1.275),
    box-shadow 180ms ease,
    background-color 180ms ease,
    border-radius 180ms ease;
}

.purchase-check--checked {
  border-radius: 24rpx 16rpx 22rpx 18rpx / 16rpx 24rpx 18rpx 22rpx;
  background: var(--button-primary-bg);
  transform: scale(1.05) rotate(-2deg);
}

.purchase-check:active {
  box-shadow: 0 0 0 var(--color-text);
  transform: scale(0.92) translateY(3rpx);
}

.purchase-check__icon {
  color: var(--button-primary-text);
  font-size: 38rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1;
  animation: purchase-check-pop 240ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes purchase-check-pop {
  0% {
    opacity: 0;
    transform: scale(0.4) rotate(28deg);
  }
  75% {
    opacity: 1;
    transform: scale(1.18) rotate(0);
  }
  100% {
    transform: scale(1) rotate(0);
  }
}

.item-row__left,
.item-row__right {
  display: flex;
  flex-direction: column;
}

.item-row__left {
  flex: 1 1 auto;
  align-items: flex-start;
  gap: 8rpx;
  min-width: 0;
}

.item-row__right {
  flex: 0 0 auto;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8rpx;
}

.item-row__identity {
  display: flex;
  flex: 0 1 auto;
  align-items: baseline;
  gap: 8rpx;
  width: 100%;
  min-width: 0;
}

.item-row__title,
.item-row__quantity,
.item-origin__tag {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.item-row__title {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-row__quantity {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-regular);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-row__category {
  flex: 0 1 auto;
  min-width: 0;
  line-height: 40rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.item-row__fridge-hint {
  flex: 0 0 auto;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  text-align: right;
  white-space: nowrap;
}

.item-row__origin-toggle {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6rpx;
  font-size: var(--font-size-xs);
  line-height: 48rpx;
}

.item-row__origin-arrow {
  display: inline-block;
  font-size: 26rpx;
  line-height: 1;
  transform: rotate(-180deg);
  color: var(--color-text-tertiary);
  transition: transform 220ms ease;
}

.item-row__origin-arrow--open {
  transform: rotate(-90deg);
}

.item-row__origin-toggle--open {
  color: var(--color-support-action);
}

.item-origin-wrap {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transform: translateY(-10rpx);
  transition:
    max-height 220ms ease,
    opacity 180ms ease,
    transform 220ms ease;
}

.item-origin-wrap--open {
  max-height: 320rpx;
  opacity: 1;
  transform: translateY(0);
}

.item-origin-list {
  display: flex;
  flex-direction: column;
}

.item-origin {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12rpx;
  width: 100%;
  margin-top: 16rpx;
  padding-top: 14rpx;
  max-width: 100%;
  border-top: 1rpx solid var(--color-divider);
}

.item-origin--link {
  cursor: pointer;
}

.item-origin__tag {
  flex: 0 0 auto;
  padding: 6rpx 16rpx;
  border-radius: var(--radius-pill);
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
  font-size: var(--font-size-xs);
}

.item-origin__text {
  flex: 0 1 auto;
  min-width: 0;
  text-align: right;
}

.detail-footer {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 30;
  padding: 18rpx var(--space-page) calc(18rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid var(--color-divider);
  background: var(--material-tabbar-bg);
  box-shadow: var(--material-tabbar-shadow);
  -webkit-backdrop-filter: var(--material-tabbar-filter);
  backdrop-filter: var(--material-tabbar-filter);
  box-sizing: border-box;
}

.meal-footer__actions {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 0;
}

.meal-footer__quick {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  min-width: 86rpx;
}

.meal-footer__quick--disabled {
  opacity: 0.42;
}

.meal-footer__quick-icon {
  font-size: 30rpx;
  color: var(--color-text);
}

.meal-footer__quick-label {
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.4;
}

.meal-footer__buttons {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 14rpx;
}

.meal-footer__buttons--single .meal-footer__button {
  width: 100%;
  flex: 1 1 100%;
}

.meal-footer__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 90rpx;
  margin: 0;
  padding: 0 28rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1;
  box-sizing: border-box;
}

.meal-footer__button::after {
  border: none;
  display: none;
}

.meal-footer__button--primary {
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}

.meal-footer__button--disabled {
  opacity: 0.46;
  box-shadow: var(--button-primary-shadow);
}

.meal-footer__button-content {
  line-height: 1;
}

.settings-action {
  display: flex;
  align-items: center;
  gap: 20rpx;
  min-height: 112rpx;
  padding: 16rpx 8rpx;
}

.settings-action--disabled {
  opacity: 0.56;
}

.settings-action__icon-wrap {
  display: flex;
  flex: 0 0 72rpx;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  border-radius: 22rpx;
  background: var(--color-state-danger-soft);
}

.settings-action__icon {
  color: var(--color-state-danger-text);
  font-size: 34rpx;
}

.settings-action__copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.settings-action__title {
  color: var(--color-state-danger-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.settings-action__hint {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.floating-dock {
  position: fixed;
  right: 24rpx;
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  z-index: 40;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 18rpx;
}

.floating-dock--above-footer {
  bottom: calc(148rpx + env(safe-area-inset-bottom));
}

.floating-dock__backdrop {
  position: fixed;
  inset: 0;
  z-index: 0;
  background: transparent;
}

.floating-dock__store,
.manage-dock__action,
.manage-dock__button {
  margin: 0;
  border: 0;
  border-radius: 50%;
}

.floating-dock__store {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 92rpx;
  height: 92rpx;
  min-height: 92rpx;
  padding: 0;
  box-sizing: border-box;
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  font-size: 24rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.2;
  text-align: center;
  white-space: normal;
  -webkit-backdrop-filter: var(--button-primary-filter);
  backdrop-filter: var(--button-primary-filter);
}

.floating-dock__store--finish {
  background: var(--button-secondary-bg);
  color: var(--button-secondary-text);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--button-secondary-filter);
  backdrop-filter: var(--button-secondary-filter);
}

.manage-dock {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 92rpx;
  min-height: 92rpx;
  margin-left: auto;
  padding-bottom: 52rpx;
}

.manage-dock__actions {
  position: absolute;
  top: 0;
  right: calc(100% + 50rpx);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 50rpx;
  pointer-events: none;
}

.manage-dock__action {
  position: relative;
  display: inline-flex;
  flex: 0 0 92rpx;
  align-items: center;
  justify-content: center;
  width: 92rpx;
  height: 92rpx;
  padding: 0;
  border-radius: 50%;
  background: var(--button-secondary-bg);
  box-shadow: var(--material-card-shadow);
  color: var(--color-text);
  white-space: nowrap;
  opacity: 0;
  transform: translateX(26rpx) scale(0.92);
  pointer-events: none;
  -webkit-backdrop-filter: var(--button-secondary-filter);
  backdrop-filter: var(--button-secondary-filter);
  transition:
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 180ms ease;
}

.manage-dock__action--open {
  opacity: 1;
  transform: translateX(0) scale(1);
  pointer-events: auto;
}

.manage-dock__action--danger {
  background: var(--color-state-danger-soft);
  box-shadow: var(--material-card-shadow);
}

.manage-dock__action-icon {
  color: var(--color-icon-active);
  font-size: 34rpx;
}

.manage-dock__action-icon--danger {
  color: var(--color-state-danger-text);
}

.manage-dock__action-label {
  position: absolute;
  top: calc(100% + 14rpx);
  left: 50%;
  transform: translateX(-50%);
  color: var(--color-text);
  font-size: 24rpx;
  line-height: 1.3;
  font-weight: var(--font-weight-semibold);
  text-align: center;
  white-space: nowrap;
}

.manage-dock__action-label--danger {
  color: var(--color-state-danger-text);
}

.manage-dock__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 92rpx;
  height: 92rpx;
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  -webkit-backdrop-filter: var(--button-primary-filter);
  backdrop-filter: var(--button-primary-filter);
}

.manage-dock__button--hover {
  opacity: 0.94;
}

.manage-dock__icon {
  color: var(--button-primary-text);
  font-size: 34rpx;
  transition: transform 240ms ease;
}

.manage-dock__icon--open {
  transform: rotate(90deg);
}

.floating-dock__store::after,
.manage-dock__action::after {
  display: none;
}

.sheet-input {
  width: 100%;
  min-height: 92rpx;
  padding: 0 24rpx;
  border-radius: 24rpx;
  background: var(--color-surface-muted);
  box-sizing: border-box;
}

.sheet-input--compact {
  min-height: 84rpx;
}

.sheet-actions {
  width: 100%;
}

.sheet-actions__button {
  flex: 1;
}

.search-box {
  align-items: center;
  margin-top: 20rpx;
}

.search-box .sheet-input {
  flex: 1;
  min-width: 0;
}

.search-box__button {
  flex: 0 0 auto;
  min-width: 136rpx;
  border-radius: var(--radius-pill);
}

.ingredient-scroll {
  max-height: 360rpx;
  margin-top: 18rpx;
}

.ingredient-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx;
  border-radius: 24rpx;
  background: var(--color-surface-muted);
}

.ingredient-item + .ingredient-item {
  margin-top: 12rpx;
}

.ingredient-item--active {
  border: 2rpx solid var(--color-border);
  background: var(--color-tag-primary-bg);
}

.ingredient-item--disabled {
  opacity: 0.56;
}

.ingredient-item__copy {
  min-width: 0;
}

.ingredient-item__check {
  flex: 0 0 auto;
  margin-left: 20rpx;
  color: var(--color-state-success-text);
  font-size: 30rpx;
}

.ingredient-item__title,
.ingredient-item__meta {
  display: block;
}

.ingredient-item__title {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.ingredient-item__meta {
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.add-selection-summary,
.share-card,
.complete-card {
  padding: 24rpx;
}

.add-selection-summary__text,
.add-selection-summary__hint {
  display: block;
}

.add-selection-summary__text {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.add-selection-summary__hint {
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.sheet-actions__button--disabled {
  opacity: 0.45;
}

.share-card__path {
  margin-top: 10rpx;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  word-break: break-all;
}

.sheet-help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40rpx;
  min-height: 40rpx;
}

.sheet-help__icon {
  color: var(--color-text-secondary);
  opacity: 0.72;
  font-size: 28rpx;
}

.share-menu {
  display: grid;
  gap: 20rpx;
}

.collaborator-strip {
  margin-top: 20rpx;
}

.collaborator-strip__list {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx 18rpx;
}

.collaborator-strip__hint {
  display: block;
  margin-top: 16rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.collaborator-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 104rpx;
  gap: 10rpx;
}

.collaborator-chip__avatar-wrap {
  position: relative;
}

.collaborator-chip__avatar,
.collaborator-chip__avatar-image {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
}

.collaborator-chip__avatar {
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-heavy);
}

.collaborator-chip__avatar-image {
  background: var(--color-surface-muted);
}

.collaborator-chip__avatar--ghost {
  border: 2rpx dashed var(--color-border);
  background: transparent;
  color: var(--color-text-secondary);
}

.collaborator-chip__name {
  width: 100%;
  color: var(--color-text);
  font-size: var(--font-size-xs);
  line-height: 1.4;
  text-align: center;
}

.collaborator-chip__name--ghost {
  color: var(--color-text-secondary);
}

.collaborator-chip__remove {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34rpx;
  height: 34rpx;
  border-radius: 50%;
  background: var(--color-surface-soft-card);
  box-shadow: var(--shadow-card);
}

.collaborator-chip__remove-icon {
  color: var(--color-state-danger-text);
  font-size: 18rpx;
}

.share-card--button {
  position: relative;
  display: block;
  width: 100%;
  margin: 0;
  padding: 24rpx;
  border: 0;
  background: var(--color-surface-soft-card);
  box-sizing: border-box;
  line-height: 1.5;
  text-align: left;
  cursor: pointer;
}

.share-card--button::after {
  border: 0;
}

.share-actions {
  margin-top: 20rpx;
}

.share-card--disabled {
  opacity: 0.58;
}

.member-tag {
  position: absolute;
  top: 20rpx;
  right: 20rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40rpx;
  height: 40rpx;
}

.member-tag__icon {
  color: var(--color-state-warning-text);
  font-size: 28rpx;
}

.share-member-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 18rpx;
}

.share-member {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 18rpx 20rpx;
  border-radius: 24rpx;
  background: var(--color-surface-muted);
}

.share-member--active {
  background: var(--color-tag-primary-bg);
  box-shadow: inset 0 0 0 1rpx var(--color-border-active);
}

.share-member__avatar,
.share-member__check {
  flex: 0 0 auto;
}

.share-member__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border-radius: var(--radius-pill);
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-heavy);
}

.share-member__main {
  flex: 1;
  min-width: 0;
}

.share-member__name,
.share-member__meta,
.share-member__check {
  display: block;
}

.share-member__name {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.share-member__meta,
.share-member__check {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.share-member__meta {
  margin-top: 6rpx;
}

.share-member--active .share-member__check {
  color: var(--color-support-action);
  font-weight: var(--font-weight-semibold);
}

.sheet-facts {
  margin-top: 12rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.sheet-facts__item {
  padding: 0;
}

.sheet-facts__label,
.sheet-facts__value {
  display: block;
}

.sheet-facts__label {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.sheet-facts__value {
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.quick-days {
  margin-top: 20rpx;
}

.quick-days__chips {
  flex-wrap: wrap;
  margin-top: 12rpx;
}

.day-chip {
  padding: 10rpx 20rpx;
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.day-chip--active {
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
}

.picker-row {
  min-height: 84rpx;
  margin-top: 14rpx;
  padding: 0 24rpx;
  border-radius: 24rpx;
  background: var(--color-surface-muted);
}

.picker-row__value {
  color: var(--color-text);
}
</style>
