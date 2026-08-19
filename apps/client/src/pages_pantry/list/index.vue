<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="" full-screen :show-left="false" navbar-layout="custom-left">
    <template #navbar-left>
      <view class="home-nav">
        <view class="cookfont icon-back home-nav__back" hover-class="home-nav__back--hover" hover-stay-time="100" @click="goBack" />
        <view class="nav-tabs">
          <view
            v-for="item in statusTabs"
            :key="item.status"
            class="nav-tabs__item"
            :class="{ 'nav-tabs__item--active': status === item.status }"
            @click="changeStatus(item.status)"
          >
            {{ item.label }}
          </view>
        </view>
      </view>
    </template>

    <Login
      v-if="!sessionStore.isLoggedIn"
      title="登录后查看购物清单"
      description="共享清单、协作采购和分享加入都需要登录后处理。"
      @success="handleLoginSuccess"
    />

    <view v-else class="shopping-home">
      <view class="shopping-home__scroll-wrap">
        <RecipeSearchLoading
          :pull-distance="pullDistance"
          :refreshing="refreshing"
          :show-success="showSuccess"
          :refresher-text="refresherText"
          :threshold="refresherThreshold"
        />
        <scroll-view
          scroll-y
          class="shopping-home__scroll"
          refresher-enabled
          refresher-default-style="none"
          :show-scrollbar="false"
          :refresher-threshold="refresherThreshold"
          :refresher-triggered="refresherTriggered"
          @refresherpulling="onRefresherPulling"
          @refresherrefresh="handleRefresherRefresh"
          @refresherrestore="onRefresherRestore"
          @refresherabort="onRefresherRestore"
        >
          <view class="shopping-home__body">
            <view v-if="errorText" class="notice" @click="loadPage">{{ errorText }}</view>
            <view v-else-if="loading && !lists.length" class="notice">加载中...</view>
            <template v-else>
              <Empty
                v-if="!lists.length"
                :title="emptyTitle"
                :description="emptyDescription"
                :art="emptyStateArt"
              />

              <view v-else class="list">
                <view
                  v-for="item in lists"
                  :key="item.id"
                  class="list-card"
                  :class="{ 'list-card--shared': showBadge(item) }"
                  hover-class="list-card--hover"
                  hover-stay-time="100"
                  @click="openList(item.id)"
                >
                  <text v-if="showBadge(item)" class="list-card__badge" :class="badgeClass(item)">{{ badgeText(item) }}</text>
                  <text v-if="cardNote(item)" class="list-card__note">{{ cardNote(item) }}</text>
                  <view class="list-card__head">
                    <view class="list-card__title-row">
                      <view class="list-card__title-main">
                        <text class="list-card__title">{{ item.name }}</text>
                        <text
                          v-if="item.role === 'OWNER' && item.status === 'ACTIVE'"
                          class="cookfont icon-edit list-card__edit"
                          @click.stop="openRenameSheet(item)"
                        />
                      </view>
                      <text class="list-card__date">{{ formatDate(item) }}</text>
                    </view>
                  </view>

                  <view class="progress-block">
                    <view class="progress-block__head">
                      <text class="progress-block__label">采购进度</text>
                      <text class="progress-block__value">{{ item.progressDoneCount }}/{{ item.progressTotalCount }}</text>
                    </view>
                    <view class="progress-block__track">
                      <view class="progress-block__value-bar" :style="{ width: `${progressPercent(item)}%` }" />
                    </view>
                  </view>

                  <view class="list-card__actions">
                    <template v-if="item.status === 'ACTIVE' && item.role === 'OWNER'">
                      <button class="action-pill action-pill--muted action-pill--subtle" :disabled="isListBusy(item.id)" @click.stop="openShareManager(item)">协作</button>
                      <button class="action-pill action-pill--primary" :disabled="isListBusy(item.id)" @click.stop="markComplete(item)">
                        标记完成
                      </button>
                      <button class="action-pill action-pill--muted" :disabled="isListBusy(item.id)" @click.stop="voidList(item)">作废</button>
                    </template>

                    <template v-else-if="item.status === 'ACTIVE'">
                      <button class="action-pill" :disabled="isListBusy(item.id)" @click.stop="copyList(item)">复制</button>
                      <button class="action-pill action-pill--primary" :disabled="isListBusy(item.id)" @click.stop="openList(item.id)">继续采购</button>
                      <button class="action-pill action-pill--danger" :disabled="isListBusy(item.id)" @click.stop="leaveList(item)">退出</button>
                    </template>

                    <template v-else-if="item.status === 'COMPLETED'">
                      <button class="action-pill" :disabled="isListBusy(item.id)" @click.stop="copyList(item)">复制清单</button>
                      <button class="action-pill action-pill--primary" :disabled="isListBusy(item.id)" @click.stop="openList(item.id)">查看清单</button>
                      <button
                        v-if="item.role === 'OWNER'"
                        class="action-pill action-pill--danger"
                        :disabled="isListBusy(item.id)"
                        @click.stop="deleteList(item)"
                      >
                        删除
                      </button>
                    </template>

                    <template v-else>
                      <button v-if="item.role === 'OWNER'" class="action-pill" :disabled="isListBusy(item.id)" @click.stop="restoreList(item)">
                        恢复采购
                      </button>
                      <button v-if="item.role === 'COLLABORATOR'" class="action-pill" :disabled="isListBusy(item.id)" @click.stop="openList(item.id)">查看清单</button>
                      <button class="action-pill action-pill--primary" :disabled="isListBusy(item.id)" @click.stop="copyList(item)">复制清单</button>
                      <button
                        v-if="item.role === 'OWNER'"
                        class="action-pill action-pill--danger"
                        :disabled="isListBusy(item.id)"
                        @click.stop="deleteList(item)"
                      >
                        删除
                      </button>
                    </template>
                  </view>
                </view>
              </view>
            </template>
          </view>
        </scroll-view>
      </view>

      <view class="create-fab" hover-class="create-fab--hover" hover-stay-time="100" @click="openCreateSheet">
        <text class="cookfont icon-add create-fab__icon" />
      </view>
    </view>

    <SheetShell
      :visible="createSheetVisible"
      :title="sheetTitle"
      :subtitle="sheetSubtitle"
      @close="closeCreateSheet"
      @after-close="handleCreateSheetAfterClose"
    >
      <input
        v-model="createName"
        class="sheet-input"
        maxlength="20"
        placeholder="请输入购物清单名"
      />
      <template #footer>
        <view class="sheet-actions">
          <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="submitting" @click="closeCreateSheet">取消</button>
          <button class="sheet-actions__button sheet-actions__button--confirm" :disabled="submitting || !createName.trim()" @click="submitSheet">
            {{ submitting ? sheetSubmittingText : sheetConfirmText }}
          </button>
        </view>
      </template>
    </SheetShell>

    <InviteShareSheet
      :visible="shareManageVisible"
      :title="shareManageTitle"
      :subtitle="shareManageSubtitle"
      single-share
      :friend-action="shareFriendAction"
      :error-text="shareLinkError"
      :show-close-action="canCloseShare"
      close-action-text="关闭分享"
      :close-action-disabled="submitting"
      @close="closeShareManager"
      @friend="handleShareFriendClick"
      @close-action="closeShare"
    >
      <template #title-extra>
        <view class="sheet-help" @click.stop="openShareNotice">
          <text class="cookfont icon-qa sheet-help__icon" />
        </view>
      </template>
      <template #header>
        <view v-if="shareActive && shareTarget" class="collaborator-strip">
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

    <SheetShell
      :visible="shareSheetVisible"
      title="加入共享清单"
      :subtitle="shareSheetSubtitle"
      @close="closeShareSheet"
    >
      <view v-if="shareLoading" class="sheet-note">加载中...</view>
      <view v-else-if="shareErrorText" class="sheet-note sheet-note--error">{{ shareErrorText }}</view>
      <view v-else-if="sharePreview" class="share-preview">
        <text class="share-preview__title">{{ sharePreview.name }}</text>
        <text class="share-preview__meta">{{ shareOwnerText(sharePreview) }} · {{ sharePreview.memberCount }}/{{ sharePreview.memberLimit }} 人协作</text>
        <text class="share-preview__meta">{{ sharePreview.itemCount }} 个食材项 · {{ shareStatusText(sharePreview.status) }}</text>
      </view>
      <template #footer>
        <view class="sheet-actions">
          <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="joiningShare" @click="closeShareSheet">稍后再说</button>
          <button
            class="sheet-actions__button sheet-actions__button--confirm"
            :disabled="shareJoinDisabled"
            @click="joinShare"
          >
            {{ shareJoinText }}
          </button>
        </view>
      </template>
    </SheetShell>

  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShareAppMessage, onShow } from "@dcloudio/uni-app";
