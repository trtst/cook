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
            <view class="hero-stage">
              <view class="hero-stage__notes">
                <view class="hero-note hero-note--time">
                  <view class="hero-note__pins">
                    <view class="hero-note__pin" />
                    <view class="hero-note__pin" />
                  </view>
                  <text class="hero-note__caption">一起开饭第</text>
                  <view class="hero-note__value-row">
                    <text class="hero-note__value-number">{{ displayCreatedDays }}</text>
                    <text class="hero-note__value-unit">天</text>
                  </view>
                  <view class="hero-note__pins hero-note__pins--bottom">
                    <view class="hero-note__pin" />
                    <view class="hero-note__pin" />
                  </view>
                </view>

                <view class="hero-note hero-note--stats">
                  <view class="hero-note__metric">
                    <view class="hero-note__metric-value hero-note__metric-value--member">
                      <text class="hero-note__metric-current">{{ currentDiningGroup.memberCount ?? 0 }}</text>
                      <text class="hero-note__metric-separator">/</text>
                      <text class="hero-note__metric-limit">{{ currentDiningGroup.memberLimit ?? 0 }}</text>
                    </view>
                    <text class="hero-note__metric-label">成员数</text>
                  </view>
                  <view class="hero-note__metric">
                    <text class="hero-note__metric-value">{{ currentDiningGroup.pollCount ?? 0 }}</text>
                    <text class="hero-note__metric-label">点菜</text>
                  </view>
                  <view class="hero-note__metric">
                    <text class="hero-note__metric-value">{{ currentDiningGroup.diningEventCount ?? 0 }}</text>
                    <text class="hero-note__metric-label">饭局</text>
                  </view>
                </view>
              </view>

              <view class="hero-stage__art">
                <image
                  v-if="currentDiningGroup.coverImageUrl"
                  class="hero-stage__cover-image"
                  :src="currentDiningGroup.coverImageUrl"
                  mode="aspectFill"
                />
                <view v-else class="hero-stage__placeholder">
                  <view class="hero-stage__placeholder-ring hero-stage__placeholder-ring--outer" />
                  <view class="hero-stage__placeholder-ring hero-stage__placeholder-ring--inner" />
                  <view class="hero-stage__placeholder-chip">主图展示区</view>
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
            <view class="action-strip">
              <button
                v-if="canInviteCurrentGroup"
                class="action-chip action-chip--primary"
                :loading="inviteSubmitting"
                :disabled="inviteSubmitting"
                @click="handleCreateInvite"
              >
                生成邀请
              </button>
              <button v-if="canEditCurrentGroup" class="action-chip action-chip--ghost" @click="openEditSheet">编辑资料</button>
              <button v-else class="action-chip action-chip--ghost" @click="handleOpenEntitlements">查看权益</button>
              <button v-if="diningGroups.length > 1" class="action-chip action-chip--ghost" @click="openSwitchSheet">切换饭搭子</button>
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

            <view class="section-card">
              <view class="section-card__head">
                <text class="section-card__title">当前动态</text>
                <text class="section-card__action" @click="loadActivities">刷新</text>
              </view>
              <text class="section-card__hint">只展示这段关系里最近需要关注的轻动态。</text>

              <view v-if="activitiesLoading" class="state-inline">
                <text class="state-inline__text">加载中...</text>
              </view>

              <view v-else-if="activityItems.length" class="activity-list">
                <view v-for="item in activityItems" :key="item.id" class="activity-item">
                  <view class="activity-item__badge" :class="{ 'activity-item__badge--pending': item.state === 'PENDING' }">
                    <text class="activity-item__badge-text">{{ resolveActivityTag(item) }}</text>
                  </view>
                  <view class="activity-item__main">
                    <view class="activity-item__title-row">
                      <text class="activity-item__title">{{ item.title }}</text>
                      <view v-if="item.state === 'PENDING'" class="activity-item__dot" />
                    </view>
                    <text v-if="item.detail" class="activity-item__detail">{{ item.detail }}</text>
                    <text class="activity-item__meta">{{ buildActivityMeta(item) }}</text>
                  </view>
                </view>
              </view>

              <view v-else class="state-inline">
                <text class="state-inline__text">当前还没有新的动态。</text>
              </view>
            </view>

            <view class="section-card">
              <view class="section-card__head">
                <text class="section-card__title">成员</text>
                <text class="section-card__action" @click="loadMembers">刷新</text>
              </view>
              <text class="section-card__hint">关系只改变成员协作入口，不会切换个人菜谱、冰箱和计划归属。</text>

              <view v-if="membersLoading" class="state-inline">
                <text class="state-inline__text">加载中...</text>
              </view>

              <view v-else-if="members.length" class="member-list">
                <view v-for="member in members" :key="member.id" class="member-item">
                  <view class="member-item__avatar">
                    <image v-if="member.user.avatarUrl" class="member-item__avatar-image" :src="member.user.avatarUrl" mode="aspectFill" />
                    <text v-else class="member-item__avatar-text">{{ getAvatarText(member.user.nickname) }}</text>
                  </view>
                  <view class="member-item__main">
                    <text class="member-item__name">{{ member.user.nickname || "未命名成员" }}</text>
                    <text class="member-item__meta">UID {{ member.user.uid }}</text>
                  </view>
                  <text class="member-item__role">{{ roleLabels[member.role] ?? member.role }}</text>
                </view>
              </view>

              <view v-else class="state-inline">
                <text class="state-inline__text">当前还没有其他成员。</text>
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

          <view v-if="diningGroups.length > 1" class="floating-switch" @click="openSwitchSheet">
            <text>切换饭搭子</text>
            <view v-if="hasOtherGroupAttention" class="floating-switch__dot" />
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
import type { DiningGroupRole } from "@/apis/dining-group";
import type { UUID } from "@/apis/http";
import { pollApi, type DiningGroupActivitySummary } from "@/apis/poll";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { usePageScrollLock, usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useDiningGroupStore } from "@/stores/dining-group";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";

