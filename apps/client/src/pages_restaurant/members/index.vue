<template>
  <page-meta :page-style="pageStyle" />
  <Layout
    title=""
    full-screen
    :show-left="false"
    :navbar-placeholder="false"
    navbar-transparent
    navbar-layout="custom-left"
  >
    <template #navbar-left>
      <view class="members-navbar" @click="handleBack">
        <view class="cookfont icon-back navbar__icon members-navbar__back" />
        <text class="members-navbar__title">{{ navTitle }}</text>
      </view>
    </template>
    <view class="members-nav-backdrop" :style="navBackdropStyle" />
    <scroll-view class="members-scroll" scroll-y :show-scrollbar="false" @scroll="handlePageScroll">
      <view class="members-page">
        <Login
          v-if="!sessionStore.isLoggedIn"
          title="登录后开启或管理饭搭子"
          description="登录后可以创建自己的饭搭子，也可以查看当前关系成员和最近动态。"
          @success="loadMine"
        />

        <template v-else-if="!diningGroupStore.hasCurrentContext">
          <view class="state-wrap">
            <view class="state-card">
              <text class="state-card__title">饭搭子加载中</text>
              <text class="state-card__desc">正在同步你的饭搭子关系。</text>
            </view>
          </view>
        </template>

        <template v-else-if="!currentDiningGroup">
          <view class="state-wrap">
            <view class="state-card state-card--empty">
              <text class="state-card__eyebrow">未开启</text>
              <text class="state-card__title">还没开启饭搭子</text>
              <text class="state-card__desc">开启后可以邀请饭搭子一起定下一顿吃什么，也能在这里随时修改名称和简介。</text>

              <view class="profile-chip">
                <text class="profile-chip__label">当前昵称</text>
                <text class="profile-chip__value">{{ profileNickname }}</text>
              </view>

              <button class="primary-button" @click="openCreateSheet">立即开启</button>
              <text v-if="errorText" class="error-text">{{ errorText }}</text>
            </view>
          </view>
        </template>

        <template v-else>
          <view class="hero-shell" :style="heroStyle">
            <view class="hero-shell__veil" />
            <view class="hero-stage hero-stage--living">
              <view class="hero-stage__art hero-stage__art--living">
                <image
                  v-if="currentDiningGroup.coverImageUrl"
                  class="hero-stage__cover-image"
                  :src="currentDiningGroup.coverImageUrl"
                  mode="aspectFill"
                />
                <view v-else class="hero-stage__placeholder">
                  <view class="hero-stage__placeholder-ring hero-stage__placeholder-ring--outer" />
                  <view class="hero-stage__placeholder-ring hero-stage__placeholder-ring--inner" />
                </view>

                <view class="hero-stage__overlay">
                  <view class="hero-stage__copy">
                    <text class="hero-stage__title">{{ heroStateTitle }}</text>
                    <text class="hero-stage__subtitle">{{ heroStateSubtitle }}</text>
                  </view>

                  <view class="hero-stage__footer">
                    <view class="hero-stage__status-strip">
                      <view class="hero-stage__status-pill" @click="nextMealItem ? handleOpenNextMeal() : handleOpenMealPlan()">
                        <text class="hero-stage__status-label">{{ heroStageStatusPrimaryLabel }}</text>
                        <text class="hero-stage__status-value">{{ heroStageStatusPrimary }}</text>
                      </view>
                      <view
                        class="hero-stage__status-pill"
                        :class="{ 'hero-stage__status-pill--disabled': !heroStageStatusSecondaryClickable }"
                        @click="handleOpenRecentMemory()"
                      >
                        <text class="hero-stage__status-label">{{ heroStageStatusSecondaryLabel }}</text>
                        <text class="hero-stage__status-value">{{ heroStageStatusSecondary }}</text>
                      </view>
                    </view>
                    <view v-if="heroMemberItems.length" class="hero-members hero-members--stage">
                      <view class="hero-members__avatars">
                        <view
                          v-for="(member, index) in heroMemberItems"
                          :key="member.id"
                          class="hero-members__avatar hero-members__avatar--stage"
                          :class="{ 'hero-members__avatar--active': activeHeroMemberId === member.id }"
                          :style="{ zIndex: `${resolveHeroMemberZIndex(member.id, index)}` }"
                          @click="setActiveHeroMember(member.id)"
                        >
                          <image v-if="member.user.avatarUrl" class="hero-members__avatar-image" :src="member.user.avatarUrl" mode="aspectFill" />
                          <text v-else class="hero-members__avatar-text">{{ getAvatarText(member.user.nickname) }}</text>
                        </view>
                        <view
                          v-if="canInviteCurrentGroup"
                          class="hero-members__avatar hero-members__avatar--invite"
                          :style="{ zIndex: `${heroMemberItems.length + 1}` }"
                          @click.stop="handleCreateInvite"
                        >
                          <text class="cookfont icon-add hero-members__invite-icon" />
                        </view>
                      </view>
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </view>

          <view class="members-content">
            <view class="members-content__waves">
              <text class="cookfont icon-wave members-content__wave members-content__wave--back" />
              <text class="cookfont icon-wave members-content__wave members-content__wave--mid" />
              <text class="cookfont icon-wave members-content__wave members-content__wave--front" />
            </view>

            <text v-if="errorText" class="error-text error-text--inline">{{ errorText }}</text>

            <view v-if="sharePath" class="section-card">
              <view class="section-card__head">
                <text class="section-card__title">邀请路径</text>
                <text class="section-card__action" @click="handleCopy">复制</text>
              </view>
              <text class="share-box__path">{{ sharePath }}</text>
              <text class="section-card__hint">把这条路径发给对方，对方确认后才会加入当前饭搭子。</text>
            </view>

            <view class="section-card next-meal-card" :class="{ 'next-meal-card--empty': !nextMealItem }" @click="nextMealItem ? handleOpenNextMeal() : handleOpenMealPlan()">
              <view class="section-card__head">
                <text class="section-card__title">{{ nextMealPanelTitle }}</text>
                <text class="section-card__action">{{ nextMealPanelAction }}</text>
              </view>
              <text class="section-card__hint">{{ nextMealPanelHint }}</text>

              <view v-if="nextMealItem" class="next-meal-card__body">
                <view class="next-meal-card__title-row">
                  <text class="next-meal-card__title">{{ nextMealItem.title }}</text>
                  <view class="next-meal-card__badge" :class="{ 'next-meal-card__badge--pending': nextMealItem.status === 'OPEN' }">
                    <text class="next-meal-card__badge-text">{{ nextMealStatusText }}</text>
                  </view>
                </view>
                <text v-if="nextMealItem.note" class="next-meal-card__note">{{ nextMealItem.note }}</text>

                <view v-if="nextMealChoiceTitles.length" class="next-meal-card__choices">
                  <text v-for="title in nextMealChoiceTitles" :key="title" class="next-meal-card__choice">{{ title }}</text>
                </view>

                <view class="next-meal-card__group">
                  <text class="next-meal-card__group-title">已回应</text>
                  <view v-if="nextMealRespondedMembers.length" class="next-meal-card__avatars">
                    <view v-for="member in nextMealRespondedMembers" :key="member.id" class="next-meal-card__avatar">
                      <image v-if="member.user.avatarUrl" class="next-meal-card__avatar-image" :src="member.user.avatarUrl" mode="aspectFill" />
                      <text v-else class="next-meal-card__avatar-text">{{ getAvatarText(member.user.nickname) }}</text>
                    </view>
                  </view>
                  <text v-else class="next-meal-card__group-empty">还没人回应</text>
                </view>

                <view v-if="nextMealPendingMembers.length" class="next-meal-card__group">
                  <text class="next-meal-card__group-title">还在等</text>
                  <view class="next-meal-card__avatars">
                    <view v-for="member in nextMealPendingMembers" :key="member.id" class="next-meal-card__avatar next-meal-card__avatar--pending">
                      <image v-if="member.user.avatarUrl" class="next-meal-card__avatar-image" :src="member.user.avatarUrl" mode="aspectFill" />
                      <text v-else class="next-meal-card__avatar-text">{{ getAvatarText(member.user.nickname) }}</text>
                    </view>
                  </view>
                </view>

                <view v-if="nextMealItem.status === 'OPEN'" class="next-meal-card__progress">
                  <view class="next-meal-card__progress-track">
                    <view class="next-meal-card__progress-fill" :style="{ width: nextMealProgressWidth }" />
                  </view>
                  <text class="next-meal-card__progress-text">{{ nextMealProgressText }}</text>
                </view>

                <text v-if="nextMealLatestLine" class="next-meal-card__latest">{{ nextMealLatestLine }}</text>
              </view>

              <view v-else class="next-meal-card__empty">
                <text class="next-meal-card__empty-title">还没定下一顿</text>
                <text class="next-meal-card__empty-text">先去安排想吃什么。</text>
              </view>
            </view>

            <view class="section-card recent-memory-card">
              <view class="section-card__head">
                <text class="section-card__title">餐桌时刻</text>
                <text v-if="recentMemoryActionText" class="section-card__action" @click="handleOpenRecentMemory">
                  {{ recentMemoryActionText }}
                </text>
              </view>

              <view v-if="recentMemoryLoading" class="state-inline">
                <text class="state-inline__text">加载中...</text>
              </view>

              <scroll-view v-if="recentMemoryCards.length" class="recent-memory-card__rail" scroll-x :show-scrollbar="false">
                <view class="recent-memory-card__rail-inner">
                  <view
                    v-for="item in recentMemoryCards"
                    :key="item.token"
                    class="recent-memory-tile"
                    @click="handleOpenRecentMemoryCard(item)"
                  >
                    <image
                      v-if="resolveRecentMemoryCover(item.preview)"
                      class="recent-memory-tile__image"
                      :src="resolveRecentMemoryCover(item.preview) || ''"
                      mode="aspectFill"
                    />
                    <view v-else class="recent-memory-tile__image recent-memory-tile__image--empty">
                      <text class="recent-memory-card__image-text">餐桌</text>
                    </view>
                    <view class="recent-memory-tile__copy">
                      <text class="recent-memory-tile__title">{{ resolveRecentMemoryCaption(item.preview) }}</text>
                      <text class="recent-memory-tile__menu">{{ resolveRecentMemoryMenu(item.preview) }}</text>
                      <text class="recent-memory-tile__meta">{{ resolveRecentMemoryMeta(item.preview) }}</text>
                    </view>
                  </view>

                  <view
                    v-if="recentMemoryGuideVisible"
                    class="recent-memory-tile recent-memory-tile--guide"
                    :class="{ 'recent-memory-tile--actionable': Boolean(recentMemoryActionText) }"
                    @click="recentMemoryActionText ? handleOpenRecentMemory() : undefined"
                  >
                    <view class="recent-memory-tile__image recent-memory-tile__image--empty recent-memory-card__image--placeholder">
                      <view class="recent-memory-card__image-orbit recent-memory-card__image-orbit--outer" />
                      <view class="recent-memory-card__image-orbit recent-memory-card__image-orbit--inner" />
                      <view class="recent-memory-card__image-chip">
                        <text class="recent-memory-card__image-text">{{ recentMemoryEmptyBadge }}</text>
                      </view>
                    </view>
                    <view class="recent-memory-tile__copy">
                      <text class="recent-memory-tile__title">{{ recentMemoryEmptyTitle }}</text>
                      <text class="recent-memory-tile__menu">{{ recentMemoryEmptyText }}</text>
                    </view>
                  </view>
                </view>
              </scroll-view>

              <view
                v-else
                class="recent-memory-card__body recent-memory-card__body--empty"
                :class="{ 'recent-memory-card__body--actionable': Boolean(recentMemoryActionText) }"
                @click="recentMemoryActionText ? handleOpenRecentMemory() : undefined"
              >
                <view class="recent-memory-card__image recent-memory-card__image--empty recent-memory-card__image--placeholder">
                  <view class="recent-memory-card__image-orbit recent-memory-card__image-orbit--outer" />
                  <view class="recent-memory-card__image-orbit recent-memory-card__image-orbit--inner" />
                  <view class="recent-memory-card__image-chip">
                    <text class="recent-memory-card__image-text">{{ recentMemoryEmptyBadge }}</text>
                  </view>
                </view>

                <view class="recent-memory-card__content recent-memory-card__content--empty">
                  <text class="recent-memory-card__caption">{{ recentMemoryEmptyTitle }}</text>
                  <text class="recent-memory-card__menu">{{ recentMemoryEmptyText }}</text>
                  <text v-if="recentMemoryEmptyMeta" class="recent-memory-card__meta">{{ recentMemoryEmptyMeta }}</text>
                  <button
                    v-if="recentMemoryActionText"
                    class="action-chip action-chip--primary recent-memory-card__button"
                    @click.stop="handleOpenRecentMemory"
                  >
                    {{ recentMemoryActionText }}
                  </button>
                </view>
              </view>
            </view>

            <view class="section-card life-feed-card">
              <view class="section-card__head">
                <text class="section-card__title">生活流</text>
                <text class="section-card__action" @click="loadActivities">刷新</text>
              </view>

              <view v-if="activitiesLoading" class="state-inline">
                <text class="state-inline__text">加载中...</text>
              </view>

              <view v-else-if="lifeFeedItems.length" class="life-feed-list">
                <view v-for="item in lifeFeedItems" :key="item.id" class="life-feed-item" @click="handleOpenActivity(item.raw)">
                  <view class="life-feed-item__avatar" :class="{ 'life-feed-item__avatar--pending': item.raw.state === 'PENDING' }">
                    <text class="life-feed-item__avatar-text">{{ item.tag }}</text>
                  </view>
                  <view class="life-feed-item__main">
                    <text class="life-feed-item__title">{{ item.title }}</text>
                    <text v-if="item.detail" class="life-feed-item__detail">{{ item.detail }}</text>
                    <text class="life-feed-item__meta">{{ item.meta }}</text>
                  </view>
                </view>
              </view>

              <view v-else class="state-inline">
                <text class="state-inline__text">当前还没有新的动态。</text>
              </view>
            </view>

            <view class="section-card">
              <view class="section-card__head">
                <text class="section-card__title">我加入的饭搭子</text>
                <text v-if="diningGroups.length > 1" class="section-card__action" @click="openSwitchSheet">切换</text>
              </view>
              <text class="section-card__hint">上面展示当前饭搭子的聚合信息，下面可以切换到你加入的其他饭搭子。</text>

              <view class="group-list">
                <view
                  v-for="item in diningGroups"
                  :key="item.id"
                  class="group-card"
                  :class="{ 'group-card--active': item.id === currentDiningGroup.id }"
                  @click="selectDiningGroup(item.id)"
                >
                  <view class="group-card__head">
                    <view class="group-card__title-row">
                      <text class="group-card__name">{{ item.name }}</text>
                      <view v-if="item.hasAttention" class="group-card__dot" />
                    </view>
                    <text class="group-card__badge">{{ item.id === currentDiningGroup.id ? "当前" : roleLabels[item.myRole] }}</text>
                  </view>
                  <text class="group-card__desc">{{ item.latestActivityTitle || item.description || "还没有新的动态" }}</text>
                  <text class="group-card__meta">{{ buildGroupMeta(item) }}</text>
                </view>
              </view>
            </view>

            <view v-if="canEditCurrentGroup" class="danger-card">
              <view class="danger-card__head" @click="dangerExpanded = !dangerExpanded">
                <view class="danger-card__copy">
                  <text class="danger-card__title">危险区</text>
                  <text class="danger-card__hint">解散后会结束当前全部成员关系。</text>
                </view>
                <text class="danger-card__toggle">{{ dangerExpanded ? "收起" : "展开" }}</text>
              </view>

              <view v-if="dangerExpanded" class="danger-card__body">
                <button class="danger-card__button" @click="handleDissolve">解散饭搭子</button>
              </view>
            </view>
          </view>

          <view class="floating-fab">
            <view v-if="fabExpanded" class="floating-fab__backdrop" @click="closeFab" />
            <view class="floating-fab__cluster">
              <view
                v-for="(item, index) in fabActionItems"
                :key="item.key"
                class="floating-fab__item"
                :class="[`floating-fab__item--${item.tone}`, { 'floating-fab__item--expanded': fabExpanded }]"
                :style="buildFabActionStyle(index, fabActionItems.length)"
                @click="handleFabAction(item.key)"
              >
                <text class="floating-fab__item-label">{{ item.label }}</text>
              </view>

              <view class="floating-fab__trigger" :class="{ 'floating-fab__trigger--expanded': fabExpanded }" @click="toggleFab">
                <view class="floating-fab__trigger-icon">
                  <view class="floating-fab__trigger-line floating-fab__trigger-line--x" />
                  <view class="floating-fab__trigger-line floating-fab__trigger-line--y" />
                </view>
                <text class="floating-fab__trigger-text">{{ fabExpanded ? "收起" : "快捷" }}</text>
                <view v-if="hasOtherGroupAttention && !fabExpanded" class="floating-fab__trigger-dot" />
              </view>
            </view>
          </view>
        </template>
      </view>
    </scroll-view>

    <SheetShell
      v-if="sheetMode"
      :visible="sheetVisible"
      :title="sheetTitle"
      :subtitle="sheetSubtitle"
      @close="closeSheet"
      @after-close="handleSheetAfterClose"
    >
      <template v-if="sheetMode === 'switch'">
        <view class="switch-list">
          <view
            v-for="item in diningGroups"
            :key="item.id"
            class="switch-item"
            :class="{ 'switch-item--active': item.id === currentDiningGroup?.id }"
            @click="handleSwitchFromSheet(item.id)"
          >
            <view class="switch-item__main">
              <view class="switch-item__title-row">
                <text class="switch-item__name">{{ item.name }}</text>
                <view v-if="item.hasAttention" class="switch-item__dot" />
              </view>
              <text class="switch-item__meta">{{ item.memberCount }} 人 · {{ roleLabels[item.myRole] }}</text>
            </view>
            <text class="switch-item__status">{{ item.id === currentDiningGroup?.id ? "当前" : "切换" }}</text>
          </view>
        </view>
      </template>

      <template v-else>
        <view class="sheet-field">
          <text class="sheet-field__label">当前昵称</text>
          <view class="sheet-static">{{ profileNickname }}</view>
        </view>

        <view class="sheet-field">
          <text class="sheet-field__label">饭搭子名称</text>
          <input
            v-model="groupForm.name"
            class="sheet-input"
            maxlength="20"
            placeholder="请输入饭搭子名称"
            placeholder-class="sheet-input__placeholder"
            :disabled="sheetSubmitting"
          />
        </view>

        <view class="sheet-field">
          <text class="sheet-field__label">简介</text>
          <textarea
            v-model="groupForm.description"
            class="sheet-textarea"
            maxlength="120"
            placeholder="选填，说说你们平时怎么一起吃饭"
            placeholder-class="sheet-input__placeholder"
            :disabled="sheetSubmitting"
          />
        </view>

        <text v-if="sheetErrorText" class="error-text error-text--sheet">{{ sheetErrorText }}</text>

        <template #footer>
          <view class="sheet-actions">
            <button class="sheet-button sheet-button--ghost" :disabled="sheetSubmitting" @click="closeSheet">取消</button>
            <button
              class="sheet-button sheet-button--primary"
              :loading="sheetSubmitting"
              :disabled="sheetSubmitting || !canSubmitSheet"
              @click="submitSheet"
            >
              {{ sheetSubmitText }}
            </button>
          </view>
        </template>
      </template>
    </SheetShell>
  </Layout>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { memoryShareApi, type MemorySharePreviewResponse } from "../apis/memory-share";
