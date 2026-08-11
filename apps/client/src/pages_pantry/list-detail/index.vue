<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="" full-screen navbar-layout="custom-left" :show-left="false">
    <template #navbar-left>
      <view class="detail-nav">
        <view class="cookfont icon-back detail-nav__back" hover-class="detail-nav__back--hover" hover-stay-time="100" @click="goBack" />
        <text class="detail-nav__title">{{ detail?.name || "购物清单" }}</text>
      </view>
    </template>

    <Login v-if="!sessionStore.isLoggedIn" title="登录后查看清单详情" description="共享清单详情、采购勾选和入库确认都需要登录后处理。" />

    <view v-else class="detail-page">
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
        <scroll-view scroll-y class="detail-scroll" :show-scrollbar="false">
          <view class="detail-body">
            <view class="summary-card">
              <view class="summary-card__head">
                <view class="summary-card__main">
                  <text class="summary-card__title">{{ detail.name }}</text>
                  <text class="summary-card__meta">{{ headerMeta }}</text>
                </view>
                <view class="summary-card__side">
                  <text class="summary-card__badge" :class="statusBadgeClass">{{ statusBadgeText }}</text>
                  <text v-if="canRename" class="summary-card__edit" @click="openRenameSheet">改名</text>
                </view>
              </view>

              <view class="progress-card">
                <view class="progress-card__head">
                  <text class="progress-card__label">采购进度</text>
                  <text class="progress-card__value">{{ detail.progressDoneCount }}/{{ detail.progressTotalCount }}</text>
                </view>
                <view class="progress-card__track">
                  <view class="progress-card__bar" :style="{ width: `${progressPercent}%` }" />
                </view>
              </view>

              <text class="summary-card__hint">{{ summaryHint }}</text>

              <view class="summary-actions">
                <button v-if="canOpenShare" class="action-pill" :disabled="submitting" @click="openShareSheet">协作</button>
                <button v-if="canCopy" class="action-pill" :disabled="submitting || copying" @click="copyList">复制清单</button>
                <button v-if="canOpenComplete" class="action-pill action-pill--primary" :disabled="submitting" @click="markComplete">
                  标记完成
                </button>
                <button v-if="canVoid" class="action-pill action-pill--danger" :disabled="submitting" @click="voidList">作废</button>
                <button v-if="canRestore" class="action-pill" :disabled="submitting" @click="restoreList">恢复采购</button>
                <button v-if="canDelete" class="action-pill action-pill--danger" :disabled="submitting" @click="deleteList">删除清单</button>
                <button v-if="canLeave" class="action-pill action-pill--danger" :disabled="submitting" @click="leaveList">退出共享</button>
              </view>
            </view>

            <view v-if="groups.length" class="group-list">
              <view v-for="group in groups" :key="group.key" class="group-card">
                <view class="group-card__head">
                  <view class="group-card__main">
                    <text class="group-card__title">{{ group.name }}</text>
                    <text class="group-card__meta">{{ group.lines.join(" · ") }}</text>
                  </view>
                  <text class="group-card__count">{{ group.checkedCount }}/{{ group.totalCount }}</text>
                </view>

                <view v-if="group.sourceLabels.length" class="source-row">
                  <text v-for="label in group.sourceLabels" :key="label" class="source-pill">{{ label }}</text>
                </view>

                <view class="item-list">
                  <view v-for="item in group.items" :key="item.id" class="item-row">
                    <view class="item-row__main">
                      <text class="item-row__source">{{ itemSourceText(item) }}</text>
                      <text class="item-row__meta">{{ item.quantityText || "未填数量" }}</text>
                      <text v-if="item.note" class="item-row__meta">{{ item.note }}</text>
                    </view>
                    <view class="item-row__actions">
                      <button
                        v-if="canEditItems"
                        class="mini-pill"
                        :class="{ 'mini-pill--checked': item.status === 'CHECKED' }"
                        :disabled="submitting"
                        @click="toggleItem(item)"
                      >
                        {{ item.status === "CHECKED" ? "已购" : "待购" }}
                      </button>
                      <button v-if="canEditItems" class="mini-pill mini-pill--danger" :disabled="submitting" @click="removeItem(item)">
                        删除
                      </button>
                    </view>
                  </view>
                </view>
              </view>
            </view>

            <Empty v-else title="这张清单还没有食材" description="可以从菜谱里继续加，也可以用右下角按钮手动补食材。" />
          </view>
        </scroll-view>

        <view v-if="canAddItem" class="detail-fab" hover-class="detail-fab--hover" hover-stay-time="100" @click="openAddSheet">
          <text class="cookfont icon-add detail-fab__icon" />
          <text class="detail-fab__text">添加食材</text>
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

    <SheetShell
      :visible="shareSheetVisible"
      :title="shareSheetTitle"
      :subtitle="shareSheetSubtitle"
      @close="closeShareSheet"
    >
      <template #title-extra>
        <view class="sheet-help" @click.stop="openShareNotice">
          <text class="cookfont icon-qa sheet-help__icon" />
        </view>
      </template>
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
      <view class="share-menu">
        <view class="share-card share-card--button" :class="{ 'share-card--disabled': shareMemberFull || !canUseShareFeature }" @click="openShareMembersSheet">
          <view class="member-tag">
            <text class="cookfont member-tag__icon">&#xe6c8;</text>
          </view>
          <text class="share-card__label">分享给饭搭子</text>
          <text class="share-card__hint">{{ !canUseShareFeature ? "协作分享属于会员权益，开通会员后可邀请饭搭子一起维护。" : shareMemberFull ? "当前协作者名额已满，暂时不能再加新的饭搭子。" : "把这张清单发给已有关系的饭搭子，对方确认后一起维护。" }}</text>
        </view>
        <button
          class="share-card share-card--button"
          :class="{ 'share-card--disabled': shareFriendDisabled }"
          :disabled="canUseShareFeature && (shareMemberFull || shareLinkLoading || !shareUrl)"
          :open-type="shareFriendOpenType()"
          @click="handleShareFriendClick"
        >
          <view class="member-tag">
            <text class="cookfont member-tag__icon">&#xe6c8;</text>
          </view>
          <text class="share-card__label">分享给好友</text>
          <text class="share-card__hint">{{ shareFriendCardHint }}</text>
        </button>
      </view>
      <view v-if="shareLinkError" class="sheet-note sheet-note--error">{{ shareLinkError }}</view>
      <view v-if="canCloseShare" class="share-actions">
        <button class="action-pill action-pill--danger" :disabled="submitting" @click="closeShare">关闭分享</button>
      </view>
    </SheetShell>

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

    <ShoppingCompleteSheet
      :visible="completeSheetVisible"
      :entries="completeItems"
      :submitting="submitting"
      @close="closeCompleteSheet"
      @after-close="handleCompleteSheetAfterClose"
      @update:entries="updateCompleteItems"
      @submit="completeList"
    />
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShareAppMessage, onShow } from "@dcloudio/uni-app";
import emptyStateArt from "@/assets/recipe-page/empty-state.svg";
import { diningGroupApi, type DiningGroupMemberSummary } from "@/apis/dining-group";
import type { UUID } from "@/apis/http";
import { recipeApi, type IngredientSummary } from "@/apis/recipe";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { createOperationId } from "@/utils/operation-id";
import { formatMonthDay } from "../utils/date";
import ShoppingCompleteSheet from "../components/ShoppingCompleteSheet.vue";
import { type ShoppingCompleteEntry, toShoppingCompleteEntries } from "../components/shopping-complete-sheet";
import {
  shoppingApi,
  type ShoppingListCollaborator,
  type ShoppingListDetail,
  type ShoppingListDetailItem
} from "../apis/shopping";

