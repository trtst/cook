<template>
	<page-meta :page-style="pageStyle" />
	<Layout title="我的" current-tab="me" :show-left="false" full-screen :navbar-placeholder="false" navbar-transparent>
		<scroll-view class="me-page" scroll-y>
			<view class="profile-hero" :class="profileHeroVariant" :style="profileHeroStyle">
				<image v-if="profileCoverUrl" class="profile-hero__cover" :src="profileCoverUrl" mode="aspectFill" />
				<view v-if="profileCoverUrl" class="profile-hero__frost" />
				<view class="profile-hero__mask" />
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
								<image v-if="profileAvatarUrl" class="profile-row__avatar-image" :src="profileAvatarUrl"
									mode="aspectFill" />
								<text v-else class="profile-row__avatar-text">{{ profileAvatarText }}</text>
							</view>

							<view class="profile-row__main">
								<view class="profile-row__name-line">
									<text class="profile-row__name">{{ profileName }}</text>
									<TierBadge v-if="sessionStore.isLoggedIn"
										:tier="userStore.profile?.membership?.tier" />
								</view>
								<text class="profile-row__uid">{{ profileUidText }}</text>
							</view>

							<view class="profile-row__edit" hover-class="is-pressed" hover-stay-time="100"
								@click="handleProfileAction">
								<text class="profile-row__edit-arrow cookfont icon-back" aria-hidden="true" />
							</view>
						</view>

						<view class="quick-grid">
							<view v-for="item in coreEntries" :key="item.title" class="quick-entry"
								hover-class="is-pressed" hover-stay-time="100" @click="handleEntryClick(item)">
								<view class="quick-entry__icon-wrap">
									<image class="quick-entry__icon" :src="item.iconSrc" mode="aspectFit" />
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
						<view class="dining-card" hover-class="is-pressed" hover-stay-time="100"
							@click="handleDiningGroupManage">
							<view class="overview-heading">
								<text class="overview-heading__title">饭搭子</text>
								<text class="overview-heading__arrow">›</text>
							</view>
							<text class="dining-card__description">一起决定下一顿吃什么</text>

							<view v-if="hasDiningGroup" class="dining-card__summary">
								<text class="dining-card__count">{{ diningGroupCountText }}</text>
								<text class="dining-card__current">{{ diningGroupCurrentText }}</text>
							</view>
							<template v-else>
								<text class="dining-card__status">未开启</text>
								<text class="dining-card__invite">{{ diningGroupInviteText }}</text>
							</template>
						</view>

						<view class="medal-card" hover-class="is-pressed" hover-stay-time="100"
							@click="handleMedalClick">
							<view class="medal-card__icon">
								<text class="medal-card__icon-text">勋</text>
							</view>
							<text class="medal-card__label">我的勋章</text>
							<view class="medal-card__count-line">
								<text class="medal-card__count">{{ medalCount === null ? "--" : medalCount }}</text>
								<text class="medal-card__unit">枚</text>
							</view>
						</view>
					</view>

					<view class="service-section">
						<text class="service-section__title">个人服务</text>
						<view class="service-list">
							<view v-for="item in personalEntries" :key="item.title" class="service-row"
								hover-class="is-pressed" hover-stay-time="100" @click="handleEntryClick(item)">
								<view class="service-row__icon-wrap">
									<image class="service-row__icon" :src="item.iconSrc" mode="aspectFit" />
								</view>
								<view class="service-row__copy">
									<text class="service-row__title">{{ item.title }}</text>
									<text v-if="item.description" class="service-row__description">{{ item.description
										}}</text>
								</view>
								<text class="service-row__arrow">›</text>
							</view>
						</view>
					</view>

					<view class="service-section">
						<text class="service-section__title">厨房知识</text>
						<view class="knowledge-grid">
							<view v-for="item in knowledgeEntries" :key="item.title" class="knowledge-entry"
								hover-class="is-pressed" hover-stay-time="100" @click="handleEntryClick(item)">
								<view class="knowledge-entry__icon-wrap">
									<image class="knowledge-entry__icon" :src="item.iconSrc" mode="aspectFit" />
								</view>
								<text class="knowledge-entry__title">{{ item.title }}</text>
								<text class="knowledge-entry__description">{{ item.description }}</text>
							</view>
						</view>
					</view>

					<view class="service-section">
						<text class="service-section__title">设置与支持</text>
						<view class="service-list">
							<view class="service-row" hover-class="is-pressed" hover-stay-time="100"
								@click="themePanelOpen = !themePanelOpen">
								<view class="service-row__icon-wrap">
									<image class="service-row__icon" :src="themeIcon" mode="aspectFit" />
								</view>
								<view class="service-row__copy">
									<text class="service-row__title">皮肤主题</text>
									<text class="service-row__description">{{ currentThemeText }}</text>
								</view>
								<text class="service-row__arrow"
									:class="{ 'service-row__arrow--open': themePanelOpen }">›</text>
							</view>

							<view v-if="themePanelOpen" class="theme-panel">
								<view class="theme-group">
									<text class="theme-group__label">显示模式</text>
									<view class="option-row">
										<view v-for="option in themeModeOptions" :key="option.value" class="option-chip"
											:class="{ 'option-chip--active': option.value === themeMode }"
											hover-class="is-pressed" hover-stay-time="100"
											@click="handleThemeModeChange(option.value)">
											<text class="option-chip__text">{{ option.label }}</text>
										</view>
									</view>
								</view>

								<view class="theme-group">
									<text class="theme-group__label">皮肤风格</text>
									<view class="option-row">
										<view v-for="option in skinOptions" :key="option.value" class="option-chip"
											:class="{ 'option-chip--active': option.value === effectiveSkin }"
											hover-class="is-pressed" hover-stay-time="100"
											@click="handleSkinChange(option.value)">
											<text class="option-chip__text">{{ option.label }}</text>
										</view>
									</view>
								</view>

								<view v-if="canSwitchPalette" class="theme-group">
									<text class="theme-group__label">色系</text>
									<view class="option-row">
										<view v-for="palette in supportedPalettes" :key="palette" class="option-chip"
											:class="{ 'option-chip--active': palette === effectivePalette }"
											hover-class="is-pressed" hover-stay-time="100"
											@click="handlePaletteChange(palette)">
											<text class="option-chip__text">{{ paletteLabels[palette] }}</text>
										</view>
									</view>
								</view>
							</view>

							<view v-for="item in visibleSettingEntries" :key="item.title" class="service-row"
								hover-class="is-pressed" hover-stay-time="100" @click="handleEntryClick(item)">
								<view class="service-row__icon-wrap">
									<image class="service-row__icon" :src="item.iconSrc" mode="aspectFit" />
								</view>
								<view class="service-row__copy">
									<text class="service-row__title">{{ item.title }}</text>
									<text v-if="item.description" class="service-row__description">{{ item.description
										}}</text>
								</view>
								<text class="service-row__arrow">›</text>
							</view>
						</view>
					</view>
				</template>
			</view>

			<view v-if="profileEditorOpen" class="profile-modal" @click="closeProfileEditor" @touchmove.stop.prevent>
				<view class="profile-modal__panel" @click.stop>
					<view class="profile-modal__header">
						<text class="profile-modal__title">编辑资料</text>
						<text class="profile-modal__close" @click="closeProfileEditor">×</text>
					</view>

					<view class="profile-form">
						<text class="profile-form__label">昵称</text>
						<input v-model="profileNameDraft" class="profile-form__input" maxlength="20" placeholder="请输入昵称"
							:disabled="profileSaving" />
						<text v-if="profileEditErrorText" class="profile-form__error">{{ profileEditErrorText }}</text>
					</view>

					<view class="profile-modal__actions">
						<button class="profile-modal__button profile-modal__button--ghost" :disabled="profileSaving"
							@click="closeProfileEditor">
							取消
						</button>
						<button class="profile-modal__button profile-modal__button--primary" :loading="profileSaving"
							:disabled="profileSaving" @click="saveProfile">
							保存
						</button>
					</view>
				</view>
			</view>

			<view v-if="passwordEditorOpen" class="profile-modal" @click="closePasswordEditor" @touchmove.stop.prevent>
				<view class="profile-modal__panel" @click.stop>
					<view class="profile-modal__header">
						<text class="profile-modal__title">修改密码</text>
						<text class="profile-modal__close" @click="closePasswordEditor">×</text>
					</view>

					<view class="password-form">
						<view class="password-form__field">
							<text class="password-form__label">当前密码</text>
							<input v-model="currentPasswordDraft" class="password-form__input" password maxlength="128"
								placeholder="请输入当前密码" :disabled="passwordSaving" />
						</view>

						<view class="password-form__field">
							<text class="password-form__label">新密码</text>
							<input v-model="nextPasswordDraft" class="password-form__input" password maxlength="128"
								placeholder="请输入新密码，至少 6 位" :disabled="passwordSaving" />
						</view>

						<view class="password-form__field">
							<text class="password-form__label">确认新密码</text>
							<input v-model="confirmPasswordDraft" class="password-form__input" password maxlength="128"
								placeholder="请再次输入新密码" :disabled="passwordSaving" />
						</view>

						<text v-if="passwordEditErrorText" class="password-form__error">{{ passwordEditErrorText
							}}</text>
					</view>

					<view class="profile-modal__actions">
						<button class="profile-modal__button profile-modal__button--ghost" :disabled="passwordSaving"
							@click="closePasswordEditor">
							取消
						</button>
						<button class="profile-modal__button profile-modal__button--primary" :loading="passwordSaving"
							:disabled="passwordSaving" @click="savePassword">
							保存
						</button>
					</view>
				</view>
			</view>
		</scroll-view>
	</Layout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { ApiClientError } from "@/apis/http";
