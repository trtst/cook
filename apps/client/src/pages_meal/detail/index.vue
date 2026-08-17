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
      <view class="meal-detail-nav">
        <view class="cookfont icon-back meal-detail-nav__back" hover-class="meal-detail-nav__back--hover" hover-stay-time="100" @click="goBack" />
        <text class="meal-detail-nav__title" :style="navTitleStyle">{{ navTitle }}</text>
      </view>
    </template>

    <Login
      v-if="!sessionStore.isLoggedIn"
      title="登录后查看餐次详情"
      description="安排这顿饭、继续发起饭局和查看参与情况，都需要登录后处理。"
    />

    <view v-else class="meal-detail-page">
      <view class="meal-detail-nav-backdrop" :style="navBackdropStyle" />
      <view v-if="loading && !planDetail" class="meal-detail-state">加载中...</view>
      <view v-else-if="errorText && !planDetail" class="meal-detail-state meal-detail-state--error" @click="loadDetail">
        {{ errorText }}
      </view>
      <view v-else-if="!planDetail" class="meal-detail-empty">
        <Empty title="未找到这条安排" description="可能已被删除，或当前日期范围里暂无这条餐次安排。" />
      </view>

      <template v-else>
        <scroll-view
          scroll-y
          scroll-with-animation
          class="meal-detail-scroll"
          :show-scrollbar="false"
          :scroll-into-view="scrollTarget"
          @scroll="handleScroll"
        >
          <view class="meal-detail-body">
            <view v-if="eventDetail" class="meal-hero meal-hero--event" :style="eventHeroStyle">
              <ImageField
                v-if="canUpdateCover"
                class="meal-hero__cover-field"
                variant="cover"
                :image-src="heroCoverUrl || ''"
                :title="eventCoverTitle"
                :description="eventCoverDesc"
                :button-text="coverActionText"
                :clearable="false"
                @select="handleCoverAction"
              />
              <view v-else-if="heroCoverUrl" class="meal-hero__cover-static">
                <image class="meal-hero__cover-image" :src="heroCoverUrl" mode="aspectFill" />
              </view>
              <view v-else class="meal-hero__cover-empty">
                <text class="meal-hero__cover-empty-title">暂未上传聚会照片</text>
                <text class="meal-hero__cover-empty-desc">发起人后续补上封面后，饭局列表会同步显示。</text>
              </view>
            </view>

            <view v-else class="meal-hero meal-hero--plan" :style="heroStyle">
              <view class="meal-hero__title-row">
                <view class="meal-hero__title-main">
                  <text class="meal-hero__title" :style="heroTitleStyle">{{ planHeroTitle }}</text>
                  <text class="meal-hero__eyebrow">{{ planHeroEyebrow }}</text>
                </view>
              </view>
              <text v-if="planHeroMeta" class="meal-hero__meta">{{ planHeroMeta }}</text>
              <view v-if="planDetail.status === 'COMPLETED'" class="meal-hero__tags">
                <text class="meal-hero__tag meal-hero__tag--done">已完成</text>
              </view>
            </view>

            <view class="meal-detail-content">
              <view class="meal-detail-summary">
                <view class="summary-card">
                  <view class="summary-card__topline">
                    <view class="summary-card__title-row">
                      <text class="summary-card__title">{{ detailTitle }}</text>
                      <text
                        v-if="canEditTitle"
                        class="cookfont icon-edit summary-card__edit"
                        :class="{ 'summary-card__edit--disabled': submitting }"
                        @click="handleTitleAction"
                      />
                    </view>
                    <text v-if="summaryBadgeText" class="summary-card__badge" :class="summaryBadgeClass">{{ summaryBadgeText }}</text>
                  </view>
                  <view class="summary-card__facts">
                    <view v-for="fact in detailFacts" :key="fact.label" class="summary-card__fact">
                      <view class="summary-card__fact-main">
                        <text class="cookfont summary-card__fact-icon" :class="fact.iconClass" />
                        <text class="summary-card__fact-label">{{ fact.label }}</text>
                      </view>
                      <text class="summary-card__fact-value">{{ fact.value }}</text>
                    </view>
                  </view>
                  <view v-if="organizerAvatarItem" class="summary-card__avatars">
                    <view class="summary-card__avatars-head">
                      <text class="summary-card__avatars-title">参与人</text>
                      <view
                        v-if="canManageParticipants"
                        class="meal-inline-action meal-inline-action--ghost summary-card__avatars-action"
                        @click="openParticipantSheet"
                      >
                        <text class="cookfont icon-manage meal-menu__add-icon" />
                        管理
                      </view>
                    </view>
                    <view class="summary-card__avatars-row">
                      <view class="summary-card__avatar-group">
                        <view class="summary-card__avatar" :title="organizerAvatarItem.name">
                          <image v-if="organizerAvatarItem.avatarUrl" class="summary-card__avatar-image" :src="organizerAvatarItem.avatarUrl" mode="aspectFill" />
                          <text v-else class="summary-card__avatar-fallback">{{ organizerAvatarItem.fallback }}</text>
                        </view>
                      </view>
                      <view v-if="showParticipantAvatarGroup" class="summary-card__avatar-divider" />
                      <view v-if="showParticipantAvatarGroup" class="summary-card__avatar-group">
                        <view v-for="item in visibleParticipantAvatarItems" :key="item.key" class="summary-card__avatar" :title="item.name">
                          <image v-if="item.avatarUrl" class="summary-card__avatar-image" :src="item.avatarUrl" mode="aspectFill" />
                          <text v-else class="summary-card__avatar-fallback">{{ item.fallback }}</text>
                        </view>
                        <view v-if="participantAvatarOverflow > 0" class="summary-card__avatar summary-card__avatar--more">
                          <text class="summary-card__avatar-more">+{{ participantAvatarOverflow }}</text>
                        </view>
                        <view
                          v-if="canInviteParticipants"
                          class="summary-card__invite"
                          :class="{ 'summary-card__invite--disabled': !canInviteParticipants || inviteSharing }"
                          @click="handleInviteShare"
                        >
                          <text class="cookfont icon-add summary-card__invite-icon" />
                        </view>
                      </view>
                    </view>
                  </view>
                </view>
              </view>

              <view v-if="eventErrorText && !eventDetail" class="meal-panel meal-panel--warning" @click="loadDetail">
                <text class="meal-panel__title">饭局信息暂时加载失败</text>
                <text class="meal-panel__meta">{{ eventErrorText }}</text>
              </view>

              <view v-else-if="showEventEditor" class="meal-panel">
                <view class="meal-panel__head">
                  <text class="meal-panel__title">发起饭局</text>
                  <text class="meal-panel__meta">先把时间定下来，菜单后面仍在这个餐次详情里继续补。</text>
                </view>

                <view class="field-block">
                  <text class="field-block__label">日期</text>
                  <picker mode="date" :value="scheduledDate" @change="handleDateChange">
                    <view class="field-block__value">{{ scheduledDate }}</view>
                  </picker>
                </view>

                <view class="field-block">
                  <text class="field-block__label">时间</text>
                  <picker mode="time" :value="scheduledTime" @change="handleTimeChange">
                    <view class="field-block__value">{{ scheduledTime }}</view>
                  </picker>
                </view>

                <view class="field-actions">
                  <view class="field-actions__button field-actions__button--ghost" @click="closeEventEditor">先不发起</view>
                  <view class="field-actions__button field-actions__button--primary" @click="createEvent">
                    {{ submitting ? "创建中..." : "确认发起饭局" }}
                  </view>
                </view>
              </view>

              <view v-if="planDetail" id="meal-menu-panel" class="meal-panel">
                <view class="meal-panel__head meal-panel__head--row">
                  <text class="meal-panel__title">{{ menuPanelTitle }}</text>
                  <view class="meal-menu__head-actions">
                    <view
                      v-if="showMenuDeadlineAction"
                      class="meal-inline-action meal-inline-action--ghost meal-menu__deadline-action"
                      @click="handleMenuDeadlineAction"
                    >
                      <text class="cookfont icon-time meal-menu__add-icon" />
                      <text>{{ menuDeadlineText }}</text>
                    </view>
                    <view
                      v-if="canEditPlan"
                      class="meal-inline-action meal-inline-action--ghost meal-menu__add-action"
                      @click="openRecipePage"
                    >
                      <text class="cookfont icon-add meal-menu__add-icon" />
                      <text>添加</text>
                    </view>
                  </view>
                </view>

                <view v-if="currentMenuItems.length" class="meal-menu">
                  <view
                    v-for="item in currentMenuItems"
                    :key="item.key"
                    class="meal-menu__row"
                  >
                    <text
                      :class="['meal-menu__name', item.recipeId ? 'meal-menu__name--link' : '']"
                      :hover-class="item.recipeId ? 'meal-menu__name--hover' : ''"
                      hover-stay-time="100"
                      @click="openRecipeDetail(item.recipeId)"
                    >
                      {{ item.title }}
                    </text>
                    <view class="meal-menu__dash" />
                    <view
                      class="meal-menu__status"
                      :class="{ 'meal-menu__status--action': canTriggerMenuAction(item) }"
                      @click.stop="handleMenuAction(item)"
                    >
                      <image
                        v-if="resolveCookAvatarUrl(item)"
                        class="meal-menu__status-avatar"
                        :src="resolveCookAvatarUrl(item)"
                        mode="aspectFill"
                      />
                      <text v-else class="meal-menu__status-text">{{ resolveMenuMeta(item) }}</text>
                    </view>
                  </view>
                </view>

                <view v-else class="meal-menu-empty">
                  <text class="meal-menu-empty__title">菜单待补</text>
                  <text class="meal-menu-empty__text">
                    {{ eventDetail ? "这场饭局已经先建好了，后续从管理入口继续补菜单即可。" : "先把这顿饭的菜单定下来，后面生成做饭安排和发起饭局都会基于这里继续。" }}
                  </text>
                </view>
              </view>

              <view v-if="planDetail" class="meal-panel">
                <view class="meal-panel__head">
                  <text class="meal-panel__title">做饭助手</text>
                  <text class="meal-panel__meta">{{ cookAssistantMeta }}</text>
                </view>

                <view v-if="cookAssistant?.isStale" class="meal-helper-banner">
                  <text class="meal-helper-banner__title">当前建议已过期</text>
                  <text class="meal-helper-banner__text">菜单或菜谱有变化，原来的做饭安排可能已经不准，建议重新生成后再开始做饭。</text>
                </view>

                <view v-if="!currentMenuItems.length" class="meal-helper-state">
                  先把这顿饭的菜单定下来，后面生成做饭建议和开始做饭都会基于这里继续。
                </view>

                <view v-else-if="cookAssistantLoading && !cookAssistant?.hasSnapshot" class="meal-helper-state">
                  正在准备这顿饭的流程安排...
                </view>

                <view v-else-if="cookAssistant?.hasSnapshot" class="meal-helper">
                  <view class="meal-helper__summary">
                    <view class="meal-helper__summary-item">
                      <text class="meal-helper__summary-label">前期准备</text>
                      <text class="meal-helper__summary-value">{{ cookAssistant.summary.prepTaskCount }}项</text>
                    </view>
                    <view class="meal-helper__summary-item">
                      <text class="meal-helper__summary-label">开做步骤</text>
                      <text class="meal-helper__summary-value">{{ cookAssistant.summary.timelineStepCount }}步</text>
                    </view>
                    <view class="meal-helper__summary-item">
                      <text class="meal-helper__summary-label">预计总时长</text>
                      <text class="meal-helper__summary-value">{{ cookAssistant.summary.totalDurationText || "待估算" }}</text>
                    </view>
                    <view class="meal-helper__summary-item">
                      <text class="meal-helper__summary-label">建议开做</text>
                      <text class="meal-helper__summary-value">{{ cookAssistant.summary.suggestedStartTime || "按这顿饭时间倒推" }}</text>
                    </view>
                  </view>
                </view>

                <view v-else class="meal-helper-state">
                  先整理这桌菜，再开始做饭。做饭助手会按菜单生成一份可执行步骤，后面再打开也能直接接着用。
                </view>

                <view v-if="currentMenuItems.length" class="meal-helper__actions">
                  <template v-if="cookAssistant?.hasSnapshot && !cookAssistant?.isStale">
                    <button class="meal-helper__button meal-helper__button--ghost" @click="openCookAssistantPage">查看做饭建议</button>
                    <button class="meal-helper__button meal-helper__button--primary" @click="openCookMode">按建议开始做饭</button>
                  </template>
                  <template v-else-if="cookAssistant?.isStale">
                    <button
                      class="meal-helper__button meal-helper__button--primary"
                      :disabled="cookAssistantLoading || submitting"
                      @click="handleCookAssistantAction"
                    >
                      重新生成建议
                    </button>
                    <button class="meal-helper__button meal-helper__button--ghost" @click="openCookMode">直接开始做饭</button>
                  </template>
                  <template v-else>
                    <button
                      class="meal-helper__button meal-helper__button--primary"
                      :disabled="cookAssistantLoading || submitting"
                      @click="handleCookAssistantAction"
                    >
                      生成做饭建议
                    </button>
                    <button class="meal-helper__button meal-helper__button--ghost" @click="openCookMode">直接开始做饭</button>
                  </template>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>

        <view v-if="footerVisible" class="meal-footer">
          <view class="meal-footer__status">
            <view class="meal-footer__status-main">
              <text class="cookfont meal-footer__status-icon" :class="footerStatusIcon" />
              <text class="meal-footer__status-text">{{ footerStatusText }}</text>
            </view>
            <text v-if="footerStatusMeta" class="meal-footer__status-meta">{{ footerStatusMeta }}</text>
          </view>

          <view class="meal-footer__actions">
            <view
              v-if="footerQuickAction"
              class="meal-footer__quick"
              :class="{ 'meal-footer__quick--disabled': footerQuickAction.disabled }"
              @click="handleFooterAction(footerQuickAction.key)"
            >
              <text class="cookfont meal-footer__quick-icon" :class="footerQuickAction.iconClass" />
              <text class="meal-footer__quick-label">{{ footerQuickAction.label }}</text>
            </view>

            <view class="meal-footer__buttons">
              <button
                v-if="footerSecondaryAction"
                class="meal-footer__button meal-footer__button--ghost"
                :disabled="footerSecondaryAction.disabled || submitting"
                @click="handleFooterAction(footerSecondaryAction.key)"
              >
                {{ footerSecondaryAction.label }}
              </button>
              <button
                v-if="footerPrimaryAction"
                class="meal-footer__button meal-footer__button--primary"
                :disabled="footerPrimaryAction.disabled || submitting"
                @click="handleFooterAction(footerPrimaryAction.key)"
              >
                {{ footerPrimaryAction.label }}
              </button>
            </view>
          </view>
        </view>

        <SheetShell
          :visible="participantSheetVisible"
          title="参与人管理"
          subtitle="邀请入口和成员协作先收在这里，待确认邀请和成员移出后续继续补齐。"
          @close="closeParticipantSheet"
        >
          <view class="participant-sheet">
            <view class="participant-sheet__section">
              <text class="participant-sheet__title">当前参与</text>
              <view class="participant-sheet__list">
                <view
                  v-for="item in participantSheetItems"
                  :key="item.key"
                  class="participant-sheet__row"
                  :class="{ 'participant-sheet__row--dimmed': item.dimmed }"
                >
                  <view class="participant-sheet__avatar">
                    <image v-if="item.avatarUrl" class="participant-sheet__avatar-image" :src="item.avatarUrl" mode="aspectFill" />
                    <text v-else class="participant-sheet__avatar-fallback">{{ buildAvatarFallback(item.name) }}</text>
                  </view>
                  <view class="participant-sheet__main">
                    <text class="participant-sheet__name">{{ item.name }}</text>
                    <text class="participant-sheet__meta">{{ item.statusText }}</text>
                  </view>
                </view>
              </view>
            </view>

            <view v-if="canInviteParticipants" class="participant-sheet__section">
              <text class="participant-sheet__title">邀请入口</text>
              <view
                class="participant-sheet__invite"
                :class="{ 'participant-sheet__invite--disabled': !canInviteParticipants || inviteSharing }"
                @click="handleInviteShare"
              >
                <text class="cookfont icon-share participant-sheet__invite-icon" />
                <text class="participant-sheet__invite-text">分享邀请</text>
              </view>
            </view>
          </view>
        </SheetShell>
      </template>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { onHide, onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import { mealApi, type DiningEventSummary, type MealPlanCookAssistant, type MealPlanSummary } from "../apis/meal";
import type { UUID } from "@/apis/http";
import Empty from "@/components/Empty/Empty.vue";
import Login from "@/components/Login/Login.vue";
import Layout from "@/components/Layout/Layout.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import ImageField from "@/components/ImageField.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";
import { formatMealSlot, mealSlotDefaultTime } from "@/utils/meal-slot";
import { formatDateTimeMinute } from "../utils/date";

type MealSlot = MealPlanSummary["mealSlot"];
type MenuEntry = {
  key: string;
  title: string;
  recipeId: UUID | null;
  menuItemId: UUID | null;
  version: number | null;
  cookUserUid: number | null;
  cookName: string | null;
  servings: number | null;
};
type FactItem = {
  label: string;
  value: string;
  iconClass: string;
};
type ProgressStep = {
  label: string;
  done: boolean;
  current: boolean;
};
type ParticipantAvatarItem = {
  key: string;
  name: string;
  avatarUrl: string | null;
  fallback: string;
};
type FooterStage = "PLANNING" | "MENU_PENDING" | "READY_TO_START" | "COMPLETED" | "CANCELLED";
type FooterActionKey =
  | "share-invite"
  | "recipe"
  | "create-event"
  | "fill-menu"
  | "confirm-menu"
  | "cook-assistant"
  | "view-menu"
  | "complete-event"
  | "share-memory"
  | "view-memory";
type FooterAction = {
  key: FooterActionKey;
  label: string;
  iconClass?: string;
  disabled?: boolean;
};

const NAV_FADE_DISTANCE = 132;
const pageStyle = usePageScrollStyle();
const sessionStore = useSessionStore();
const { navBarTotalHeight } = useSystemInfo();
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const eventErrorText = ref("");
const planItemId = ref<UUID | "">("");
const planDate = ref("");
const eventId = ref<UUID | "">("");
const planDetail = ref<MealPlanSummary | null>(null);
const eventDetail = ref<DiningEventSummary | null>(null);
const showEventEditor = ref(false);
const scheduledDate = ref("");
const scheduledTime = ref("18:30");
const cookAssistantLoading = ref(false);
const cookAssistant = ref<MealPlanCookAssistant | null>(null);
const scrollTop = ref(0);
const scrollTarget = ref("");
const uploadingCover = ref(false);
const participantSheetVisible = ref(false);
const claimingMenuItemId = ref<UUID | null>(null);
const inviteSharing = ref(false);
const nowMs = ref(Date.now());
let footerTimer: ReturnType<typeof setInterval> | null = null;

const navTitle = computed(() => {
  if (eventDetail.value) return detailTitle.value;
  const title = planDetail.value?.title?.trim();
  if (title && title !== "本餐菜单") return title;
  return planDetail.value ? `${planDateText.value} · ${slotLabel(planDetail.value.mealSlot)}` : "餐次详情";
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
  paddingTop: `${navBarTotalHeight.value + 12}px`,
  "--hero-header-offset": `${navBarTotalHeight.value}px`
}));
const eventHeroStyle = computed(() => ({
  "--hero-header-offset": `${navBarTotalHeight.value}px`
}));
const detailPanelStyle = computed(() => ({
  top: `${navBarTotalHeight.value + 12}px`
}));
const heroTitleStyle = computed(() => ({
  opacity: `${1 - navProgress.value * 0.56}`
}));
const planDateText = computed(() => formatPlanDate(planDetail.value?.planDate || planDate.value));
const heroCoverUrl = computed(() => eventDetail.value?.coverImageUrl || null);
const hasDiningEvent = computed(() => Boolean(eventDetail.value || planDetail.value?.hasDiningEvent));
const planHeroTitle = computed(() => (planDetail.value?.status === "COMPLETED" ? "这顿饭已经收尾" : "先安排这顿饭"));
const planHeroEyebrow = computed(() => {
  if (!planDetail.value) return planDateText.value;
  return `${planDateText.value} · ${slotLabel(planDetail.value.mealSlot)}`;
});
const planHeroMeta = computed(() => {
  if (planDetail.value?.status === "COMPLETED") {
    return "菜单和这顿饭的安排会继续保留在这里，后面回看也方便。";
  }
  if (currentMenuItems.value.length) {
    return "菜单、做饭顺序、后续发起饭局，都从这里继续。";
  }
  return "先把这顿饭定下来，后面的菜单和饭局都从这里展开。";
});
const eventCoverTitle = computed(() => "上传聚会封面");
const eventCoverDesc = computed(() => "上传一张聚会照片，饭局列表里也会同步显示缩略图。");
const currentMenuItems = computed<MenuEntry[]>(() => {
  if (eventDetail.value) {
    return eventDetail.value.menuItems.map(item => ({
      key: `event-${item.id}`,
      title: item.title,
      recipeId: item.recipeId,
      menuItemId: item.id,
      version: item.version,
      cookUserUid: item.cookUserUid,
      cookName: item.cookName,
      servings: null
    }));
  }

  return (planDetail.value?.menuItems ?? []).map(item => ({
    key: `plan-${item.recipeVersionId}`,
    title: item.title,
    recipeId: item.recipeId,
    menuItemId: null,
    version: null,
    cookUserUid: null,
    cookName: null,
    servings: item.servings
  }));
});
const acceptedCount = computed(() => (eventDetail.value?.participants ?? []).filter(item => item.status === "ACCEPTED").length);
const pendingCount = computed(() => (eventDetail.value?.participants ?? []).filter(item => item.status === "INVITED").length);
const displayParticipants = computed(() => (eventDetail.value?.participants ?? []).filter(item => item.status !== "REMOVED"));
const menuPanelTitle = computed(() => "菜单");
const detailTitle = computed(() => {
  const title = eventDetail.value?.title?.trim() || planDetail.value?.title?.trim();
  if (title) return title;
  return eventDetail.value ? "这场饭局" : "这顿饭";
});
const summaryBadgeText = computed(() => {
  if (eventDetail.value) return formatEventStatus(eventDetail.value.status);
  if (!planDetail.value) return "";
  if (planDetail.value.status === "COMPLETED") return "已完成";
  if (hasDiningEvent.value) return "已发起饭局";
  if (currentMenuItems.value.length) return "已安排";
  return "待安排";
});
const summaryBadgeClass = computed(() => {
  if (eventDetail.value?.status === "COMPLETED" || planDetail.value?.status === "COMPLETED") return "summary-card__badge--done";
  if (eventDetail.value?.status === "CANCELLED") return "summary-card__badge--cancelled";
  if (eventDetail.value?.status === "CONFIRMED" || hasDiningEvent.value || currentMenuItems.value.length) return "summary-card__badge--confirmed";
  return "summary-card__badge--planned";
});
const detailFacts = computed<FactItem[]>(() => {
  const timeText = eventDetail.value
    ? `${formatDateTimeMinute(eventDetail.value.scheduledAt) || "待定"}${planDetail.value ? ` · ${slotLabel(planDetail.value.mealSlot)}` : ""}`
    : `${planDateText.value || "这一天"} · ${planDetail.value ? slotLabel(planDetail.value.mealSlot) : "这顿饭"}`;
  const menuText = currentMenuItems.value.length ? summarizeMenu(currentMenuItems.value) : "待补菜单";

  if (eventDetail.value) {
    return [
      { label: "时间", value: timeText, iconClass: "icon-time" },
      { label: "菜单", value: menuText, iconClass: "icon-dining-event" }
    ];
  }
  return [
    { label: "时间", value: timeText, iconClass: "icon-time" },
    { label: "菜单", value: menuText, iconClass: "icon-plan" }
  ];
});
const canEditTitle = computed(() => Boolean(planDetail.value && planDetail.value.status !== "COMPLETED"));
const organizerAvatarItem = computed<ParticipantAvatarItem | null>(() => {
  if (!eventDetail.value) return null;
  const organizerName = eventDetail.value.organizerName?.trim() || `UID ${eventDetail.value.organizerUid ?? "--"}`;
  return {
    key: `organizer-${eventDetail.value.organizerUid ?? "self"}`,
    name: organizerName,
    avatarUrl: eventDetail.value.organizerAvatarUrl ?? null,
    fallback: buildAvatarFallback(organizerName)
  };
});
const participantAvatarItems = computed<ParticipantAvatarItem[]>(() => {
  if (!eventDetail.value) return [];
  const items: ParticipantAvatarItem[] = [];
  for (const item of displayParticipants.value) {
    const name = item.displayName?.trim() || item.guestName?.trim() || `UID ${item.userUid ?? "--"}`;
    items.push({
      key: `participant-${item.id}`,
      name,
      avatarUrl: item.avatarUrl ?? null,
      fallback: buildAvatarFallback(name)
    });
  }

  return items;
});
const visibleParticipantAvatarItems = computed(() => participantAvatarItems.value.slice(0, 5));
const participantAvatarOverflow = computed(() => Math.max(0, participantAvatarItems.value.length - visibleParticipantAvatarItems.value.length));
const canInviteParticipants = computed(() => {
  if (!eventDetail.value) return false;
  if (eventDetail.value.organizerUid !== sessionStore.uid) return false;
  if (eventDetail.value.status === "CANCELLED" || eventDetail.value.status === "COMPLETED") return false;
  return true;
});
const showParticipantAvatarGroup = computed(() =>
  Boolean(visibleParticipantAvatarItems.value.length || participantAvatarOverflow.value > 0 || canInviteParticipants.value)
);
const progressSteps = computed<ProgressStep[]>(() => {
  if (eventDetail.value) {
    const eventSteps = eventDetail.value.status === "CANCELLED"
      ? [
          { label: "饭局已创建", done: true },
          { label: "流程已取消", done: true }
        ]
      : [
          { label: "饭局已创建", done: true },
          { label: "时间已定", done: Boolean(eventDetail.value.scheduledAt) },
          { label: "菜单已定", done: currentMenuItems.value.length > 0 },
          { label: "有人响应", done: displayParticipants.value.length > 0 || acceptedCount.value > 0 || pendingCount.value > 0 },
          { label: "饭局完成", done: eventDetail.value.status === "COMPLETED" }
        ];
    const firstUndoneIndex = eventSteps.findIndex(item => !item.done);
    return eventSteps.map((item, index) => ({
      ...item,
      current: firstUndoneIndex >= 0 && index === firstUndoneIndex
    }));
  }

  const planSteps = [
    { label: "餐次已创建", done: Boolean(planDetail.value) },
    { label: "菜单已定", done: currentMenuItems.value.length > 0 },
    { label: "饭局已发起", done: hasDiningEvent.value },
    { label: "做饭建议已生成", done: Boolean(cookAssistant.value?.hasSnapshot && !cookAssistant.value.isStale) },
    { label: "已完成", done: planDetail.value?.status === "COMPLETED" }
  ];
  const firstUndoneIndex = planSteps.findIndex(item => !item.done);
  return planSteps.map((item, index) => ({
    ...item,
    current: firstUndoneIndex >= 0 && index === firstUndoneIndex
  }));
});
const progressDoneCount = computed(() => progressSteps.value.filter(item => item.done).length);
const progressTitle = computed(() => (eventDetail.value ? "饭局进度" : "计划进度"));
const progressDesc = computed(() => {
  if (eventDetail.value?.status === "COMPLETED") return "这场饭局已经收尾，后续分享和回看还可以继续处理。";
  if (eventDetail.value?.status === "CANCELLED") return "这场饭局已取消，当前不再继续推进。";
  if (eventDetail.value) return "时间、菜单和参与反馈会沿着这里继续往下推进。";
  if (planDetail.value?.status === "COMPLETED") return "这顿饭已经完成，记录会继续保留在这里。";
  if (hasDiningEvent.value) return "这顿饭已经挂上饭局，后续菜单和做饭安排继续往下补。";
  return "先把这顿饭安排起来，菜单、饭局和做饭建议会按顺序补齐。";
});
const canEditPlan = computed(() => Boolean(planDetail.value && planDetail.value.status !== "COMPLETED"));
const currentParticipant = computed(() => eventDetail.value?.participants.find(item => item.userUid === sessionStore.uid) ?? null);
const canCreateEvent = computed(() =>
  Boolean(
    planDetail.value &&
      planDetail.value.status !== "COMPLETED" &&
      !planDetail.value.hasDiningEvent &&
      !eventDetail.value
  )
);
const canCompleteEvent = computed(() => Boolean(eventDetail.value && eventDetail.value.status !== "COMPLETED" && eventDetail.value.status !== "CANCELLED"));
const canManageParticipants = computed(() => Boolean(eventDetail.value && eventDetail.value.organizerUid === sessionStore.uid));
const canUpdateCover = computed(() => Boolean(eventDetail.value && eventDetail.value.organizerUid === sessionStore.uid));
const canClaimCook = computed(() =>
  Boolean(
    eventDetail.value &&
      (eventDetail.value.organizerUid === sessionStore.uid ||
        (currentParticipant.value && currentParticipant.value.status !== "DECLINED" && currentParticipant.value.status !== "REMOVED"))
  )
);
const footerStage = computed<FooterStage>(() => {
  if (eventDetail.value?.status === "CANCELLED") return "CANCELLED";
  if (eventDetail.value?.status === "COMPLETED" || eventDetail.value?.completedAt) return "COMPLETED";
  if (planDetail.value?.status === "COMPLETED") return "COMPLETED";
  if (eventDetail.value?.status === "CONFIRMED") return "READY_TO_START";
  if (currentMenuItems.value.length > 0) return "MENU_PENDING";
  return "PLANNING";
});
const scheduledAtMs = computed(() => {
  if (!eventDetail.value?.scheduledAt) return 0;
  const value = new Date(eventDetail.value.scheduledAt).getTime();
  return Number.isFinite(value) ? value : 0;
});
const scheduledCountdownText = computed(() => {
  if (!scheduledAtMs.value || footerStage.value !== "READY_TO_START") return "";
  const diff = scheduledAtMs.value - nowMs.value;
  if (diff <= 0) return "已经到点了";
  return formatCountdown(diff);
});
const menuDeadlineText = computed(() => "设置截止");
const showMenuDeadlineAction = computed(() => Boolean(eventDetail.value && canManageParticipants.value && currentMenuItems.value.length));
const footerVisible = computed(() => Boolean(planDetail.value && footerStage.value !== "CANCELLED"));
const footerStatusIcon = computed(() => {
  if (footerStage.value === "COMPLETED") return "icon-select-on";
  if (footerStage.value === "READY_TO_START") return "icon-time";
  if (footerStage.value === "MENU_PENDING") return "icon-notice";
  return eventDetail.value ? "icon-dining-event" : "icon-plan";
});
const footerStatusText = computed(() => {
  if (footerStage.value === "COMPLETED") return "这次饭局已完成";
  if (footerStage.value === "READY_TO_START") return scheduledCountdownText.value ? `距开饭还剩 ${scheduledCountdownText.value}` : "这场饭局已确认";
  if (footerStage.value === "MENU_PENDING") return currentMenuItems.value.length ? "还没定下菜单截止时间" : "先把菜单定下来";
  if (eventDetail.value) return "先把人和菜单定下来";
  if (currentMenuItems.value.length) return "菜单已经有了，接下来可以发起饭局";
  return "先把这顿饭安排起来";
});
const footerStatusMeta = computed(() => {
  if (footerStage.value === "COMPLETED") return eventDetail.value ? "可以继续分享饭局卡，或者回看这次菜单。" : "这顿饭已经收尾，后面还可以回看记录。";
  if (footerStage.value === "READY_TO_START") return eventDetail.value?.scheduledAt ? `开饭时间 ${formatDateTimeMinute(eventDetail.value.scheduledAt)}` : "";
  if (footerStage.value === "MENU_PENDING") {
    if (eventDetail.value && canManageParticipants.value) return "菜单头部会补“设置截止”入口，当前先保留入口提示。";
    return eventDetail.value ? "先继续加菜，等确认菜单能力接上后再推进到开席阶段。" : "先继续补菜单，确认后再决定是否发起饭局。";
  }
  if (eventDetail.value) return "邀请、补菜单、做饭安排都还会沿着这场饭局继续推进。";
  return canCreateEvent.value ? "这顿饭还没约起来，可以先去菜谱选菜，也可以直接发起饭局。" : "先把菜定下来，后面再继续展开。";
});
const footerQuickAction = computed<FooterAction | null>(() => {
  if (footerStage.value === "COMPLETED" && eventDetail.value) {
    return { key: "share-memory", label: "分享饭局卡", iconClass: "icon-share" };
  }
  if (footerStage.value === "READY_TO_START" && currentMenuItems.value.length) {
    return { key: "cook-assistant", label: "做饭助手", iconClass: "icon-recommend" };
  }
  if (eventDetail.value) {
    return { key: "share-invite", label: "分享邀请", iconClass: "icon-share", disabled: !canInviteParticipants.value || inviteSharing.value };
  }
  return null;
});
const footerSecondaryAction = computed<FooterAction | null>(() => {
  if (footerStage.value === "COMPLETED" && eventDetail.value) return { key: "view-memory", label: "查看记录" };
  if (footerStage.value === "READY_TO_START") return { key: "view-menu", label: "查看菜单" };
  if (footerStage.value === "MENU_PENDING") return { key: "recipe", label: "继续加菜" };
  if (canEditPlan.value) return { key: "recipe", label: "去菜谱" };
  return null;
});
const footerPrimaryAction = computed<FooterAction | null>(() => {
  if (footerStage.value === "COMPLETED" || footerStage.value === "CANCELLED") return null;
  if (footerStage.value === "READY_TO_START") {
    return canCompleteEvent.value ? { key: "complete-event", label: "完成饭局" } : null;
  }
  if (footerStage.value === "MENU_PENDING") {
    if (eventDetail.value && canManageParticipants.value) return { key: "confirm-menu", label: "确认菜单" };
    if (!eventDetail.value && canCreateEvent.value) return { key: "create-event", label: "发起饭局" };
    return null;
  }
  if (eventDetail.value) return canEditPlan.value ? { key: "fill-menu", label: "补菜单" } : null;
  if (canCreateEvent.value) return { key: "create-event", label: "发起饭局" };
  return null;
});
const coverActionText = computed(() => {
  if (uploadingCover.value) return "上传中...";
  return heroCoverUrl.value ? "更换封面图" : "上传聚会图片";
});
const participantSheetItems = computed(() => {
  if (!eventDetail.value) return [];
  const items = [
    {
      key: `organizer-${eventDetail.value.organizerUid ?? "self"}`,
      name: eventDetail.value.organizerName?.trim() || `UID ${eventDetail.value.organizerUid ?? "--"}`,
      statusText: "发起人",
      avatarUrl: eventDetail.value.organizerAvatarUrl ?? null,
      dimmed: false
    }
  ];

  for (const item of eventDetail.value.participants) {
    items.push({
      key: `participant-${item.id}`,
      name: item.displayName?.trim() || item.guestName?.trim() || `UID ${item.userUid ?? "--"}`,
      statusText: formatParticipantStatus(item.status, item.bringRecipeTitle),
      avatarUrl: item.avatarUrl ?? null,
      dimmed: item.status === "INVITED"
    });
  }

  return items;
});
const cookAssistantMeta = computed(() => {
  if (!currentMenuItems.value.length) return "这桌菜还没定下来，先补菜单后再生成做饭建议。";
  if (cookAssistantLoading.value && !cookAssistant.value?.hasSnapshot) return "正在生成这顿饭的流程安排";
  if (!cookAssistant.value?.hasSnapshot) return "先整理这桌菜，再开始做饭。";
  if (cookAssistant.value.isStale) return "菜单或菜谱有变化，建议重新生成。";
  return cookAssistant.value.generatedAt ? `最近生成于 ${formatDateTimeMinute(cookAssistant.value.generatedAt)}` : "已生成";
});

