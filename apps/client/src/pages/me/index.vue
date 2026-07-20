<template>
  <Layout
    title="我的"
    current-tab="me"
    :show-left="false"
    full-screen
    :navbar-placeholder="false"
    navbar-transparent
  >
    <template #navbar-left>
      <view
        v-if="sessionStore.isLoggedIn"
        class="nav-switch"
        hover-class="nav-switch--hover"
        hover-stay-time="100"
        @click="handleDiningGroupManage"
      >
        <text class="nav-switch__text">{{ navSwitchText }}</text>
        <text class="nav-switch__arrow">⌄</text>
      </view>
    </template>

    <template #navbar-center>
      <text class="nav-title">我的</text>
    </template>

    <view class="me-page" :class="themeClasses">
      <template v-if="profileLoading">
        <view class="me-skeleton page-content">
          <view class="profile-card">
            <Skeleton class="profile-card__avatar-skeleton" shape="circle" width="112rpx" height="112rpx" />
            <view class="profile-card__main">
              <Skeleton width="260rpx" height="36rpx" />
              <Skeleton width="360rpx" height="28rpx" />
            </view>
          </view>
          <Skeleton layout="column" :count="3" width="100%" height="118rpx" radius="var(--radius-lg)" />
          <Skeleton width="100%" height="260rpx" radius="var(--entry-board-radius)" />
        </view>
      </template>

      <template v-else>
        <view class="profile-hero">
          <view v-if="sessionStore.isLoggedIn" class="profile-card">
            <view class="profile-card__avatar">
              <text class="profile-card__avatar-text">我</text>
            </view>
            <view class="profile-card__main">
              <view class="profile-card__name-row">
                <text class="profile-card__name">{{ profileName }}</text>
                <text class="profile-card__vip">{{ vipLevelText }}</text>
              </view>
              <view class="profile-card__meta-row">
                <text class="profile-card__meta">{{ profileUidText }}</text>
                <text class="profile-card__ticket">{{ mealTicketText }}</text>
              </view>
            </view>
            <view class="profile-card__action" hover-class="profile-card__action--hover" hover-stay-time="100" @click="showComingSoon('个人资料编辑')">
              <text class="profile-card__action-text">编辑</text>
              <text class="profile-card__action-arrow">›</text>
            </view>
          </view>

          <Login
            v-else
            class="login-card"
            title="登录后查看我的饭搭子"
            description="登录后可以查看账号、饭搭子列表、成员身份和设置。"
            @success="loadMe"
          />
        </view>

        <view class="page-content">
          <view class="stats-card">
            <view v-for="item in statsItems" :key="item.label" class="stats-card__item">
              <text class="stats-card__value">{{ item.value }}</text>
              <text class="stats-card__label">{{ item.label }}</text>
            </view>
          </view>

          <view class="benefit-panel">
            <view class="benefit-grid">
              <view
                v-for="item in benefitEntries"
                :key="item.title"
                class="benefit-entry"
                hover-class="benefit-entry--hover"
                hover-stay-time="100"
                @click="handleEntryClick(item)"
              >
                <view class="benefit-entry__icon-wrap">
                  <text class="benefit-entry__icon">{{ item.icon }}</text>
                </view>
                <text class="benefit-entry__title">{{ item.title }}</text>
              </view>
            </view>

            <view class="level-grid">
              <view class="level-card">
                <text class="level-card__label">当前版本</text>
                <text class="level-card__value">基础版</text>
              </view>
              <view class="level-card level-card--soft">
                <text class="level-card__label">会员权益</text>
                <text class="level-card__value">未开通</text>
              </view>
            </view>
          </view>

          <view v-if="sessionStore.isLoggedIn" class="restaurant-panel">
            <view class="section-heading">
              <text class="section-heading__title">当前饭搭子</text>
              <text class="section-heading__action" @click="handleDiningGroupManage">管理</text>
            </view>

            <view v-if="currentDiningGroup" class="restaurant-card">
              <text class="restaurant-card__name">{{ currentDiningGroup.name }}</text>
              <text class="restaurant-card__meta">{{ diningGroupMeta }}</text>
            </view>

            <view v-else class="restaurant-empty">
              <text class="restaurant-empty__title">还没有饭搭子</text>
              <text class="restaurant-empty__description">创建或加入饭搭子后，成员、菜谱和采购都会跟随饭搭子管理。</text>
            </view>
          </view>

          <view class="action-panel">
            <view
              v-for="item in sessionStore.isLoggedIn && currentDiningGroup ? diningGroupEntries : guestDiningGroupEntries"
              :key="item.title"
              class="action-entry"
              hover-class="action-entry--hover"
              hover-stay-time="100"
              @click="handleEntryClick(item)"
            >
              <text class="action-entry__icon">{{ item.icon }}</text>
              <text class="action-entry__title">{{ item.title }}</text>
            </view>
          </view>

          <view class="menu-section">
            <view class="section-heading">
              <text class="section-heading__title">个人设置</text>
            </view>
            <view class="menu-list">
              <view
                v-for="item in settingEntries"
                :key="item.title"
                class="menu-item"
                hover-class="menu-item--hover"
                hover-stay-time="100"
                @click="handleEntryClick(item)"
              >
                <view class="menu-item__left">
                  <text class="menu-item__icon">{{ item.icon }}</text>
                  <text class="menu-item__title">{{ item.title }}</text>
                </view>
                <view class="menu-item__right">
                  <text v-if="item.description" class="menu-item__description">{{ item.description }}</text>
                  <text class="menu-item__arrow">›</text>
                </view>
              </view>
            </view>
          </view>

          <view class="theme-section">
            <view class="section-heading">
              <text class="section-heading__title">皮肤与主题</text>
            </view>
            <text class="theme-section__description">基础皮肤可切换色系，会员皮肤先作为权益入口展示。</text>

            <view class="setting-group">
              <text class="setting-label">皮肤风格</text>
              <view class="option-row">
                <view
                  v-for="option in skinOptions"
                  :key="option.value"
                  class="option-chip"
                  :class="{ 'option-chip--active': option.value === effectiveSkin }"
                  hover-class="option-chip--hover"
                  hover-stay-time="100"
                  @click="handleSkinChange(option.value)"
                >
                  <text class="option-chip__text">{{ option.label }}</text>
                  <text v-if="option.access === 'member'" class="option-chip__badge">会员</text>
                </view>
              </view>
            </view>

            <view v-if="canSwitchPalette" class="setting-group">
              <text class="setting-label">色系</text>
              <view class="option-row">
                <view
                  v-for="palette in supportedPalettes"
                  :key="palette"
                  class="option-chip"
                  :class="{ 'option-chip--active': palette === effectivePalette }"
                  hover-class="option-chip--hover"
                  hover-stay-time="100"
                  @click="handlePaletteChange(palette)"
                >
                  <text class="option-chip__text">{{ paletteLabels[palette] }}</text>
                </view>
              </view>
            </view>

            <text v-else class="setting-note">当前皮肤使用固定色系。</text>
          </view>

          <view class="menu-section">
            <view class="section-heading">
              <text class="section-heading__title">支持</text>
            </view>
            <view class="menu-list">
              <view
                v-for="item in supportEntries"
                :key="item.title"
                class="menu-item"
                hover-class="menu-item--hover"
                hover-stay-time="100"
                @click="handleEntryClick(item)"
              >
                <view class="menu-item__left">
                  <text class="menu-item__icon">{{ item.icon }}</text>
                  <text class="menu-item__title">{{ item.title }}</text>
                </view>
                <view class="menu-item__right">
                  <text v-if="item.description" class="menu-item__description">{{ item.description }}</text>
                  <text class="menu-item__arrow">›</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </template>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { userApi } from "@/apis/user";