import type { DiningGroupRole } from "@/apis/dining-group";
import type { UUID } from "@/apis/http";
import { pollApi, type DiningGroupActivitySummary, type MealPollDetail, type MealPollSummary } from "@/apis/poll";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { usePageScrollLock, usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useDiningGroupStore } from "@/stores/dining-group";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { formatMonthDayMinute, formatPlanDate } from "../utils/date";

type SheetMode = "create" | "edit" | "switch" | "";
type FabActionKey = "nextMeal" | "recentMemory" | "invite" | "cover" | "edit" | "entitlements" | "switch";
type FabActionTone = "primary" | "surface" | "warning";
type RecentMemoryCardItem = {
  token: string;
  eventId: UUID | null;
  preview: MemorySharePreviewResponse;
};

const pageStyle = usePageScrollStyle();
const { setLocked: setPageLocked } = usePageScrollLock(Symbol("dining-group-sheet"));
const { navBarTotalHeight } = useSystemInfo();

const HERO_NAV_GAP = 22;
const HERO_NAV_FADE_DISTANCE = 108;
const FAB_ACTION_START = 188;
const FAB_ACTION_END = 270;
const FAB_ACTION_DISTANCE = 208;
const FAB_ACTION_DISTANCE_STEP = 14;

const sessionStore = useSessionStore();
const userStore = useUserStore();
const diningGroupStore = useDiningGroupStore();