onLoad(query => {
  planItemId.value = parseQueryId(query?.planItemId);
  planDate.value = parseQueryText(query?.planDate);
  eventId.value = parseQueryId(query?.eventId);
  showEventEditor.value = parseQueryText(query?.mode) === "create-event";
});

onShow(() => {
  startFooterTimer();
  void loadDetail();
});

onHide(() => {
  stopFooterTimer();
});

onUnload(() => {
  stopFooterTimer();
});

watch(
  () => sessionStore.isLoggedIn,
  isLoggedIn => {
    if (!isLoggedIn) {
      clearPageState();
      return;
    }
    void loadDetail();
  }
);

async function loadDetail() {
  if (!sessionStore.isLoggedIn) {
    clearPageState();
    return;
  }
  if (!planItemId.value || !planDate.value || loading.value) return;

  loading.value = true;
  errorText.value = "";
  eventErrorText.value = "";
  try {
    const result = await mealApi.listPlans({ from: planDate.value, to: planDate.value, page: 1, pageSize: 10 });
    const nextPlan = result.items.find(item => item.id === planItemId.value) ?? null;
    planDetail.value = nextPlan;
    if (!nextPlan) {
      errorText.value = "这条餐次暂时找不到了，点此重试";
      eventDetail.value = null;
      cookAssistant.value = null;
      return;
    }

    resetEventDraft(nextPlan);
    await loadCookAssistant(nextPlan.id);
    const targetEventId = eventId.value || nextPlan.diningEventId;
    if (!targetEventId) {
      eventDetail.value = null;
      return;
    }

    try {
      eventDetail.value = await mealApi.getDiningEvent(targetEventId);
      eventId.value = eventDetail.value.id;
      showEventEditor.value = false;
    } catch (error) {
      eventDetail.value = null;
      eventErrorText.value = error instanceof Error ? error.message : "点此重试加载饭局信息";
    }
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "餐次加载失败，点此重试";
  } finally {
    loading.value = false;
  }
}

