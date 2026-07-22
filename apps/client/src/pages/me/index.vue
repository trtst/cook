<template>
  <Layout
    title="我的"
    current-tab="me"
    :show-left="false"
    full-screen
    :navbar-placeholder="false"
    navbar-transparent
  >
    <template #navbar-center>
      <text class="nav-title">我的</text>
    </template>

    <view class="me-page" :class="themeClasses">
      <view class="profile-hero" :class="profileHeroVariant">
        <view class="identity-card">
          <template v-if="profileLoading">
            <view class="profile-row">
              <Skeleton shape="circle" width="112rpx" height="112rpx" />
              <view class="profile-row__main">
                <Skeleton width="250rpx" height="36rpx" />
                <Skeleton width="190rpx" height="26rpx" />
              </view>
            </view>
            <view class="quick-grid quick-grid--skeleton">
              <Skeleton v-for="index in 4" :key="index" shape="circle" width="64rpx" height="64rpx" />
            </view>
          </template>

          <template v-else>
            <view class="profile-row">
              <view class="profile-row__avatar">
                <image
                  v-if="profileAvatarUrl"
                  class="profile-row__avatar-image"
                  :src="profileAvatarUrl"
                  mode="aspectFill"
                />
                <text v-else class="profile-row__avatar-text">{{ profileAvatarText }}</text>
              </view>

              <view class="profile-row__main">
                <view class="profile-row__name-line">
                  <text class="profile-row__name">{{ profileName }}</text>
                  <text class="profile-row__tier">{{ personalTierText }}</text>
                </view>
                <text class="profile-row__uid">{{ profileUidText }}</text>
                <view v-if="profileChips.length" class="profile-row__chips">
                  <text v-for="chip in profileChips" :key="chip" class="profile-row__chip">{{ chip }}</text>
                </view>
              </view>

              <view
                class="profile-row__edit"
                hover-class="is-pressed"
                hover-stay-time="100"
                @click="handleProfileAction"
              >
                <text class="profile-row__edit-arrow">›</text>
              </view>
            </view>

            <view class="quick-grid">
              <view
                v-for="item in coreEntries"
                :key="item.title"
                class="quick-entry"
                hover-class="is-pressed"
                hover-stay-time="100"
                @click="handleEntryClick(item)"
              >
                <view class="quick-entry__icon-wrap">
                  <text class="quick-entry__icon">{{ item.icon }}</text>
                </view>
                <text class="quick-entry__title">{{ item.title }}</text>
                <text v-if="isDisabledEntry(item)" class="quick-entry__badge">待开放</text>
              </view>
            </view>
          </template>
        </view>
      </view>

      <view class="page-content">
        <template v-if="profileLoading">
          <view class="overview-grid">
            <Skeleton width="100%" height="246rpx" radius="var(--radius-xs)" />
            <Skeleton width="100%" height="246rpx" radius="var(--radius-xs)" />
          </view>
          <Skeleton width="100%" height="380rpx" radius="var(--radius-xs)" />
        </template>

        <template v-else>
          <view v-if="sessionStore.isLoggedIn && loadErrorText" class="load-notice" @click="loadMe">
            <text class="load-notice__text">{{ loadErrorText }}</text>
            <text class="load-notice__action">重新加载</text>
          </view>

          <view class="overview-grid">
            <view
              class="dining-card"
              hover-class="is-pressed"
              hover-stay-time="100"
              @click="handleDiningGroupManage"
            >
              <view class="overview-heading">
                <text class="overview-heading__title">我的饭搭子</text>
                <text class="overview-heading__arrow">›</text>
              </view>
              <text class="dining-card__name">{{ diningGroupName }}</text>

              <view class="dining-card__stats">
                <view v-for="item in diningGroupStats" :key="item.label" class="dining-stat">
                  <text class="dining-stat__value">{{ item.value }}</text>
                  <text class="dining-stat__label">{{ item.label }}</text>
                </view>
              </view>
            </view>

            <view class="entitlement-card">
              <view class="overview-heading">
                <text class="overview-heading__title">权益状态</text>
                <text class="entitlement-card__scope">{{ entitlementScopeText }}</text>
              </view>
              <text class="entitlement-card__title">{{ entitlementTitle }}</text>
              <text class="entitlement-card__description">{{ entitlementDescription }}</text>
              <view class="entitlement-card__limits">
                <view v-for="item in entitlementLimits" :key="item.label" class="entitlement-limit">
                  <text class="entitlement-limit__label">{{ item.label }}</text>
                  <text class="entitlement-limit__value">{{ item.value }}</text>
                </view>
              </view>
            </view>
          </view>

          <view class="service-section">
            <text class="service-section__title">其他个人服务</text>
            <view class="service-list">
              <view
                v-for="item in personalEntries"
                :key="item.title"
                class="service-row"
                hover-class="is-pressed"
                hover-stay-time="100"
                @click="handleEntryClick(item)"
              >
                <view class="service-row__icon-wrap">
                  <text class="service-row__icon">{{ item.icon }}</text>
                </view>
                <view class="service-row__copy">
                  <text class="service-row__title">{{ item.title }}</text>
                  <text v-if="item.description" class="service-row__description">{{ item.description }}</text>
                </view>
                <text class="service-row__arrow">›</text>
              </view>
            </view>
          </view>

          <view class="service-section">
            <text class="service-section__title">厨房知识</text>
            <view class="knowledge-grid">
              <view
                v-for="item in knowledgeEntries"
                :key="item.title"
                class="knowledge-entry"
                hover-class="is-pressed"
                hover-stay-time="100"
                @click="handleEntryClick(item)"
              >
                <view class="knowledge-entry__icon-wrap">
                  <text class="knowledge-entry__icon">{{ item.icon }}</text>
                </view>
                <text class="knowledge-entry__title">{{ item.title }}</text>
                <text class="knowledge-entry__description">{{ item.description }}</text>
              </view>
            </view>
          </view>

          <view class="service-section">
            <text class="service-section__title">设置与支持</text>
            <view class="service-list">
              <view
                class="service-row"
                hover-class="is-pressed"
                hover-stay-time="100"
                @click="themePanelOpen = !themePanelOpen"
              >
                <view class="service-row__icon-wrap">
                  <text class="service-row__icon">肤</text>
                </view>
                <view class="service-row__copy">
                  <text class="service-row__title">皮肤主题</text>
                  <text class="service-row__description">{{ currentThemeText }}</text>
                </view>
                <text class="service-row__arrow" :class="{ 'service-row__arrow--open': themePanelOpen }">›</text>
              </view>

              <view v-if="themePanelOpen" class="theme-panel">
                <view class="theme-group">
                  <text class="theme-group__label">显示模式</text>
                  <view class="option-row">
                    <view
                      v-for="option in themeModeOptions"
                      :key="option.value"
                      class="option-chip"
                      :class="{ 'option-chip--active': option.value === themeMode }"
                      hover-class="is-pressed"
                      hover-stay-time="100"
                      @click="handleThemeModeChange(option.value)"
                    >
                      <text class="option-chip__text">{{ option.label }}</text>
                    </view>
                  </view>
                </view>

                <view class="theme-group">
                  <text class="theme-group__label">皮肤风格</text>
                  <view class="option-row">
                    <view
                      v-for="option in skinOptions"
                      :key="option.value"
                      class="option-chip"
                      :class="{ 'option-chip--active': option.value === effectiveSkin }"
                      hover-class="is-pressed"
                      hover-stay-time="100"
                      @click="handleSkinChange(option.value)"
                    >
                      <text class="option-chip__text">{{ option.label }}</text>
                    </view>
                  </view>
                </view>

                <view v-if="canSwitchPalette" class="theme-group">
                  <text class="theme-group__label">色系</text>
                  <view class="option-row">
                    <view
                      v-for="palette in supportedPalettes"
                      :key="palette"
                      class="option-chip"
                      :class="{ 'option-chip--active': palette === effectivePalette }"
                      hover-class="is-pressed"
                      hover-stay-time="100"
                      @click="handlePaletteChange(palette)"
                    >
                      <text class="option-chip__text">{{ paletteLabels[palette] }}</text>
                    </view>
                  </view>
                </view>
              </view>

              <view
                v-for="item in visibleSettingEntries"
                :key="item.title"
                class="service-row"
                hover-class="is-pressed"
                hover-stay-time="100"
                @click="handleEntryClick(item)"
              >
                <view class="service-row__icon-wrap">
                  <text class="service-row__icon">{{ item.icon }}</text>
                </view>
                <view class="service-row__copy">
                  <text class="service-row__title">{{ item.title }}</text>
                  <text v-if="item.description" class="service-row__description">{{ item.description }}</text>
                </view>
                <text class="service-row__arrow">›</text>
              </view>
            </view>
          </view>
        </template>
      </view>

      <view
        v-if="loginVisible"
        class="login-modal"
        @click="closeLogin"
        @touchmove.stop.prevent
      >
        <view class="login-modal__panel" @click.stop>
          <view class="login-modal__header">
            <text class="login-modal__close" @click="closeLogin">×</text>
          </view>
          <Login
            title="登录下一餐"
            description="登录后可以同步饭搭子、计划、购物清单和食材。"
            @success="handleLoginSuccess"
          />
        </view>
      </view>

      <view
        v-if="profileEditorOpen"
        class="profile-modal"
        @click="closeProfileEditor"
        @touchmove.stop.prevent
      >
        <view class="profile-modal__panel" @click.stop>
          <view class="profile-modal__header">
            <text class="profile-modal__title">编辑资料</text>
            <text class="profile-modal__close" @click="closeProfileEditor">×</text>
          </view>

          <view class="profile-form">
            <text class="profile-form__label">昵称</text>
            <input
              v-model="profileNameDraft"
              class="profile-form__input"
              maxlength="20"
              placeholder="请输入昵称"
              :disabled="profileSaving"
            />
            <text v-if="profileEditErrorText" class="profile-form__error">{{ profileEditErrorText }}</text>
          </view>

          <view class="profile-modal__actions">
            <button class="profile-modal__button profile-modal__button--ghost" :disabled="profileSaving" @click="closeProfileEditor">
              取消
            </button>
            <button
              class="profile-modal__button profile-modal__button--primary"
              :loading="profileSaving"
              :disabled="profileSaving"
              @click="saveProfile"
            >
              保存
            </button>
          </view>
        </view>
      </view>

      <view
        v-if="passwordEditorOpen"
        class="profile-modal"
        @click="closePasswordEditor"
        @touchmove.stop.prevent
      >
        <view class="profile-modal__panel" @click.stop>
          <view class="profile-modal__header">
            <text class="profile-modal__title">修改密码</text>
            <text class="profile-modal__close" @click="closePasswordEditor">×</text>
          </view>

          <view class="password-form">
            <view class="password-form__field">
              <text class="password-form__label">当前密码</text>
              <input
                v-model="currentPasswordDraft"
                class="password-form__input"
                password
                maxlength="128"
                placeholder="请输入当前密码"
                :disabled="passwordSaving"
              />
            </view>

            <view class="password-form__field">
              <text class="password-form__label">新密码</text>
              <input
                v-model="nextPasswordDraft"
                class="password-form__input"
                password
                maxlength="128"
                placeholder="请输入新密码，至少 6 位"
                :disabled="passwordSaving"
              />
            </view>

            <view class="password-form__field">
              <text class="password-form__label">确认新密码</text>
              <input
                v-model="confirmPasswordDraft"
                class="password-form__input"
                password
                maxlength="128"
                placeholder="请再次输入新密码"
                :disabled="passwordSaving"
              />
            </view>

            <text v-if="passwordEditErrorText" class="password-form__error">{{ passwordEditErrorText }}</text>
          </view>

          <view class="profile-modal__actions">
            <button class="profile-modal__button profile-modal__button--ghost" :disabled="passwordSaving" @click="closePasswordEditor">
              取消
            </button>
            <button
              class="profile-modal__button profile-modal__button--primary"
              :loading="passwordSaving"
              :disabled="passwordSaving"
              @click="savePassword"
            >
              保存
            </button>
          </view>
        </view>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { ApiClientError } from "@/apis/http";
