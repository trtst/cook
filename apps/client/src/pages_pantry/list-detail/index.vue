<template>
  <page-meta :page-style="pageStyle" />
  <Layout
    title=""
    full-screen
    navbar-layout="custom-left"
    :show-left="false"
    :navbar-transparent="sessionStore.isLoggedIn"
    :navbar-placeholder="!sessionStore.isLoggedIn"
  >
    <template #navbar-left>
      <view class="detail-nav">
        <view class="cookfont icon-back detail-nav__back" hover-class="detail-nav__back--hover" hover-stay-time="100" @click="goBack" />
        <text class="detail-nav__title" :style="navTitleStyle">{{ detail?.name || "购物清单" }}</text>
      </view>
    </template>

    <Login v-if="!sessionStore.isLoggedIn" title="登录后查看清单详情" description="共享清单详情、采购勾选和入库确认都需要登录后处理。" />

    <view v-else class="detail-page">
      <view class="detail-nav-backdrop" :style="navBackdropStyle" />
      <view v-if="loading" class="notice">加载中...</view>
      <view v-else-if="errorText" class="notice" @click="loadDetail">{{ errorText }}</view>
      <view v-else-if="!detail" class="detail-empty">
        <Empty
          :art="emptyStateArt"
          title="清单不存在"
          description="这张清单可能已删除、无权访问或分享链接已失效。"
        />
      </view>

      <template v-else>
        <scroll-view scroll-y class="detail-scroll" :show-scrollbar="false" @scroll="handleScroll">
          <view class="detail-body">
            <view class="detail-hero" :style="heroStyle">
              <view class="detail-hero__title-row">
                <text class="detail-hero__title" :style="heroTitleStyle">{{ detail.name }}</text>
                <text
                  v-if="canRename"
                  class="cookfont icon-edit detail-hero__edit"
                  @click.stop="openRenameSheet"
                />
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
                  <view class="store-card__main">
                    <text class="store-card__title">{{ endedCardTitle }}</text>
                    <text class="store-card__desc">{{ endedCardDesc }}</text>
                  </view>
                  <view v-if="canOpenPantryHome" class="store-card__aside">
                    <view class="store-card__button store-card__button--plain" @click="openPantryHome">
                      去食材库
                    </view>
                  </view>
                </view>
                <view v-if="canShowPrimaryAction" class="store-card" :class="{ 'store-card--finish': canShowFinishButton }">
                  <view class="store-card__main">
                    <text class="store-card__title">{{ primaryCardTitle }}</text>
                    <text class="store-card__desc">{{ primaryCardDesc }}</text>
                  </view>
                  <view class="store-card__aside">
                    <view class="store-card__stat">
                      <text class="store-card__stat-number">{{ primaryCardStatNumber }}</text>
                      <text class="store-card__stat-label">{{ primaryCardStatLabel }}</text>
                    </view>
                    <view
                      class="store-card__button"
                      :class="{
                        'store-card__button--finish': canShowFinishButton,
                        'store-card__button--disabled': submitting
                      }"
                      @click="submitting ? undefined : handlePrimaryAction()"
                    >
                      {{ primaryCardButtonText }}
                    </view>
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
                        <view class="item-row__cover">
                          <image v-if="group.imageUrl" class="item-row__image" :src="group.imageUrl" mode="aspectFill" />
                          <view v-else class="item-row__placeholder">食材</view>
                        </view>
                        <view class="item-row__main">
                          <view class="item-row__top">
                            <text class="item-row__title">{{ group.name }}</text>
                            <text class="item-row__quantity">{{ itemQuantityText(group) }}</text>
                          </view>
                          <view v-if="group.categoryName || inventoryText(group)" class="item-row__info">
                            <text class="item-row__category">{{ group.categoryName || "未分类" }}</text>
                            <text
                              v-if="inventoryText(group)"
                              class="item-row__inventory"
                              :class="{ 'item-row__inventory--warning': hasInventoryWarning(group) }"
                            >
                              {{ inventoryText(group) }}
                            </text>
                          </view>
                            <view class="item-row__bottom">
                              <view class="item-row__bottom-left">
                                <text
                                  v-if="itemSourceText(group)"
                                  class="item-row__origin-toggle"
                                :class="{ 'item-row__origin-toggle--open': isOriginOpen(group.id) }"
                                @click.stop="toggleItemOrigin(group.id)"
                              >
                                {{ isOriginOpen(group.id) ? "收起来源" : "查看来源" }}
                              </text>
                              </view>
                              <view v-if="canEditItems" class="item-row__actions">
                                <button
                                  v-if="canShowInventoryAction(group)"
                                  class="mini-pill"
                                  hover-class="none"
                                  :class="{
                                    'mini-pill--active': isInventoryApplied(group),
                                    'mini-pill--pending': isItemPending(group.id, 'fridge'),
                                    'mini-pill--disabled': isInventoryDisabled(group) && !isInventoryApplied(group),
                                    'mini-pill--locked': isInventoryDisabled(group) && isInventoryApplied(group)
                                  }"
                                  :disabled="submitting || isInventoryDisabled(group)"
                                  @click.stop="handleFridgeAction(group)"
                                >
                                  用库存
                                </button>
                              <button
                                class="mini-pill"
                                hover-class="none"
                                :class="{
                                  'mini-pill--active': isItemChecked(group),
                                  'mini-pill--pending': isItemPending(group.id, 'check'),
                                  'mini-pill--disabled': isBoughtDisabled(group)
                                }"
                                :disabled="submitting || isBoughtDisabled(group)"
                                @click.stop="toggleItem(group)"
                              >
                                已购
                              </button>
                            </view>
                          </view>
                        </view>
                      </view>
                      <view
                        v-if="itemSourceText(group)"
                        class="item-origin-wrap"
                        :class="{ 'item-origin-wrap--open': isOriginOpen(group.id) }"
                      >
                        <view class="item-origin">
                          <text class="item-origin__tag">{{ itemSourceKindText(group) }}</text>
                          <text class="item-origin__text">{{ itemSourceText(group) }}</text>
                        </view>
                      </view>
                    </view>
                  </view>
                </view>
              </transition-group>

              <Empty v-else class="detail-content__empty" title="这张清单还没有食材" description="可以从菜谱里继续加，也可以用右下角管理入口手动补食材。" />
            </view>
          </view>
        </scroll-view>

        <view v-if="canShowManageDock" class="floating-dock">
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

    <SheetShell
      :visible="renameSheetVisible"
      title="修改清单名"
      subtitle="这会同步更新当前共享清单的名称。"
      @close="closeRenameSheet"
      @after-close="handleRenameSheetAfterClose"
    >
      <input v-model="renameName" class="sheet-input" maxlength="20" placeholder="请输入清单名" />
      <template #footer>
        <view class="sheet-actions">
          <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="submitting" @click="closeRenameSheet">取消</button>
          <button class="sheet-actions__button sheet-actions__button--confirm" :disabled="submitting || !renameName.trim()" @click="renameList">
            {{ submitting ? "保存中..." : "保存" }}
          </button>
        </view>
      </template>
    </SheetShell>

    <SheetShell
      :visible="addSheetVisible"
      title="添加食材"
      subtitle="先选食材，再补数量和备注。搜不到时，也可以把当前搜索词作为手动项加入。"
      @close="closeAddSheet"
      @after-close="handleAddSheetAfterClose"
    >
      <view class="search-box">
        <input
          v-model="ingredientKeyword"
          class="sheet-input sheet-input--compact"
          maxlength="20"
          placeholder="搜索食材"
          @confirm="searchIngredients"
        />
        <button class="search-box__button" :disabled="ingredientLoading" @click="searchIngredients">
          {{ ingredientLoading ? "搜索中" : "搜索" }}
        </button>
      </view>

      <view v-if="ingredientErrorText" class="sheet-note sheet-note--error">{{ ingredientErrorText }}</view>
      <view v-else-if="ingredientLoading && !ingredientOptions.length" class="sheet-note">加载中...</view>

      <scroll-view scroll-y class="ingredient-scroll" :show-scrollbar="false">
        <view v-if="ingredientOptions.length" class="ingredient-list">
          <view
            v-for="item in ingredientOptions"
            :key="item.id"
            class="ingredient-item"
            :class="{ 'ingredient-item--active': selectedIngredientId === item.id }"
            @click="selectIngredient(item.id)"
          >
            <text class="ingredient-item__title">{{ item.name }}</text>
            <text class="ingredient-item__meta">{{ ingredientMeta(item) }}</text>
          </view>
        </view>
        <view v-else class="sheet-note">没有搜到食材，确认时会按手动项加入当前清单。</view>
      </scroll-view>

      <view class="editor-card">
        <text class="editor-card__label">当前食材</text>
        <text class="editor-card__value">{{ addItemName }}</text>
        <input v-model="addQuantityText" class="sheet-input sheet-input--compact" maxlength="30" placeholder="数量，例如 2 包 / 500g" />
        <input v-model="addNote" class="sheet-input sheet-input--compact" maxlength="40" placeholder="备注，例如 火锅补货" />
      </view>

      <template #footer>
        <view class="sheet-actions">
          <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="submitting" @click="closeAddSheet">取消</button>
          <button class="sheet-actions__button sheet-actions__button--confirm" :disabled="submitting || !addItemName" @click="createItem">
            {{ submitting ? "添加中..." : "加入清单" }}
          </button>
        </view>
      </template>
    </SheetShell>

    <InviteShareSheet
      :visible="shareSheetVisible"
      :title="shareSheetTitle"
      :subtitle="shareSheetSubtitle"
      :member-action="shareMemberAction"
      :friend-action="shareFriendAction"
      :error-text="shareLinkError"
      :show-close-action="canCloseShare"
      close-action-text="关闭分享"
      :close-action-disabled="submitting"
      @close="closeShareSheet"
      @member="openShareMembersSheet"
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
          <text class="sheet-facts__value">可发给饭搭子，也可直接转发给好友，对方确认后才会加入。</text>
        </view>
        <view class="sheet-facts__item">
          <text class="sheet-facts__label">关闭分享</text>
          <text class="sheet-facts__value">关闭后，好友入口和待确认邀请会失效，新的协作者不能再加入。</text>
        </view>
      </view>
    </SheetShell>

    <SheetShell
      :visible="shareMembersSheetVisible"
      title="分享给饭搭子"
      :subtitle="shareMembersSubtitle"
      @close="closeShareMembersSheet"
    >
      <view class="share-card">
        <text class="share-card__label">可选饭搭子</text>
        <text class="share-card__hint">这里只显示当前和你存在有效关系的饭搭子成员。</text>
        <view v-if="shareMembersLoading" class="sheet-note">加载中...</view>
        <view v-else-if="shareMembersError" class="sheet-note sheet-note--error" @click="loadShareMembers(true)">{{ shareMembersError }}</view>
        <view v-else-if="shareMembers.length" class="share-member-list">
          <view
            v-for="member in shareMembers"
            :key="member.userId"
            class="share-member"
            :class="{ 'share-member--active': selectedShareUserIds.includes(member.userId) }"
            @click="toggleShareUser(member.userId)"
          >
            <view class="share-member__avatar">{{ member.user.nickname?.trim().slice(0, 1) || "饭" }}</view>
            <view class="share-member__main">
              <text class="share-member__name">{{ member.user.nickname || "未命名成员" }}</text>
              <text class="share-member__meta">UID {{ member.user.uid }}</text>
            </view>
            <text class="share-member__check">{{ selectedShareUserIds.includes(member.userId) ? "已选" : "选择" }}</text>
          </view>
        </view>
        <text v-else class="share-card__hint">当前还没有可添加的饭搭子成员。</text>
      </view>
      <template #footer>
        <view class="sheet-actions">
          <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="submitting" @click="closeShareMembersSheet">取消</button>
          <button
            class="sheet-actions__button sheet-actions__button--confirm"
            :disabled="submitting || !selectedShareUserIds.length || shareMemberFull"
            @click="shareToMembers"
          >
            {{ submitting ? "发送中..." : `发送 ${selectedShareUserIds.length} 位加入邀请` }}
          </button>
        </view>
      </template>
    </SheetShell>

  </Layout>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { onLoad, onShareAppMessage, onShow } from "@dcloudio/uni-app";