import { useTheme } from "@/composables/useTheme";
import { useDiningGroupStore } from "@/stores/dining-group";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { THEME_SKIN_OPTIONS, type ThemePalette, type ThemeSkin } from "@/themes";

const sessionStore = useSessionStore();
const userStore = useUserStore();
const diningGroupStore = useDiningGroupStore();
const {
  themeClasses,
  effectiveSkin,
  effectivePalette,
  supportedPalettes,
  canSwitchPalette,
  setThemeSkin,
  setThemePalette
} = useTheme();
const profileLoading = ref(false);
const skinOptions = THEME_SKIN_OPTIONS;
const currentDiningGroup = computed(() => diningGroupStore.currentDiningGroup);
const diningGroupCount = computed(() => (currentDiningGroup.value ? 1 : 0));
const navSwitchText = computed(() => currentDiningGroup.value?.name || "我的饭搭子");
const diningGroupMeta = computed(() => {
  const group = currentDiningGroup.value;

  if (!group) return "";

  return `${group.memberCount} 位成员`;
});
const profileName = computed(() => userStore.profile?.nickname || "下一餐用户");
const profileUidText = computed(() => `UID ${userStore.profile?.uid ?? "--"}`);
const vipLevelText = computed(() => "VIP 0");
const mealTicketText = computed(() => "饭票 0");
const memberSkinCount = computed(() => skinOptions.filter((item) => item.access === "member").length);
const statsItems = computed(() => [
  {
    value: diningGroupCount.value,
    label: "当前空间"
  },
  {
    value: currentDiningGroup.value?.memberCount ?? 0,
    label: "成员"
  },
  {
    value: memberSkinCount.value,
    label: "会员皮肤"
  }
]);