import { userApi } from "@/apis/user";
import { uniPlatform } from "@/platform/uni";
import { useTheme } from "@/composables/useTheme";
import { useDiningGroupStore } from "@/stores/dining-group";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { THEME_SKIN_OPTIONS, type ThemePalette, type ThemeSkin } from "@/themes";
import { restoreAppSession } from "@/utils/app-session";

interface PageEntry {
  title: string;
  icon: string;
  url?: string;
  disabledText?: string;
  description?: string;
  action?: "logout" | "change-password";
}

const sessionStore = useSessionStore();
const userStore = useUserStore();
const diningGroupStore = useDiningGroupStore();
const {
  themeClasses,
  effectiveSkin,
  effectivePalette,
  themeMode,
  supportedPalettes,
  canSwitchPalette,
  setThemeMode,
  setThemeSkin,
  setThemePalette
} = useTheme();

const profileLoading = ref(false);
const loadErrorText = ref("");
const themePanelOpen = ref(false);
const loginVisible = ref(false);
const profileEditorOpen = ref(false);
const profileSaving = ref(false);
const passwordEditorOpen = ref(false);
const passwordSaving = ref(false);
const profileNameDraft = ref("");
const profileEditErrorText = ref("");
const currentPasswordDraft = ref("");
const nextPasswordDraft = ref("");
const confirmPasswordDraft = ref("");
const passwordEditErrorText = ref("");
const skinOptions = THEME_SKIN_OPTIONS;
const profileHeroVariants = ["profile-hero--mist", "profile-hero--halo", "profile-hero--ripple"] as const;
const profileHeroVariant = profileHeroVariants[Math.floor(Math.random() * profileHeroVariants.length)];
let pendingAction: (() => void) | null = null;
let restoredOnce = false;