import aboutIcon from "@/assets/me-actions/about.svg";
import categoriesUnitsIcon from "@/assets/me-actions/categories-units.svg";
import cookingSkillsIcon from "@/assets/me-actions/cooking-skills.svg";
import cookwareIcon from "@/assets/me-actions/cookware.svg";
import diningEventIcon from "@/assets/me-actions/dining-event.svg";
import feedbackIcon from "@/assets/me-actions/feedback.svg";
import kitchenPrepIcon from "@/assets/me-actions/kitchen-prep.svg";
import logoutIcon from "@/assets/me-actions/logout.svg";
import mealPlanIcon from "@/assets/me-actions/meal-plan.svg";
import notificationsIcon from "@/assets/me-actions/notifications.svg";
import pantryIcon from "@/assets/me-actions/pantry.svg";
import passwordIcon from "@/assets/me-actions/password.svg";
import privacyIcon from "@/assets/me-actions/privacy.svg";
import recipeSkillsIcon from "@/assets/me-actions/recipe-skills.svg";
import shoppingListIcon from "@/assets/me-actions/shopping-list.svg";
import tasteIcon from "@/assets/me-actions/taste.svg";
import themeIcon from "@/assets/me-actions/theme.svg";
import { medalApi } from "@/apis/medal";
import { userApi } from "@/apis/user";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import Skeleton from "@/components/Skeleton/Skeleton.vue";
import TierBadge from "@/components/TierBadge/TierBadge.vue";
import { usePageScrollLock } from "@/composables/usePageScrollLock";
import { uniPlatform } from "@/platform/uni";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { useTheme } from "@/composables/useTheme";
import { APP_NAME } from "@/config";
import { useDiningGroupStore } from "@/stores/dining-group";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { THEME_SKIN_OPTIONS, type ThemePalette, type ThemeSkin } from "@/themes";
import { clearLocalClientCache, clearUserSessionState } from "@/utils/session-cleanup";
import { restoreAppSession } from "@/utils/session";