import emptyStateArt from "@/assets/recipe-page/empty-state.svg";
import { diningGroupApi, type DiningGroupMemberSummary } from "@/apis/dining-group";
import type { UUID } from "@/apis/http";
import { recipeApi, type IngredientSummary } from "@/apis/recipe";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import InviteShareSheet from "@/components/Share/InviteShareSheet.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { createOperationId } from "@/utils/operation-id";
import { formatMonthDay } from "../utils/date";
import {
  shoppingApi,
  type ShoppingListCollaborator,
  type ShoppingListDetail,
  type ShoppingListDetailItem,
  type ShoppingItemSourceSummary,
  type ShoppingListItemFridgeActionMode,
  type ShoppingInventoryStatus,
  type ShoppingListItemPatchResponse
} from "../apis/shopping";
import { buildShoppingCompletePagePath, consumeShoppingCompleteResult } from "../list-complete/bridge";

type DetailAction = "" | "share" | "complete";
type ManageActionKey = "add" | "share" | "void" | "restore" | "delete" | "leave";

interface GroupView {
  key: string;
  id: UUID;
  items: ShoppingListDetailItem[];
  name: string;
  categoryName: string | null;
  imageUrl: string | null;
  quantityText: string;
  requiredQuantityText: string | null;
  remainingQuantityText: string | null;
  appliedInventoryQuantityText: string | null;
  fridgeText: string | null;
  inventoryStatus: ShoppingInventoryStatus;
  inventoryApplied: boolean;
  inventoryCovered: boolean;
  fridgeStatusText: string | null;
  fridgeActionLabel: string | null;
  fridgeActionMode: ShoppingListItemFridgeActionMode;
  checkedAt: string | null;
  sources: ShoppingItemSourceSummary[];
}

const NAV_FADE_DISTANCE = 132;
const SWIPE_DELETE_WIDTH = typeof uni !== "undefined" && typeof uni.upx2px === "function" ? uni.upx2px(156) : 78;

const pageStyle = usePageScrollStyle();
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();
const userStore = useUserStore();

const listId = ref<UUID | "">("");
const pendingAction = ref<DetailAction>("");
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const detail = ref<ShoppingListDetail | null>(null);

const renameSheetVisible = ref(false);
const renameName = ref("");

const addSheetVisible = ref(false);
const ingredientLoading = ref(false);
const ingredientKeyword = ref("");
const ingredientErrorText = ref("");
const ingredientOptions = ref<IngredientSummary[]>([]);
const selectedIngredientId = ref<UUID | "">("");
const addQuantityText = ref("");
const addNote = ref("");

const shareSheetVisible = ref(false);
const shareNoticeVisible = ref(false);
const shareMembersSheetVisible = ref(false);
const shareUrl = ref("");
const shareLinkLoading = ref(false);
const shareLinkError = ref("");
const shareMembersLoading = ref(false);
const shareMembersError = ref("");
const shareMembers = ref<DiningGroupMemberSummary[]>([]);
const shareMembersReady = ref(false);
const selectedShareUserIds = ref<UUID[]>([]);
const scrollTop = ref(0);
const manageMenuOpen = ref(false);
const openSwipeItemId = ref<UUID | "">("");
const itemPendingId = ref<UUID | "">("");
const itemPendingAction = ref<"" | "check" | "fridge" | "remove">("");
const openOriginItemIds = ref<UUID[]>([]);
const swipeState = reactive({
  itemId: "" as UUID | "",
  startX: 0,
  startY: 0,
  startOffset: 0,
  offset: 0,
  axis: "" as "" | "x" | "y"
});