type DetailAction = "" | "share" | "complete";

interface GroupView {
  key: string;
  name: string;
  items: ShoppingListDetailItem[];
  lines: string[];
  sourceLabels: string[];
  checkedCount: number;
  totalCount: number;
}

const pageStyle = usePageScrollStyle();
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
const copying = ref(false);

const completeSheetVisible = ref(false);
const completeItems = ref<ShoppingCompleteEntry[]>([]);

const groups = computed<GroupView[]>(() => {
  const source = detail.value?.items ?? [];
  const bucket = new Map<string, GroupView>();
  source.forEach((item) => {
    const key = `${item.ingredientId || "none"}:${item.name.trim().toLowerCase()}`;
    const current = bucket.get(key);
    const line = item.quantityText?.trim() || "未填数量";
    const labels = item.sources.map(sourceItem => sourceLabel(sourceItem.sourceType, sourceItem.title, sourceItem.addCount, sourceItem.servings));
    if (current) {
      current.items.push(item);
      if (!current.lines.includes(line)) current.lines.push(line);
      labels.forEach((label) => {
        if (!current.sourceLabels.includes(label)) current.sourceLabels.push(label);
      });
      if (item.status === "CHECKED") current.checkedCount += 1;
      current.totalCount += 1;
      return;
    }
    bucket.set(key, {
      key,
      name: item.name,
      items: [item],
      lines: [line],
      sourceLabels: [...labels],
      checkedCount: item.status === "CHECKED" ? 1 : 0,
      totalCount: 1
    });
  });
  return [...bucket.values()];
});