interface PageEntry {
	title: string;
	iconSrc: string;
	url?: string;
	disabledText?: string;
	description?: string;
	action?: "logout" | "change-password" | "clear-cache";
	requiresLogin?: boolean;
}

const pageStyle = usePageScrollStyle();

const sessionStore = useSessionStore();
const userStore = useUserStore();
const diningGroupStore = useDiningGroupStore();
const loginModalStore = useLoginModalStore();
const {
	effectiveSkin,
	effectivePalette,
	themeMode,
	supportedPalettes,
	canSwitchPalette,
	setThemeMode,
	setThemeSkin,
	setThemePalette
} = useTheme();
const { navBarTotalHeight } = useSystemInfo();

const profileLoading = ref(false);
const loadErrorText = ref("");
const themePanelOpen = ref(false);
const profileEditorOpen = ref(false);
const profileSaving = ref(false);
const passwordEditorOpen = ref(false);
const passwordSaving = ref(false);
const medalCount = ref<number | null>(null);
const profileNameDraft = ref("");
const profileEditErrorText = ref("");
const currentPasswordDraft = ref("");
const nextPasswordDraft = ref("");
const confirmPasswordDraft = ref("");
const passwordEditErrorText = ref("");
const skinOptions = THEME_SKIN_OPTIONS;
const profileHeroVariants = ["profile-hero--mist", "profile-hero--halo", "profile-hero--ripple"] as const;
const profileHeroVariant = profileHeroVariants[Math.floor(Math.random() * profileHeroVariants.length)];
const { setLocked: setPageLocked } = usePageScrollLock(Symbol("me-page-modal"));
let restoredOnce = false;
let loadMePromise: Promise<void> | null = null;
let loadMedalsPromise: Promise<void> | null = null;