const currentDiningGroup = computed(() => diningGroupStore.currentDiningGroup);
const currentEntitlements = computed(() => diningGroupStore.currentEntitlements);
const profileName = computed(() => {
  if (!sessionStore.isLoggedIn) return "点击登录";
  return userStore.profile?.nickname || "下一餐用户";
});
const profileAvatarUrl = computed(() => userStore.profile?.avatarUrl || "");
const profileAvatarText = computed(() => {
  if (!sessionStore.isLoggedIn) return "我";
  return profileName.value.trim().slice(0, 1) || "我";
});
const profileUidText = computed(() =>
  sessionStore.isLoggedIn ? `UID ${userStore.profile?.uid ?? "--"}` : "登录后同步你的数据"
);
const personalTierText = computed(() => {
  if (!sessionStore.isLoggedIn) return "登录";
  return getTierText(currentEntitlements.value?.personalTier);
});
const profileChips = computed(() => {
  if (!sessionStore.isLoggedIn) return [];

  const chips = [`个人 ${getTierText(currentEntitlements.value?.personalTier)}`];
  if (currentDiningGroup.value) {
    chips.push(diningGroupRoleText.value);
  }

  return chips;
});
const diningGroupName = computed(() => {
  if (!sessionStore.isLoggedIn) return "登录后查看饭搭子";
  return currentDiningGroup.value?.name || "饭搭子信息暂未加载";
});
const diningGroupRoleText = computed(() => {
  const role = currentDiningGroup.value?.myRole;
  if (!role) return "角色待加载";
  return diningGroupRoleLabels[role];
});
const diningGroupStateText = computed(() => {
  const state = currentDiningGroup.value?.state;
  if (!state) return "状态待加载";
  return diningGroupStateLabels[state];
});
const diningGroupStats = computed(() => [
  {
    value: currentDiningGroup.value?.memberCount ?? "--",
    label: "成员"
  },
  {
    value: currentDiningGroup.value?.memberLimit ?? currentEntitlements.value?.memberLimit ?? "--",
    label: "上限"
  },
  {
    value: currentDiningGroup.value ? diningGroupRoleText.value : "--",
    label: "角色"
  }
]);
const entitlementScopeText = computed(() => {
  if (!sessionStore.isLoggedIn) return "未登录";
  const scope = currentEntitlements.value?.currentScope;
  return scope ? entitlementScopeLabels[scope] : "待加载";
});
const entitlementTitle = computed(() => {
  if (!sessionStore.isLoggedIn) return "登录后查看权益";
  return `个人 ${getTierText(currentEntitlements.value?.personalTier)} · 饭搭子 ${getTierText(currentEntitlements.value?.diningGroupTier)}`;
});
const entitlementDescription = computed(() => {
  if (!sessionStore.isLoggedIn) return "登录后同步饭搭子、计划、购物清单和食材。";
  return `当前饭搭子${diningGroupStateText.value}`;
});
const entitlementLimits = computed(() => [
  {
    label: "菜谱",
    value: currentEntitlements.value ? `${currentEntitlements.value.recipeLimit}` : "--"
  },
  {
    label: "存储",
    value: currentEntitlements.value ? formatBytes(currentEntitlements.value.storageLimitBytes) : "--"
  }
]);
const currentThemeText = computed(() => {
  const modeLabel = themeModeLabels[themeMode.value];
  const skinLabel = skinOptions.find((item) => item.value === effectiveSkin.value)?.label || "基础";
  if (!canSwitchPalette.value) return `${modeLabel} · ${skinLabel}`;
  return `${modeLabel} · ${skinLabel} · ${paletteLabels[effectivePalette.value]}`;
});