import type { UUID } from "@/apis/http";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import RecipeSearchLoading from "@/components/Recipe/RecipeSearchLoading.vue";
import InviteShareSheet from "@/components/Share/InviteShareSheet.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import emptyStateArt from "@/assets/recipe-page/empty-state.svg";
import { useCustomRefresher } from "@/composables/useCustomRefresher";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { createOperationId } from "@/utils/operation-id";
import { formatMonthDay } from "../utils/date";
import {
  shoppingApi,
  type ShoppingListCollaborator,
  type ShoppingListDetail,
  type ShoppingListStatus,
  type ShoppingListSummary,
  type ShoppingSharePreview
} from "../apis/shopping";
import { buildShoppingCompletePagePath, consumeShoppingCompleteResult } from "../list-complete/bridge";

const pageStyle = usePageScrollStyle();
const sessionStore = useSessionStore();
const userStore = useUserStore();

const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const status = ref<ShoppingListStatus>("ACTIVE");
const lists = ref<ShoppingListSummary[]>([]);

const createSheetVisible = ref(false);
const createName = ref("");
const editingList = ref<ShoppingListSummary | null>(null);

const shareToken = ref("");
const shareSheetVisible = ref(false);
const shareLoading = ref(false);
const joiningShare = ref(false);
const shareErrorText = ref("");
const sharePreview = ref<ShoppingSharePreview | null>(null);
const shareManageVisible = ref(false);
const shareTarget = ref<ShoppingListDetail | null>(null);
const shareNoticeVisible = ref(false);
const shareLinkLoading = ref(false);
const shareLinkError = ref("");
const shareUrl = ref("");
const copyingListId = ref<UUID | "">("");
const busyListId = ref<UUID | "">("");