const currentRelation = computed(() => diningGroupStore.currentRelationSummary);
const relationUsage = computed(() => diningGroupStore.relationUsage);
const profileHeroStyle = computed(() => ({
	"--profile-hero-padding-top": `${navBarTotalHeight.value}px`
}));
watch(
	() => profileEditorOpen.value || passwordEditorOpen.value,
	(visible) => {
		setPageLocked(visible);
	},
	{ immediate: true }
);
const profileName = computed(() => {
	if (!sessionStore.isLoggedIn) return "点击登录";
	return userStore.profile?.nickname || `${APP_NAME}用户`;
});
const profileCoverUrl = computed(() => userStore.profile?.display?.profileBackgroundUrl || "");
const profileAvatarUrl = computed(() => userStore.profile?.avatarUrl || "");
const profileAvatarText = computed(() => {
	if (!sessionStore.isLoggedIn) return "我";
	return profileName.value.trim().slice(0, 1) || "我";
});
const profileUidText = computed(() =>
	sessionStore.isLoggedIn ? `UID: ${userStore.profile?.uid ?? "--"}` : "登录后同步你的数据"
);
const hasDiningGroup = computed(() => Boolean(currentRelation.value && relationUsage.value));
const diningGroupCountText = computed(() => {
	if (!relationUsage.value) return "已加入 0 个";
	return `已加入 ${relationUsage.value.joinedCount} 个`;
});
const diningGroupCurrentText = computed(() => {
	if (!currentRelation.value) return "";
	return `当前：${currentRelation.value.name} · ${getRoleText(currentRelation.value.myRole)}`;
});
const diningGroupInviteText = computed(() => {
	return "开启后可以邀请饭搭子一起定下一顿吃什么。";
});
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
const coreEntries: PageEntry[] = [
	{
		title: "饭局",
		iconSrc: diningEventIcon
	},
	{
		title: "计划",
		iconSrc: mealPlanIcon,
		url: "/pages_meal/plan/index"
	},
	{
		title: "购物清单",
		iconSrc: shoppingListIcon,
		url: "/pages_pantry/list/index"
	},
	{
		title: "食材",
		iconSrc: pantryIcon,
		url: "/pages_pantry/index/index"
	}
];

const personalEntries: PageEntry[] = [
	{
		title: "通知中心",
		iconSrc: notificationsIcon,
		description: "推荐审核、饭局邀请、计划进度和系统消息",
		url: "/pages_me/recommend/index"
	},
	{
		title: "我的口味",
		iconSrc: tasteIcon,
		description: "口味偏好、忌口和过敏信息",
		url: "/pages_me/taste/index"
	},
	{
		title: "食材与单位",
		iconSrc: categoriesUnitsIcon,
		description: "创建菜谱时会用到的食材分类、常用食材和单位",
		url: "/pages_me/ingredient-units/index"
	},
	{
		title: "厨具",
		iconSrc: cookwareIcon,
		description: "平底锅等常用厨具资料",
		disabledText: "厨具"
	}
];

const knowledgeEntries: PageEntry[] = [
	{
		title: "厨房准备",
		iconSrc: kitchenPrepIcon,
		description: "备菜与收纳",
		url: "/pages_web/content/index?slug=kitchen-prep",
		requiresLogin: false
	},
	{
		title: "烹饪技巧",
		iconSrc: cookingSkillsIcon,
		description: "火候与做法",
		url: "/pages_web/content/index?slug=cooking-skills",
		requiresLogin: false
	},
	{
		title: "食谱技巧",
		iconSrc: recipeSkillsIcon,
		description: "配方与替换",
		url: "/pages_web/content/index?slug=recipe-skills",
		requiresLogin: false
	}
];