const themeModeLabels = {
  system: "跟随系统",
  light: "浅色",
  dark: "深色"
} as const;
const themeModeOptions = [
  { label: "跟随系统", value: "system" },
  { label: "浅色", value: "light" },
  { label: "深色", value: "dark" }
] as const;
const paletteLabels: Record<ThemePalette, string> = {
  default: "默认",
  warm: "暖黄",
  olive: "橄榄",
  cool: "冷蓝"
};
const diningGroupRoleLabels = {
  OWNER: "主理人",
  ADMIN: "管理员",
  MEMBER: "成员"
} as const;
const diningGroupStateLabels = {
  NORMAL: "正常",
  OVER_RECIPE_LIMIT: "菜谱超额",
  OVER_STORAGE_READONLY: "存储只读"
} as const;
const entitlementScopeLabels = {
  USER: "个人",
  DINING_GROUP: "饭搭子"
} as const;

const coreEntries: PageEntry[] = [
  {
    title: "饭局",
    icon: "局",
    disabledText: "饭局"
  },
  {
    title: "计划",
    icon: "计",
    url: "/pages_meal/plan/index"
  },
  {
    title: "购物清单",
    icon: "购",
    url: "/pages_pantry/list/index"
  },
  {
    title: "食材",
    icon: "材",
    url: "/pages_pantry/index/index"
  }
];

const personalEntries: PageEntry[] = [
  {
    title: "消息通知",
    icon: "讯",
    description: "饭局邀请、计划进度和系统消息",
    disabledText: "消息通知"
  },
  {
    title: "我的口味",
    icon: "味",
    description: "口味偏好、忌口和过敏信息",
    url: "/pages_me/taste/index"
  },
  {
    title: "我的勋章",
    icon: "勋",
    description: "成长记录暂未开放",
    disabledText: "勋章墙"
  },
  {
    title: "分类与单位",
    icon: "类",
    description: "蔬菜、肉蛋奶、水产海鲜｜克、千克、斤、升、个",
    disabledText: "分类与单位"
  },
  {
    title: "食材",
    icon: "材",
    description: "土豆、小葱等基础食材资料",
    disabledText: "食材资料"
  },
  {
    title: "厨具",
    icon: "具",
    description: "平底锅等常用厨具资料",
    disabledText: "厨具"
  }
];

const knowledgeEntries: PageEntry[] = [
  {
    title: "烹饪技巧",
    icon: "烹",
    description: "火候与做法",
    disabledText: "烹饪技巧"
  },
  {
    title: "厨房准备",
    icon: "备",
    description: "备菜与收纳",
    disabledText: "厨房准备"
  },
  {
    title: "食谱技巧",
    icon: "谱",
    description: "配方与替换",
    disabledText: "食谱技巧"
  }
];