const paletteLabels: Record<ThemePalette, string> = {
  default: "默认",
  warm: "暖黄",
  olive: "橄榄",
  cool: "冷蓝"
};

interface PageEntry {
  title: string;
  icon: string;
  url?: string;
  disabledText?: string;
  description?: string;
}

const diningGroupEntries: PageEntry[] = [
  {
    title: "成员管理",
    icon: "员",
    url: "/pages_restaurant/members/index"
  },
  {
    title: "邀请家人",
    icon: "邀",
    url: "/pages_restaurant/members/index"
  },
  {
    title: "饭搭子设置",
    icon: "设",
    url: "/pages_restaurant/settings/index"
  },
];

const guestDiningGroupEntries: PageEntry[] = [
  {
    title: "邀请链接加入",
    icon: "加",
    disabledText: "邀请链接加入"
  }
];

const benefitEntries: PageEntry[] = [
  {
    title: "皮肤权益",
    icon: "肤",
    disabledText: "权益购买"
  },
  {
    title: "饭搭子权益",
    icon: "权",
    disabledText: "权益购买"
  },
  {
    title: "饭搭子卡",
    icon: "卡",
    url: "/pages_share/memory/index"
  }
];

const settingEntries: PageEntry[] = [
  {
    title: "个人资料",
    icon: "我",
    disabledText: "个人资料编辑"
  },
  {
    title: "账号与安全",
    icon: "安",
    disabledText: "账号与安全"
  },
  {
    title: "消息提醒",
    icon: "铃",
    disabledText: "消息提醒"
  },
  {
    title: "我的权益",
    icon: "权",
    description: "基础版",
    disabledText: "权益购买"
  }
];

const supportEntries: PageEntry[] = [
  {
    title: "帮助反馈",
    icon: "帮",
    disabledText: "帮助反馈"
  },
  {
    title: "关于下一餐",
    icon: "关",
    disabledText: "关于下一餐"
  }
];

async function loadMe() {
  if (!sessionStore.isLoggedIn || profileLoading.value) return;

  profileLoading.value = true;
  try {
    userStore.setProfile(await userApi.getCurrent());
    await loadDiningGroup();
  } finally {
    profileLoading.value = false;
  }
}

async function loadDiningGroup() {
  if (!sessionStore.isLoggedIn) return;
  await diningGroupStore.refreshCurrent();
}

async function handleSkinChange(skin: ThemeSkin) {
  await setThemeSkin(skin);
}

async function handlePaletteChange(palette: ThemePalette) {
  await setThemePalette(palette);
}

function handleDiningGroupManage() {
  if (currentDiningGroup.value) {
    navigateTo("/pages_restaurant/members/index");
    return;
  }

  void loadDiningGroup();
}

function handleEntryClick(entry: PageEntry) {
  if (entry.url) {
    navigateTo(entry.url);
    return;
  }

  showComingSoon(entry.disabledText || entry.title);
}