const accountSettingEntries: PageEntry[] = [
	{
		title: "修改密码",
		iconSrc: passwordIcon,
		description: "更新当前账号登录密码",
		action: "change-password"
	}
];

const supportSettingEntries: PageEntry[] = [
	{
		title: "清除缓存",
		iconSrc: privacyIcon,
		description: "清除本地资料缓存和菜谱编辑缓存",
		action: "clear-cache"
	},
	{
		title: "隐私保护",
		iconSrc: privacyIcon,
		url: "/pages_web/content/index?slug=privacy",
		requiresLogin: false
	},
	{
		title: "帮助与反馈",
		iconSrc: feedbackIcon,
		description: "常见问题与当前内容说明",
		url: "/pages_web/content/index?slug=faq",
		requiresLogin: false
	},
	{
		title: `关于${APP_NAME}`,
		iconSrc: aboutIcon,
		url: "/pages_web/content/index?slug=about",
		requiresLogin: false
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
			iconSrc: logoutIcon,
			description: "清除当前账号会话",
			action: "logout" as const
		}
	];
});

function getRoleText(role?: "OWNER" | "ADMIN" | "MEMBER") {
	if (role === "OWNER") return "主理人";
	if (role === "ADMIN") return "管理员";
	return "成员";
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
		await Promise.allSettled([loadMe(), loadMedals()]);
		return;
	}

	profileLoading.value = false;
	loadErrorText.value = "";
	medalCount.value = null;
}

async function loadMe() {
	if (!sessionStore.isLoggedIn) return;
	if (loadMePromise) {
		await loadMePromise;
		return;
	}
	if (profileLoading.value) return;

	loadMePromise = doLoadMe().finally(() => {
		loadMePromise = null;
	});

	await loadMePromise;
}

async function doLoadMe() {
	const shouldLoadProfile = !userStore.profile;
	const shouldLoadDiningGroup = !diningGroupStore.hasCurrentContext;

	if (!shouldLoadProfile && !shouldLoadDiningGroup) {
		profileLoading.value = false;
		loadErrorText.value = "";
		return;
	}

	profileLoading.value = true;
	loadErrorText.value = "";

	const [profileResult, diningGroupResult] = await Promise.allSettled([
		shouldLoadProfile ? userApi.getCurrent() : Promise.resolve(null),
		shouldLoadDiningGroup ? diningGroupStore.refreshCurrent() : Promise.resolve()
	]);

	if (shouldLoadProfile && profileResult.status === "fulfilled" && profileResult.value) {
		userStore.setProfile(profileResult.value);
	}

	if (
		(shouldLoadProfile && profileResult.status === "rejected") ||
		(shouldLoadDiningGroup && diningGroupResult.status === "rejected")
	) {
		loadErrorText.value = "部分信息加载失败";
	}

	profileLoading.value = false;
}

async function loadMedals() {
	if (!sessionStore.isLoggedIn) return;
	if (loadMedalsPromise) {
		await loadMedalsPromise;
		return;
	}

	loadMedalsPromise = doLoadMedals().finally(() => {
		loadMedalsPromise = null;
	});

	await loadMedalsPromise;
}

async function doLoadMedals() {
	try {
		const result = await medalApi.getCurrent();
		medalCount.value = result.earnedCount;
	} catch {
		medalCount.value = null;
	}
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
	navigateTo("/pages_restaurant/members/index");
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

	if (entry.action === "clear-cache") {
		void handleClearCache();
		return;
	}

	const openEntry = () => {
		if (entry.url) {
			navigateTo(entry.url);
			return;
		}

		showComingSoon(entry.disabledText || entry.title);
	};

	if (entry.requiresLogin === false) {
		openEntry();
		return;
	}

	requireLogin(openEntry);
}

function handleProfileAction() {
	if (sessionStore.isLoggedIn) {
		openProfileEditor();
		return;
	}

	openLogin();
}

function handleMedalClick() {
	requireLogin(() => navigateTo("/pages_me/medal/index"));
}

function requireLogin(action: () => void) {
	if (sessionStore.isLoggedIn) {
		action();
		return;
	}

	openLogin(action);
}