const accountSettingEntries: PageEntry[] = [
  {
    title: "修改密码",
    icon: "安",
    description: "更新当前账号登录密码",
    action: "change-password"
  }
];

const supportSettingEntries: PageEntry[] = [
  {
    title: "消息提醒",
    icon: "铃",
    disabledText: "消息提醒"
  },
  {
    title: "隐私保护",
    icon: "隐",
    disabledText: "隐私保护"
  },
  {
    title: "帮助与反馈",
    icon: "帮",
    disabledText: "帮助与反馈"
  },
  {
    title: "关于下一餐",
    icon: "关",
    disabledText: "关于下一餐"
  }
];

const visibleSettingEntries = computed(() => {
  const entries = sessionStore.isLoggedIn ? [...accountSettingEntries, ...supportSettingEntries] : supportSettingEntries;

  if (!sessionStore.isLoggedIn) {
    return entries;
  }

  return [
    ...entries,
    {
      title: "退出登录",
      icon: "退",
      description: "清除当前账号会话",
      action: "logout" as const
    }
  ];
});

function getTierText(tier?: "FREE" | "PLUS") {
  return tier === "PLUS" ? "Plus" : "Free";
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${Math.round(bytes / 1024 / 1024 / 1024)}GB`;
  }

  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / 1024 / 1024)}MB`;
  }

  return `${Math.round(bytes / 1024)}KB`;
}

function isDisabledEntry(entry: PageEntry) {
  return Boolean(entry.disabledText && !entry.url && !entry.action);
}

onShow(() => {
  void syncPageState();
});

async function syncPageState() {
  if (!restoredOnce) {
    await restoreAppSession();
    restoredOnce = true;

    if (sessionStore.isLoggedIn && userStore.profile && diningGroupStore.hasCurrentContext) {
      profileLoading.value = false;
      loadErrorText.value = "";
      return;
    }
  }

  if (sessionStore.isLoggedIn) {
    await loadMe();
    return;
  }

  profileLoading.value = false;
  loadErrorText.value = "";
}

async function loadMe() {
  if (!sessionStore.isLoggedIn || profileLoading.value) return;

  const hasCachedMe = Boolean(userStore.profile && diningGroupStore.hasCurrentContext);
  profileLoading.value = !hasCachedMe;
  loadErrorText.value = "";

  const [profileResult, diningGroupResult] = await Promise.allSettled([
    userApi.getCurrent(),
    diningGroupStore.refreshCurrent()
  ]);

  if (profileResult.status === "fulfilled") {
    userStore.setProfile(profileResult.value);
  }

  if (profileResult.status === "rejected" || diningGroupResult.status === "rejected") {
    loadErrorText.value = "部分信息加载失败";
  }

  profileLoading.value = false;
}

async function handleSkinChange(skin: ThemeSkin) {
  await setThemeSkin(skin);
}

async function handleThemeModeChange(mode: (typeof themeModeOptions)[number]["value"]) {
  await setThemeMode(mode);
}

async function handlePaletteChange(palette: ThemePalette) {
  await setThemePalette(palette);
}

function handleDiningGroupManage() {
  requireLogin(() => {
    if (currentDiningGroup.value) {
      navigateTo("/pages_restaurant/members/index");
      return;
    }

    void loadMe();
  });
}

function handleEntryClick(entry: PageEntry) {
  if (entry.action === "change-password") {
    requireLogin(() => {
      openPasswordEditor();
    });
    return;
  }

  if (entry.action === "logout") {
    void handleLogout();
    return;
  }

  requireLogin(() => {
    if (entry.url) {
      navigateTo(entry.url);
      return;
    }

    showComingSoon(entry.disabledText || entry.title);
  });
}

function handleProfileAction() {
  if (sessionStore.isLoggedIn) {
    openProfileEditor();
    return;
  }

  openLogin();
}

function requireLogin(action: () => void) {
  if (sessionStore.isLoggedIn) {
    action();
    return;
  }

  openLogin(action);
}

function openLogin(action: (() => void) | null = null) {
  pendingAction = action;
  loginVisible.value = true;
}

function closeLogin() {
  loginVisible.value = false;
  pendingAction = null;
}

function openProfileEditor() {
  profileNameDraft.value = userStore.profile?.nickname || "";
  profileEditErrorText.value = "";
  profileEditorOpen.value = true;
}

function closeProfileEditor() {
  if (profileSaving.value) return;
  profileEditorOpen.value = false;
  profileEditErrorText.value = "";
}

function openPasswordEditor() {
  resetPasswordForm();
  passwordEditorOpen.value = true;
}

function closePasswordEditor() {
  if (passwordSaving.value) return;
  passwordEditorOpen.value = false;
  passwordEditErrorText.value = "";
}