function navigateTo(url: string) {
  uni.navigateTo({ url });
}

function showComingSoon(name: string) {
  uni.showToast({
    title: `${name}暂未开放`,
    icon: "none"
  });
}
</script>

<style scoped lang="scss">
.nav-title {
  color: var(--color-text-inverse);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.nav-switch {
  display: inline-flex;
  align-items: center;
  max-width: 260rpx;
  height: 54rpx;
  padding: 0 18rpx;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.18);
}

.nav-switch--hover,
.profile-card__action--hover,
.benefit-entry--hover,
.action-entry--hover,
.menu-item--hover,
.option-chip--hover {
  opacity: 0.86;
}

.nav-switch__text {
  overflow: hidden;
  color: var(--color-text-inverse);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-switch__arrow {
  margin-left: 6rpx;
  color: rgba(255, 255, 255, 0.82);
  font-size: var(--font-size-sm);
  line-height: 1;
}

.me-page {
  min-height: 100vh;
  padding-bottom: calc(132rpx + env(safe-area-inset-bottom));
  background: var(--color-page);
}

.profile-hero {
  position: relative;
  overflow: hidden;
  min-height: 430rpx;
  padding: 154rpx var(--space-page) 150rpx;
  background:
    radial-gradient(circle at 14% 20%, rgba(255, 255, 255, 0.22) 0, transparent 30%),
    radial-gradient(circle at 86% 14%, var(--color-primary-soft) 0, transparent 34%),
    linear-gradient(160deg, var(--color-primary-active), var(--color-primary));
}

.profile-hero::after {
  position: absolute;
  right: -28%;
  bottom: -142rpx;
  left: -28%;
  height: 250rpx;
  border-radius: 50% 50% 0 0;
  background: var(--color-page);
  content: "";
  pointer-events: none;
}

.page-content {
  position: relative;
  z-index: 2;
  padding: 0 var(--space-page) var(--space-lg);
}

.me-page > .page-content {
  margin-top: -112rpx;
}

.me-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding-top: 160rpx;
}

.profile-card {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  min-height: 132rpx;
}

.me-skeleton .profile-card {
  min-height: 150rpx;
  padding: 28rpx;
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.profile-card__avatar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 112rpx;
  height: 112rpx;
  border: 5rpx solid rgba(255, 255, 255, 0.72);
  border-radius: var(--radius-pill);
  background: var(--entry-primary-bg);
  box-shadow: 0 12rpx 26rpx rgba(0, 0, 0, 0.12);
}

.profile-card__avatar-skeleton {
  flex: 0 0 112rpx;
  width: 112rpx;
}

.profile-card__avatar-text {
  color: var(--entry-ink);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-heavy);
}

.profile-card__main {
  flex: 1;
  min-width: 0;
  margin-left: var(--space-md);
}

.profile-card__name-row,
.profile-card__meta-row {
  display: flex;
  align-items: center;
  min-width: 0;
}

.profile-card__meta-row {
  margin-top: 10rpx;
}

.profile-card__name {
  overflow: hidden;
  max-width: 300rpx;
  color: var(--color-text-inverse);
  font-size: 42rpx;
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-card__vip {
  flex: 0 0 auto;
  margin-left: 12rpx;
  padding: 4rpx 12rpx;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.22);
  color: var(--color-text-inverse);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
  line-height: 1.3;
}

.profile-card__meta,
.profile-card__ticket {
  overflow: hidden;
  color: rgba(255, 255, 255, 0.82);
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-card__meta {
  flex: 0 1 auto;
  max-width: 210rpx;
}

.profile-card__ticket {
  flex: 0 0 auto;
  margin-left: 18rpx;
  padding-left: 18rpx;
  border-left: 1rpx solid rgba(255, 255, 255, 0.28);
}

.profile-card__action {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  margin-left: var(--space-md);
  padding: 14rpx 20rpx;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.18);
}