const statusTabs = computed(() => [
  { status: "ACTIVE" as const, label: "采购中" },
  { status: "COMPLETED" as const, label: "已完成" },
  { status: "VOIDED" as const, label: "已作废" }
]);
const emptyTitle = computed(() => {
  if (status.value === "COMPLETED") return "还没有已完成清单";
  if (status.value === "VOIDED") return "还没有已作废清单";
  return "还没有采购中清单";
});
const emptyDescription = computed(() => {
  if (status.value === "COMPLETED") return "采购完成的清单会收在这里，方便复制后再次采购。";
  if (status.value === "VOIDED") return "暂时取消的清单会放在这里，后续也可以恢复继续采购。";
  return "先新建一张购物清单，再把菜谱食材或临时补货加进来。";
});
const shareSheetSubtitle = computed(() => {
  if (!sharePreview.value) return "确认后，这张清单会出现在你的购物清单首页里。";
  if (sharePreview.value.joined) return "你已经加入这张共享清单，可直接进入继续维护。";
  if (!sharePreview.value.canJoin) return "当前协作者名额已满，暂时不能继续加入。";
  return "确认加入后，这张清单会出现在你的购物清单首页里，后续可一起维护。";
});
const shareJoinDisabled = computed(() => {
  if (!sharePreview.value || Boolean(shareErrorText.value)) return true;
  if (sharePreview.value.joined) return false;
  return joiningShare.value || !sharePreview.value.canJoin;
});
const shareJoinText = computed(() => {
  if (joiningShare.value) return sharePreview.value?.joined ? "进入中..." : "加入中...";
  if (!sharePreview.value) return "加入清单";
  if (sharePreview.value.joined) return "进入清单";
  if (!sharePreview.value.canJoin) return "协作者已满";
  return "确认加入";
});
const shareActive = computed(() => Boolean(shareTarget.value && (shareTarget.value.memberCount > 1 || shareTarget.value.pendingInviteCount > 0)));
const canUseShareFeature = computed(() => userStore.profile?.membership?.tier !== "FREE");
const shareMemberFull = computed(() => {
  if (!shareTarget.value) return false;
  return shareTarget.value.memberCount >= shareTarget.value.memberLimit;
});
const shareCollaborators = computed(() => shareTarget.value?.collaborators ?? []);
const shareEmptySlots = computed(() => {
  if (!shareTarget.value) return [];
  const remain = Math.max(shareTarget.value.memberLimit - shareCollaborators.value.length, 0);
  return Array.from({ length: remain }, (_, index) => index + 1);
});
const sharePendingText = computed(() => {
  if (!shareTarget.value?.pendingInviteCount) return "";
  return `当前还有 ${shareTarget.value.pendingInviteCount} 位待确认。`;
});
const shareManageTitle = computed(() => "清单协作");
const shareManageSubtitle = computed(() => {
  if (!shareTarget.value) return "直接转发给好友，对方确认后一起维护。";
  if (shareActive.value) return `最多 ${shareTarget.value.memberLimit} 人协作，先加入者优先。`;
  return "会生成好友分享入口，对方确认后加入。";
});
const canCloseShare = computed(() => shareTarget.value?.role === "OWNER" && shareTarget.value?.status === "ACTIVE" && shareActive.value);
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
  if (!shareTarget.value) return "当前只支持小范围协作，先加入者优先。";
  return `当前最多支持 ${shareTarget.value.memberLimit} 人一起维护，先加入者优先。`;
});
const sheetTitle = computed(() => editingList.value ? "修改清单名" : "新建购物清单");
const sheetSubtitle = computed(() => editingList.value ? "改成更好识别的名字，方便这次采购和后续继续维护。" : "先起一个名字，后续再把菜谱、缺口和手动补货收进来。");
const sheetConfirmText = computed(() => editingList.value ? "保存" : "创建并进入");
const sheetSubmittingText = computed(() => editingList.value ? "保存中..." : "创建中...");
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
    pulling: "下拉刷新清单",
    canRelease: ["松手刷新清单", "更新采购进度"],
    success: "清单已刷新"
  }
});