function clearPageState() {
  loading.value = false;
  submitting.value = false;
  uploadingCover.value = false;
  errorText.value = "";
  eventErrorText.value = "";
  scrollTop.value = 0;
  scrollTarget.value = "";
  planDetail.value = null;
  eventDetail.value = null;
  cookAssistant.value = null;
  cookAssistantLoading.value = false;
  showEventEditor.value = false;
}

function resetEventDraft(plan: MealPlanSummary) {
  if (eventDetail.value || !showEventEditor.value) return;
  scheduledDate.value = plan.planDate || todayText();
  scheduledTime.value = resolveDefaultTime(plan.mealSlot);
}

function summarizeMenu(items: MenuEntry[]) {
  return items.map(item => item.title).join(" · ");
}

function buildAvatarFallback(name: string) {
  const text = name.trim();
  return (text[0] || "?").toUpperCase();
}

function slotLabel(slot: MealSlot) {
  return formatMealSlot(slot);
}

function formatPlanDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "这一天";
  const [, month, day] = value.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function parseQueryId(value: unknown): UUID | "" {
  const raw = Array.isArray(value) ? value[0] : value;
  const decoded = typeof raw === "string" ? Number(decodeURIComponent(raw)) : Number(raw);
  return Number.isInteger(decoded) && decoded > 0 ? decoded : "";
}