async function saveProfile() {
  if (profileSaving.value) return;

  const nickname = profileNameDraft.value.trim();
  if (!nickname) {
    profileEditErrorText.value = "请输入昵称";
    return;
  }

  if (nickname === (userStore.profile?.nickname || "").trim()) {
    closeProfileEditor();
    return;
  }

  profileSaving.value = true;
  profileEditErrorText.value = "";

  try {
    const profile = await userApi.updateCurrent({ nickname });
    userStore.setProfile(profile);
    profileEditorOpen.value = false;
  } catch (error) {
    profileEditErrorText.value = error instanceof Error ? error.message : "保存失败";
    return;
  } finally {
    profileSaving.value = false;
  }

  await uniPlatform.feedback.toast({ title: "已保存", icon: "success" }).catch(() => undefined);
}

async function savePassword() {
  if (passwordSaving.value) return;

  const currentPassword = currentPasswordDraft.value;
  const newPassword = nextPasswordDraft.value;
  const confirmPassword = confirmPasswordDraft.value;
  const validationError = validatePasswordForm(currentPassword, newPassword, confirmPassword);

  if (validationError) {
    passwordEditErrorText.value = validationError;
    return;
  }

  passwordSaving.value = true;
  passwordEditErrorText.value = "";

  try {
    await userApi.changeCurrentPassword({
      currentPassword,
      newPassword
    });
    passwordEditorOpen.value = false;
    resetPasswordForm();
  } catch (error) {
    passwordEditErrorText.value = getPasswordErrorText(error);
    return;
  } finally {
    passwordSaving.value = false;
  }

  await uniPlatform.feedback.toast({ title: "密码已更新", icon: "success" }).catch(() => undefined);
}

async function handleLoginSuccess() {
  loginVisible.value = false;
  await loadMe();

  const action = pendingAction;
  pendingAction = null;
  action?.();
}

async function handleLogout() {
  closeLogin();
  closeProfileEditor();
  closePasswordEditor();
  await sessionStore.clearSession();
  userStore.clearProfile();
  await diningGroupStore.clearDiningGroupState();
  loadErrorText.value = "";
  await uniPlatform.feedback.toast({
    title: "已退出登录",
    icon: "success"
  });
}

function navigateTo(url: string) {
  void uniPlatform.navigation.navigateTo(url);
}

function showComingSoon(name: string) {
  void uniPlatform.feedback.toast({
    title: `${name}暂未开放`,
    icon: "none"
  });
}

function resetPasswordForm() {
  currentPasswordDraft.value = "";
  nextPasswordDraft.value = "";
  confirmPasswordDraft.value = "";
  passwordEditErrorText.value = "";
}

function validatePasswordForm(currentPassword: string, newPassword: string, confirmPassword: string) {
  if (!currentPassword) return "请输入当前密码";
  if (!newPassword) return "请输入新密码";
  if (newPassword.length < 6) return "新密码至少 6 位";
  if (newPassword === currentPassword) return "新密码不能与当前密码相同";
  if (!confirmPassword) return "请再次输入新密码";
  if (newPassword !== confirmPassword) return "两次输入的新密码不一致";
  return "";
}

function getPasswordErrorText(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.code === 400) return error.message || "请检查密码输入";
    if (error.code === 401) return "登录状态已失效，请重新登录";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "修改密码失败，请稍后重试";
}
</script>

<style scoped lang="scss">
.nav-title {
  color: var(--entry-ink);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.me-page {
  --me-card-shadow: 0 4rpx 14rpx rgba(23, 35, 29, 0.035);

  min-height: 100vh;
  min-height: 100dvh;
  padding-bottom: calc(132rpx + env(safe-area-inset-bottom));
  background: var(--color-page);
}

.me-page.theme-dark {
  --me-card-shadow: 0 4rpx 14rpx rgba(0, 0, 0, 0.1);
}

.profile-hero {
  position: relative;
  min-height: 520rpx;
  overflow: hidden;
  padding: 200rpx var(--space-page) 74rpx;
  background:
    radial-gradient(circle at 16% 18%, var(--entry-side-mint-bg) 0, transparent 32%),
    radial-gradient(circle at 86% 12%, var(--entry-side-aqua-bg) 0, transparent 30%),
    linear-gradient(148deg, var(--entry-primary-bg), var(--entry-board-bg));
}

.profile-hero::before {
  position: absolute;
  top: 88rpx;
  right: -96rpx;
  z-index: 0;
  width: 310rpx;
  height: 220rpx;
  border-radius: 50%;
  background: var(--color-surface-mask-weak);
  content: "";
  pointer-events: none;
  transform: rotate(-18deg);
}

.profile-hero--halo {
  background:
    radial-gradient(circle at 78% 16%, var(--entry-primary-bg) 0, transparent 34%),
    radial-gradient(circle at 8% 42%, var(--entry-side-aqua-bg) 0, transparent 30%),
    linear-gradient(132deg, var(--entry-board-bg), var(--entry-side-mint-bg));
}

.profile-hero--halo::before {
  top: 116rpx;
  right: auto;
  left: -112rpx;
  width: 360rpx;
  height: 240rpx;
  transform: rotate(16deg);
}

.profile-hero--ripple {
  background:
    radial-gradient(ellipse at 50% -8%, var(--entry-board-bg) 0, transparent 42%),
    radial-gradient(circle at 88% 36%, var(--entry-side-mint-bg) 0, transparent 28%),
    linear-gradient(158deg, var(--entry-primary-bg), var(--entry-side-aqua-bg));
}

.profile-hero--ripple::before {
  top: 72rpx;
  right: -60rpx;
  width: 420rpx;
  height: 180rpx;
  transform: rotate(-8deg);
}

.profile-hero::after {
  position: absolute;
  right: -28%;
  bottom: -150rpx;
  left: -28%;
  z-index: 0;
  height: 300rpx;
  border-radius: 50% 50% 0 0;
  background: var(--color-page);
  content: "";
  pointer-events: none;
}

.identity-card {
  position: relative;
  z-index: 1;
  min-height: 302rpx;
  overflow: hidden;
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-shadow: var(--me-card-shadow);
}

.profile-row {
  display: flex;
  align-items: center;
  min-height: 154rpx;
  padding: 24rpx 26rpx 20rpx;
}

.profile-row__avatar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 104rpx;
  height: 104rpx;
  overflow: hidden;
  border: 4rpx solid var(--color-surface);
  border-radius: var(--radius-pill);
  background: var(--entry-primary-bg);
  box-shadow: 0 8rpx 22rpx rgba(23, 35, 29, 0.12);
}