function resolveGroupSortRank(group: GroupView) {
  if (isGroupResolved(group)) {
    return isItemChecked(group) ? 3 : 2;
  }
  if (group.items.some(item => Boolean(item.checkedAt) || item.status === "CHECKED" || item.inventoryApplied)) {
    return 1;
  }
  return 0;
}

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
    .map(([key, items], index) => ({
      index,
      group: buildGroupView(key, items)
    }))
    .sort((left, right) => {
      const leftRank = resolveGroupSortRank(left.group);
      const rightRank = resolveGroupSortRank(right.group);
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return left.index - right.index;
    })
    .map(entry => entry.group);
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
  if (detail.value?.status === "COMPLETED") return "这张清单已经结束，本轮采购和入库都已收尾。";
  if (detail.value?.status === "VOIDED") return "这张清单已经作废，后续也可以恢复继续采购。";
  return "先把要买的食材归到这里，买的时候就不会漏。";
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
  if (detail.value?.status === "COMPLETED") return "这张清单已完成";
  if (detail.value?.status === "VOIDED") return "这张清单已作废";
  return "";
});
const endedCardDesc = computed(() => {
  if (!detail.value) return "";
  if (detail.value.status === "COMPLETED") {
    const dayText = detail.value.completedAt ? formatMonthDay(detail.value.completedAt) : "刚刚";
    return `${dayText} 已结束本轮采购；需要继续补货时，可以直接去食材库看看当前库存。`;
  }
  if (detail.value.status === "VOIDED") {
    const dayText = detail.value.voidedAt ? formatMonthDay(detail.value.voidedAt) : "刚刚";
    return `${dayText} 已结束当前采购；如果后面还要继续买，也可以随时恢复这张清单。`;
  }
  return "";
});
const canRename = computed(() => detail.value?.role === "OWNER" && detail.value?.status === "ACTIVE");
const canOpenShare = computed(() => detail.value?.role === "OWNER" && detail.value.status === "ACTIVE");
const canVoid = computed(() => detail.value?.role === "OWNER" && detail.value.status === "ACTIVE");
const canRestore = computed(() => detail.value?.role === "OWNER" && detail.value.status === "VOIDED");
const canDelete = computed(() => detail.value?.role === "OWNER" && (detail.value.status === "COMPLETED" || detail.value.status === "VOIDED"));
const canLeave = computed(() => detail.value?.role === "COLLABORATOR");
const canEditItems = computed(() => Boolean(detail.value) && detail.value?.status === "ACTIVE");
const canAddItem = computed(() => Boolean(detail.value) && detail.value?.status === "ACTIVE");
const hasPendingGroups = computed(() => groups.value.some(group => !isGroupResolved(group)));
const hasCheckedGroups = computed(() => groups.value.some(group => group.items.some(item => item.status === "CHECKED" || Boolean(item.checkedAt))));
const storeReadyCount = computed(() => groups.value.filter(group => group.items.some(item => item.status === "CHECKED" || Boolean(item.checkedAt))).length);
const canShowStoreButton = computed(() => detail.value?.status === "ACTIVE" && groups.value.length > 0 && !hasPendingGroups.value && hasCheckedGroups.value);
const canShowFinishButton = computed(() => detail.value?.status === "ACTIVE" && groups.value.length > 0 && !hasPendingGroups.value && !hasCheckedGroups.value);
const canShowPrimaryAction = computed(() => canShowStoreButton.value || canShowFinishButton.value);
const primaryActionText = computed(() => {
  if (canShowStoreButton.value) return "入库";
  if (canShowFinishButton.value) return "完成清单";
  return "";
});
const primaryCardTitle = computed(() => {
  if (canShowStoreButton.value) return "入库还差一步";
  return "这张清单可以收尾了";
});
const primaryCardDesc = computed(() => {
  if (canShowStoreButton.value) {
    return "确认好数量和保鲜时间，这批食材就能收进库存，后续补买更顺手。";
  }
  return "都处理完了，确认后这张清单就归到已完成。";
});
const primaryCardStatNumber = computed(() => String(canShowStoreButton.value ? storeReadyCount.value : progressDoneCount.value));
const primaryCardStatLabel = computed(() => (canShowStoreButton.value ? "项待入库" : "项已处理"));
const primaryCardButtonText = computed(() => (canShowStoreButton.value ? "继续入库" : "完成清单"));
const manageActions = computed(() => {
  const actions: Array<{ key: ManageActionKey; label: string; iconClass: string; tone?: "default" | "danger" }> = [];
  if (canAddItem.value) actions.push({ key: "add", label: "添加食材", iconClass: "icon-add", tone: "default" });
  if (canOpenShare.value) actions.push({ key: "share", label: "协作", iconClass: "icon-share", tone: "default" });
  if (canVoid.value) actions.push({ key: "void", label: "作废", iconClass: "icon-close", tone: "danger" });
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
  if (!detail.value) return "支持饭搭子和好友一起维护。";
  if (shareActive.value) return `最多 ${detail.value.memberLimit} 人协作，先加入者优先。`;
  return "选一个协作方式，对方确认后加入。";
});
const shareMembersSubtitle = computed(() => {
  if (!detail.value) return "选择当前与你有有效关系的饭搭子成员。";
  return `当前 ${detail.value.memberCount}/${detail.value.memberLimit} 人，发出邀请后需对方确认才会加入。`;
});
const canCloseShare = computed(() => detail.value?.role === "OWNER" && detail.value?.status === "ACTIVE" && shareActive.value);
const shareFriendDisabled = computed(() => !canUseShareFeature.value || shareMemberFull.value || shareLinkLoading.value || !shareUrl.value);
const shareFriendCardHint = computed(() => {
  if (!canUseShareFeature.value) return "协作分享属于会员权益，开通会员后可邀请一起维护。";
  if (shareMemberFull.value) return "当前协作者名额已满，暂时不能再通过好友加入。";
  if (shareLinkLoading.value) return "正在准备好友分享入口...";
  return "直接转发给好友，对方打开后确认加入。";
});
const shareMemberAction = computed(() => ({
  label: "分享给饭搭子",
  hint: !canUseShareFeature.value
    ? "协作分享属于会员权益，开通会员后可邀请饭搭子一起维护。"
    : shareMemberFull.value
      ? "当前协作者名额已满，暂时不能再加新的饭搭子。"
      : "把这张清单发给已有关系的饭搭子，对方确认后一起维护。",
  disabled: shareMemberFull.value,
  muted: shareMemberFull.value || !canUseShareFeature.value
}));
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
const addItemName = computed(() => {
  const selected = ingredientOptions.value.find(item => item.id === selectedIngredientId.value);
  return selected?.name || ingredientKeyword.value.trim();
});

onShareAppMessage(() => ({
  title: detail.value?.name ? `${detail.value.name}，一起补齐这顿饭` : "邀请你一起维护购物清单",
  path: shareUrl.value || "/pages_pantry/list/index"
}));

onLoad((query) => {
  const rawId = Array.isArray(query?.id) ? query.id[0] : query?.id;
  const nextAction = Array.isArray(query?.action) ? query.action[0] : query?.action;
  listId.value = rawId ? Number(rawId) || "" : "";
  pendingAction.value = nextAction === "share" || nextAction === "complete" ? nextAction : "";
});