const progressPercent = computed(() => {
  if (!detail.value?.progressTotalCount) return 0;
  return Math.min(100, Math.round((detail.value.progressDoneCount / detail.value.progressTotalCount) * 100));
});
const headerMeta = computed(() => {
  if (!detail.value) return "";
  const roleText = detail.value.role === "OWNER"
    ? `${detail.value.memberCount}/${detail.value.memberLimit} 人协作`
    : `来自 ${detail.value.ownerNickname || `UID ${detail.value.ownerUid}`} 的清单`;
  return `${roleText} · 创建于 ${formatMonthDay(detail.value.createdAt)}`;
});
const summaryHint = computed(() => {
  if (!detail.value) return "";
  if (!detail.value.progressTotalCount) return "这是一张空白清单，可以从菜谱或手动继续补食材。";
  if (detail.value.status === "COMPLETED") return "这张清单已完成，本次已勾选的食材已经进入入库确认流程。";
  if (detail.value.status === "VOIDED") return "这张清单已作废，创建者可恢复后继续采购。";
  if (!detail.value.progressDoneCount) return "点标记完成后，会先把当前清单食材全部标成已购，再一起确认是否入库。";
  return `当前已勾选 ${detail.value.progressDoneCount} 项，标记完成后会一起确认入库。`;
});
const statusBadgeText = computed(() => {
  if (!detail.value) return "";
  if (detail.value.status === "COMPLETED") return "已完成";
  if (detail.value.status === "VOIDED") return "已作废";
  return detail.value.role === "OWNER" ? "采购中" : "协作中";
});
const statusBadgeClass = computed(() => {
  if (!detail.value) return "summary-card__badge--active";
  if (detail.value.status === "COMPLETED") return "summary-card__badge--done";
  if (detail.value.status === "VOIDED") return "summary-card__badge--voided";
  return detail.value.role === "OWNER" ? "summary-card__badge--active" : "summary-card__badge--shared";
});
const canRename = computed(() => detail.value?.role === "OWNER" && detail.value?.status === "ACTIVE");
const canOpenShare = computed(() => detail.value?.role === "OWNER" && detail.value.status === "ACTIVE");
const canCopy = computed(() => Boolean(detail.value));
const canOpenComplete = computed(() => detail.value?.role === "OWNER" && detail.value.status === "ACTIVE");
const canVoid = computed(() => detail.value?.role === "OWNER" && detail.value.status === "ACTIVE");
const canRestore = computed(() => detail.value?.role === "OWNER" && detail.value.status === "VOIDED");
const canDelete = computed(() => detail.value?.role === "OWNER" && (detail.value.status === "COMPLETED" || detail.value.status === "VOIDED"));
const canLeave = computed(() => detail.value?.role === "COLLABORATOR");
const canEditItems = computed(() => Boolean(detail.value) && detail.value?.status === "ACTIVE");
const canAddItem = computed(() => Boolean(detail.value) && detail.value?.status === "ACTIVE");
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
const shareFriendHint = computed(() => {
  if (shareMemberFull.value) return "当前协作者名额已满。";
  if (shareLinkLoading.value) return "正在准备好友分享入口...";
  if (shareUrl.value) return "点击后直接呼起系统分享，对方打开后需确认加入。";
  if (shareLinkError.value) return "好友分享入口准备失败，可关闭后重试。";
  return "正在准备好友分享入口...";
});
const shareFriendCardHint = computed(() => {
  if (!canUseShareFeature.value) return "协作分享属于会员权益，开通会员后可邀请一起维护。";
  if (shareMemberFull.value) return "当前协作者名额已满，暂时不能再通过好友加入。";
  if (shareLinkLoading.value) return "正在准备好友分享入口...";
  return "直接转发给好友，对方打开后确认加入。";
});
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
  void loadDetail();
});