function parseQueryText(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? decodeURIComponent(raw).trim() : "";
}

function openRecipeDetail(recipeId: UUID | null) {
  if (!recipeId) return;
  void uniPlatform.navigation.navigateTo(`/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(recipeId))}&kind=my`);
}

function openPlanEditor(plan: MealPlanSummary) {
  void uniPlatform.navigation.navigateTo(
    `/pages_meal/plan/index?date=${encodeURIComponent(plan.planDate)}&planItemId=${encodeURIComponent(String(plan.id))}`
  );
}

function handleTitleAction() {
  if (!planDetail.value || !canEditTitle.value || submitting.value) return;
  openPlanEditor(planDetail.value);
}

function openRecipePage() {
  void uniPlatform.navigation.switchTab("/pages/recipe/index");
}

function openParticipantSheet() {
  if (!eventDetail.value || !canManageParticipants.value) return;
  participantSheetVisible.value = true;
}

function closeParticipantSheet() {
  participantSheetVisible.value = false;
}

function openCookAssistantPage() {
  if (!planDetail.value || !planDate.value || !currentMenuItems.value.length) return;
  const eventQuery = eventDetail.value?.id ? `&eventId=${encodeURIComponent(String(eventDetail.value.id))}` : "";
  void uniPlatform.navigation.navigateTo(
    `/pages_meal/assistant/index?planItemId=${encodeURIComponent(String(planDetail.value.id))}&planDate=${encodeURIComponent(planDate.value)}${eventQuery}`
  );
}