onShareAppMessage(() => ({
  title: shareTarget.value?.name ? `${shareTarget.value.name}，一起补齐这顿饭` : "邀请你一起维护购物清单",
  path: shareUrl.value || "/pages_pantry/list/index"
}));

onLoad((query) => {
  const token = Array.isArray(query?.shareToken) ? query.shareToken[0] : query?.shareToken;
  shareToken.value = typeof token === "string" ? decodeURIComponent(token) : "";
});

onShow(() => {
  if (!sessionStore.isLoggedIn) return;
  const completedDetail = consumeShoppingCompleteResult("list");
  if (completedDetail) {
    applyCompletedSummary(completedDetail);
  } else {
    void loadPage();
  }
  if (shareToken.value) {
    void loadSharePreview();
  }
});

async function handleLoginSuccess() {
  await loadPage();
  if (shareToken.value) {
    await loadSharePreview();
  }
}

async function loadPage() {
  if (!sessionStore.isLoggedIn || loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    const summary = await shoppingApi.getListSummary();
    const nextStatus = summary.statuses.find(item => item.status === status.value) ? status.value : summary.defaultStatus;
    if (status.value !== nextStatus) status.value = nextStatus;
    const page = await shoppingApi.listLists(nextStatus);
    lists.value = page.items;
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "购物清单加载失败";
  } finally {
    loading.value = false;
  }
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

async function loadSharePreview() {
  if (!sessionStore.isLoggedIn || !shareToken.value || shareLoading.value) return;
  shareLoading.value = true;
  shareErrorText.value = "";
  sharePreview.value = null;
  shareSheetVisible.value = true;
  try {
    sharePreview.value = await shoppingApi.getSharePreview(shareToken.value);
  } catch (error) {
    shareErrorText.value = error instanceof Error ? error.message : "分享清单加载失败";
  } finally {
    shareLoading.value = false;
  }
}

function changeStatus(nextStatus: ShoppingListStatus) {
  if (status.value === nextStatus) return;
  status.value = nextStatus;
  void loadPage();
}

async function goBack() {
  try {
    await uniPlatform.navigation.navigateBack();
  } catch {
    await uniPlatform.navigation.reLaunch("/pages/home/index");
  }
}

function progressPercent(item: ShoppingListSummary) {
  if (!item.progressTotalCount) return 0;
  return Math.min(100, Math.round((item.progressDoneCount / item.progressTotalCount) * 100));
}

function cardNote(item: ShoppingListSummary) {
  if (item.role !== "COLLABORATOR") return "";
  return `来自 ${item.ownerNickname || `UID ${item.ownerUid}`} 的清单`;
}

function showBadge(item: ShoppingListSummary) {
  return item.memberCount > 1;
}

function badgeText(item: ShoppingListSummary) {
  if (item.role === "COLLABORATOR") return "协作中";
  return "已共享";
}

function badgeClass(item: ShoppingListSummary) {
  if (item.role === "COLLABORATOR") return "list-card__badge--shared";
  return "list-card__badge--owner";
}

function formatDate(item: ShoppingListSummary) {
  if (item.status === "COMPLETED" && item.completedAt) return formatMonthDay(item.completedAt);
  if (item.status === "VOIDED" && item.voidedAt) return formatMonthDay(item.voidedAt);
  return formatMonthDay(item.createdAt);
}

function isListBusy(listId: UUID) {
  return busyListId.value === listId || copyingListId.value === listId;
}

function buildListSummary(detail: ShoppingListDetail): ShoppingListSummary {
  return {
    id: detail.id,
    name: detail.name,
    status: detail.status,
    role: detail.role,
    ownerUid: detail.ownerUid,
    ownerNickname: detail.ownerNickname,
    memberCount: detail.memberCount,
    memberLimit: detail.memberLimit,
    pendingInviteCount: detail.pendingInviteCount,
    progressDoneCount: detail.progressDoneCount,
    progressTotalCount: detail.progressTotalCount,
    hasActiveShareLink: detail.hasActiveShareLink,
    version: detail.version,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    completedAt: detail.completedAt,
    voidedAt: detail.voidedAt
  };
}

function openList(listId: UUID, action = "") {
  const query = action ? `?id=${encodeURIComponent(String(listId))}&action=${encodeURIComponent(action)}` : `?id=${encodeURIComponent(String(listId))}`;
  void uniPlatform.navigation.navigateTo(`/pages_pantry/list-detail/index${query}`);
}

function openCreateSheet() {
  editingList.value = null;
  createName.value = buildDefaultListName();
  createSheetVisible.value = true;
}

function closeCreateSheet() {
  createSheetVisible.value = false;
}

function handleCreateSheetAfterClose() {
  createName.value = "";
  editingList.value = null;
}

function openRenameSheet(item: ShoppingListSummary) {
  editingList.value = item;
  createName.value = item.name;
  createSheetVisible.value = true;
}

async function createList() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const detail = await shoppingApi.createList({
      operationId: createOperationId(),
      name: createName.value.trim() || null
    });
    closeCreateSheet();
    await loadPage();
    await uniPlatform.feedback.toast({ title: "已创建清单", icon: "success" });
    openList(detail.id);
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "创建失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function renameList() {
  if (!editingList.value || submitting.value) return;
  submitting.value = true;
  try {
    await shoppingApi.renameList(editingList.value.id, {
      operationId: createOperationId(),
      version: editingList.value.version,
      name: createName.value.trim()
    });
    closeCreateSheet();
    await loadPage();
    await uniPlatform.feedback.toast({ title: "已更新清单名", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "保存失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

function submitSheet() {
  if (editingList.value) {
    void renameList();
    return;
  }
  void createList();
}

async function copyList(item: ShoppingListSummary) {
  if (submitting.value || copyingListId.value) return;
  copyingListId.value = item.id;
  try {
    const detail = await shoppingApi.copyList(item.id, {
      operationId: createOperationId(),
      version: item.version
    });
    await loadPage();
    await uniPlatform.feedback.toast({ title: "已复制到新清单", icon: "success" });
    openList(detail.id);
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "复制失败", icon: "none" });
  } finally {
    copyingListId.value = "";
  }
}

async function openShareManager(item: ShoppingListSummary) {
  if (submitting.value || shareLinkLoading.value || isListBusy(item.id)) return;
  busyListId.value = item.id;
  try {
    shareTarget.value = await shoppingApi.getListDetail(item.id);
    shareManageVisible.value = true;
    shareLinkError.value = "";
    if (!shareMemberFull.value && !shareUrl.value) {
      await prepareShareLink(true);
    }
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "共享加载失败", icon: "none" });
  } finally {
    busyListId.value = "";
  }
}