.profile-row__avatar-image {
  width: 100%;
  height: 100%;
}

.profile-row__avatar-text {
  color: var(--entry-ink);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-heavy);
}

.profile-row__main {
  flex: 1;
  min-width: 0;
  margin-left: var(--space-md);
}

.profile-row__name-line {
  display: flex;
  align-items: center;
  min-width: 0;
}

.profile-row__name {
  overflow: hidden;
  max-width: 270rpx;
  color: var(--color-text);
  font-size: 38rpx;
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-row__tier {
  flex: 0 0 auto;
  margin-left: 10rpx;
  padding: 4rpx 12rpx;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
}

.profile-row__uid {
  display: block;
  margin-top: 10rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.profile-row__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-top: 14rpx;
}

.profile-row__chip {
  padding: 4rpx 12rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.profile-row__edit {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  margin-left: var(--space-lg);
  padding: 12rpx 10rpx;
}

.profile-row__edit-text,
.profile-row__edit-arrow {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.profile-row__edit-arrow {
  margin-left: 6rpx;
  font-size: var(--font-size-lg);
  line-height: 1;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  min-height: 142rpx;
  padding: 18rpx 8rpx 20rpx;
  border-top: 1rpx solid var(--color-divider);
}

.quick-grid--skeleton {
  align-items: center;
  justify-items: center;
}

.quick-entry {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.quick-entry__icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 62rpx;
  height: 62rpx;
  border-radius: var(--radius-lg);
  background: var(--color-primary-soft);
}

.quick-entry__icon {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.quick-entry__title {
  overflow: hidden;
  max-width: 136rpx;
  margin-top: 10rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-entry__badge {
  margin-top: 6rpx;
  color: var(--color-text-tertiary);
  font-size: 18rpx;
  line-height: 1;
}

.page-content {
  position: relative;
  z-index: 2;
  margin-top: -68rpx;
  padding: 34rpx var(--space-page) var(--space-lg);
}

.load-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 72rpx;
  margin-bottom: var(--space-md);
  padding: 0 var(--space-md);
  border-radius: var(--radius-lg);
  background: var(--color-primary-soft);
}

.load-notice__text,
.load-notice__action {
  font-size: var(--font-size-sm);
}

.load-notice__text {
  color: var(--color-text-secondary);
}

.load-notice__action {
  color: var(--color-primary);
  font-weight: var(--font-weight-bold);
}

.overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: var(--space-lg);
}

.dining-card,
.entitlement-card,
.service-list,
.knowledge-grid {
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-shadow: var(--me-card-shadow);
}

.dining-card {
  min-width: 0;
  min-height: 246rpx;
  padding: 26rpx 24rpx 22rpx;
}

.overview-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.overview-heading__title {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.overview-heading__arrow {
  color: var(--color-text-tertiary);
  font-size: 38rpx;
  line-height: 1;
}

.dining-card__name {
  display: block;
  overflow: hidden;
  margin-top: 10rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dining-card__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 30rpx;
}

.dining-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}

.dining-stat + .dining-stat {
  border-left: 1rpx solid var(--color-divider);
}

.dining-stat__value {
  overflow: hidden;
  max-width: 100%;
  color: var(--color-text);
  font-size: 34rpx;
  font-weight: var(--font-weight-heavy);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dining-stat__label {
  margin-top: 8rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.entitlement-card {
  min-width: 0;
  min-height: 246rpx;
  overflow: hidden;
  padding: 26rpx 22rpx 20rpx;
  background: linear-gradient(160deg, var(--color-primary-soft), var(--color-surface));
}

.entitlement-card__scope {
  flex: 0 0 auto;
  padding: 4rpx 12rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
}

.entitlement-card__title,
.entitlement-card__description {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entitlement-card__title {
  margin-top: 18rpx;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.entitlement-card__description {
  margin-top: 10rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.entitlement-card__limits {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-sm);
  margin-top: 22rpx;
}

.entitlement-limit {
  min-width: 0;
  padding: 12rpx 10rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface-mask-weak);
}

.entitlement-limit__label,
.entitlement-limit__value {
  display: block;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entitlement-limit__label {
  color: var(--color-text-tertiary);
  font-size: 20rpx;
}

.entitlement-limit__value {
  margin-top: 6rpx;
  color: var(--color-text);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
}

.service-section {
  margin-top: var(--space-lg);
}

.service-section__title {
  display: block;
  margin-left: 4rpx;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.service-list {
  margin-top: var(--space-lg);
  padding: 0 var(--space-md);
  overflow: hidden;
}

.service-row {
  display: flex;
  align-items: center;
  min-height: 112rpx;
}

.service-row + .service-row,
.theme-panel + .service-row {
  border-top: 1rpx solid var(--color-divider);
}

.service-row__icon-wrap {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 58rpx;
  height: 58rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.service-row__icon {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.service-row__copy {
  flex: 1;
  min-width: 0;
  margin-left: var(--space-md);
}

.service-row__title,
.service-row__description {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.service-row__title {
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.service-row__description {
  margin-top: 5rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.service-row__arrow {
  flex: 0 0 auto;
  margin-left: var(--space-lg);
  color: var(--color-text-tertiary);
  font-size: 40rpx;
  line-height: 1;
  transition: transform 0.2s ease;
}

.service-row__arrow--open {
  transform: rotate(90deg);
}

.knowledge-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-lg);
  margin-top: var(--space-lg);
  padding: 24rpx 18rpx;
}

.knowledge-entry {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  padding: 8rpx 4rpx;
}

.knowledge-entry__icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  border-radius: var(--radius-lg);
  background: var(--color-primary-soft);
}

.knowledge-entry__icon {
  color: var(--color-primary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-heavy);
}

.knowledge-entry__title {
  overflow: hidden;
  max-width: 100%;
  margin-top: 14rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.knowledge-entry__description {
  overflow: hidden;
  max-width: 100%;
  margin-top: 6rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theme-panel {
  padding: 0 0 var(--space-md) 82rpx;
  border-top: 1rpx solid var(--color-divider);
}

.theme-group {
  margin-top: var(--space-md);
}

.theme-group__label {
  display: block;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.option-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg);
  margin-top: var(--space-lg);
}

.option-chip {
  display: flex;
  align-items: center;
  min-height: 54rpx;
  padding: 0 20rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
}

.option-chip--active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.option-chip__text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.option-chip--active .option-chip__text {
  color: var(--color-primary);
}

.is-pressed {
  opacity: 0.86;
  transform: scale(0.98);
}

.login-modal {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-page);
  background: rgba(15, 23, 19, 0.56);
}

.login-modal__panel {
  width: 100%;
  overflow: hidden;
  border-radius: var(--radius-sheet);
  background: var(--color-surface);
  box-shadow: 0 28rpx 80rpx rgba(15, 23, 19, 0.28);
}

.login-modal__header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 24rpx 28rpx 0;
}

.login-modal__panel :deep(.login) {
  padding-top: 8rpx;
  border: 0;
  border-radius: 0;
}

.login-modal__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  color: var(--color-text-tertiary);
  font-size: 44rpx;
  line-height: 1;
}

.profile-modal {
  position: fixed;
  inset: 0;
  z-index: 130;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-page);
  background: rgba(15, 23, 19, 0.5);
}

.profile-modal__panel {
  width: 100%;
  overflow: hidden;
  border-radius: var(--radius-sheet);
  background: var(--color-surface);
  box-shadow: 0 28rpx 80rpx rgba(15, 23, 19, 0.24);
}

.profile-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 30rpx 0;
}

.profile-modal__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.profile-modal__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  color: var(--color-text-tertiary);
  font-size: 44rpx;
  line-height: 1;
}

.profile-form {
  padding: var(--space-lg) 30rpx var(--space-md);
}

.profile-form__label {
  display: block;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.profile-form__input {
  min-height: var(--size-input);
  margin-top: var(--space-lg);
  padding: 0 var(--space-md);
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  color: var(--color-text);
  font-size: var(--font-size-md);
}

.profile-form__error {
  display: block;
  margin-top: var(--space-lg);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.password-form {
  padding: var(--space-lg) 30rpx var(--space-md);
}

.password-form__field + .password-form__field {
  margin-top: var(--space-md);
}

.password-form__label {
  display: block;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.password-form__input {
  min-height: var(--size-input);
  margin-top: 14rpx;
  padding: 0 var(--space-md);
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  color: var(--color-text);
  font-size: var(--font-size-md);
}

.password-form__error {
  display: block;
  margin-top: var(--space-lg);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.profile-modal__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-lg);
  padding: 0 30rpx 30rpx;
}

.profile-modal__button {
  min-height: var(--size-button-secondary);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.profile-modal__button--ghost {
  border: 1rpx solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}

.profile-modal__button--primary {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}
</style>