.profile-card__action-text,
.profile-card__action-arrow {
  color: var(--color-text-inverse);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.profile-card__action-arrow {
  margin-left: 8rpx;
  font-size: var(--font-size-lg);
  line-height: 1;
}

.login-card {
  position: relative;
  z-index: 2;
}

.stats-card,
.benefit-panel,
.restaurant-panel,
.action-panel,
.theme-section {
  border-radius: 32rpx;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.stats-card {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  min-height: 128rpx;
  overflow: hidden;
}

.stats-card__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.stats-card__value,
.stats-card__label {
  display: block;
}

.stats-card__value {
  color: var(--color-text);
  font-size: 40rpx;
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
}

.stats-card__label {
  margin-top: 10rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.benefit-panel,
.restaurant-panel,
.action-panel,
.menu-section,
.theme-section {
  margin-top: var(--space-md);
}

.benefit-panel {
  padding: 28rpx 28rpx 24rpx;
}

.benefit-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-sm);
}

.benefit-entry {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}

.benefit-entry__icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 74rpx;
  height: 74rpx;
  border-radius: 22rpx;
  background: var(--color-primary-soft);
}

.benefit-entry__icon {
  color: var(--color-primary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-heavy);
}

.benefit-entry__title {
  overflow: hidden;
  max-width: 150rpx;
  margin-top: 18rpx;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.level-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-sm);
  margin-top: 26rpx;
}

.level-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 74rpx;
  padding: 0 22rpx;
  border-radius: var(--radius-lg);
  background: var(--color-primary-soft);
}

.level-card--soft {
  background: var(--color-surface-muted);
}

.level-card__label {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.level-card__value {
  flex: 0 0 auto;
  margin-left: var(--space-sm);
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
}

.restaurant-panel,
.theme-section {
  padding: var(--space-lg);
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-heading__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.section-heading__action {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.restaurant-card,
.restaurant-empty {
  margin-top: var(--space-md);
  padding: 24rpx;
  border-radius: var(--radius-lg);
  background: var(--color-surface-muted);
}

.restaurant-card__name,
.restaurant-card__meta,
.restaurant-empty__title,
.restaurant-empty__description {
  display: block;
}

.restaurant-card__name,
.restaurant-empty__title {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.restaurant-card__meta,
.restaurant-empty__description {
  margin-top: 8rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.action-panel {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  min-height: 140rpx;
  padding: 18rpx 10rpx;
}

.action-entry {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.action-entry__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 58rpx;
  height: 58rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.action-entry__title {
  overflow: hidden;
  max-width: 128rpx;
  margin-top: 12rpx;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-section {
  padding: 8rpx 0;
}

.menu-list {
  margin-top: var(--space-sm);
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 96rpx;
  padding: 0 8rpx;
}

.menu-item__left,
.menu-item__right {
  display: flex;
  align-items: center;
  min-width: 0;
}

.menu-item__left {
  flex: 1;
}

.menu-item__right {
  flex: 0 0 auto;
  margin-left: var(--space-sm);
}

.menu-item__icon {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 48rpx;
  height: 48rpx;
  border-radius: var(--radius-pill);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.menu-item__title {
  overflow: hidden;
  margin-left: var(--space-sm);
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-item__description {
  max-width: 180rpx;
  overflow: hidden;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-item__arrow {
  margin-left: 10rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-lg);
  line-height: 1;
}

.theme-section__description {
  display: block;
  margin-top: var(--space-sm);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
}

.setting-group {
  margin-top: var(--space-lg);
}

.setting-label {
  display: block;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.option-row {
  display: flex;
  flex-wrap: wrap;
  margin: 16rpx -8rpx -8rpx;
}

.option-chip {
  display: flex;
  align-items: center;
  margin: 0 8rpx 8rpx;
  padding: 16rpx 22rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
}

.option-chip--active {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.option-chip__text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.option-chip--active .option-chip__text {
  color: var(--color-text-inverse);
}

.option-chip__badge {
  margin-left: 8rpx;
  padding: 2rpx 8rpx;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
}

.option-chip--active .option-chip__badge {
  background: rgba(255, 255, 255, 0.22);
  color: var(--color-text-inverse);
}

.setting-note {
  display: block;
  margin-top: var(--space-lg);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}
</style>