async function voidList(item: ShoppingListSummary) {
  if (submitting.value || isListBusy(item.id)) return;
  const confirmed = await uniPlatform.feedback.confirm({
    title: "作废清单",
    content: "作废后这张清单会移到已作废列表，后续仍可恢复。"
  });
  if (!confirmed) return;
  busyListId.value = item.id;
  try {
    await shoppingApi.voidList(item.id, {
      operationId: createOperationId(),
      version: item.version
    });
    await loadPage();
    await uniPlatform.feedback.toast({ title: "已作废", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "操作失败", icon: "none" });
  } finally {
    busyListId.value = "";
  }
}

async function restoreList(item: ShoppingListSummary) {
  if (submitting.value || isListBusy(item.id)) return;
  busyListId.value = item.id;
  try {
    await shoppingApi.restoreList(item.id, {
      operationId: createOperationId(),
      version: item.version
    });
    await loadPage();
    await uniPlatform.feedback.toast({ title: "已恢复采购", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "恢复失败", icon: "none" });
  } finally {
    busyListId.value = "";
  }
}

async function leaveList(item: ShoppingListSummary) {
  if (submitting.value || isListBusy(item.id)) return;
  const confirmed = await uniPlatform.feedback.confirm({
    title: "退出共享清单",
    content: "退出后这张清单会从你的购物清单首页移除。"
  });
  if (!confirmed) return;
  busyListId.value = item.id;
  try {
    await shoppingApi.leaveList(item.id, {
      operationId: createOperationId(),
      version: item.version
    });
    await loadPage();
    await uniPlatform.feedback.toast({ title: "已退出", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "退出失败", icon: "none" });
  } finally {
    busyListId.value = "";
  }
}