const inviteSubmitting = ref(false);
const membersLoading = ref(false);
const activitiesLoading = ref(false);
const pageScrollTop = ref(0);
const errorText = ref("");
const sharePath = ref("");
const nextMealItem = ref<MealPollSummary | null>(null);
const nextMealDetail = ref<MealPollDetail | null>(null);
const nextMealLoading = ref(false);
const activityItems = ref<DiningGroupActivitySummary[]>([]);
const fabExpanded = ref(false);
const coverSubmitting = ref(false);
const recentMemoryCards = ref<RecentMemoryCardItem[]>([]);
const recentMemoryLoading = ref(false);
const recentMemoryToken = ref<string | null>(null);
const recentMemoryEventId = ref<UUID | null>(null);
const dangerExpanded = ref(false);
const sheetMode = ref<SheetMode>("");
const sheetVisible = ref(false);
const sheetSubmitting = ref(false);
const sheetErrorText = ref("");
let recentMemoryLoadSeq = 0;
const groupForm = reactive({
  name: "",
  description: ""
});

const currentDiningGroup = computed(() => diningGroupStore.currentDiningGroup);
const diningGroups = computed(() => diningGroupStore.diningGroups);
const members = computed(() => diningGroupStore.members);
const profileNickname = computed(() => userStore.profile?.nickname?.trim() || "未填写昵称");
const canEditCurrentGroup = computed(() => Boolean(currentDiningGroup.value?.isOwned));
const canManageCurrentGroupCover = computed(() => Boolean(currentDiningGroup.value?.canManageCover));
const canInviteCurrentGroup = computed(() => {
  const role = currentDiningGroup.value?.myRole;
  return role === "OWNER" || role === "ADMIN";
});
const nextMealResponseUids = computed(() => new Set((nextMealDetail.value?.responses ?? []).map(item => item.userUid)));
const currentUserRespondedNextMeal = computed(() => nextMealResponseUids.value.has(sessionStore.uid));
const nextMealRespondedMembers = computed(() =>
  members.value.filter(member => nextMealResponseUids.value.has(member.user.uid)).slice(0, 5)
);
const nextMealPendingMembers = computed(() =>
  members.value.filter(member => !nextMealResponseUids.value.has(member.user.uid)).slice(0, 5)
);
const nextMealPendingCount = computed(() =>
  Math.max(0, (currentDiningGroup.value?.memberCount ?? members.value.length) - nextMealResponseUids.value.size)
);
const nextMealChoiceTitles = computed(() => {
  if (!nextMealDetail.value) return [];
  return nextMealDetail.value.candidates
    .filter(item => item.status === "ACTIVE")
    .slice(0, 3)
    .map(item => item.title);
});
const nextMealLatestLine = computed(() => {
  if (!nextMealDetail.value?.responses.length) return "";
  const latest = [...nextMealDetail.value.responses].sort((a, b) => new Date(b.respondedAt).getTime() - new Date(a.respondedAt).getTime())[0];
  const member = members.value.find(item => item.user.uid === latest.userUid);
  const name = member?.user.nickname?.trim() || "有人";
  return `刚刚，${name}提交了选择`;
});
const heroStateTitle = computed(() => {
  if (nextMealItem.value?.status === "CONFIRMED") return `${resolveMealMoment(nextMealItem.value.planDate, nextMealItem.value.mealSlot)}已定`;
  if (nextMealItem.value?.status === "OPEN" && !currentUserRespondedNextMeal.value) {
    return `${resolveMealMoment(nextMealItem.value.planDate, nextMealItem.value.mealSlot)}吃什么？`;
  }
  if (nextMealItem.value?.status === "OPEN") {
    return `等家人定下${resolveMealMoment(nextMealItem.value.planDate, nextMealItem.value.mealSlot)}`;
  }
  if (recentMemoryEventId.value || recentMemoryCards.value.length) return "刚吃过一顿";
  return "下一顿吃什么？";
});
const heroStateSubtitle = computed(() => {
  if (nextMealItem.value?.status === "CONFIRMED") {
    return `${formatPlanDate(nextMealItem.value.planDate)} ${formatMealSlot(nextMealItem.value.mealSlot)} · ${nextMealItem.value.title}`;
  }
  if (nextMealItem.value?.status === "OPEN" && !currentUserRespondedNextMeal.value) {
    return `${nextMealItem.value.responseCount} 人已回应 · ${formatMonthDayMinute(nextMealItem.value.deadlineAt)} 截止`;
  }
  if (nextMealItem.value?.status === "OPEN") {
    return nextMealPendingCount.value > 0
      ? `还差 ${nextMealPendingCount.value} 人回应 · ${formatMonthDayMinute(nextMealItem.value.deadlineAt)} 截止`
      : "就等你们一起定下今晚菜单";
  }
  if (recentMemoryCards.value.length) {
    return `最近记录了 ${recentMemoryCards.value.length} 次餐桌时刻`;
  }
  if (recentMemoryEventId.value) {
    return "这顿饭刚吃完，正适合记下来";
  }
  return `一起开饭第 ${displayCreatedDays.value} 天`;
});
const heroStageStatusPrimaryLabel = computed(() => "点菜");
const heroStageStatusPrimary = computed(() => {
  if (!nextMealItem.value) return "还没安排";
  const mealMoment = resolveMealMoment(nextMealItem.value.planDate, nextMealItem.value.mealSlot);
  if (nextMealItem.value.status === "CONFIRMED") return `${mealMoment} 已定`;
  if (nextMealPendingCount.value > 0) return `${mealMoment} · 差 ${nextMealPendingCount.value} 人`;
  return `${mealMoment} · ${nextMealItem.value.responseCount} 人已选`;
});
const heroStageStatusSecondaryLabel = computed(() => "最近记录");
const latestCompletedActivity = computed(() => activityItems.value.find(item => item.kind === "MEAL_COMPLETED") ?? null);
const heroStageStatusSecondaryClickable = computed(() => Boolean(recentMemoryToken.value || recentMemoryEventId.value));
const heroStageStatusSecondary = computed(() => {
  if (recentMemoryCards.value.length > 0) return resolveRecentMemoryMoment(recentMemoryCards.value[0].preview);
  if (latestCompletedActivity.value) return buildActivityMeta(latestCompletedActivity.value);
  return "暂无";
});
const nextMealPanelTitle = computed(() => {
  if (!nextMealItem.value) return "下一顿吃什么？";
  if (nextMealItem.value.status === "CONFIRMED") return `${resolveMealMoment(nextMealItem.value.planDate, nextMealItem.value.mealSlot)}已定`;
  if (currentUserRespondedNextMeal.value) return "等家人回应中";
  return `${resolveMealMoment(nextMealItem.value.planDate, nextMealItem.value.mealSlot)}吃什么？`;
});
const nextMealPanelAction = computed(() => {
  if (!nextMealItem.value) return "去安排";
  return nextMealActionText.value;
});
const nextMealPanelHint = computed(() => {
  if (!nextMealItem.value) return "还没有发起下一顿。";
  return nextMealMeta.value;
});
const activeHeroMemberId = ref<UUID | "">("");
const fabActionItems = computed<Array<{ key: FabActionKey; label: string; tone: FabActionTone }>>(() => {
  const items: Array<{ key: FabActionKey; label: string; tone: FabActionTone }> = [];

  if (nextMealItem.value) {
    items.push({
      key: "nextMeal",
      label: nextMealActionText.value || "下一顿",
      tone: "primary"
    });
  }

  if (recentMemoryActionText.value) {
    items.push({
      key: "recentMemory",
      label: recentMemoryActionText.value,
      tone: recentMemoryCards.value.length ? "surface" : "warning"
    });
  }

  if (canInviteCurrentGroup.value) {
    items.push({
      key: "invite",
      label: inviteSubmitting.value ? "生成中..." : "生成邀请",
      tone: "surface"
    });
  }

  if (canManageCurrentGroupCover.value) {
    items.push({
      key: "cover",
      label: coverSubmitting.value ? "上传中..." : "换封面",
      tone: "surface"
    });
  }

  items.push({
    key: canEditCurrentGroup.value ? "edit" : "entitlements",
    label: canEditCurrentGroup.value ? "编辑资料" : "查看权益",
    tone: "surface"
  });

  if (diningGroups.value.length > 1) {
    items.push({
      key: "switch",
      label: "切换饭搭子",
      tone: hasOtherGroupAttention.value ? "warning" : "surface"
    });
  }

  return items;
});
const heroMemberItems = computed(() => members.value);
const hasOtherGroupAttention = computed(() =>
  diningGroups.value.some(item => item.id !== currentDiningGroup.value?.id && item.hasAttention)
);
const lifeFeedItems = computed(() =>
  activityItems.value.slice(0, 5).map(item => ({
    id: item.id,
    raw: item,
    tag: resolveActivityTag(item),
    title: buildLifeTitle(item),
    detail: buildLifeDetail(item),
    meta: buildActivityMeta(item)
  }))
);
const recentMemoryGuideVisible = computed(() => recentMemoryCards.value.length > 0 && recentMemoryCards.value.length < 2);
const navProgress = computed(() => Math.min(1, Math.max(0, pageScrollTop.value / HERO_NAV_FADE_DISTANCE)));
const heroStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + HERO_NAV_GAP}px`
}));
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: `${navProgress.value}`
}));
const navTitle = computed(() => currentDiningGroup.value?.name || "饭搭子");
const displayCreatedDays = computed(() => {
  const value = currentDiningGroup.value?.createdDays;
  if (typeof value === "number" && value > 0) return value;

  const createdAt = currentDiningGroup.value?.createdAt;
  if (!createdAt) return 1;
  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) return 1;
  const diff = Date.now() - createdTime;
  return Math.max(1, Math.ceil(diff / (24 * 60 * 60 * 1000)));
});
const nextMealStatusText = computed(() => {
  if (!nextMealItem.value) return "";
  return nextMealItem.value.status === "CONFIRMED" ? "已确认" : "征集中";
});
const nextMealActionText = computed(() => {
  if (!nextMealItem.value) return "";
  return nextMealItem.value.status === "CONFIRMED" ? "看菜单" : "去点菜";
});
const nextMealMeta = computed(() => {
  if (!nextMealItem.value) return "";
  const segments = [formatPlanDate(nextMealItem.value.planDate), formatMealSlot(nextMealItem.value.mealSlot)];
  if (nextMealItem.value.status === "OPEN") {
    segments.push(`${formatMonthDayMinute(nextMealItem.value.deadlineAt)} 截止`);
  } else {
    segments.push("菜单已确认");
  }
  return segments.join(" · ");
});
const nextMealProgressWidth = computed(() => {
  if (!nextMealItem.value) return "0%";
  const memberCount = currentDiningGroup.value?.memberCount ?? 0;
  if (memberCount <= 0) return "0%";
  return `${Math.min(100, Math.round((nextMealItem.value.responseCount / memberCount) * 100))}%`;
});
const nextMealProgressText = computed(() => {
  if (!nextMealItem.value) return "";
  const memberCount = currentDiningGroup.value?.memberCount ?? 0;
  if (memberCount <= 0) return `${nextMealItem.value.responseCount} 人已回应`;
  return `${nextMealItem.value.responseCount}/${memberCount} 人已回应`;
});
const recentMemoryActionText = computed(() => {
  if (recentMemoryCards.value.length) return "看最新";
  if (recentMemoryEventId.value) return "去记录一顿";
  return "";
});
const recentMemoryEmptyBadge = computed(() => (recentMemoryEventId.value ? "待记录" : "暂无"));
const recentMemoryEmptyTitle = computed(() => {
  if (recentMemoryEventId.value) return "这一顿还没记录";
  return "还没有餐桌时刻";
});
const recentMemoryEmptyText = computed(() => {
  if (recentMemoryEventId.value) return "拍张照，写一句话";
  return "下一次一起吃饭时记录";
});
const recentMemoryEmptyMeta = computed(() => (recentMemoryEventId.value ? "已完成" : ""));
const sheetTitle = computed(() => {
  if (sheetMode.value === "edit") return "编辑饭搭子";
  if (sheetMode.value === "switch") return "切换饭搭子";
  return "开启饭搭子";
});
const sheetSubtitle = computed(() => {
  if (sheetMode.value === "edit") return "修改当前饭搭子的名称和简介。";
  if (sheetMode.value === "switch") return "选择你要查看的饭搭子。";
  return "开启后会创建你主理的第一个饭搭子。";
});
const sheetSubmitText = computed(() => (sheetMode.value === "edit" ? "保存修改" : "开启饭搭子"));
const canSubmitSheet = computed(() => Boolean(groupForm.name.trim()));

const roleLabels: Record<DiningGroupRole, string> = {
  OWNER: "主理人",
  ADMIN: "管理员",
  MEMBER: "成员"
};

watch(
  () => sheetVisible.value,
  (visible) => {
    if (visible) {
      fabExpanded.value = false;
    }
    setPageLocked(visible);
  },
  { immediate: true }
);

watch(
  () => currentDiningGroup.value?.id,
  () => {
    if (!sessionStore.isLoggedIn) return;
    fabExpanded.value = false;
    sharePath.value = "";
    dangerExpanded.value = false;
    nextMealItem.value = null;
    nextMealDetail.value = null;
    activityItems.value = [];
    recentMemoryCards.value = [];
    recentMemoryToken.value = null;
    recentMemoryEventId.value = null;
    void loadMembers();
    void Promise.all([loadActivities(), loadNextMeal()]);
  }
);

onMounted(() => {
  if (sessionStore.isLoggedIn) {
    void loadMine();
  }
});

async function loadMine() {
  errorText.value = "";
  try {
    await diningGroupStore.refreshCurrent();
    await Promise.all([loadMembers(), loadActivities(), loadNextMeal()]);
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "饭搭子加载失败";
  }
}

async function loadMembers() {
  const diningGroupId = currentDiningGroup.value?.id as UUID | undefined;
  if (!diningGroupId) {
    diningGroupStore.members = [];
    return;
  }
  if (membersLoading.value) return;

  membersLoading.value = true;
  errorText.value = "";
  try {
    await diningGroupStore.refreshMembers(diningGroupId);
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "成员加载失败";
  } finally {
    membersLoading.value = false;
  }
}

async function loadActivities() {
  const diningGroupId = currentDiningGroup.value?.id as UUID | undefined;
  if (!diningGroupId) {
    activityItems.value = [];
    await loadRecentMemory();
    return;
  }
  if (activitiesLoading.value) return;

  activitiesLoading.value = true;
  errorText.value = "";
  try {
    activityItems.value = await pollApi.listActivities({ diningGroupId, limit: 5 });
    await loadRecentMemory();
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "动态加载失败";
  } finally {
    activitiesLoading.value = false;
  }
}

async function loadNextMeal() {
  const diningGroupId = currentDiningGroup.value?.id as UUID | undefined;
  if (!diningGroupId) {
    nextMealItem.value = null;
    nextMealDetail.value = null;
    return;
  }
  if (nextMealLoading.value) return;

  nextMealLoading.value = true;
  try {
    const [openResult, confirmedResult] = await Promise.allSettled([
      pollApi.list({ diningGroupId, status: "OPEN", limit: 1 }),
      pollApi.list({ diningGroupId, status: "CONFIRMED", limit: 1 })
    ]);
    const openItem = openResult.status === "fulfilled" ? openResult.value[0] ?? null : null;
    const confirmedItem = confirmedResult.status === "fulfilled" ? confirmedResult.value[0] ?? null : null;
    nextMealItem.value = openItem ?? confirmedItem;
    nextMealDetail.value = nextMealItem.value ? await pollApi.getDetail(nextMealItem.value.id).catch(() => null) : null;
    if (!nextMealItem.value && openResult.status === "rejected" && confirmedResult.status === "rejected") {
      errorText.value ||= openResult.reason instanceof Error ? openResult.reason.message : "下一顿加载失败";
    }
  } finally {
    nextMealLoading.value = false;
  }
}

async function loadRecentMemory() {
  const requestSeq = ++recentMemoryLoadSeq;
  recentMemoryCards.value = [];
  recentMemoryToken.value = null;
  recentMemoryEventId.value = null;

  const memoryActivities = activityItems.value
    .filter(item => item.kind === "MEMORY_CREATED")
    .map(item => ({
      token: extractMemoryToken(item.detail),
      eventId: item.diningEventId
    }))
    .filter((item): item is { token: string; eventId: UUID | null } => Boolean(item.token))
    .slice(0, 3);

  if (memoryActivities.length) {
    recentMemoryLoading.value = true;
    try {
      const previews = await Promise.allSettled(
        memoryActivities.map(async item => ({
          token: item.token,
          eventId: item.eventId,
          preview: await memoryShareApi.getPreview(item.token)
        }))
      );
      if (requestSeq !== recentMemoryLoadSeq) return;
      recentMemoryCards.value = previews
        .filter((item): item is PromiseFulfilledResult<RecentMemoryCardItem> => item.status === "fulfilled")
        .map(item => item.value);
      recentMemoryToken.value = recentMemoryCards.value[0]?.token ?? null;
      recentMemoryEventId.value = recentMemoryCards.value[0]?.eventId ?? null;
    } catch {
      if (requestSeq !== recentMemoryLoadSeq) return;
      recentMemoryCards.value = [];
    } finally {
      if (requestSeq === recentMemoryLoadSeq) {
        recentMemoryLoading.value = false;
      }
    }
    return;
  }

  recentMemoryLoading.value = false;
  recentMemoryEventId.value = activityItems.value.find(item => item.kind === "MEAL_COMPLETED")?.diningEventId ?? null;
}

function openCreateSheet() {
  closeFab();
  errorText.value = "";
  sheetErrorText.value = "";
  groupForm.name = buildDefaultGroupName();
  groupForm.description = "";
  openSheet("create");
}

async function handleChooseCover() {
  if (!canManageCurrentGroupCover.value || coverSubmitting.value) return;
  closeFab();
  try {
    const [file] = await uniPlatform.media.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"]
    });
    if (!file?.path) return;
    coverSubmitting.value = true;
    const result = await diningGroupStore.updateCurrentDiningGroupCover(file.path);
    if (!result) throw new Error("当前没有可更新的封面");
    await uniPlatform.feedback.toast({ title: "封面已更新", icon: "success" }).catch(() => undefined);
  } catch (error) {
    if (error && typeof error === "object" && "errMsg" in error && String((error as { errMsg?: string }).errMsg || "").includes("cancel")) {
      return;
    }
    await uniPlatform.feedback.toast({ title: "更新失败", icon: "none" }).catch(() => undefined);
  } finally {
    coverSubmitting.value = false;
  }
}

function openEditSheet() {
  if (!currentDiningGroup.value) return;
  closeFab();
  sheetErrorText.value = "";
  groupForm.name = currentDiningGroup.value.name;
  groupForm.description = currentDiningGroup.value.description || "";
  openSheet("edit");
}

function openSwitchSheet() {
  closeFab();
  openSheet("switch");
}

function openSheet(mode: Exclude<SheetMode, "">) {
  if (sheetMode.value) {
    sheetMode.value = mode;
    sheetVisible.value = true;
    return;
  }
  sheetMode.value = mode;
  sheetVisible.value = false;
  void nextTick(() => {
    sheetVisible.value = true;
  });
}

function closeSheet() {
  if (!sheetMode.value) return;
  sheetVisible.value = false;
}

function handleSheetAfterClose() {
  sheetMode.value = "";
  sheetSubmitting.value = false;
  sheetErrorText.value = "";
  groupForm.name = "";
  groupForm.description = "";
}

async function submitSheet() {
  if (!sheetMode.value || sheetMode.value === "switch" || sheetSubmitting.value) return;

  const name = groupForm.name.trim();
  const description = groupForm.description.trim() ? groupForm.description.trim() : null;
  if (!name) {
    sheetErrorText.value = "请先填写饭搭子名称";
    return;
  }

  sheetSubmitting.value = true;
  sheetErrorText.value = "";
  try {
    if (sheetMode.value === "edit") {
      const result = await diningGroupStore.updateCurrentDiningGroup(name, description);
      if (!result) {
        sheetErrorText.value = "当前没有可编辑的饭搭子";
        return;
      }
      await uniPlatform.feedback.toast({ title: "已保存", icon: "success" }).catch(() => undefined);
    } else {
      await diningGroupStore.createDiningGroup(name, description);
      await Promise.all([loadMembers(), loadActivities()]);
      await uniPlatform.feedback.toast({ title: "已开启", icon: "success" }).catch(() => undefined);
    }
    closeSheet();
  } catch (error) {
    sheetErrorText.value = error instanceof Error ? error.message : sheetMode.value === "edit" ? "保存失败" : "开启失败";
  } finally {
    sheetSubmitting.value = false;
  }
}

async function handleCreateInvite() {
  const diningGroupId = currentDiningGroup.value?.id as UUID | undefined;
  if (!diningGroupId || inviteSubmitting.value) return;

  closeFab();
  inviteSubmitting.value = true;
  errorText.value = "";
  try {
    const result = await diningGroupStore.createInvite(diningGroupId);
    sharePath.value = result.sharePath;
    await uniPlatform.feedback.toast({ title: "已生成", icon: "success" }).catch(() => undefined);
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "生成邀请失败";
  } finally {
    inviteSubmitting.value = false;
  }
}

async function handleCopy() {
  if (!sharePath.value) return;
  try {
    await uniPlatform.clipboard.set(sharePath.value);
    await uniPlatform.feedback.toast({ title: "已复制", icon: "success" }).catch(() => undefined);
  } catch {
    await uniPlatform.feedback.toast({ title: "复制失败", icon: "none" }).catch(() => undefined);
  }
}

function setActiveHeroMember(memberId: UUID) {
  activeHeroMemberId.value = memberId;
}

function resolveHeroMemberZIndex(memberId: UUID, index: number) {
  if (activeHeroMemberId.value === memberId) return heroMemberItems.value.length + 2;
  return index + 1;
}

function handleOpenNextMeal() {
  if (!nextMealItem.value) return;
  closeFab();
  if (nextMealItem.value.status === "OPEN") {
    void uniPlatform.navigation.navigateTo(`/pages_meal/poll/index?pollId=${encodeURIComponent(String(nextMealItem.value.id))}`).catch(() => undefined);
    return;
  }
  void uniPlatform.navigation.navigateTo(`/pages_meal/result/index?pollId=${encodeURIComponent(String(nextMealItem.value.id))}`).catch(() => undefined);
}

function handleOpenMealPlan() {
  closeFab();
  void uniPlatform.navigation.navigateTo("/pages_meal/plan/index").catch(() => undefined);
}

function handleOpenRecentMemoryCard(card: RecentMemoryCardItem) {
  closeFab();
  void uniPlatform.navigation
    .navigateTo(`/pages_share/memory/index?token=${encodeURIComponent(card.token)}`)
    .catch(() => undefined);
}

function handleOpenRecentMemory() {
  closeFab();
  if (recentMemoryToken.value) {
    void uniPlatform.navigation
      .navigateTo(`/pages_share/memory/index?token=${encodeURIComponent(recentMemoryToken.value)}`)
      .catch(() => undefined);
    return;
  }
  if (recentMemoryEventId.value) {
    void uniPlatform.navigation
      .navigateTo(`/pages_share/memory/index?eventId=${encodeURIComponent(String(recentMemoryEventId.value))}`)
      .catch(() => undefined);
    return;
  }
}

function handleOpenEntitlements() {
  closeFab();
  void uniPlatform.navigation.navigateTo("/pages_restaurant/settings/index").catch(() => undefined);
}

async function handleDissolve() {
  if (!currentDiningGroup.value || !canEditCurrentGroup.value) return;
  const confirmed = await uniPlatform.feedback
    .confirm({
      title: "确认解散饭搭子？",
      content: "解散后会结束当前全部成员关系，当前主图和邀请也会一起失效。",
      confirmText: "确认解散"
    })
    .catch(() => false);
  if (!confirmed) return;

  try {
    await diningGroupStore.dissolveCurrent();
    sharePath.value = "";
    nextMealItem.value = null;
    nextMealDetail.value = null;
    activityItems.value = [];
    recentMemoryCards.value = [];
    recentMemoryToken.value = null;
    recentMemoryEventId.value = null;
    await uniPlatform.feedback.toast({ title: "已解散", icon: "success" }).catch(() => undefined);
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "解散失败";
  }
}

function selectDiningGroup(diningGroupId: UUID) {
  if (diningGroupId === currentDiningGroup.value?.id) return;
  closeFab();
  sharePath.value = "";
  errorText.value = "";
  diningGroupStore.selectDiningGroup(diningGroupId);
}

function handleSwitchFromSheet(diningGroupId: UUID) {
  selectDiningGroup(diningGroupId);
  closeSheet();
}

function handlePageScroll(event: { detail?: { scrollTop?: number } }) {
  pageScrollTop.value = event.detail?.scrollTop ?? 0;
  if (fabExpanded.value) {
    fabExpanded.value = false;
  }
}

function handleBack() {
  if (getCurrentPages().length > 1) {
    void uniPlatform.navigation.navigateBack();
    return;
  }

  void uniPlatform.navigation.switchTab("/pages/home/index");
}

function handleOpenActivity(item: DiningGroupActivitySummary) {
  if (item.kind === "MEMORY_CREATED") {
    const token = extractMemoryToken(item.detail);
    if (token) {
      void uniPlatform.navigation.navigateTo(`/pages_share/memory/index?token=${encodeURIComponent(token)}`).catch(() => undefined);
      return;
    }
  }

  if (item.kind === "MEAL_COMPLETED" && item.diningEventId) {
    void uniPlatform.navigation
      .navigateTo(`/pages_share/memory/index?eventId=${encodeURIComponent(String(item.diningEventId))}`)
      .catch(() => undefined);
    return;
  }

  if (item.kind === "MENU_CONFIRMED" && item.pollId) {
    void uniPlatform.navigation.navigateTo(`/pages_meal/result/index?pollId=${encodeURIComponent(String(item.pollId))}`).catch(() => undefined);
    return;
  }

  if (item.pollId) {
    void uniPlatform.navigation.navigateTo(`/pages_meal/poll/index?pollId=${encodeURIComponent(String(item.pollId))}`).catch(() => undefined);
  }
}

function toggleFab() {
  fabExpanded.value = !fabExpanded.value;
}

function closeFab() {
  fabExpanded.value = false;
}

function handleFabAction(key: FabActionKey) {
  if (key === "nextMeal") {
    handleOpenNextMeal();
    return;
  }
  if (key === "recentMemory") {
    handleOpenRecentMemory();
    return;
  }
  if (key === "invite") {
    void handleCreateInvite();
    return;
  }
  if (key === "cover") {
    void handleChooseCover();
    return;
  }
  if (key === "edit") {
    openEditSheet();
    return;
  }
  if (key === "switch") {
    openSwitchSheet();
    return;
  }
  handleOpenEntitlements();
}

function buildFabActionStyle(index: number, total: number) {
  const angle = total <= 1 ? 228 : FAB_ACTION_START + ((FAB_ACTION_END - FAB_ACTION_START) / (total - 1)) * index;
  const distance = FAB_ACTION_DISTANCE + Math.max(0, total - 3) * FAB_ACTION_DISTANCE_STEP;
  const radian = (angle * Math.PI) / 180;
  const x = Math.round(Math.cos(radian) * distance);
  const y = Math.round(Math.sin(radian) * distance);
  const delay = index * 90;
  return `--fab-x: ${x}rpx; --fab-y: ${y}rpx; --fab-delay: ${delay}ms;`;
}

function buildDefaultGroupName() {
  const nickname = userStore.profile?.nickname?.trim();
  return nickname ? `${nickname}的饭搭子` : "";
}

function getAvatarText(nickname: string | null) {
  return nickname?.trim().slice(0, 1) || "饭";
}

function resolveActivityTag(item: DiningGroupActivitySummary) {
  if (item.kind === "MENU_CONFIRMED") return "定";
  if (item.kind === "COOK_CLAIMED") return "做";
  if (item.kind === "BRING_UPDATED") return "带";
  if (item.kind === "MEAL_COMPLETED") return "饭";
  if (item.kind === "MEMORY_CREATED") return "卡";
  if (item.kind === "MEMBER_JOINED" || item.kind === "INVITE_PENDING") return "人";
  return "投";
}

function buildLifeTitle(item: DiningGroupActivitySummary) {
  const actor = item.actorName?.trim() || "有人";
  if (item.kind === "POLL_OPENED") return `${actor}发起了下一顿`;
  if (item.kind === "POLL_VOTED") return `${actor}选了今儿个想吃的`;
  if (item.kind === "POLL_SUGGESTED") return `${actor}补了一道想吃的`;
  if (item.kind === "POLL_NOTED") return `${actor}留了一句想法`;
  if (item.kind === "MENU_CONFIRMED") return `${actor}把今天菜单定下了`;
  if (item.kind === "COOK_CLAIMED") return `${actor}认领了掌勺`;
  if (item.kind === "BRING_UPDATED") return `${actor}更新了带菜安排`;
  if (item.kind === "MEAL_COMPLETED") return `${actor}把这顿饭收尾了`;
  if (item.kind === "MEMORY_CREATED") return `${actor}留住了这顿饭`;
  if (item.kind === "MEMBER_JOINED") return `${actor}加入了饭搭子`;
  if (item.kind === "INVITE_PENDING") return `${actor}发出了一张邀请`;
  return `${actor}更新了下一顿`;
}

function buildLifeDetail(item: DiningGroupActivitySummary) {
  if (item.kind === "MEMORY_CREATED") return "留下一张餐桌照片";
  if (item.kind === "MEAL_COMPLETED") return "这顿饭已经吃完了";
  if (item.kind === "COOK_CLAIMED") return item.title?.trim() || "今晚有人掌勺";
  if (item.kind === "BRING_UPDATED") return item.title?.trim() || "带菜安排有更新";
  if (item.kind === "POLL_VOTED") return "去看看这顿饭最后会定成什么";
  return item.title?.trim() || item.detail?.trim() || "";
}

function buildActivityMeta(item: DiningGroupActivitySummary) {
  return formatMonthDayMinute(item.createdAt);
}

function buildGroupMeta(item: (typeof diningGroups.value)[number]) {
  const segments = [`${item.memberCount} 人`, `点菜 ${item.pollCount}`, `饭局 ${item.diningEventCount}`];
  if (item.latestActivityAt) {
    segments.push(formatMonthDayMinute(item.latestActivityAt));
  }
  return segments.join(" · ");
}

function extractMemoryToken(detail: string | null) {
  if (!detail) return null;
  const matched = detail.match(/[?&]token=([^&]+)/);
  return matched ? decodeURIComponent(matched[1]) : null;
}

function resolveRecentMemoryCover(preview: MemorySharePreviewResponse) {
  return preview.menuItems.find(item => item.coverUrl)?.coverUrl ?? null;
}

function resolveRecentMemoryCaption(preview: MemorySharePreviewResponse) {
  if (preview.caption?.trim()) return preview.caption.trim();
  return "这顿饭已经被记下来了";
}

function resolveRecentMemoryMenu(preview: MemorySharePreviewResponse) {
  const titles = preview.menuItems
    .map(item => item.title?.trim())
    .filter((value): value is string => Boolean(value))
    .slice(0, 3);
  return titles.length ? titles.join(" · ") : "这一顿的菜单";
}

function resolveRecentMemoryMeta(preview: MemorySharePreviewResponse) {
  const segments: string[] = [];
  if (preview.planDate) segments.push(formatPlanDate(preview.planDate));
  if (preview.mealSlot) segments.push(formatMealSlot(preview.mealSlot));
  if (preview.participants.length > 0) segments.push(`${preview.participants.length} 人一起`);
  return segments.join(" · ");
}

function resolveRecentMemoryMoment(preview: MemorySharePreviewResponse) {
  const moment = [preview.planDate ? formatPlanDate(preview.planDate) : "", preview.mealSlot ? formatMealSlot(preview.mealSlot) : ""]
    .filter(Boolean)
    .join(" ");
  return moment || formatMonthDayMinute(preview.sharedAt);
}

function resolveMealMoment(planDate?: string | null, mealSlot?: MealPollSummary["mealSlot"] | MemorySharePreviewResponse["mealSlot"] | null) {
  const slotLabel = mealSlot ? formatMealSlot(mealSlot) : "";
  const dayLabel = planDate ? formatRelativePlanDate(planDate) : "";
  const moment = `${dayLabel}${slotLabel}`.trim();
  return moment || "下一顿";
}

function formatRelativePlanDate(planDate: string) {
  const target = parsePlanDate(planDate);
  if (!target) return "";
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((target.getTime() - current.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  return "";
}

function parsePlanDate(planDate: string) {
  const [yearText, monthText, dayText] = planDate.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatMealSlot(slot: MealPollSummary["mealSlot"] | MemorySharePreviewResponse["mealSlot"]) {
  if (slot === "BREAKFAST") return "早餐";
  if (slot === "LUNCH") return "午餐";
  if (slot === "DINNER") return "晚餐";
  return "";
}

</script>

<style scoped lang="scss">
.members-nav-backdrop {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 799;
  overflow: hidden;
  background: var(--color-tabbar-bg);
  box-shadow: var(--shadow-tabbar);
  pointer-events: none;
  -webkit-backdrop-filter: saturate(180%) blur(22rpx);
  backdrop-filter: saturate(180%) blur(22rpx);
  transition: opacity 180ms ease;
}

.members-navbar {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-width: 0;
}

.members-navbar__back {
  display: flex;
  align-items: center;
  width: 64rpx;
  height: 64rpx;
  color: var(--color-text);
  line-height: 1;
}

.members-navbar__title {
  overflow: hidden;
  max-width: 420rpx;
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.members-scroll {
  height: 100%;
  background: var(--color-page);
}

.members-page {
  min-height: 100%;
}

.state-wrap {
  padding: 160rpx 24rpx 80rpx;
}

.state-card {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.state-card--empty {
  background: var(--color-surface);
}

.state-card__eyebrow,
.danger-card__title {
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: 700;
}

.state-card__title,
.section-card__title {
  color: var(--color-text);
  font-size: 42rpx;
  font-weight: 800;
}

.state-card__desc,
.section-card__hint,
.share-box__path,
.member-item__meta,
.group-card__meta,
.group-card__desc,
.activity-item__detail,
.activity-item__meta,
.state-inline__text,
.danger-card__hint {
  color: var(--color-text-secondary);
  font-size: 26rpx;
  line-height: 1.7;
}

.profile-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  border-radius: 24rpx;
  background: var(--color-surface-muted);
  padding: 22rpx 24rpx;
}

.profile-chip__label {
  color: var(--color-text-tertiary);
  font-size: 24rpx;
}

.profile-chip__value,
.member-item__name,
.group-card__name,
.switch-item__name,
.activity-item__title {
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: 700;
}

.primary-button,
.action-chip,
.sheet-button,
.danger-card__button,
.floating-switch {
  border-radius: 999rpx;
}

.primary-button,
.action-chip--primary,
.sheet-button--primary,
.danger-card__button,
.floating-switch {
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  color: var(--button-primary-text);
}

.hero-shell {
  position: relative;
  overflow: hidden;
  min-height: 760rpx;
  padding: 36rpx var(--space-page) 100rpx;
  background: url("https://p26-flow-imagex-sign.byteimg.com/tos-cn-i-a9rns2rl98/ae78f9de7a1f478c98191392ce02a1da.png~tplv-a9rns2rl98-image.png?lk3s=8e244e95&rcl=20260805163449D498FFFC3D3FE0525A12&rrcfp=dafada99&x-expires=2102142889&x-signature=MRqgWj6sVZ7ahwITIQ5Gxmt3kQ4%3D");
  // background:
  //   radial-gradient(circle at 18% 24%, var(--color-primary-soft), transparent 28%),
  //   radial-gradient(circle at 86% 12%, var(--color-warning-soft), transparent 22%),
  //   linear-gradient(
  //     180deg,
  //     color-mix(in srgb, var(--color-surface) 82%, var(--color-primary-soft) 18%) 0%,
  //     var(--color-page) 100%
  //   );
}

.hero-shell__veil {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--color-surface-mask-medium) 82%, var(--color-primary-soft) 18%) 0%,
      color-mix(in srgb, var(--color-surface-mask-strong) 88%, var(--color-warning-soft) 12%) 100%
    );
  -webkit-backdrop-filter: saturate(140%) blur(10rpx);
  backdrop-filter: saturate(140%) blur(10rpx);
  -webkit-mask-image: radial-gradient(ellipse 40% 60% at 75% 50%, transparent 0%, transparent 30%, rgba(0, 0, 0, 0.22) 40%, rgba(0, 0, 0, 0.72) 60%, #000 80%);
  mask-image: radial-gradient(ellipse 40% 60% at 75% 50%, transparent 0%, transparent 30%, rgba(0, 0, 0, 0.22) 40%, rgba(0, 0, 0, 0.72) 60%, #000 80%);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}

.hero-shell::after {
  position: absolute;
  right: -120rpx;
  bottom: 80rpx;
  width: 300rpx;
  height: 300rpx;
  border-radius: 50%;
  background: var(--color-primary-soft);
  content: "";
}

.hero-stage {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  gap: 20rpx;
  align-items: stretch;
}

.hero-stage__notes {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 30rpx;
}

.hero-note {
  position: relative;
  overflow: hidden;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.hero-note::before {
  position: absolute;
  inset: auto auto 0 0;
  width: 168rpx;
  height: 132rpx;
  background: color-mix(in srgb, var(--color-primary-soft) 38%, transparent);
  border-radius: 0 88rpx 0 0;
  content: "";
}

.hero-note--time {
  min-height: 236rpx;
  padding: 28rpx 24rpx;
  border-radius: var(--radius-lg);
}

.hero-note--stats {
  display: flex;
  flex: 1;
  gap: 12rpx;
  justify-content: space-between;
  padding: 40rpx 24rpx;
  border-radius: var(--radius-lg);
}

.hero-note--stats::before {
  inset: 0 0 auto auto;
  width: 188rpx;
  height: 120rpx;
  background: color-mix(in srgb, var(--color-warning-soft) 42%, transparent);
  border-radius: 0 0 0 92rpx;
}

.hero-note__pins {
  display: flex;
  justify-content: space-between;
}

.hero-note__pins--bottom {
  position: absolute;
  right: 24rpx;
  bottom: 24rpx;
  left: 24rpx;
  z-index: 2;
}

.hero-note__pin {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: var(--color-primary);
}

.hero-note__value-row {
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 12rpx;
  margin-top: 16rpx;
}

.hero-note__members {
  position: absolute;
  right: 24rpx;
  bottom: 130rpx;
  left: 24rpx;
  z-index: 2;
}

.hero-note__value-number {
  display: block;
  color: var(--color-text);
  font-size: 72rpx;
  font-weight: 900;
  line-height: 1;
}

.hero-note__value-unit,
.hero-note__metric-label {
  display: block;
  margin-top: 10rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.hero-note__caption {
  display: block;
  margin-top: 14rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  font-weight: 600;
}

.hero-note__metric {
  display: flex;
  position: relative;
  z-index: 1;
  flex: 1;
  align-items: center;
  gap: 10rpx;
  flex-direction: column;
  justify-content: flex-start;
  text-align: center;
}

.hero-note__metric-value {
  display: block;
  color: var(--color-text);
  font-size: 38rpx;
  font-weight: 900;
  line-height: 1.1;
}

.hero-note__metric-value--member {
  display: flex;
  align-items: baseline;
  gap: 6rpx;
}

.hero-note__metric-current {
  color: var(--color-text);
  font-size: 38rpx;
  font-weight: 900;
  line-height: 1.1;
}

.hero-note__metric-separator,
.hero-note__metric-limit {
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1;
}

.hero-stage__art {
  position: relative;
  z-index: 1;
  overflow: hidden;
  min-height: 100%;
  border-radius: var(--radius-lg);
  box-shadow:
    0 28rpx 64rpx color-mix(in srgb, var(--color-primary-soft) 34%, transparent),
    var(--shadow-card);
  background:
    radial-gradient(circle at 26% 28%, var(--color-surface-mask-medium), transparent 24%),
    radial-gradient(circle at 74% 68%, var(--color-primary-soft), transparent 28%),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--color-surface) 90%, var(--color-primary-soft) 10%) 0%,
      color-mix(in srgb, var(--color-page) 82%, var(--color-warning-soft) 18%) 100%
    );
}

.hero-stage__cover-image {
  position: relative;
  z-index: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.hero-stage__placeholder {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.hero-stage__placeholder-ring {
  position: absolute;
  border-radius: 50%;
  border: 2rpx solid var(--color-border);
}

.hero-stage__placeholder-ring--outer {
  top: 76rpx;
  right: 44rpx;
  width: 280rpx;
  height: 280rpx;
}

.hero-stage__placeholder-ring--inner {
  right: 92rpx;
  bottom: 84rpx;
  width: 172rpx;
  height: 172rpx;
}

.hero-members__avatars {
  display: flex;
  align-items: center;
  min-width: 0;
}

.hero-members__avatars--centered {
  justify-content: flex-end;
}

.hero-members__avatar {
  display: flex;
  width: 60rpx;
  height: 60rpx;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-left: -12rpx;
  border-radius: 50%;
  box-shadow: var(--shadow-card);
}

.hero-members__avatar:first-child {
  margin-left: 0;
}

.hero-members__avatar-image {
  width: 100%;
  height: 100%;
}

.hero-members__avatar-text,
.hero-members__more-text {
  font-size: 24rpx;
  font-weight: 800;
}

.hero-members__avatar--more {
  background: color-mix(in srgb, var(--color-surface) 64%, var(--color-warning-soft) 36%);
  color: var(--color-warning-text);
}

.members-content {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  padding: 0rpx var(--space-page) calc(220rpx + env(safe-area-inset-bottom));
  background: var(--color-surface);
}

.members-content__waves {
  position: absolute;
  top: -70rpx;
  right: 0;
  left: 0;
  height: 120rpx;
  overflow: hidden;
  pointer-events: none;
}

.members-content__wave {
  position: absolute;
  left: 50%;
  color: var(--color-surface);
  font-size: 420rpx;
  line-height: 0.72;
  white-space: nowrap;
  transform: translateX(-50%) scaleX(.9) scaleY(.7);
  transform-origin: center top;
}

.members-content__wave--back {
  top: -26rpx;
  opacity: 0.5;
}

.members-content__wave--mid {
  top: -4rpx;
  opacity: 0.7;
  transform: translateX(-40%) scaleX(1.6) scaleY(.9);
}

.members-content__wave--front {
  top: 18rpx;
  opacity: .9;
}

.sheet-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.action-chip {
  min-width: 188rpx;
  padding: 0 28rpx;
  height: 84rpx;
  line-height: 84rpx;
  font-size: 26rpx;
  box-shadow: var(--shadow-card);
}

.action-chip--ghost,
.sheet-button--ghost {
  background: var(--color-surface);
  color: var(--color-text);
}

.section-card__head,
.group-card__head,
.group-card__title-row,
.member-item,
.switch-item,
.switch-item__title-row,
.activity-item,
.activity-item__title-row,
.danger-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.section-card__action,
.danger-card__toggle {
  color: var(--color-primary);
  font-size: 24rpx;
}

.activity-list,
.member-list,
.group-list,
.switch-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.activity-item,
.member-item,
.group-card,
.switch-item {
  border-radius: 24rpx;
  background: var(--color-surface);
  padding: 22rpx 24rpx;
}

.activity-item__badge {
  display: flex;
  width: 72rpx;
  height: 72rpx;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  flex: 0 0 auto;
}

.activity-item__badge--pending {
  background: var(--color-warning-soft);
  color: var(--color-warning-text);
}

.activity-item__badge-text {
  font-size: 24rpx;
  font-weight: 800;
}

.activity-item__main,
.member-item__main,
.switch-item__main,
.danger-card__copy {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 8rpx;
}

.activity-item__dot,
.group-card__dot,
.switch-item__dot,
.floating-switch__dot,
.floating-fab__trigger-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: var(--color-danger);
  flex: 0 0 auto;
}

.member-item__avatar {
  display: flex;
  width: 84rpx;
  height: 84rpx;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  flex: 0 0 auto;
}

.member-item__avatar-image {
  width: 100%;
  height: 100%;
}

.member-item__avatar-text,
.member-item__role,
.group-card__badge,
.switch-item__status {
  font-size: 24rpx;
  font-weight: 700;
}

.member-item__role,
.group-card__badge,
.switch-item__status {
  color: var(--color-primary);
}

.group-card {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.group-card--active,
.switch-item--active {
  box-shadow: inset 0 0 0 2rpx var(--color-primary-soft);
}

.next-meal-card,
.recent-memory-card {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.next-meal-card__body,
.recent-memory-card__content,
.recent-memory-card__empty {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.next-meal-card__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.next-meal-card__title,
.recent-memory-card__caption,
.recent-memory-card__empty-title {
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: 800;
  line-height: 1.4;
}

.next-meal-card__badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 108rpx;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--color-surface) 58%, var(--color-warning-soft) 42%);
  color: var(--color-warning-text);
}

.next-meal-card__badge--pending {
  background: color-mix(in srgb, var(--color-surface) 56%, var(--color-primary-soft) 44%);
  color: var(--color-primary);
}

.next-meal-card__badge-text,
.next-meal-card__fact,
.next-meal-card__progress-text,
.recent-memory-card__menu,
.recent-memory-card__meta,
.recent-memory-card__empty-text,
.recent-memory-card__image-text {
  font-size: 24rpx;
}

.next-meal-card__badge-text,
.next-meal-card__fact,
.next-meal-card__progress-text,
.recent-memory-card__menu,
.recent-memory-card__image-text {
  font-weight: 700;
}

.next-meal-card__note {
  color: var(--color-text-secondary);
  font-size: 26rpx;
  line-height: 1.7;
}

.next-meal-card__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.next-meal-card__fact {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
}

.next-meal-card__progress {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.next-meal-card__progress-track {
  overflow: hidden;
  height: 16rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--color-surface) 70%, var(--color-primary-soft) 30%);
}

.next-meal-card__progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
}

.next-meal-card__progress-text,
.recent-memory-card__meta,
.recent-memory-card__empty-text {
  color: var(--color-text-secondary);
}

.recent-memory-card__body {
  display: flex;
  gap: 20rpx;
}

.recent-memory-card__body--empty {
  align-items: stretch;
}

.recent-memory-card__body--actionable {
  cursor: pointer;
}

.recent-memory-card__image {
  width: 180rpx;
  height: 180rpx;
  border-radius: 24rpx;
  background: color-mix(in srgb, var(--color-surface) 66%, var(--color-primary-soft) 34%);
  flex: 0 0 auto;
}

.recent-memory-card__image--empty {
  display: flex;
  position: relative;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 30% 28%, var(--color-surface-mask-medium), transparent 32%),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--color-surface) 86%, var(--color-primary-soft) 14%) 0%,
      color-mix(in srgb, var(--color-surface) 78%, var(--color-warning-soft) 22%) 100%
    );
}

.recent-memory-card__image--placeholder {
  overflow: hidden;
}

.recent-memory-card__image-orbit {
  position: absolute;
  border: 2rpx solid color-mix(in srgb, var(--color-border) 80%, transparent);
  border-radius: 50%;
}

.recent-memory-card__image-orbit--outer {
  top: 26rpx;
  left: 26rpx;
  width: 126rpx;
  height: 126rpx;
}

.recent-memory-card__image-orbit--inner {
  right: 28rpx;
  bottom: 26rpx;
  width: 72rpx;
  height: 72rpx;
}

.recent-memory-card__image-chip {
  position: absolute;
  right: 18rpx;
  bottom: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 92rpx;
  padding: 10rpx 14rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--color-surface-mask-strong) 78%, var(--color-surface) 22%);
  box-shadow: var(--shadow-card);
}

.recent-memory-card__image-text {
  color: var(--color-primary);
}

.recent-memory-card__content {
  flex: 1;
  min-width: 0;
}

.recent-memory-card__content--empty {
  justify-content: center;
}

.recent-memory-card__menu {
  color: var(--color-text);
}

.recent-memory-card__button {
  align-self: flex-start;
  min-width: 220rpx;
}

.switch-item__meta {
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.danger-card {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  background: color-mix(in srgb, var(--color-surface) 78%, var(--color-danger-soft) 22%);
}

.danger-card__button {
  width: 100%;
  background: var(--color-danger-button-bg);
  color: var(--color-danger-button-text);
}

.floating-fab {
  position: fixed;
  inset: 0;
  z-index: 20;
  pointer-events: none;
}

.floating-fab__backdrop {
  position: absolute;
  inset: 0;
  pointer-events: auto;
}

.floating-fab__cluster {
  position: absolute;
  right: 24rpx;
  bottom: calc(32rpx + env(safe-area-inset-bottom));
  width: 440rpx;
  height: 440rpx;
  pointer-events: none;
}

.floating-fab__item,
.floating-fab__trigger {
  position: absolute;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

.floating-fab__item {
  min-width: 168rpx;
  max-width: 220rpx;
  min-height: 76rpx;
  padding: 18rpx 26rpx;
  border-radius: 999rpx;
  box-shadow: var(--shadow-card);
  -webkit-backdrop-filter: saturate(125%) blur(12rpx);
  backdrop-filter: saturate(125%) blur(12rpx);
  transform-origin: right bottom;
  opacity: 0;
  transform: translate(0, 0) scale(0.42);
  pointer-events: none;
}

.floating-fab__item--expanded {
  opacity: 1;
  transform: translate(var(--fab-x), var(--fab-y)) scale(1);
  animation: floating-fab-pop 340ms cubic-bezier(0.18, 0.88, 0.24, 1.18) both;
  animation-delay: var(--fab-delay);
  pointer-events: auto;
}

.floating-fab__item--primary {
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow);
}

.floating-fab__item--surface {
  background: color-mix(in srgb, var(--color-surface-mask-medium) 80%, var(--color-surface) 20%);
  color: var(--color-text);
}

.floating-fab__item--warning {
  background: color-mix(in srgb, var(--color-surface) 70%, var(--color-warning-soft) 30%);
  color: var(--color-warning-text);
}

.floating-fab__item-label,
.floating-fab__trigger-text {
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1;
}

.floating-fab__trigger {
  gap: 14rpx;
  min-width: 176rpx;
  height: 92rpx;
  padding: 0 30rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow);
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.floating-fab__trigger--expanded {
  transform: scale(0.96);
}

.floating-fab__trigger-icon {
  position: relative;
  width: 28rpx;
  height: 28rpx;
  flex: 0 0 auto;
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.floating-fab__trigger--expanded .floating-fab__trigger-icon {
  transform: rotate(135deg);
}

.floating-fab__trigger-line {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 28rpx;
  height: 4rpx;
  border-radius: 999rpx;
  background: currentColor;
  transform: translate(-50%, -50%);
}

.floating-fab__trigger-line--y {
  transform: translate(-50%, -50%) rotate(90deg);
}

.floating-fab__trigger-dot {
  position: absolute;
  top: 16rpx;
  right: 18rpx;
}

.hero-stage--living {
  display: block;
}

.hero-stage__art--living {
  min-height: 640rpx;
}

.hero-stage__overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 28rpx;
  // background:
  //   linear-gradient(180deg, color-mix(in srgb, var(--color-surface-mask-medium) 44%, transparent) 0%, transparent 34%),
  //   linear-gradient(180deg, transparent 42%, color-mix(in srgb, var(--color-surface-mask-strong) 84%, transparent) 100%);
}

.hero-stage__copy {
  display: flex;
  max-width: 500rpx;
  flex-direction: column;
  gap: 18rpx;
}

.hero-stage__title {
  color: var(--color-text);
  font-size: 62rpx;
  font-weight: 900;
  line-height: 1.12;
  text-shadow: 0 10rpx 28rpx color-mix(in srgb, var(--color-surface) 56%, transparent);
}

.hero-stage__subtitle {
  color: var(--color-text-secondary);
  font-size: 28rpx;
  font-weight: 500;
  line-height: 1.6;
  text-shadow: 0 8rpx 20rpx color-mix(in srgb, var(--color-surface) 42%, transparent);
}

.hero-stage__status-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  width: 100%;
}

.hero-stage__status-pill {
  display: flex;
  min-height: 124rpx;
  flex-direction: column;
  justify-content: space-between;
  gap: 12rpx;
  padding: 22rpx 20rpx 18rpx;
  border-radius: 24rpx;
  background: color-mix(in srgb, var(--color-surface) 74%, var(--color-surface-mask-medium) 26%);
  -webkit-backdrop-filter: saturate(125%) blur(10rpx);
  backdrop-filter: saturate(125%) blur(10rpx);
  box-shadow: var(--shadow-card);
  cursor: pointer;
}

.hero-stage__status-pill--disabled {
  opacity: 0.72;
}

.hero-stage__status-label {
  color: var(--color-text-tertiary);
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.2;
}

.hero-stage__status-value {
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: 800;
  line-height: 1.4;
}

.hero-stage__footer {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 18rpx;
}

.hero-members--stage {
  display: flex;
  align-items: center;
  align-self: flex-start;
  max-width: 100%;
  padding: 14rpx 18rpx 14rpx 16rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--color-surface) 76%, var(--color-surface-mask-medium) 24%);
  -webkit-backdrop-filter: saturate(125%) blur(12rpx);
  backdrop-filter: saturate(125%) blur(12rpx);
}

.hero-members__avatar--stage {
  border: 4rpx solid color-mix(in srgb, var(--color-surface) 90%, transparent);
  background: color-mix(in srgb, var(--color-surface) 66%, var(--color-primary-soft) 34%);
  color: var(--color-primary);
  transition: transform 180ms ease;
}

.hero-members__avatar--active {
  transform: scale(1.04);
}

.hero-members__avatar--invite {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 12px;
  border: 2rpx dashed color-mix(in srgb, var(--color-primary) 52%, var(--color-text-tertiary) 48%);
  background: color-mix(in srgb, var(--color-surface) 82%, var(--color-primary-soft) 18%);
  color: var(--color-primary);
}

.hero-members__invite-icon {
  font-size: 24rpx;
  font-weight: 700;
}

.next-meal-card--empty {
  cursor: pointer;
}

.next-meal-card__choices,
.next-meal-card__avatars {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.next-meal-card__choice {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--color-surface) 68%, var(--color-primary-soft) 32%);
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: 700;
}

.next-meal-card__group {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.next-meal-card__group-title,
.next-meal-card__group-empty,
.next-meal-card__latest,
.next-meal-card__empty-text {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.next-meal-card__avatar {
  display: flex;
  width: 64rpx;
  height: 64rpx;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-surface) 72%, var(--color-primary-soft) 28%);
  color: var(--color-primary);
  box-shadow: var(--shadow-card);
}

.next-meal-card__avatar--pending {
  opacity: 0.56;
  filter: grayscale(1);
}

.next-meal-card__avatar-image {
  width: 100%;
  height: 100%;
}

.next-meal-card__avatar-text {
  font-size: 24rpx;
  font-weight: 800;
}

.next-meal-card__empty {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.next-meal-card__empty-title {
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: 800;
}

.recent-memory-card__rail {
  width: 100%;
}

.recent-memory-card__rail-inner {
  display: flex;
  gap: 18rpx;
}

.recent-memory-tile {
  display: flex;
  width: 308rpx;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 14rpx;
}

.recent-memory-tile--guide {
  cursor: pointer;
}

.recent-memory-tile__image {
  width: 100%;
  height: 220rpx;
  border-radius: 28rpx;
  background: color-mix(in srgb, var(--color-surface) 66%, var(--color-primary-soft) 34%);
}

.recent-memory-tile__image--empty {
  display: flex;
  position: relative;
  align-items: center;
  justify-content: center;
}

.recent-memory-tile__copy {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.recent-memory-tile__title {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1.4;
}

.recent-memory-tile__menu,
.recent-memory-tile__meta,
.life-feed-item__detail,
.life-feed-item__meta {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.life-feed-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.life-feed-item {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
  padding: 22rpx 0;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 72%, transparent);
}

.life-feed-item:first-child {
  padding-top: 0;
  border-top: none;
}

.life-feed-item__avatar {
  display: flex;
  width: 72rpx;
  height: 72rpx;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  background: color-mix(in srgb, var(--color-surface) 66%, var(--color-primary-soft) 34%);
  color: var(--color-primary);
  flex: 0 0 auto;
}

.life-feed-item__avatar--pending {
  background: color-mix(in srgb, var(--color-surface) 64%, var(--color-warning-soft) 36%);
  color: var(--color-warning-text);
}

.life-feed-item__avatar-text {
  font-size: 24rpx;
  font-weight: 800;
}

.life-feed-item__main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}

.life-feed-item__title {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1.5;
}

@keyframes floating-fab-pop {
  0% {
    opacity: 0;
    transform: translate(0, 0) scale(0.42);
  }

  72% {
    opacity: 1;
    transform: translate(var(--fab-x), var(--fab-y)) scale(1.06);
  }

  100% {
    opacity: 1;
    transform: translate(var(--fab-x), var(--fab-y)) scale(1);
  }
}

.sheet-field {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.sheet-field__label {
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: 700;
}

.sheet-static,
.sheet-input,
.sheet-textarea {
  border-radius: 24rpx;
  background: var(--color-surface-muted);
  color: var(--color-text);
  font-size: 28rpx;
  padding: 22rpx 24rpx;
}

.sheet-button {
  flex: 1;
}

.sheet-textarea {
  min-height: 180rpx;
}

.sheet-input__placeholder {
  color: var(--color-text-tertiary);
}

.error-text {
  color: var(--color-danger-text);
  font-size: 24rpx;
}

.error-text--sheet {
  margin-bottom: 20rpx;
}

.error-text--inline {
  margin: -6rpx 0 2rpx;
}

.state-inline {
  padding: 8rpx 0;
}

@media (max-width: 720rpx) {
  .hero-stage {
    grid-template-columns: minmax(0, 1fr);
  }

  .hero-stage__art {
    min-height: 320rpx;
  }

  .recent-memory-card__body {
    flex-direction: column;
  }

  .recent-memory-card__image {
    width: 100%;
    height: 240rpx;
  }
}
</style>