function openCookMode() {
  if (!planDetail.value || !planDate.value || !currentMenuItems.value.length) return;
  const eventQuery = eventDetail.value?.id ? `&eventId=${encodeURIComponent(String(eventDetail.value.id))}` : "";
  void uniPlatform.navigation.navigateTo(
    `/pages_meal/cook-mode/index?source=plan&planItemId=${encodeURIComponent(String(planDetail.value.id))}&planDate=${encodeURIComponent(planDate.value)}${eventQuery}`
  );
}

function openEventEditor() {
  if (!planDetail.value) return;
  showEventEditor.value = true;
  resetEventDraft(planDetail.value);
}

function closeEventEditor() {
  showEventEditor.value = false;
}

function handleDateChange(event: { detail?: { value?: string } }) {
  const nextValue = event.detail?.value?.trim();
  if (!nextValue) return;
  scheduledDate.value = nextValue;
}

function handleTimeChange(event: { detail?: { value?: string } }) {
  const nextValue = event.detail?.value?.trim();
  if (!nextValue) return;
  scheduledTime.value = nextValue;
}

async function createEvent() {
  if (!planDetail.value || submitting.value) return;
  submitting.value = true;
  try {
    const result = await mealApi.createDiningEvent(planDetail.value.id, {
      operationId: createOperationId(),
      scheduledAt: composeScheduledAt(
        scheduledDate.value || planDetail.value.planDate || todayText(),
        scheduledTime.value || resolveDefaultTime(planDetail.value.mealSlot)
      ),
      location: null
    });
    eventId.value = result.id;
    eventDetail.value = result;
    planDetail.value = {
      ...planDetail.value,
      hasDiningEvent: true,
      diningEventId: result.id
    };
    showEventEditor.value = false;
    await uniPlatform.feedback.toast({ title: "饭局已创建", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "创建失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function handleCoverAction() {
  if (!eventDetail.value || !canUpdateCover.value || uploadingCover.value) return;

  try {
    const hadCover = Boolean(heroCoverUrl.value);
    const files = await uniPlatform.media.chooseImage({
      count: 1,
      sourceType: ["album", "camera"],
      sizeType: ["compressed"]
    });
    const filePath = files[0]?.path?.trim();
    if (!filePath) return;

    uploadingCover.value = true;
    const next = await mealApi.uploadDiningEventCover(eventDetail.value.id, {
      operationId: createOperationId(),
      expectedVersion: eventDetail.value.version,
      filePath
    });
    eventDetail.value = next;
    await uniPlatform.feedback.toast({ title: hadCover ? "封面已更新" : "封面已上传", icon: "success" });
  } catch (error) {
    const message =
      error && typeof error === "object" && "errMsg" in error ? String((error as { errMsg?: string }).errMsg || "") : "";
    if (message.includes("cancel")) return;
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "封面上传失败", icon: "none" });
  } finally {
    uploadingCover.value = false;
  }
}

async function loadCookAssistant(currentPlanItemId: UUID) {
  cookAssistantLoading.value = true;
  try {
    cookAssistant.value = await mealApi.getCookAssistant(currentPlanItemId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("计划不存在")) {
      cookAssistant.value = null;
      return;
    }
    if (!cookAssistant.value?.hasSnapshot) {
      cookAssistant.value = null;
    }
  } finally {
    cookAssistantLoading.value = false;
  }
}

async function handleCookAssistantAction() {
  if (!planDetail.value || cookAssistantLoading.value || submitting.value) return;
  cookAssistantLoading.value = true;
  try {
    cookAssistant.value = await mealApi.generateCookAssistant(planDetail.value.id, {
      operationId: createOperationId()
    });
    await uniPlatform.feedback.toast({ title: cookAssistant.value.isStale ? "已重新生成" : "已生成做饭安排", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "生成失败", icon: "none" });
  } finally {
    cookAssistantLoading.value = false;
  }
}

function resolveCookAvatarUrl(item: MenuEntry) {
  if (!eventDetail.value || !item.cookUserUid) return "";
  if (eventDetail.value.organizerUid === item.cookUserUid) return eventDetail.value.organizerAvatarUrl ?? "";
  return eventDetail.value.participants.find(participant => participant.userUid === item.cookUserUid)?.avatarUrl ?? "";
}

function resolveMenuMeta(item: MenuEntry) {
  if (eventDetail.value) {
    if (claimingMenuItemId.value === item.menuItemId) return "处理中...";
    if (item.cookUserUid) return item.cookName?.trim() || "已认领";
    return "待认领";
  }
  return item.servings ? `${item.servings}人份` : "";
}

function canTriggerMenuAction(item: MenuEntry) {
  if (!eventDetail.value || !item.menuItemId || !canClaimCook.value || claimingMenuItemId.value === item.menuItemId) return false;
  if (!item.cookUserUid) return true;
  return item.cookUserUid === sessionStore.uid;
}

async function handleMenuAction(item: MenuEntry) {
  if (!eventDetail.value || !item.menuItemId || item.version == null || !canTriggerMenuAction(item)) return;

  claimingMenuItemId.value = item.menuItemId;
  try {
    eventDetail.value = await mealApi.claimCook(eventDetail.value.id, {
      operationId: createOperationId(),
      expectedVersion: item.version,
      menuItemId: item.menuItemId,
      action: item.cookUserUid ? "RELEASE" : "CLAIM"
    });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "操作失败", icon: "none" });
  } finally {
    claimingMenuItemId.value = null;
  }
}