async function deleteList(item: ShoppingListSummary) {
  if (submitting.value || isListBusy(item.id)) return;
  const confirmed = await uniPlatform.feedback.confirm({
    title: "删除清单",
    content: "删除后这张清单和其中食材会从购物清单与兼容记录里移除，无法恢复。"
  });
  if (!confirmed) return;
  busyListId.value = item.id;
  try {
    await shoppingApi.deleteList(item.id, {
      operationId: createOperationId(),
      version: item.version
    });
    await loadPage();
    await uniPlatform.feedback.toast({ title: "已删除", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "删除失败", icon: "none" });
  } finally {
    busyListId.value = "";
  }
}

async function markComplete(item: ShoppingListSummary) {
  if (submitting.value || isListBusy(item.id)) return;
  busyListId.value = item.id;
  try {
    if (!item.progressTotalCount) {
      const detail = await shoppingApi.completeList(item.id, {
        operationId: createOperationId(),
        version: item.version,
        entries: []
      });
      applyCompletedSummary(detail);
      await loadPage();
      await uniPlatform.feedback.toast({ title: "已标记完成", icon: "success" });
      return;
    }
    const detail = item.progressTotalCount > 0 && item.progressDoneCount < item.progressTotalCount
      ? await shoppingApi.checkAllListItems(item.id, {
          operationId: createOperationId(),
          version: item.version
        })
      : await shoppingApi.getListDetail(item.id);
    syncListSummary(detail);
    openCompletePage(detail.id);
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "标记失败", icon: "none" });
  } finally {
    busyListId.value = "";
  }
}

function syncListSummary(detail: ShoppingListDetail) {
  const nextItem = buildListSummary(detail);
  lists.value = lists.value.map(item => (
    item.id === detail.id
      ? nextItem
      : item
  ));
}

function applyCompletedSummary(detail: ShoppingListDetail) {
  const nextItem = buildListSummary(detail);
  if (status.value === "ACTIVE") {
    lists.value = lists.value.filter(item => item.id !== detail.id);
    return;
  }
  if (status.value === "COMPLETED") {
    const nextLists = lists.value.filter(item => item.id !== detail.id);
    lists.value = [nextItem, ...nextLists];
    return;
  }
  syncListSummary(detail);
}

function openCompletePage(listId: UUID) {
  void uniPlatform.navigation.navigateTo(buildShoppingCompletePagePath(listId, "list"));
}