type SheetMode = "create" | "edit" | "switch" | "";

const pageStyle = usePageScrollStyle();
const { setLocked: setPageLocked } = usePageScrollLock(Symbol("dining-group-sheet"));
const { navBarTotalHeight } = useSystemInfo();

const HERO_NAV_GAP = 22;
const HERO_NAV_FADE_DISTANCE = 108;

const sessionStore = useSessionStore();
const userStore = useUserStore();
const diningGroupStore = useDiningGroupStore();

const inviteSubmitting = ref(false);
const membersLoading = ref(false);
const activitiesLoading = ref(false);
const pageScrollTop = ref(0);
const errorText = ref("");
const sharePath = ref("");
const activityItems = ref<DiningGroupActivitySummary[]>([]);
const dangerExpanded = ref(false);
const sheetMode = ref<SheetMode>("");
const sheetVisible = ref(false);
const sheetSubmitting = ref(false);
const sheetErrorText = ref("");
const groupForm = reactive({
  name: "",
  description: ""
});

const currentDiningGroup = computed(() => diningGroupStore.currentDiningGroup);
const diningGroups = computed(() => diningGroupStore.diningGroups);
const members = computed(() => diningGroupStore.members);
const profileNickname = computed(() => userStore.profile?.nickname?.trim() || "未填写昵称");
const canEditCurrentGroup = computed(() => Boolean(currentDiningGroup.value?.isOwned));
const canInviteCurrentGroup = computed(() => {
  const role = currentDiningGroup.value?.myRole;
  return role === "OWNER" || role === "ADMIN";
});
const hasOtherGroupAttention = computed(() =>
  diningGroups.value.some(item => item.id !== currentDiningGroup.value?.id && item.hasAttention)
);
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
    setPageLocked(visible);
  },
  { immediate: true }
);

watch(
  () => currentDiningGroup.value?.id,
  () => {
    if (!sessionStore.isLoggedIn) return;
    sharePath.value = "";
    dangerExpanded.value = false;
    void loadMembers();
    void loadActivities();
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
    await Promise.all([loadMembers(), loadActivities()]);
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
    return;
  }
  if (activitiesLoading.value) return;

  activitiesLoading.value = true;
  errorText.value = "";
  try {
    activityItems.value = await pollApi.listActivities({ diningGroupId, limit: 5 });
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "动态加载失败";
  } finally {
    activitiesLoading.value = false;
  }
}