function openLogin(action: (() => void) | null = null) {
	loginModalStore.open(null, action);
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

	const nicknameUnchanged = nickname === (userStore.profile?.nickname || "").trim();

	if (nicknameUnchanged) {
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

async function handleLogout() {
	loginModalStore.close();
	closeProfileEditor();
	closePasswordEditor();
	await clearUserSessionState();
	loadErrorText.value = "";
	medalCount.value = null;
	await uniPlatform.feedback.toast({
		title: "已退出登录",
		icon: "success"
	});
}

async function handleClearCache() {
	const confirmed = await uniPlatform.feedback.confirm({
		title: "清除缓存",
		content: "将清除本地资料缓存和菜谱编辑缓存，不会退出登录，也不会清除主题和设备布局快照。",
		confirmText: "清除",
		cancelText: "取消",
		tone: "danger"
	}).catch(() => false);
	if (!confirmed) return;

	clearLocalClientCache();
	loadErrorText.value = "";
	await uniPlatform.feedback.toast({
		title: "缓存已清除",
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
	--me-card-shadow: var(--shadow-card);
	height: 100%;
	background: var(--color-page);
}

.profile-hero {
	--profile-hero-end: var(--color-page);
	--profile-hero-padding-top: var(--size-navbar-content);

	position: relative;
	min-height: 520rpx;
	overflow: hidden;
	padding: var(--profile-hero-padding-top) var(--space-page) 74rpx;
	background:
		radial-gradient(circle at 16% 18%, var(--entry-side-mint-bg) 0, transparent 32%),
		radial-gradient(circle at 86% 12%, var(--entry-side-aqua-bg) 0, transparent 30%),
		linear-gradient(148deg, var(--entry-primary-bg), var(--entry-board-bg));
}

.profile-hero::before {
	position: absolute;
	top: 88rpx;
	right: -96rpx;
	z-index: 2;
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

.profile-hero__cover {
	position: absolute;
	inset: 0;
	z-index: 0;
	width: 100%;
	height: 100%;
}

.profile-hero__frost {
	position: absolute;
	inset: 0;
	z-index: 1;
	background:
		linear-gradient(180deg, var(--color-surface-mask-weak), var(--color-surface-mask-medium)),
		radial-gradient(circle at 50% 12%, transparent 0%, var(--color-surface-mask-weak) 72%);
	backdrop-filter: blur(10rpx);
	pointer-events: none;
	-webkit-backdrop-filter: blur(10rpx);
}

.profile-hero__mask {
	--profile-mask-solid: #000;
	--profile-mask-strong: rgba(0, 0, 0, 0.76);
	--profile-mask-mid: rgba(0, 0, 0, 0.42);

	position: absolute;
	right: 0;
	bottom: 0;
	left: 0;
	z-index: 2;
	height: 260rpx;
	background: var(--profile-hero-end);
	mask-image:
		radial-gradient(ellipse at 15% 100%,
			var(--profile-mask-solid) 0%,
			var(--profile-mask-strong) 36%,
			transparent 72%),
		radial-gradient(ellipse at 85% 100%,
			var(--profile-mask-solid) 0%,
			var(--profile-mask-strong) 36%,
			transparent 72%),
		linear-gradient(to bottom,
			transparent 0%,
			var(--profile-mask-mid) 50%,
			var(--profile-mask-solid) 100%);
	mask-size: 100% 100%;
	pointer-events: none;
	-webkit-mask-image:
		radial-gradient(ellipse at 15% 100%,
			var(--profile-mask-solid) 0%,
			var(--profile-mask-strong) 36%,
			transparent 72%),
		radial-gradient(ellipse at 85% 100%,
			var(--profile-mask-solid) 0%,
			var(--profile-mask-strong) 36%,
			transparent 72%),
		linear-gradient(to bottom,
			transparent 0%,
			var(--profile-mask-mid) 50%,
			var(--profile-mask-solid) 100%);
	-webkit-mask-size: 100% 100%;
}

.identity-card {
	position: relative;
	z-index: 3;
	min-height: 302rpx;
	overflow: hidden;
}

.profile-row {
	display: flex;
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
	box-shadow: var(--entry-board-shadow);
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

.profile-row__uid {
	display: block;
	margin-top: 10rpx;
	color: var(--color-text-tertiary);
	font-size: var(--font-size-sm);
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
	font-size: 30rpx;
	line-height: 1;
	transform: rotate(180deg);
}

.quick-grid {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	min-height: 142rpx;
	padding: 16rpx 0;
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
}

.quick-entry__icon {
	display: block;
	width: 64rpx;
	height: 64rpx;
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
	padding: 0 var(--space-page) calc(var(--space-lg) + var(--tabbar-shell-height) + env(safe-area-inset-bottom));
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
.medal-card,
.service-list,
.knowledge-grid {
	border-radius: var(--radius-xs);
	background: var(--color-surface);
	box-shadow: var(--me-card-shadow);
}

.dining-card {
	min-width: 0;
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

.dining-card__description,
.dining-card__invite,
.dining-card__status {
	display: block;
	font-size: var(--font-size-xs);
	line-height: 1.5;
}

.dining-card__description {
	color: var(--color-text-tertiary);
	margin-top: 8rpx;
}

.dining-card__status {
	margin-top: 26rpx;
	color: var(--color-primary);
	font-weight: var(--font-weight-bold);
}

.dining-card__invite {
	margin-top: 8rpx;
	color: var(--color-text-tertiary);
}

.dining-card__summary {
	display: flex;
	flex-direction: column;
	gap: 10rpx;
	margin-top: 24rpx;
}

.dining-card__count {
	overflow: hidden;
	max-width: 100%;
	color: var(--color-text);
	font-size: 34rpx;
	font-weight: var(--font-weight-heavy);
	text-overflow: ellipsis;
	white-space: nowrap;
}

.dining-card__current {
	overflow: hidden;
	max-width: 100%;
	color: var(--color-text-secondary);
	font-size: var(--font-size-sm);
	text-overflow: ellipsis;
	white-space: nowrap;
}

.medal-card {
	position: relative;
	min-width: 0;
	overflow: hidden;
	padding: 22rpx 20rpx;
	background: linear-gradient(160deg, var(--color-primary-soft), var(--color-surface));
}

.medal-card__icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 54rpx;
	height: 54rpx;
	border: 4rpx solid var(--medal-icon-border);
	border-radius: var(--radius-pill);
	background: var(--medal-icon-bg);
	box-shadow: var(--medal-icon-shadow);
}

.medal-card__icon-text {
	color: var(--medal-icon-text);
	font-size: var(--font-size-xs);
	font-weight: var(--font-weight-heavy);
}

.medal-card__label {
	display: block;
	margin-top: 14rpx;
	color: var(--color-text-secondary);
	font-size: var(--font-size-sm);
	font-weight: var(--font-weight-bold);
}

.medal-card__count-line {
	display: flex;
	align-items: baseline;
	margin-top: 4rpx;
}

.medal-card__count {
	color: var(--color-primary);
	font-size: 42rpx;
	font-weight: var(--font-weight-heavy);
	line-height: var(--line-height-tight);
}

.medal-card__unit {
	margin-left: 4rpx;
	color: var(--color-text-tertiary);
	font-size: var(--font-size-xs);
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

.service-row+.service-row,
.theme-panel+.service-row {
	border-top: 1rpx solid var(--color-divider);
}

.service-row__icon-wrap {
	display: flex;
	flex: 0 0 auto;
	align-items: center;
	justify-content: center;
	width: 58rpx;
	height: 58rpx;
}

.service-row__icon {
	display: block;
	width: 58rpx;
	height: 58rpx;
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
}

.knowledge-entry__icon {
	display: block;
	width: 72rpx;
	height: 72rpx;
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

.profile-modal {
	position: fixed;
	inset: 0;
	z-index: 130;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: var(--space-page);
	background: var(--login-popup-backdrop-bg);
	-webkit-backdrop-filter: blur(24rpx) saturate(145%);
	backdrop-filter: blur(24rpx) saturate(145%);
}

.profile-modal__panel {
	width: 100%;
	overflow: hidden;
	border-radius: var(--radius-sheet);
	background: var(--color-surface);
	box-shadow: var(--login-popup-sheet-shadow);
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
	color: var(--color-danger-text);
	font-size: var(--font-size-sm);
}

.password-form {
	padding: var(--space-lg) 30rpx var(--space-md);
}

.password-form__field+.password-form__field {
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
	color: var(--color-danger-text);
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