onShow(() => {
  if (!sessionStore.isLoggedIn || !listId.value) return;
  const completedDetail = consumeShoppingCompleteResult("detail", listId.value);
  if (completedDetail) {
    detail.value = completedDetail;
    return;
  }
  void loadDetail();
});

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
    detail.value = await shoppingApi.getListDetail(listId.value);
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
    return;
  }
  if (action === "complete" && canShowPrimaryAction.value) {
    void handlePrimaryAction();
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

function itemSourceText(group: GroupView) {
  const sourceType = resolveGroupSourceType(group);
  if (!sourceType) return null;
  const titles = [...new Set(
    group.sources
      .filter(source => source.sourceType === sourceType)
      .map(source => source.title?.trim() || "")
      .filter(Boolean)
  )];
  if (titles.length) return titles.join("、");
  return sourceType === "PLAN" ? "下一餐计划" : "菜谱";
}

function itemSourceKindText(group: GroupView) {
  const sourceType = resolveGroupSourceType(group);
  if (sourceType === "PLAN") return "计划";
  if (sourceType === "RECIPE") return "菜谱";
  return null;
}

function itemQuantityText(group: GroupView) {
  if (group.inventoryCovered) {
    return "不需购买";
  }
  if (group.inventoryApplied && group.remainingQuantityText) {
    return `还需购买 ${group.remainingQuantityText}`;
  }
  return group.requiredQuantityText || group.quantityText || "未填数量";
}

function isOriginOpen(itemId: UUID) {
  return openOriginItemIds.value.includes(itemId);
}

function toggleItemOrigin(itemId: UUID) {
  if (isOriginOpen(itemId)) {
    openOriginItemIds.value = openOriginItemIds.value.filter(currentId => currentId !== itemId);
    return;
  }
  openOriginItemIds.value = [...openOriginItemIds.value, itemId];
}

function inventoryText(group: GroupView) {
  if (!group.fridgeText) return null;
  const text = group.fridgeText.replace(/^冰箱：/, "库存：");
  return isInventoryApplied(group) ? `已用 ${text}` : text;
}

function hasInventoryWarning(group: GroupView) {
  return group.items.some(item => {
    if (item.inventoryStatus === "SHORTAGE") return true;
    return Boolean(item.inventoryApplied && item.remainingQuantityText);
  });
}

function isItemChecked(group: GroupView) {
  const purchasableItems = group.items.filter(item => !item.inventoryCovered);
  return purchasableItems.length > 0 && purchasableItems.every(item => item.status === "CHECKED" || Boolean(item.checkedAt));
}

function isGroupResolved(group: GroupView) {
  return group.items.every(item => isResolvedItem(item));
}

function isResolvedItem(item: ShoppingListDetailItem) {
  return item.status === "CHECKED"
    || Boolean(item.checkedAt)
    || isFullyCoveredItem(item);
}

function isFullyCoveredItem(item: ShoppingListDetailItem) {
  return item.inventoryCovered;
}

function isItemPending(itemId: UUID, action?: "check" | "fridge" | "remove") {
  if (itemPendingId.value !== itemId) return false;
  if (!action) return true;
  return itemPendingAction.value === action;
}

function isInventoryApplied(group: GroupView) {
  return group.inventoryApplied;
}

function isInventoryDisabled(group: GroupView) {
  if (!canShowInventoryAction(group)) return true;
  if (group.inventoryApplied) {
    return group.items.some(item => item.status === "CHECKED" || Boolean(item.checkedAt));
  }
  if (isItemChecked(group) && group.inventoryStatus === "ENOUGH") return true;
  return group.fridgeActionMode === "NONE" || group.fridgeActionMode === "NEED_CONFIRM";
}

function isBoughtDisabled(group: GroupView) {
  return group.inventoryCovered;
}

function canShowInventoryAction(group: GroupView) {
  return group.inventoryApplied
    || group.fridgeActionMode === "APPLY_FULL"
    || group.fridgeActionMode === "APPLY_PARTIAL"
    || group.fridgeActionMode === "UNDO";
}

function applyItemPatch(patch: ShoppingListItemPatchResponse) {
  if (!detail.value || detail.value.id !== patch.listId) return;

  const nextItems = [...detail.value.items];
  if (patch.removedItemId !== null) {
    const removedIndex = nextItems.findIndex(item => item.id === patch.removedItemId);
    if (removedIndex >= 0) {
      nextItems.splice(removedIndex, 1);
    }
    openOriginItemIds.value = openOriginItemIds.value.filter(itemId => itemId !== patch.removedItemId);
    if (openSwipeItemId.value === patch.removedItemId) {
      openSwipeItemId.value = "";
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
}

function itemSwipeStyle(itemId: UUID) {
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

function handleItemTouchStart(itemId: UUID, event: ItemTouchEvent) {
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

function openRenameSheet() {
  renameName.value = detail.value?.name || "";
  renameSheetVisible.value = true;
}

function closeRenameSheet() {
  renameSheetVisible.value = false;
}

function handleRenameSheetAfterClose() {
  renameName.value = "";
}

async function renameList() {
  if (!detail.value || !renameName.value.trim() || submitting.value) return;
  submitting.value = true;
  try {
    detail.value = await shoppingApi.renameList(detail.value.id, {
      operationId: createOperationId(),
      version: detail.value.version,
      name: renameName.value.trim()
    });
    closeRenameSheet();
    await uniPlatform.feedback.toast({ title: "已改名", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "保存失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function toggleItem(group: GroupView) {
  if (!detail.value || submitting.value || itemPendingId.value) return;
  openSwipeItemId.value = "";
  itemPendingId.value = group.id;
  itemPendingAction.value = "check";
  try {
    const targetChecked = !isItemChecked(group);
    const currentItems = getCurrentGroupItems(group.key);
    for (const currentItem of currentItems) {
      if (targetChecked && isFullyCoveredItem(currentItem)) continue;
      if (Boolean(currentItem.checkedAt) === targetChecked) continue;
      const patch = await shoppingApi.checkListItem(detail.value.id, currentItem.id, {
        operationId: createOperationId(),
        version: detail.value.version,
        checked: targetChecked
      });
      applyItemPatch(patch);
    }
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "更新失败", icon: "none" });
  } finally {
    itemPendingId.value = "";
    itemPendingAction.value = "";
  }
}

async function handleFridgeAction(group: GroupView) {
  if (!detail.value || submitting.value || itemPendingId.value || isInventoryDisabled(group)) return;
  openSwipeItemId.value = "";
  if (group.fridgeActionMode === "NEED_CONFIRM") {
    await uniPlatform.feedback.toast({ title: "这条库存还不能自动计算，请先把冰箱数量改成精确数量。", icon: "none" });
    return;
  }
  if (group.fridgeActionMode === "NONE") return;
  itemPendingId.value = group.id;
  itemPendingAction.value = "fridge";
  try {
    const targetAction = group.items.some(item => item.inventoryApplied) ? "UNDO" : "APPLY";
    const currentItems = getCurrentGroupItems(group.key);
    for (const currentItem of currentItems) {
      if (targetAction === "UNDO" && !currentItem.inventoryApplied) continue;
      if (targetAction === "APPLY" && currentItem.inventoryApplied) continue;
      if (targetAction === "APPLY" && (currentItem.fridgeActionMode !== "APPLY_FULL" && currentItem.fridgeActionMode !== "APPLY_PARTIAL")) continue;
      const patch = await shoppingApi.applyListItemFridge(detail.value.id, currentItem.id, {
        operationId: createOperationId(),
        version: detail.value.version,
        action: targetAction
      });
      applyItemPatch(patch);
    }
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "库存应用失败", icon: "none" });
  } finally {
    itemPendingId.value = "";
    itemPendingAction.value = "";
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
    for (const currentItem of currentItems) {
      const patch = await shoppingApi.removeListItem(detail.value.id, currentItem.id, {
        operationId: createOperationId(),
        version: detail.value.version
      });
      applyItemPatch(patch);
    }
    await uniPlatform.feedback.toast({ title: "已移出", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "移出失败", icon: "none" });
  } finally {
    itemPendingId.value = "";
    itemPendingAction.value = "";
  }
}

function openAddSheet() {
  closeManageMenu();
  addSheetVisible.value = true;
  if (!ingredientOptions.value.length) {
    void searchIngredients();
  }
}

function closeAddSheet() {
  addSheetVisible.value = false;
}

function buildGroupKey(item: { ingredientId: UUID | null; name: string }) {
  return `${item.ingredientId || "none"}:${item.name.trim().toLowerCase()}`;
}

function resolveGroupSourceType(group: GroupView) {
  if (group.sources.some(source => source.sourceType === "PLAN")) return "PLAN" as const;
  if (group.sources.some(source => source.sourceType === "RECIPE")) return "RECIPE" as const;
  return null;
}

function buildGroupView(key: string, items: ShoppingListDetailItem[]): GroupView {
  const primary = items[0]!;
  const sources = mergeGroupSources(items);
  const checkedItems = items.map(item => item.checkedAt).filter((value): value is string => Boolean(value));
  const inventoryApplied = items.some(item => item.inventoryApplied);
  const inventoryCovered = items.length > 0 && items.every(item => item.inventoryCovered);
  const requiredQuantityText = buildGroupQuantityText(items, false);
  const remainingQuantityText = inventoryApplied && !inventoryCovered ? buildGroupQuantityText(items, true) : null;
  return {
    key,
    id: primary.id,
    items,
    name: primary.name,
    categoryName: primary.categoryName,
    imageUrl: primary.imageUrl,
    quantityText: remainingQuantityText || requiredQuantityText,
    requiredQuantityText,
    remainingQuantityText,
    appliedInventoryQuantityText: buildGroupAppliedQuantityText(items),
    fridgeText: buildGroupFridgeText(items),
    inventoryStatus: resolveGroupInventoryStatus(items),
    inventoryApplied,
    inventoryCovered,
    fridgeStatusText: resolveGroupFridgeStatusText(items),
    fridgeActionLabel: resolveGroupFridgeActionLabel(items),
    fridgeActionMode: resolveGroupFridgeActionMode(items),
    checkedAt: items.every(item => Boolean(item.checkedAt))
      ? checkedItems.sort()[checkedItems.length - 1] ?? primary.checkedAt
      : null,
    sources
  };
}

function mergeGroupSources(items: ShoppingListDetailItem[]) {
  const sourceMap = new Map<string, ShoppingItemSourceSummary>();
  for (const item of items) {
    for (const source of item.sources) {
      const key = [
        source.sourceType,
        source.planItemId ?? "",
        source.recipeId ?? "",
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

function manageActionStyle(index: number) {
  const total = manageActions.value.length;
  return {
    transitionDelay: manageMenuOpen.value ? `${index * 46}ms` : `${(total - index - 1) * 28}ms`
  };
}

function buildGroupQuantityText(items: ShoppingListDetailItem[], remainingOnly = false) {
  if (!items.length || (remainingOnly && items.every(item => item.inventoryCovered))) {
    return "不需购买";
  }
  const exactOrder: string[] = [];
  const exactMap = new Map<string, { unit: string; total: number }>();
  const fuzzyLines: string[] = [];

  for (const item of items) {
    if (remainingOnly && item.inventoryCovered) continue;
    const text = (remainingOnly && item.inventoryApplied
      ? item.remainingQuantityText
      : item.requiredQuantityText ?? item.quantityText)?.trim();
    if (!text) continue;
    const parsed = parseExactQuantityText(text);
    if (!parsed) {
      fuzzyLines.push(text);
      continue;
    }
    if (!exactMap.has(parsed.unitKey)) {
      exactOrder.push(parsed.unitKey);
      exactMap.set(parsed.unitKey, {
        unit: parsed.unitText,
        total: parsed.amount
      });
      continue;
    }
    exactMap.get(parsed.unitKey)!.total += parsed.amount;
  }

  const lines = exactOrder.map((unitKey) => {
    const current = exactMap.get(unitKey)!;
    return `${formatQuantityNumber(current.total)} ${current.unit}`.trim();
  }).concat(fuzzyLines);

  if (!lines.length) return "未填数量";
  return lines.join(" / ");
}

function buildGroupAppliedQuantityText(items: ShoppingListDetailItem[]) {
  const exactOrder: string[] = [];
  const exactMap = new Map<string, { unit: string; total: number }>();
  for (const item of items) {
    const parsed = item.appliedInventoryQuantityText ? parseExactQuantityText(item.appliedInventoryQuantityText) : null;
    if (!parsed) continue;
    if (!exactMap.has(parsed.unitKey)) {
      exactOrder.push(parsed.unitKey);
      exactMap.set(parsed.unitKey, { unit: parsed.unitText, total: parsed.amount });
    } else {
      exactMap.get(parsed.unitKey)!.total += parsed.amount;
    }
  }
  if (!exactOrder.length) return null;
  return exactOrder.map(unitKey => {
    const current = exactMap.get(unitKey)!;
    return `${formatQuantityNumber(current.total)} ${current.unit}`.trim();
  }).join(" / ");
}

function resolveGroupInventoryStatus(items: ShoppingListDetailItem[]): ShoppingInventoryStatus {
  if (items.some(item => item.inventoryStatus === "SHORTAGE")) return "SHORTAGE";
  if (items.some(item => item.inventoryStatus === "UNKNOWN")) return "UNKNOWN";
  if (items.some(item => item.inventoryStatus === "ENOUGH")) return "ENOUGH";
  return "NONE";
}

function buildGroupFridgeText(items: ShoppingListDetailItem[]) {
  const exactOrder: string[] = [];
  const exactMap = new Map<string, { unit: string; total: number }>();
  let recordCount = 0;
  let fallbackText: string | null = null;

  for (const item of items) {
    const text = item.fridgeText?.replace(/^冰箱：/, "").trim();
    if (!text) continue;
    const parsed = parseExactQuantityText(text);
    if (parsed) {
      if (!exactMap.has(parsed.unitKey)) {
        exactOrder.push(parsed.unitKey);
        exactMap.set(parsed.unitKey, {
          unit: parsed.unitText,
          total: parsed.amount
        });
      } else {
        exactMap.get(parsed.unitKey)!.total += parsed.amount;
      }
      continue;
    }
    if (text === "有库存记录") {
      recordCount += 1;
      continue;
    }
    const recordMatch = text.match(/^有\s*(\d+)\s*条记录$/);
    if (recordMatch) {
      recordCount += Number(recordMatch[1] ?? 0);
      continue;
    }
    fallbackText = fallbackText ?? text;
  }

  if (exactOrder.length) {
    const exactText = exactOrder
      .map((unitKey) => {
        const current = exactMap.get(unitKey)!;
        return `${formatQuantityNumber(current.total)} ${current.unit}`.trim();
      })
      .join(" / ");
    if (recordCount > 0) {
      return `冰箱：${exactText}，另有${recordCount}条记录`;
    }
    return `冰箱：${exactText}`;
  }
  if (recordCount > 1) {
    return `冰箱：有 ${recordCount} 条记录`;
  }
  if (recordCount === 1) {
    return "冰箱：有库存记录";
  }
  return fallbackText ? `冰箱：${fallbackText}` : null;
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

function resolveGroupFridgeActionMode(items: ShoppingListDetailItem[]): ShoppingListItemFridgeActionMode {
  const modes = items.map(item => item.fridgeActionMode);
  if (items.some(item => item.inventoryApplied)) {
    return modes.includes("UNDO") ? "UNDO" : "NONE";
  }
  const hasApplyPartial = modes.includes("APPLY_PARTIAL");
  const hasApplyFull = modes.includes("APPLY_FULL");
  const hasShortage = items.some(item => item.inventoryStatus === "SHORTAGE");
  if (hasApplyPartial) return "APPLY_PARTIAL";
  if (hasApplyFull) {
    return modes.includes("NEED_CONFIRM") || hasShortage ? "APPLY_PARTIAL" : "APPLY_FULL";
  }
  if (modes.includes("UNDO")) return "UNDO";
  if (modes.includes("NEED_CONFIRM")) return "NEED_CONFIRM";
  return "NONE";
}

function resolveGroupFridgeActionLabel(items: ShoppingListDetailItem[]) {
  const mode = resolveGroupFridgeActionMode(items);
  if (mode === "NONE") return null;
  if (mode === "NEED_CONFIRM") return "库存待确认";
  if (mode === "UNDO") {
    return items.find(item => item.fridgeActionMode === "UNDO")?.fridgeActionLabel ?? "撤销";
  }
  return items.find(item => item.fridgeActionMode === mode)?.fridgeActionLabel ?? "用库存";
}

function resolveGroupFridgeStatusText(items: ShoppingListDetailItem[]) {
  const hasNeedConfirm = items.some(item => item.fridgeActionMode === "NEED_CONFIRM");
  const hasApplied = items.some(item => item.inventoryApplied);
  const hasShortage = items.some(item => item.inventoryStatus === "SHORTAGE");
  if (items.length > 0 && items.every(item => item.inventoryCovered) && !hasNeedConfirm) {
    return "库存足够，不买了";
  }
  if (hasApplied && hasShortage) {
    return hasNeedConfirm ? "已应用部分库存，其余待确认" : "已应用部分库存，仍需补买";
  }
  if (hasShortage) {
    return hasNeedConfirm ? "部分库存待确认，仍需补买" : "库存不足，仍需补买";
  }
  if (hasApplied) {
    return hasNeedConfirm ? "已应用部分库存，其余待确认" : "已应用部分库存";
  }
  if (hasNeedConfirm) return "部分库存待确认";
  return items.find(item => item.fridgeStatusText)?.fridgeStatusText ?? null;
}

function getCurrentGroupItems(groupKey: string) {
  return (detail.value?.items ?? []).filter(item => buildGroupKey(item) === groupKey);
}

function handleAddSheetAfterClose() {
  ingredientKeyword.value = "";
  ingredientErrorText.value = "";
  ingredientOptions.value = [];
  selectedIngredientId.value = "";
  addQuantityText.value = "";
  addNote.value = "";
}

async function searchIngredients() {
  ingredientLoading.value = true;
  ingredientErrorText.value = "";
  try {
    const result = await recipeApi.listIngredients({
      page: 1,
      pageSize: 30,
      keyword: ingredientKeyword.value.trim() || undefined,
      source: "ALL"
    });
    ingredientOptions.value = result.items;
    if (selectedIngredientId.value && !result.items.find(item => item.id === selectedIngredientId.value)) {
      selectedIngredientId.value = "";
    }
  } catch (error) {
    ingredientErrorText.value = error instanceof Error ? error.message : "食材加载失败";
  } finally {
    ingredientLoading.value = false;
  }
}

function selectIngredient(ingredientId: UUID) {
  selectedIngredientId.value = selectedIngredientId.value === ingredientId ? "" : ingredientId;
}

function ingredientMeta(item: IngredientSummary) {
  return `${item.source === "PERSONAL" ? "个人食材" : "系统食材"} · 默认 ${item.defaultUnit.name}`;
}

async function createItem() {
  if (!detail.value || submitting.value || !addItemName.value) return;
  submitting.value = true;
  try {
    detail.value = await shoppingApi.createListItem(detail.value.id, {
      operationId: createOperationId(),
      name: addItemName.value,
      ingredientId: selectedIngredientId.value || null,
      quantityText: addQuantityText.value.trim() || null,
      note: addNote.value.trim() || null
    });
    closeAddSheet();
    await uniPlatform.feedback.toast({ title: "已加入清单", icon: "success" });
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

function openShareMembersSheet() {
  if (!canUseShareFeature.value) {
    void handleShareFeatureLocked();
    return;
  }
  if (shareMemberFull.value) return;
  shareSheetVisible.value = false;
  shareMembersSheetVisible.value = true;
  void loadShareMembers();
}

function closeShareMembersSheet() {
  shareMembersSheetVisible.value = false;
  selectedShareUserIds.value = [];
  shareMembersError.value = "";
}

async function loadShareMembers(force = false) {
  if (shareMembersReady.value && !force) return;
  if (shareMembersLoading.value && !force) return;
  shareMembersLoading.value = true;
  shareMembersError.value = "";
  try {
    const groups = await diningGroupApi.getMine();
    const results = await Promise.all(groups.items.map(item => diningGroupApi.listMembers(item.id)));
    const memberMap = new Map<UUID, DiningGroupMemberSummary>();
    results.forEach((result) => {
      result.members.forEach((member) => {
        if (member.user.uid === sessionStore.uid) return;
        if (!memberMap.has(member.userId)) {
          memberMap.set(member.userId, member);
        }
      });
    });
    shareMembers.value = [...memberMap.values()];
    shareMembersReady.value = true;
    selectedShareUserIds.value = selectedShareUserIds.value.filter(userId => memberMap.has(userId));
  } catch (error) {
    shareMembersError.value = error instanceof Error ? error.message : "饭搭子成员加载失败";
  } finally {
    shareMembersLoading.value = false;
  }
}

function toggleShareUser(userId: UUID) {
  if (selectedShareUserIds.value.includes(userId)) {
    selectedShareUserIds.value = selectedShareUserIds.value.filter(currentUserId => currentUserId !== userId);
    return;
  }
  selectedShareUserIds.value = [...selectedShareUserIds.value, userId];
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

async function shareToMembers() {
  if (!detail.value || submitting.value || !selectedShareUserIds.value.length) return;
  submitting.value = true;
  try {
    detail.value = await shoppingApi.shareListMembers(detail.value.id, {
      operationId: createOperationId(),
      version: detail.value.version,
      targetUserIds: selectedShareUserIds.value
    });
    closeShareMembersSheet();
    selectedShareUserIds.value = [];
    await uniPlatform.feedback.toast({ title: "已发送邀请", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "分享失败", icon: "none" });
  } finally {
    submitting.value = false;
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
    closeShareMembersSheet();
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

function handleManageAdd() {
  openAddSheet();
}

function handleManageShare() {
  openShareSheet();
}

async function handleManageVoid() {
  closeManageMenu();
  await voidList();
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

function openStoreFlow() {
  if (!detail.value || submitting.value) return;
  closeManageMenu();
  void uniPlatform.navigation.navigateTo(buildShoppingCompletePagePath(detail.value.id, "detail"));
}

async function finishList() {
  if (!detail.value || submitting.value) return;
  closeManageMenu();
  const confirmed = await uniPlatform.feedback.confirm({
    title: "完成清单",
    content: "这张清单已经都处理完了，确认后会结束当前采购。"
  });
  if (!confirmed) return;
  submitting.value = true;
  try {
    detail.value = await shoppingApi.completeList(detail.value.id, {
      operationId: createOperationId(),
      version: detail.value.version,
      entries: []
    });
    await uniPlatform.feedback.toast({ title: "已完成清单", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "提交失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function handlePrimaryAction() {
  if (canShowStoreButton.value) {
    openStoreFlow();
    return;
  }
  if (canShowFinishButton.value) {
    await finishList();
  }
}

async function handleManageAction(action: ManageActionKey) {
  if (action === "add") {
    handleManageAdd();
    return;
  }
  if (action === "share") {
    handleManageShare();
    return;
  }
  if (action === "void") {
    await handleManageVoid();
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
    content: "退出后，这张清单会从你的购物清单列表移除。"
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
</script>

<style scoped lang="scss">
.detail-page,
.detail-scroll {
  height: 100%;
}

.detail-page {
  position: relative;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-page) 84%, var(--color-primary-soft) 16%) 0%, var(--color-page) 48%, var(--color-page) 100%);
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
  min-width: 0;
}

.detail-nav-backdrop {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 790;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-surface-mask-strong) 82%, var(--color-surface) 18%) 0%, color-mix(in srgb, var(--color-surface) 92%, transparent) 100%);
  box-shadow: 0 10rpx 26rpx color-mix(in srgb, var(--color-surface-mask-medium) 64%, transparent);
  pointer-events: none;
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

.detail-hero {
  --detail-hero-end: var(--color-page);

  position: relative;
  overflow: hidden;
  min-height: 452rpx;
  padding-right: 32rpx;
  padding-bottom: 146rpx;
  padding-left: 32rpx;
  border-bottom-right-radius: 56rpx;
  border-bottom-left-radius: 56rpx;
  background:
    radial-gradient(circle at 16% 18%, var(--entry-side-mint-bg) 0, transparent 32%),
    radial-gradient(circle at 86% 12%, var(--entry-side-aqua-bg) 0, transparent 30%),
    linear-gradient(148deg, var(--entry-primary-bg), var(--entry-board-bg));
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
  --detail-mask-solid: #000;
  --detail-mask-strong: rgba(0, 0, 0, 0.76);
  --detail-mask-mid: rgba(0, 0, 0, 0.42);

  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1;
  height: 248rpx;
  background: var(--detail-hero-end);
  content: "";
  mask-image:
    radial-gradient(ellipse at 15% 100%,
      var(--detail-mask-solid) 0%,
      var(--detail-mask-strong) 36%,
      transparent 72%),
    radial-gradient(ellipse at 85% 100%,
      var(--detail-mask-solid) 0%,
      var(--detail-mask-strong) 36%,
      transparent 72%),
    linear-gradient(to bottom,
      transparent 0%,
      var(--detail-mask-mid) 50%,
      var(--detail-mask-solid) 100%);
  mask-size: 100% 100%;
  pointer-events: none;
  -webkit-mask-image:
    radial-gradient(ellipse at 15% 100%,
      var(--detail-mask-solid) 0%,
      var(--detail-mask-strong) 36%,
      transparent 72%),
    radial-gradient(ellipse at 85% 100%,
      var(--detail-mask-solid) 0%,
      var(--detail-mask-strong) 36%,
      transparent 72%),
    linear-gradient(to bottom,
      transparent 0%,
      var(--detail-mask-mid) 50%,
      var(--detail-mask-solid) 100%);
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
.editor-card__label,
.editor-card__value,
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

.detail-hero__edit {
  flex: 0 0 auto;
  margin-top: 16rpx;
  color: var(--color-primary);
  font-size: 32rpx;
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
  background: color-mix(in srgb, var(--color-primary-soft) 78%, var(--color-surface) 22%);
  color: var(--color-primary);
}

.detail-hero__tag--voided {
  background: color-mix(in srgb, var(--color-danger-soft) 72%, var(--color-surface) 28%);
  color: var(--color-danger-text);
}

.detail-content {
  position: relative;
  margin-top: -42rpx;
  padding: 126rpx var(--space-page) calc(24rpx + env(safe-area-inset-bottom));
  border-top-left-radius: 38rpx;
  border-top-right-radius: 38rpx;
  background: color-mix(in srgb, var(--color-surface) 94%, var(--color-page) 6%);
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
.editor-card {
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.notice,
.group-list,
.share-card,
.complete-list,
.editor-card {
  margin-top: 20rpx;
}

.notice {
  padding: 28rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.summary-card {
  padding: 28rpx 30rpx;
  background: color-mix(in srgb, var(--color-surface) 94%, var(--color-page) 6%);
  box-shadow:
    0 18rpx 42rpx color-mix(in srgb, var(--color-primary-soft) 32%, transparent),
    inset 0 0 0 1rpx color-mix(in srgb, var(--color-surface) 74%, transparent);
}

.store-card {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
  margin-top: 18rpx;
  padding: 28rpx 30rpx;
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--color-warning-soft) 68%, transparent) 0 26%, transparent 27%),
    linear-gradient(135deg, color-mix(in srgb, var(--color-surface) 95%, var(--color-warning-soft) 5%) 0%, var(--color-surface) 100%);
  box-shadow:
    0 20rpx 42rpx color-mix(in srgb, var(--color-warning-soft) 26%, transparent),
    inset 0 0 0 1rpx color-mix(in srgb, var(--color-warning-soft) 34%, transparent);
}

.store-card--finish {
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--color-primary-soft) 62%, transparent) 0 26%, transparent 27%),
    linear-gradient(135deg, color-mix(in srgb, var(--color-surface) 95%, var(--color-primary-soft) 5%) 0%, var(--color-surface) 100%);
  box-shadow:
    0 20rpx 42rpx color-mix(in srgb, var(--color-primary-soft) 22%, transparent),
    inset 0 0 0 1rpx color-mix(in srgb, var(--color-primary-soft) 26%, transparent);
}

.store-card--done {
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--color-primary-soft) 60%, transparent) 0 26%, transparent 27%),
    linear-gradient(135deg, color-mix(in srgb, var(--color-surface) 95%, var(--color-primary-soft) 5%) 0%, var(--color-surface) 100%);
  box-shadow:
    0 20rpx 42rpx color-mix(in srgb, var(--color-primary-soft) 24%, transparent),
    inset 0 0 0 1rpx color-mix(in srgb, var(--color-primary-soft) 24%, transparent);
}

.store-card--voided {
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--color-danger-soft) 60%, transparent) 0 26%, transparent 27%),
    linear-gradient(135deg, color-mix(in srgb, var(--color-surface) 95%, var(--color-danger-soft) 5%) 0%, var(--color-surface) 100%);
  box-shadow:
    0 20rpx 42rpx color-mix(in srgb, var(--color-danger-soft) 24%, transparent),
    inset 0 0 0 1rpx color-mix(in srgb, var(--color-danger-soft) 22%, transparent);
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
.store-card__main,
.item-row__main {
  flex: 1;
  min-width: 0;
}

.store-card__main {
  display: flex;
  flex-direction: column;
  align-self: stretch;
  justify-content: space-between;
  padding: 4rpx 0;
}

.complete-card__title {
  color: var(--color-text);
  font-weight: var(--font-weight-heavy);
}

.day-chip,
.mini-pill,
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
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.summary-card__badge--shared {
  background: var(--color-surface-muted);
  color: var(--color-info);
  box-shadow: inset 0 0 0 1rpx var(--color-border);
}

.summary-card__badge--done {
  background: var(--color-warning-soft);
  color: var(--color-warning-text);
}

.summary-card__badge--voided {
  background: var(--color-danger-soft);
  color: var(--color-danger-text);
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
  color: var(--color-primary);
}

.store-card__title {
  display: block;
  color: var(--color-text);
  font-size: 40rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.24;
}

.store-card__desc {
  display: block;
  margin-top: 0;
  color: var(--color-text-secondary);
  font-size: 26rpx;
  line-height: 1.7;
}

.store-card__aside {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  justify-content: flex-start;
  gap: 18rpx;
  align-items: flex-end;
  margin-left: auto;
}

.store-card__stat {
  display: flex;
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
  align-items: center;
  justify-content: center;
  min-width: 196rpx;
  min-height: 72rpx;
  padding: 0 24rpx;
  border-radius: var(--radius-pill);
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  font-size: 24rpx;
  font-weight: var(--font-weight-heavy);
}

.store-card__button--finish {
  background: color-mix(in srgb, var(--color-surface) 92%, var(--color-page) 8%);
  box-shadow: var(--shadow-card);
  color: var(--color-text);
}

.store-card__button--plain {
  background: color-mix(in srgb, var(--color-surface) 92%, var(--color-page) 8%);
  box-shadow: var(--shadow-card);
  color: var(--color-text);
}

.store-card__button--disabled {
  opacity: 0.58;
}

.progress-card__track {
  height: 16rpx;
  margin-top: 12rpx;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-primary-soft) 62%, var(--color-surface));
  overflow: hidden;
}

.progress-card__bar {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
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

.mini-pill,
.sheet-actions__button,
.search-box__button {
  margin: 0;
  font-size: var(--font-size-sm);
}

.search-box__button,
.sheet-actions__button--cancel,
.mini-pill {
  background: color-mix(in srgb, var(--color-surface) 82%, var(--color-primary-soft) 18%);
  color: color-mix(in srgb, var(--color-text) 86%, var(--color-primary) 14%);
  box-shadow:
    inset 0 0 0 1rpx color-mix(in srgb, var(--color-primary) 18%, var(--color-border) 82%),
    0 6rpx 14rpx color-mix(in srgb, var(--color-surface-mask-medium) 10%, transparent);
}

.sheet-actions__button {
  min-width: 168rpx;
}

.sheet-actions__button--confirm {
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  color: var(--button-primary-text);
}

.mini-pill--danger {
  background: var(--color-danger-soft);
  color: var(--color-danger-text);
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
  background: var(--color-danger-soft);
  color: var(--color-danger-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.item-swipe__content {
  position: relative;
  z-index: 1;
  padding: 24rpx;
  background: var(--color-surface);
  transition: transform 180ms ease;
}

.item-swipe__content--dragging {
  transition: none;
}

.item-card {
  display: flex;
  align-items: stretch;
}

.item-row__cover {
  flex: 0 0 140rpx;
}

.item-row__main {
  display: flex;
  flex-direction: column;
}

.item-row__image,
.item-row__placeholder {
  width: 140rpx;
  height: 140rpx;
  border-radius: var(--radius-xs);
}

.item-row__image {
  display: block;
  background: var(--color-surface-muted);
}

.item-row__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--color-primary-soft) 34%, var(--color-surface) 66%);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.item-row__top,
.item-row__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.item-row__bottom {
  margin-top: auto;
  align-items: center;
}

.item-row__title,
.item-row__quantity,
.item-origin__tag {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.item-row__quantity {
  flex: 0 0 auto;
  text-align: right;
}

.item-row__category {
  flex: 0 1 auto;
  min-width: 0;
  line-height: 40rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.item-row__bottom-left {
  flex: 1;
  min-width: 0;
}

.item-row__origin-toggle {
  flex: 0 0 auto;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  line-height: 48rpx;
}

.item-row__origin-toggle--open {
  color: var(--color-primary);
}

.item-row__info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.item-row__inventory {
  flex: 0 0 auto;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.item-row__inventory--warning {
  color: var(--color-danger-text);
  font-weight: var(--font-weight-semibold);
}

.item-row__actions {
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.item-row__actions .mini-pill {
  height: 48rpx;
  line-height: 48rpx;
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
  max-height: 120rpx;
  opacity: 1;
  transform: translateY(0);
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
  border-top: 1rpx solid color-mix(in srgb, var(--color-border) 72%, var(--color-surface) 28%);
}

.item-origin__tag {
  flex: 0 0 auto;
  padding: 6rpx 16rpx;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: var(--font-size-xs);
}

.item-origin__text {
  flex: 0 1 auto;
  min-width: 0;
  text-align: right;
}

.mini-pill {
  min-width: 118rpx;
  padding: 0 20rpx;
}

.mini-pill--pending {
  opacity: 0.72;
}

.mini-pill--active {
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  color: var(--button-primary-text);
  box-shadow: none;
}

.mini-pill--disabled {
  background: color-mix(in srgb, var(--color-surface) 88%, var(--color-page) 12%);
  color: color-mix(in srgb, var(--color-text-tertiary) 82%, var(--color-text) 18%);
  box-shadow:
    inset 0 0 0 1rpx color-mix(in srgb, var(--color-border) 88%, transparent),
    none;
  opacity: 1;
}

.mini-pill--locked {
  opacity: 0.62;
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
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  font-size: 24rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.2;
  text-align: center;
  white-space: normal;
}

.floating-dock__store--finish {
  background: color-mix(in srgb, var(--color-surface) 92%, var(--color-page) 8%);
  color: var(--color-text);
  box-shadow: var(--shadow-card);
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
  background: color-mix(in srgb, var(--color-surface) 96%, white 4%);
  box-shadow:
    0 18rpx 34rpx color-mix(in srgb, var(--color-primary-soft) 30%, transparent),
    0 8rpx 18rpx color-mix(in srgb, var(--color-primary) 12%, transparent),
    inset 0 0 0 1rpx color-mix(in srgb, var(--color-surface) 85%, transparent);
  color: var(--color-text);
  white-space: nowrap;
  opacity: 0;
  transform: translateX(26rpx) scale(0.92);
  pointer-events: none;
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
  background: color-mix(in srgb, var(--color-danger-soft) 66%, var(--color-surface) 34%);
  box-shadow:
    0 18rpx 34rpx color-mix(in srgb, var(--color-danger-soft) 34%, transparent),
    0 8rpx 18rpx color-mix(in srgb, var(--color-danger-text) 12%, transparent),
    inset 0 0 0 1rpx color-mix(in srgb, var(--color-danger-text) 10%, transparent);
}

.manage-dock__action-icon {
  color: color-mix(in srgb, var(--color-text) 84%, var(--color-primary) 16%);
  font-size: 34rpx;
}

.manage-dock__action-icon--danger {
  color: color-mix(in srgb, var(--color-danger-text) 78%, var(--color-text) 22%);
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
  color: color-mix(in srgb, var(--color-danger-text) 82%, var(--color-text) 18%);
}

.manage-dock__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 92rpx;
  height: 92rpx;
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
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
  padding: 22rpx;
  border-radius: 24rpx;
  background: var(--color-surface-muted);
}

.ingredient-item + .ingredient-item {
  margin-top: 12rpx;
}

.ingredient-item--active {
  border: 2rpx solid var(--color-border);
  background: var(--color-primary-soft);
}

.ingredient-item__title,
.ingredient-item__meta {
  display: block;
}

.ingredient-item__title,
.editor-card__value {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.ingredient-item__meta {
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.editor-card,
.share-card,
.complete-card {
  padding: 24rpx;
}

.editor-card__value {
  margin: 8rpx 0 16rpx;
}

.editor-card .sheet-input + .sheet-input {
  margin-top: 12rpx;
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
  background: var(--color-primary-soft);
  color: var(--color-primary);
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
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.collaborator-chip__remove-icon {
  color: var(--color-danger-text);
  font-size: 18rpx;
}

.share-card--button {
  position: relative;
  display: block;
  width: 100%;
  margin: 0;
  padding: 24rpx;
  border: 0;
  background: var(--color-surface);
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
  color: #7c5600;
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
  background: var(--color-primary-soft);
  box-shadow: inset 0 0 0 2rpx var(--color-border);
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
  background: var(--color-primary-soft);
  color: var(--color-primary);
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
  color: var(--color-primary);
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
  background: var(--color-primary-soft);
  color: var(--color-primary);
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