function openCreateSheet() {
  errorText.value = "";
  sheetErrorText.value = "";
  groupForm.name = buildDefaultGroupName();
  groupForm.description = "";
  openSheet("create");
}

function openEditSheet() {
  if (!currentDiningGroup.value) return;
  sheetErrorText.value = "";
  groupForm.name = currentDiningGroup.value.name;
  groupForm.description = currentDiningGroup.value.description || "";
  openSheet("edit");
}

function openSwitchSheet() {
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

function handleOpenEntitlements() {
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
    activityItems.value = [];
    await uniPlatform.feedback.toast({ title: "已解散", icon: "success" }).catch(() => undefined);
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "解散失败";
  }
}

function selectDiningGroup(diningGroupId: UUID) {
  if (diningGroupId === currentDiningGroup.value?.id) return;
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
}

function handleBack() {
  if (getCurrentPages().length > 1) {
    void uniPlatform.navigation.navigateBack();
    return;
  }

  void uniPlatform.navigation.switchTab("/pages/home/index");
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

function buildActivityMeta(item: DiningGroupActivitySummary) {
  const actor = item.actorName?.trim() || "饭搭子";
  return `${actor} · ${formatTime(item.createdAt)}`;
}

function buildGroupMeta(item: (typeof diningGroups.value)[number]) {
  const segments = [`${item.memberCount} 人`, `点菜 ${item.pollCount}`, `饭局 ${item.diningEventCount}`];
  if (item.latestActivityAt) {
    segments.push(formatTime(item.latestActivityAt));
  }
  return segments.join(" · ");
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
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
  padding-bottom: calc(220rpx + env(safe-area-inset-bottom));
}

.state-wrap {
  padding: 160rpx 24rpx 80rpx;
}

.state-card,
.section-card,
.danger-card {
  border-radius: 32rpx;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.state-card {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 32rpx;
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
  padding: 36rpx 24rpx 120rpx;
  background:
    radial-gradient(circle at 18% 24%, var(--color-primary-soft), transparent 28%),
    radial-gradient(circle at 86% 12%, var(--color-warning-soft), transparent 22%),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--color-surface) 82%, var(--color-primary-soft) 18%) 0%,
      var(--color-page) 100%
    );
}

.hero-shell::before {
  position: absolute;
  right: 0;
  bottom: -64rpx;
  left: 0;
  height: 180rpx;
  border-radius: 50% 50% 0 0 / 100% 100% 0 0;
  background: var(--color-page);
  content: "";
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
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20rpx;
  align-items: stretch;
}

.hero-stage__notes {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 24rpx;
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
  padding: 26rpx 24rpx;
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
  align-items: baseline;
  gap: 12rpx;
  margin-top: 16rpx;
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
  overflow: hidden;
  min-height: 100%;
  border-radius: var(--radius-lg);
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
  width: 100%;
  height: 100%;
}

.hero-stage__placeholder {
  position: absolute;
  inset: 0;
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

.hero-stage__placeholder-chip {
  position: absolute;
  right: 38rpx;
  bottom: 42rpx;
  padding: 14rpx 20rpx;
  border-radius: 999rpx;
  background: var(--color-surface-mask-strong);
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: 700;
  box-shadow: var(--shadow-card);
}

.members-content {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  padding: 0rpx 24rpx calc(220rpx + env(safe-area-inset-bottom));
  background: var(--color-surface);
}

.members-content__waves {
  position: absolute;
  top: -100rpx;
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
  opacity: 0.42;
}

.members-content__wave--mid {
  top: -4rpx;
  opacity: 0.66;
  transform: translateX(-40%) scaleX(1.6) scaleY(.9);
}

.members-content__wave--front {
  top: 18rpx;
  opacity: 1;
}

.action-strip,
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

.section-card,
.danger-card {
  padding: 28rpx;
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
.floating-switch__dot {
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

.floating-switch {
  position: fixed;
  right: 28rpx;
  bottom: calc(36rpx + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 0 34rpx;
  height: 88rpx;
  box-shadow: var(--button-primary-shadow);
  font-size: 26rpx;
  z-index: 20;
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
</style>