function formatEventStatus(status: DiningEventSummary["status"]) {
  if (status === "PLANNED") return "待确认";
  if (status === "CONFIRMED") return "已确认";
  if (status === "CANCELLED") return "已取消";
  return "已完成";
}

function formatParticipantStatus(status: DiningEventSummary["participants"][number]["status"], bringRecipeTitle: string | null) {
  if (status === "ACCEPTED") {
    return bringRecipeTitle?.trim() ? `已接受 · 我带${bringRecipeTitle.trim()}` : "已接受";
  }
  if (status === "DECLINED") return "已拒绝";
  if (status === "REMOVED") return "已移除";
  return "待回应";
}

function resolveDefaultTime(slot: MealSlot) {
  return mealSlotDefaultTime(slot);
}

function composeScheduledAt(dateText: string, timeText: string) {
  const localDate = new Date(`${dateText}T${timeText}:00`);
  return localDate.toISOString();
}

function todayText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCountdown(diffMs: number) {
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const hours = `${Math.floor(totalSeconds / 3600)}`.padStart(2, "0");
  const minutes = `${Math.floor((totalSeconds % 3600) / 60)}`.padStart(2, "0");
  const seconds = `${totalSeconds % 60}`.padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function startFooterTimer() {
  if (footerTimer) return;
  nowMs.value = Date.now();
  footerTimer = setInterval(() => {
    nowMs.value = Date.now();
  }, 1000);
}

function stopFooterTimer() {
  if (!footerTimer) return;
  clearInterval(footerTimer);
  footerTimer = null;
}

async function markPlanDone(plan: MealPlanSummary) {
  if (submitting.value) return;
  const confirmed = await uniPlatform.feedback.confirm({
    title: "标记完成",
    content: `确认把${slotLabel(plan.mealSlot)}这顿饭标记为已完成吗？`
  });
  if (!confirmed) return;

  submitting.value = true;
  try {
    planDetail.value = await mealApi.completePlan(plan.id, createOperationId());
    await uniPlatform.feedback.toast({ title: "已标记完成", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "操作失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function markEventDone() {
  if (!eventDetail.value || submitting.value) return;
  const confirmed = await uniPlatform.feedback.confirm({
    title: "完成饭局",
    content: "确认把这场饭局标记为已完成吗？"
  });
  if (!confirmed) return;

  submitting.value = true;
  try {
    eventDetail.value = await mealApi.completeDiningEvent(eventDetail.value.id, createOperationId());
    await uniPlatform.feedback.toast({ title: "饭局已完成", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "操作失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function handleInviteShare() {
  if (!eventDetail.value || inviteSharing.value) return;
  if (!canInviteParticipants.value) {
    const message =
      eventDetail.value.organizerUid !== sessionStore.uid
        ? "当前仅发起人可分享邀请"
        : eventDetail.value.status === "CANCELLED" || eventDetail.value.status === "COMPLETED"
          ? "当前饭局状态不能继续分享邀请"
          : "分享入口准备中";
    void uniPlatform.feedback.toast({ title: message, icon: "none" });
    return;
  }
  inviteSharing.value = true;
  try {
    const result = await mealApi.createDiningEventShareLink(eventDetail.value.id, createOperationId());
    eventDetail.value = {
      ...eventDetail.value,
      shareTokenPath: result.shareTokenPath
    };
    await uniPlatform.navigation.navigateTo(result.shareTokenPath);
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "分享邀请生成失败", icon: "none" });
  } finally {
    inviteSharing.value = false;
  }
}

function handleMenuDeadlineAction() {
  void uniPlatform.feedback.toast({ title: "定菜截止时间能力待接入", icon: "none" });
}

function handleConfirmMenuAction() {
  void uniPlatform.feedback.toast({ title: "确认菜单能力待接入", icon: "none" });
}

function openMemory() {
  if (!eventId.value) return;
  void uniPlatform.navigation.navigateTo(`/pages_share/memory/index?eventId=${encodeURIComponent(String(eventId.value))}`);
}

function goBack() {
  void uniPlatform.navigation.navigateBack().catch(() => {
    void uniPlatform.navigation.navigateTo("/pages_meal/plan/index");
  });
}

function handleScroll(event: { detail: { scrollTop?: number } }) {
  scrollTop.value = event.detail.scrollTop ?? 0;
}

function scrollToSection(sectionId: string) {
  scrollTarget.value = "";
  void nextTick(() => {
    scrollTarget.value = sectionId;
  });
}

function handleFooterAction(action: FooterActionKey) {
  if (action === "share-invite") {
    handleInviteShare();
    return;
  }
  if (action === "recipe" || action === "fill-menu") {
    openRecipePage();
    return;
  }
  if (action === "create-event") {
    openEventEditor();
    return;
  }
  if (action === "confirm-menu") {
    handleConfirmMenuAction();
    return;
  }
  if (action === "cook-assistant") {
    if (cookAssistant.value?.hasSnapshot && !cookAssistant.value.isStale) {
      openCookAssistantPage();
      return;
    }
    void handleCookAssistantAction();
    return;
  }
  if (action === "view-menu") {
    scrollToSection("meal-menu-panel");
    return;
  }
  if (action === "complete-event") {
    void markEventDone();
    return;
  }
  if (action === "share-memory" || action === "view-memory") {
    openMemory();
  }
}
</script>

<style scoped lang="scss">
.meal-detail-page,
.meal-detail-scroll {
  height: 100%;
}

.meal-detail-page {
  display: flex;
  flex: 1;
  min-height: 0;
}

.meal-detail-empty {
  display: flex;
  min-height: 100%;
  padding: 24rpx;
  box-sizing: border-box;
}

.meal-detail-empty :deep(.empty-state--art) {
  width: 100%;
  margin-top: 0;
}

.meal-detail-nav {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-width: 0;
}

.meal-detail-nav-backdrop {
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

.meal-detail-nav__back,
.meal-detail-nav__title {
  color: var(--color-text);
}

.meal-detail-nav__back {
  font-size: 32rpx;
}

.meal-detail-nav__back--hover {
  opacity: 0.82;
}

.meal-detail-nav__title {
  min-width: 0;
  overflow: hidden;
  font-size: 34rpx;
  font-weight: var(--font-weight-heavy);
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: opacity 180ms ease;
}

.meal-detail-state {
  padding: 48rpx var(--space-page);
  color: var(--color-text-secondary);
}

.meal-detail-state--error {
  color: var(--color-danger);
}

.meal-detail-scroll {
  flex: 1;
  min-height: 0;
}

.meal-detail-body {
  min-height: 100%;
}

.meal-hero {
  position: relative;
  overflow: hidden;
  min-height: 360rpx;
  padding-right: 32rpx;
  padding-bottom: 112rpx;
  padding-left: 32rpx;
  border-bottom-right-radius: 42rpx;
  border-bottom-left-radius: 42rpx;
}

.meal-hero--plan {
  background:
    radial-gradient(circle at 12% 12%, color-mix(in srgb, var(--color-warning-soft) 70%, transparent) 0, transparent 28%),
    radial-gradient(circle at 88% 18%, color-mix(in srgb, var(--color-primary-soft) 58%, transparent) 0, transparent 26%),
    linear-gradient(160deg, color-mix(in srgb, var(--entry-board-bg) 88%, white 12%), color-mix(in srgb, var(--entry-primary-bg) 86%, var(--color-warning-soft) 14%));
}

.meal-hero--event {
  height: 75vw;
  min-height: 420rpx;
  max-height: 660rpx;
  padding-right: 0;
  padding-bottom: 0;
  padding-left: 0;
  background: transparent;
}

.meal-hero--event::before,
.meal-hero--event::after {
  content: none;
}

.meal-hero__cover-field {
  display: block;
  height: 100%;
}

.meal-hero__cover-static,
.meal-hero__cover-empty {
  position: relative;
  width: 100%;
  height: 100%;
}

.meal-hero__cover-static {
  overflow: hidden;
}

.meal-hero__cover-image {
  display: block;
  width: 100%;
  height: 100%;
}

.meal-hero__cover-empty {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 10rpx;
  padding: 36rpx;
  padding-top: calc(var(--hero-header-offset) + 24rpx);
  background:
    linear-gradient(140deg, var(--entry-side-mint-bg) 0%, var(--entry-board-bg) 48%, var(--entry-photo-bg) 100%),
    linear-gradient(180deg, var(--color-surface-mask-weak) 0%, var(--color-surface-mask-medium) 100%);
  box-sizing: border-box;
}

.meal-hero__cover-empty-title,
.meal-hero__cover-empty-desc {
  display: block;
}

.meal-hero__cover-empty-title {
  color: var(--entry-ink);
  font-size: 34rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.2;
}

.meal-hero__cover-empty-desc {
  color: var(--entry-side-muted-text);
  font-size: 24rpx;
  line-height: 1.6;
}

.meal-hero::before {
  position: absolute;
  top: 56rpx;
  right: -56rpx;
  z-index: 1;
  width: 240rpx;
  height: 186rpx;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-surface-mask-weak) 82%, white 18%);
  content: "";
  pointer-events: none;
  transform: rotate(-18deg);
}

.meal-hero::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1;
  height: 160rpx;
  background: linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--color-page) 92%, transparent) 100%);
  content: "";
  pointer-events: none;
}