async function loadDetail() {
  if (!sessionStore.isLoggedIn || !listId.value || loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    detail.value = await shoppingApi.getListDetail(listId.value);
    handlePendingAction();
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "清单详情加载失败";
  } finally {
    loading.value = false;
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
  if (action === "complete" && canOpenComplete.value) {
    void markComplete();
  }
}

function goBack() {
  void uniPlatform.navigation.navigateBack().catch(() => {
    void uniPlatform.navigation.navigateTo("/pages_pantry/list/index");
  });
}

function sourceLabel(
  sourceType: "MANUAL" | "RECIPE" | "PLAN" | "EVENT" | "BRING",
  title: string | null,
  addCount: number | null,
  servings: number | null
) {
  if (sourceType === "RECIPE") {
    const countText = addCount && addCount > 1 ? ` x${addCount}` : "";
    const servingsText = servings ? ` · ${servings} 人份` : "";
    return `${title || "菜谱"}${countText}${servingsText}`;
  }
  if (sourceType === "PLAN") return title || "下一餐计划";
  if (sourceType === "EVENT") return title || "饭局缺口";
  if (sourceType === "BRING") return title || "带菜清单";
  return title || "手动补充";
}

function itemSourceText(item: ShoppingListDetailItem) {
  const first = item.sources[0];
  if (!first) return "手动补充";
  return sourceLabel(first.sourceType, first.title, first.addCount, first.servings);
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

async function toggleItem(item: ShoppingListDetailItem) {
  if (!detail.value || submitting.value) return;
  submitting.value = true;
  try {
    detail.value = await shoppingApi.checkListItem(detail.value.id, item.id, {
      operationId: createOperationId(),
      version: detail.value.version,
      checked: item.status !== "CHECKED"
    });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "更新失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function removeItem(item: ShoppingListDetailItem) {
  if (!detail.value || submitting.value) return;
  const confirmed = await uniPlatform.feedback.confirm({
    title: "移出食材",
    content: "移出后，这个食材会从当前有效采购项里消失。"
  });
  if (!confirmed) return;
  submitting.value = true;
  try {
    detail.value = await shoppingApi.removeListItem(detail.value.id, item.id, {
      operationId: createOperationId(),
      version: detail.value.version
    });
    await uniPlatform.feedback.toast({ title: "已移出", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "移出失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

function openAddSheet() {
  addSheetVisible.value = true;
  if (!ingredientOptions.value.length) {
    void searchIngredients();
  }
}

function closeAddSheet() {
  addSheetVisible.value = false;
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

async function markComplete() {
  if (!detail.value || submitting.value) return;
  if (!detail.value.progressTotalCount) {
    submitting.value = true;
    try {
      detail.value = await shoppingApi.completeList(detail.value.id, {
        operationId: createOperationId(),
        version: detail.value.version,
        entries: []
      });
      await uniPlatform.feedback.toast({ title: "已标记完成", icon: "success" });
    } catch (error) {
      await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "标记失败", icon: "none" });
    } finally {
      submitting.value = false;
    }
    return;
  }
  submitting.value = true;
  try {
    detail.value = await shoppingApi.checkAllListItems(detail.value.id, {
      operationId: createOperationId(),
      version: detail.value.version
    });
    completeItems.value = toShoppingCompleteEntries(detail.value.items);
    completeSheetVisible.value = true;
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "标记失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

function closeCompleteSheet() {
  completeSheetVisible.value = false;
}

function handleCompleteSheetAfterClose() {
  completeItems.value = [];
}

function updateCompleteItems(entries: ShoppingCompleteEntry[]) {
  completeItems.value = entries;
}

async function completeList() {
  if (!detail.value || submitting.value) return;
  submitting.value = true;
  try {
    detail.value = await shoppingApi.completeList(detail.value.id, {
      operationId: createOperationId(),
      version: detail.value.version,
      entries: completeItems.value.map(item => ({
        itemId: item.itemId,
        store: item.store,
        quantityText: item.quantityText.trim() || null,
        expireDays: item.expireAt ? null : item.expireDays,
        expireAt: item.expireAt
      }))
    });
    closeCompleteSheet();
    await uniPlatform.feedback.toast({ title: "已完成并入库", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "提交失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function copyList() {
  if (!detail.value || submitting.value || copying.value) return;
  copying.value = true;
  try {
    const nextDetail = await shoppingApi.copyList(detail.value.id, {
      operationId: createOperationId(),
      version: detail.value.version
    });
    await uniPlatform.feedback.toast({ title: "已复制到新清单", icon: "success" });
    void uniPlatform.navigation.redirectTo(`/pages_pantry/list-detail/index?id=${encodeURIComponent(String(nextDetail.id))}`);
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "复制失败", icon: "none" });
  } finally {
    copying.value = false;
  }
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

.detail-body {
  padding: 24rpx 24rpx calc(176rpx + env(safe-area-inset-bottom));
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
}

.notice,
.summary-card,
.group-card,
.share-card,
.complete-card,
.editor-card {
  border-radius: 30rpx;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.notice,
.summary-card,
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
  padding: 28rpx;
  background:
    radial-gradient(circle at top right, var(--color-primary-soft) 0%, transparent 36%),
    linear-gradient(135deg, var(--color-surface) 0%, var(--color-page) 100%);
}

.summary-card__head,
.group-card__head,
.item-row,
.item-row__actions,
.search-box,
.summary-actions,
.sheet-actions,
.share-actions,
.quick-days__chips,
.complete-card__head,
.picker-row {
  display: flex;
  gap: 16rpx;
}

.summary-card__head,
.group-card__head,
.complete-card__head,
.picker-row {
  justify-content: space-between;
}

.summary-card__head,
.complete-card__head,
.picker-row {
  align-items: center;
}

.summary-card__main,
.group-card__main,
.item-row__main {
  flex: 1;
  min-width: 0;
}

.summary-card__title,
.summary-card__meta,
.summary-card__hint,
.progress-card__label,
.progress-card__value,
.group-card__title,
.group-card__meta,
.group-card__count,
.item-row__source,
.item-row__meta,
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

.summary-card__title,
.group-card__title,
.complete-card__title {
  color: var(--color-text);
  font-weight: var(--font-weight-heavy);
}

.summary-card__title {
  font-size: 40rpx;
}

.summary-card__meta,
.summary-card__hint,
.group-card__meta,
.item-row__meta,
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

.summary-card__meta,
.summary-card__hint,
.group-card__meta,
.share-card__hint {
  margin-top: 10rpx;
}

.summary-card__side {
  flex: 0 0 auto;
  text-align: right;
}

.summary-card__badge,
.source-pill,
.day-chip,
.mini-pill,
.sheet-actions__button {
  border-radius: var(--radius-pill);
}

.summary-card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8rpx 18rpx;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
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

.summary-card__edit {
  display: block;
  margin-top: 12rpx;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
}

.progress-card {
  margin-top: 20rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background: var(--color-surface);
  box-shadow: inset 0 0 0 1rpx var(--color-divider);
}

.progress-card__track {
  height: 14rpx;
  margin-top: 12rpx;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  overflow: hidden;
}

.progress-card__bar {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
}

.summary-actions,
.share-actions {
  flex-wrap: wrap;
  margin-top: 22rpx;
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
  background: var(--color-surface-muted);
  color: var(--color-text);
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

.group-card {
  padding: 26rpx;
}

.group-card + .group-card {
  margin-top: 18rpx;
}

.group-card__title {
  font-size: var(--font-size-lg);
}

.group-card__count {
  flex: 0 0 auto;
  color: var(--color-warning-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.source-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 18rpx;
}

.source-pill,
.day-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.source-pill {
  padding: 8rpx 18rpx;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: var(--font-size-xs);
}

.item-list {
  margin-top: 18rpx;
}

.item-row + .item-row {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid var(--color-divider);
}

.item-row__source {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.item-row__actions {
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.mini-pill {
  min-width: 118rpx;
  padding: 0 20rpx;
}

.mini-pill--checked {
  background: var(--color-warning-soft);
  color: var(--color-warning-text);
}

.detail-fab {
  position: fixed;
  right: 24rpx;
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  z-index: 40;
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  min-height: 92rpx;
  padding: 0 28rpx;
  border-radius: var(--radius-pill);
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
}

.detail-fab--hover {
  opacity: 0.92;
}

.detail-fab__icon,
.detail-fab__text {
  color: var(--button-primary-text);
}

.detail-fab__icon {
  font-size: 24rpx;
}

.detail-fab__text {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
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