function closeShareSheet() {
  shareSheetVisible.value = false;
  shareToken.value = "";
  sharePreview.value = null;
  shareErrorText.value = "";
}

function closeShareManager() {
  shareManageVisible.value = false;
  shareTarget.value = null;
  shareNoticeVisible.value = false;
  shareUrl.value = "";
  shareLinkError.value = "";
}

function openShareNotice() {
  if (!shareManageVisible.value) return;
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
    shareTarget.value
    && shareTarget.value.role === "OWNER"
    && shareTarget.value.status === "ACTIVE"
    && member.role === "COLLABORATOR"
    && member.user.uid !== sessionStore.uid
  );
}

async function prepareShareLink(silent = false) {
  if (!shareTarget.value || !canUseShareFeature.value || submitting.value || shareLinkLoading.value || shareMemberFull.value) return;
  shareLinkLoading.value = true;
  shareLinkError.value = "";
  try {
    const result = await shoppingApi.createShareLink(shareTarget.value.id, {
      operationId: createOperationId(),
      version: shareTarget.value.version
    });
    shareUrl.value = result.shareUrl;
    shareTarget.value = await shoppingApi.getListDetail(shareTarget.value.id);
    syncListSummary(shareTarget.value);
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
  if (!shareTarget.value || !canRemoveShareMember(member) || submitting.value) return;
  const confirmed = await uniPlatform.feedback.confirm({
    title: "移除协作者",
    content: `移除后，${shareMemberName(member)} 将失去这张清单的协作权限。`
  });
  if (!confirmed) return;
  submitting.value = true;
  try {
    shareTarget.value = await shoppingApi.removeListMember(shareTarget.value.id, member.userId, {
      operationId: createOperationId(),
      version: shareTarget.value.version
    });
    syncListSummary(shareTarget.value);
    await uniPlatform.feedback.toast({ title: "已移除", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "移除失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function closeShare() {
  if (!shareTarget.value || !canCloseShare.value || submitting.value) return;
  const confirmed = await uniPlatform.feedback.confirm({
    title: "关闭共享",
    content: "关闭后，好友链接和待确认邀请都会失效，新的协作者不能再加入。"
  });
  if (!confirmed) return;
  submitting.value = true;
  try {
    shareTarget.value = await shoppingApi.closeShare(shareTarget.value.id, {
      operationId: createOperationId(),
      version: shareTarget.value.version
    });
    syncListSummary(shareTarget.value);
    shareUrl.value = "";
    shareLinkError.value = "";
    await uniPlatform.feedback.toast({ title: "已关闭共享", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "操作失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

function shareOwnerText(preview: ShoppingSharePreview) {
  return preview.ownerNickname?.trim() ? preview.ownerNickname : `发起人 UID ${preview.ownerUid}`;
}

function shareStatusText(nextStatus: ShoppingListStatus) {
  if (nextStatus === "COMPLETED") return "已完成";
  if (nextStatus === "VOIDED") return "已作废";
  return "采购中";
}

function buildDefaultListName(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}月${day}日清单`;
}

async function joinShare() {
  if (!shareToken.value || !sharePreview.value || joiningShare.value) return;
  if (sharePreview.value.joined) {
    closeShareSheet();
    openList(sharePreview.value.listId);
    return;
  }
  if (!sharePreview.value.canJoin) return;
  joiningShare.value = true;
  try {
    const detail = await shoppingApi.joinShare(shareToken.value, createOperationId());
    closeShareSheet();
    await loadPage();
    await uniPlatform.feedback.toast({ title: "已加入清单", icon: "success" });
    openList(detail.id);
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "加入失败", icon: "none" });
  } finally {
    joiningShare.value = false;
  }
}
</script>

<style scoped lang="scss">
.shopping-home {
  position: relative;
  height: 100%;
}

.shopping-home__scroll-wrap {
  position: relative;
  height: 100%;
}

.shopping-home__scroll {
  height: 100%;
}

.shopping-home__body {
  padding: 12rpx var(--space-page) calc(176rpx + env(safe-area-inset-bottom));
}

.home-nav {
  display: flex;
  align-items: center;
  gap: 22rpx;
  min-width: 0;
}

.home-nav__back {
  color: var(--color-text);
  font-size: 32rpx;
}

.home-nav__back--hover {
  opacity: 0.7;
}

.nav-tabs {
  display: flex;
  gap: 36rpx;
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
  font-size: 34rpx;
  font-weight: var(--font-weight-heavy);
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

.notice,
.list-card,
.share-preview {
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.list-card__title,
.list-card__date,
.progress-block__label,
.progress-block__value,
.share-preview__title,
.share-preview__meta,
.sheet-note {
  display: block;
}

.notice,
.list-card,
.list {
  margin-top: 16rpx;
}

.notice {
  padding: 28rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.list-card {
  position: relative;
  padding: 28rpx;
}

.list-card--hover {
  opacity: 0.9;
}

.list-card + .list-card {
  margin-top: var(--space-page);
}

.list-card__head,
.progress-block__head,
.list-card__actions,
.list-card__title-row {
  display: flex;
  gap: 16rpx;
}

.list-card__head,
.progress-block__head {
  align-items: flex-start;
  justify-content: space-between;
  min-width: 0;
}

.list-card__title {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text);
  font-size: 40rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-card__title-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  width: 100%;
  min-width: 0;
}

.list-card__title-main {
  display: flex;
  flex: 1;
  min-width: 0;
  max-width: 100%;
  align-items: center;
  gap: 12rpx;
}

.list-card__edit {
  flex: 0 0 auto;
  color: var(--color-text-secondary);
  font-size: 26rpx;
}

.list-card__note,
.list-card__date,
.progress-block__label,
.progress-block__value,
.share-preview__meta,
.sheet-note {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.list-card__note {
  margin-bottom: 10rpx;
}

.list-card__date {
  margin-top: 0;
  flex: 0 0 auto;
  white-space: nowrap;
  text-align: right;
}

.list-card__badge {
  position: absolute;
  top: 0;
  right: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8rpx 18rpx;
  border-radius: 0 var(--radius-xs) 0 var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.list-card__badge--owner {
  background: var(--color-warning-soft);
  color: var(--color-warning-text);
}

.list-card__badge--shared {
  background: var(--color-surface-muted);
  color: var(--color-info);
  box-shadow: inset 0 0 0 1rpx var(--color-border);
}

.progress-block {
  margin-top: 20rpx;
}

.progress-block__track {
  height: 14rpx;
  margin-top: 12rpx;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  overflow: hidden;
}

.progress-block__value-bar {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
}

.list-card__actions {
  flex-wrap: wrap;
  margin-top: 22rpx;
  justify-content: flex-end;
}

.create-fab {
  position: fixed;
  right: 24rpx;
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 92rpx;
  height: 92rpx;
  border-radius: var(--radius-pill);
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
}

.create-fab--hover {
  opacity: 0.92;
}

.create-fab__icon {
  color: var(--button-primary-text);
  font-size: 28rpx;
}

.sheet-input {
  width: 100%;
  min-height: 92rpx;
  margin-top: 20rpx;
  padding: 0 24rpx;
  border-radius: 24rpx;
  background: var(--color-surface-muted);
  box-sizing: border-box;
}

.sheet-actions {
  display: flex;
  gap: 16rpx;
}

.sheet-actions__button {
  flex: 1;
}

.sheet-actions__button--cancel {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.sheet-actions__button--confirm {
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  color: var(--button-primary-text);
}

.share-preview {
  margin-top: 20rpx;
  padding: 24rpx;
}

.share-card {
  margin-top: 20rpx;
  padding: 24rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.share-preview__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
}

.share-card__label,
.share-card__path,
.share-card__hint,
.share-member__name,
.share-member__meta,
.share-member__check {
  display: block;
}

.share-preview__meta + .share-preview__meta {
  margin-top: 8rpx;
}

.share-card__label,
.share-member__name {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.share-card__path {
  margin-top: 10rpx;
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.share-card__hint,
.share-member__meta,
.share-member__check {
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
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

.share-menu,
.share-actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
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

.share-menu {
  margin-top: 20rpx;
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
  width: 68rpx;
  height: 68rpx;
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-heavy);
}

.share-member__main {
  flex: 1;
  min-width: 0;
}

.share-member--active .share-member__check {
  color: var(--color-primary);
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

.sheet-note {
  margin-top: 20rpx;
}

.sheet-note--error {
  color: var(--color-danger-text);
}
</style>