.meal-hero__eyebrow,
.meal-hero__title-row,
.meal-hero__meta,
.meal-hero__tags {
  position: relative;
  z-index: 2;
}

.meal-hero__eyebrow {
  display: block;
  margin-top: 12rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.meal-hero__title-row {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
}

.meal-hero__title-main {
  min-width: 0;
  flex: 1;
}

.meal-hero__title {
  display: block;
  min-width: 0;
  margin-top: 8rpx;
  color: var(--color-text);
  font-size: 52rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.12;
  transition: opacity 180ms ease;
}

.meal-hero__meta {
  display: block;
  position: relative;
  z-index: 2;
  margin-top: 16rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.meal-hero__tags {
  position: relative;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 20rpx;
}

.meal-hero__tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48rpx;
  padding: 0 20rpx;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.meal-hero__tag--accent {
  background: color-mix(in srgb, var(--color-warning-soft) 68%, var(--color-surface) 32%);
  color: var(--color-warning-text);
}

.meal-hero__tag--done {
  background: color-mix(in srgb, var(--color-primary-soft) 78%, var(--color-surface) 22%);
  color: var(--color-primary);
}

.meal-detail-content {
  position: relative;
  margin-top: -30rpx;
  padding: 116rpx var(--space-page) 236rpx;
  border-top-left-radius: 38rpx;
  border-top-right-radius: 38rpx;
  background: color-mix(in srgb, var(--color-surface) 94%, var(--color-page) 6%);
}

.meal-detail-summary {
  position: relative;
  z-index: 11;
  margin-top: -132rpx;
}

.meal-detail-panel {
  position: sticky;
  z-index: 12;
  padding-bottom: 20rpx;
  margin-top: 18rpx;
}

.summary-card,
.store-card {
  border-radius: 30rpx;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.summary-card {
  padding: 28rpx 30rpx;
  background: color-mix(in srgb, var(--color-surface) 94%, var(--color-page) 6%);
  box-shadow:
    0 18rpx 42rpx color-mix(in srgb, var(--color-primary-soft) 32%, transparent),
    inset 0 0 0 1rpx color-mix(in srgb, var(--color-surface) 74%, transparent);
}

.summary-card__topline {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}

.summary-card__title-row {
  min-width: 0;
  display: flex;
  align-items: end;
  gap: 14rpx;
}

.summary-card__edit {
  flex: 0 0 auto;
  margin-top: 10rpx;
  color: var(--theme-primary);
  font-size: 32rpx;
}

.summary-card__edit--disabled {
  opacity: 0.56;
}

.summary-card__title {
  min-width: 0;
  color: var(--color-text);
  font-size: 62rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1;
  transition: opacity 180ms ease;
}

.summary-card__badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 600;
}

.summary-card__badge--planned {
  background: color-mix(in srgb, var(--color-warning-soft) 76%, var(--color-surface) 24%);
  color: var(--color-warning-text);
}

.summary-card__badge--confirmed,
.summary-card__badge--done {
  background: color-mix(in srgb, var(--color-primary-soft) 78%, var(--color-surface) 22%);
  color: var(--color-primary);
}

.summary-card__badge--cancelled {
  background: color-mix(in srgb, var(--color-danger-soft) 76%, var(--color-surface) 24%);
  color: var(--color-danger-text);
}

.summary-card__facts {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: 24rpx;
  padding: 4rpx 0;
  border-radius: 24rpx;
  background: color-mix(in srgb, var(--color-surface-muted) 68%, transparent);
}

.summary-card__fact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  min-height: 88rpx;
  padding: 0 22rpx;
}

.summary-card__fact + .summary-card__fact {
  border-top: 1rpx solid color-mix(in srgb, var(--color-border-light) 82%, transparent);
}

.summary-card__fact-main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.summary-card__fact-icon {
  flex: 0 0 auto;
  font-size: 30rpx;
  color: var(--theme-primary);
}

.summary-card__fact-label {
  flex-shrink: 0;
  color: var(--color-text);
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.5;
}

.summary-card__fact-value {
  display: block;
  flex: 1;
  min-width: 0;
  color: var(--color-text);
  font-size: 24rpx;
  line-height: 1.5;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.summary-card__avatars {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 16rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid color-mix(in srgb, var(--color-border-light) 78%, transparent);
}

.summary-card__avatars-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.summary-card__avatars-title {
  color: var(--color-text);
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.5;
}

.summary-card__avatars-action {
  flex: 0 0 auto;
}

.summary-card__avatars-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-width: 0;
}

.summary-card__avatar-group {
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-width: 0;
}

.summary-card__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  overflow: hidden;
  border-radius: 50%;
  background: color-mix(in srgb, var(--theme-primary) 12%, var(--color-surface));
  box-shadow: inset 0 0 0 1rpx color-mix(in srgb, var(--theme-primary) 14%, transparent);
}

.summary-card__avatar-image {
  display: block;
  width: 100%;
  height: 100%;
}

.summary-card__avatar-fallback,
.summary-card__avatar-more {
  color: var(--theme-primary);
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1;
}

.summary-card__avatar-divider {
  flex: 0 0 auto;
  width: 1rpx;
  height: 38rpx;
  background: color-mix(in srgb, var(--color-border) 78%, transparent);
}

.summary-card__invite {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border: 2rpx dashed color-mix(in srgb, var(--color-primary) 52%, var(--color-text-tertiary) 48%);
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-surface) 82%, var(--color-primary-soft) 18%);
}

.summary-card__invite--disabled {
  opacity: 0.42;
}

.summary-card__invite-icon {
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1;
}

.summary-card__avatar--more {
  background: color-mix(in srgb, var(--color-warning-soft) 72%, var(--color-surface) 28%);
  box-shadow: none;
}

.store-card {
  margin-top: 18rpx;
  padding: 28rpx 30rpx;
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--color-warning-soft) 68%, transparent) 0 26%, transparent 27%),
    linear-gradient(135deg, color-mix(in srgb, var(--color-surface) 95%, var(--color-warning-soft) 5%) 0%, var(--color-surface) 100%);
  box-shadow:
    0 20rpx 42rpx color-mix(in srgb, var(--color-warning-soft) 26%, transparent),
    inset 0 0 0 1rpx color-mix(in srgb, var(--color-warning-soft) 34%, transparent);
}

.store-card--event {
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--color-primary-soft) 62%, transparent) 0 26%, transparent 27%),
    linear-gradient(135deg, color-mix(in srgb, var(--color-surface) 95%, var(--color-primary-soft) 5%) 0%, var(--color-surface) 100%);
  box-shadow:
    0 20rpx 42rpx color-mix(in srgb, var(--color-primary-soft) 24%, transparent),
    inset 0 0 0 1rpx color-mix(in srgb, var(--color-primary-soft) 28%, transparent);
}

.store-card__head {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
}

.store-card__main {
  min-width: 0;
  flex: 1;
}

.store-card__title {
  display: block;
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 700;
}

.store-card__desc {
  display: block;
  margin-top: 10rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}

.store-card__aside {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.store-card__stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6rpx;
}

.store-card__stat-number {
  color: var(--color-text);
  font-size: 38rpx;
  font-weight: 700;
  line-height: 1;
}

.store-card__stat-label {
  color: var(--color-text-secondary);
  font-size: 22rpx;
}

.store-card__steps {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 22rpx;
}

.store-card__step {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-height: 76rpx;
  padding: 0 18rpx;
  border-radius: 20rpx;
  background: color-mix(in srgb, var(--color-surface) 82%, transparent);
  color: var(--color-text-secondary);
}

.store-card__step--done {
  background: color-mix(in srgb, var(--theme-primary) 14%, var(--color-surface));
  color: var(--theme-primary);
}

.store-card__step--current {
  background: color-mix(in srgb, var(--color-warning-soft) 70%, var(--color-surface) 30%);
  color: var(--color-warning-text);
}

.store-card__step-dot {
  flex-shrink: 0;
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: currentColor;
}

.store-card__step-text {
  min-width: 0;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.5;
}

.meal-panel {
  margin-top: 24rpx;
  padding: 32rpx;
  border-radius: 30rpx;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.meal-panel--warning {
  background: color-mix(in srgb, var(--color-warning) 10%, var(--color-surface));
}

.meal-panel__head {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.meal-panel__head--row {
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}

.meal-panel__head-main {
  min-width: 0;
  flex: 1;
}

.meal-panel__title {
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: 700;
}

.meal-panel__meta {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.meal-panel__facts {
  margin-top: 24rpx;
}

.meal-inline-action {
  flex-shrink: 0;
  padding: 14rpx 26rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--theme-primary) 10%, var(--color-surface));
  color: var(--theme-primary);
  font-size: 24rpx;
  font-weight: 600;
}

.meal-inline-action--ghost {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: var(--theme-primary);
}

.meal-inline-action--disabled {
  opacity: 0.56;
}

.meal-menu {
  display: flex;
  flex-direction: column;
  margin-top: 28rpx;
}

.meal-menu__row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-width: 0;
  min-height: 76rpx;
}

.meal-menu__row + .meal-menu__row {
  margin-top: 12rpx;
}

.meal-menu__name {
  flex: 0 1 auto;
  min-width: 0;
  color: var(--color-text-secondary);
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.5;
}

.meal-menu__name--link {
  color: var(--color-text);
}

.meal-menu__name--hover {
  opacity: 0.76;
}

.meal-menu__dash {
  flex: 1;
  min-width: 32rpx;
  border-bottom: 2rpx dashed color-mix(in srgb, var(--theme-primary) 18%, var(--color-divider));
}

.meal-menu__status {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 112rpx;
  min-height: 52rpx;
}

.meal-menu__status--action {
  cursor: pointer;
}

.meal-menu__status-text {
  color: var(--color-text-secondary);
  font-size: 22rpx;
  text-align: right;
}

.meal-menu__status-avatar {
  display: block;
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
}

.meal-menu__add-action {
  flex: 0 0 auto;
  font-size: 24rpx;
  font-weight: 600;
}

.meal-menu__add-icon {
  font-size: 22rpx;
  line-height: 1;
}

.meal-menu-empty {
  margin-top: 28rpx;
  padding: 28rpx 26rpx;
  border-radius: 24rpx;
  background: color-mix(in srgb, var(--theme-primary) 5%, var(--color-surface));
}

.meal-menu-empty__title {
  display: block;
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 600;
}

.meal-menu-empty__text {
  display: block;
  margin-top: 10rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}

.meal-helper-banner {
  margin-top: 24rpx;
  padding: 22rpx 24rpx;
  border-radius: 24rpx;
  background: color-mix(in srgb, var(--color-warning) 10%, var(--color-surface));
}

.meal-helper-banner__title {
  display: block;
  color: var(--color-warning);
  font-size: 24rpx;
  font-weight: 600;
}

.meal-helper-banner__text {
  display: block;
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.meal-helper-state {
  margin-top: 24rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}

.meal-helper {
  margin-top: 24rpx;
}

.meal-helper__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
}

.meal-helper__summary-item {
  padding: 20rpx 22rpx;
  border-radius: 24rpx;
  background: color-mix(in srgb, var(--theme-primary) 6%, var(--color-surface));
}

.meal-helper__summary-label {
  display: block;
  color: var(--color-text-secondary);
  font-size: 22rpx;
}

.meal-helper__summary-value {
  display: block;
  margin-top: 10rpx;
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: 600;
  line-height: 1.5;
}

.meal-helper__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 24rpx;
}

.meal-helper__button {
  height: 84rpx;
  border-radius: 999rpx;
  font-size: 26rpx;
  font-weight: 700;
}

.meal-helper__button::after {
  border: none;
}

.meal-helper__button--primary {
  color: #fff;
  background: linear-gradient(135deg, var(--button-primary-gradient-start), var(--button-primary-gradient-end));
  box-shadow: var(--button-primary-shadow);
}

.meal-helper__button--ghost {
  color: var(--theme-primary);
  background: color-mix(in srgb, var(--theme-primary) 8%, var(--color-surface));
}

.participant-list {
  margin-top: 20rpx;
}

.participant-row {
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--color-border-light);
}

.participant-row:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.participant-empty {
  margin-top: 20rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}

.participant-sheet {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.participant-sheet__section {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.participant-sheet__title {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 700;
}

.participant-sheet__list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.participant-sheet__row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 20rpx 22rpx;
  border-radius: 24rpx;
  background: color-mix(in srgb, var(--color-surface-muted) 68%, transparent);
}

.participant-sheet__row--dimmed {
  opacity: 0.56;
}

.participant-sheet__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  overflow: hidden;
  border-radius: 50%;
  background: color-mix(in srgb, var(--theme-primary) 12%, var(--color-surface));
}

.participant-sheet__avatar-image {
  display: block;
  width: 100%;
  height: 100%;
}

.participant-sheet__avatar-fallback {
  color: var(--theme-primary);
  font-size: 24rpx;
  font-weight: 700;
}

.participant-sheet__main {
  min-width: 0;
  flex: 1;
}

.participant-sheet__name,
.participant-sheet__meta {
  display: block;
}

.participant-sheet__name {
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: 600;
}

.participant-sheet__meta {
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.5;
}

.participant-sheet__invite {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  min-height: 92rpx;
  border: 2rpx dashed color-mix(in srgb, var(--color-primary) 38%, var(--color-border) 62%);
  border-radius: 24rpx;
  background: color-mix(in srgb, var(--color-surface) 86%, var(--color-primary-soft) 14%);
}

.participant-sheet__invite--disabled {
  opacity: 0.42;
}

.participant-sheet__invite-icon {
  font-size: 24rpx;
}

.participant-sheet__invite-text {
  color: var(--color-primary);
  font-size: 26rpx;
  font-weight: 600;
}

.participant-row__name {
  display: block;
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 600;
}

.participant-row__meta {
  display: block;
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.field-block + .field-block {
  margin-top: 20rpx;
}

.field-block {
  margin-top: 28rpx;
}

.field-block__label {
  display: block;
  color: var(--color-text-secondary);
  font-size: 22rpx;
}

.field-block__value,
.field-block__input {
  margin-top: 10rpx;
  padding: 22rpx 24rpx;
  border-radius: 24rpx;
  background: var(--color-surface-muted);
  color: var(--color-text);
  font-size: 28rpx;
  box-sizing: border-box;
}

.field-block__input {
  width: 100%;
  border: 1rpx solid var(--color-border);
}

.field-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 28rpx;
}

.field-actions__button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 92rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 600;
}

.field-actions__button--ghost {
  background: color-mix(in srgb, var(--theme-primary) 8%, var(--color-surface));
  color: var(--color-text);
}

.field-actions__button--primary {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow);
}

.meal-menu__head-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 14rpx 22rpx;
}

.meal-menu__deadline-action {
  color: var(--color-text-secondary);
}

.meal-footer {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 40;
  padding: 18rpx var(--space-page) calc(18rpx + env(safe-area-inset-bottom));
  background: color-mix(in srgb, var(--color-surface) 94%, white 6%);
  box-shadow: var(--shadow-floating);
  -webkit-backdrop-filter: blur(12rpx);
  backdrop-filter: blur(12rpx);
  box-sizing: border-box;
}

.meal-footer__status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 0 8rpx;
}

.meal-footer__status-main {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-width: 0;
}

.meal-footer__status-icon {
  flex: 0 0 auto;
  font-size: 24rpx;
  color: var(--color-primary);
}

.meal-footer__status-text,
.meal-footer__status-meta {
  display: block;
  font-size: 22rpx;
  line-height: 1.5;
}

.meal-footer__status-text {
  min-width: 0;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meal-footer__status-meta {
  flex: 0 0 auto;
  color: var(--color-warning);
  font-weight: 600;
}

.meal-footer__actions {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 16rpx;
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
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: 14rpx;
}

.meal-footer__button {
  height: 84rpx;
  margin: 0;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 700;
  line-height: 84rpx;
}

.meal-footer__button::after {
  border: none;
}

.meal-footer__button--ghost {
  color: var(--theme-primary);
  background: color-mix(in srgb, var(--theme-primary) 8%, var(--color-surface));
}

.meal-footer__button--primary {
  color: var(--button-primary-text);
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
}
</style>
