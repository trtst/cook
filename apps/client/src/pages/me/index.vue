<template>
	<page-meta :page-style="themePageStyle" />
	<Layout :class="themeClasses" title="" current-tab="me" :show-left="false" full-screen :navbar-placeholder="false" navbar-transparent>
		<scroll-view class="me-page" scroll-y>
			<view class="profile-hero" :class="profileHeroVariant" :style="profileHeroStyle">
				<image v-if="profileCoverUrl" class="profile-hero__cover" :src="profileCoverUrl" mode="aspectFill" />
				<view v-if="profileCoverUrl" class="profile-hero__frost" />
				<view class="profile-hero__mask" />
				<view class="identity-card">
					<template v-if="profileLoading">
						<view class="profile-row" hover-class="is-pressed" hover-stay-time="100" @click="handleProfileAction">
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
						<view class="profile-row" hover-class="is-pressed" hover-stay-time="100" @click="handleProfileAction">
							<view class="profile-row__avatar">
								<image v-if="profileAvatarUrl" class="profile-row__avatar-image" :src="profileAvatarUrl"
									mode="aspectFill" />
								<text v-else class="profile-row__avatar-text">{{ profileAvatarText }}</text>
							</view>

							<view class="profile-row__main">
								<view class="profile-row__name-line">
									<text class="profile-row__name">{{ profileName }}</text>
									<view
										v-if="showMemberEntrances && sessionStore.isLoggedIn"
										class="profile-row__badge-hit"
										@click.stop="handleBenefitCenter"
									>
										<TierBadge :tier="userStore.profile?.membership?.tier" />
									</view>
								</view>
								<text class="profile-row__uid">{{ profileUidText }}</text>
							</view>

							<view class="profile-row__edit" @click.stop="handleProfileAction">
								<text class="profile-row__edit-arrow cookfont icon-back" aria-hidden="true" />
							</view>
						</view>

						<view class="quick-grid">
							<view v-for="item in coreEntries" :key="item.title" class="quick-entry"
								hover-class="is-pressed" hover-stay-time="100" @click="handleEntryClick(item)">
								<view class="quick-entry__icon-wrap">
									<text class="quick-entry__icon-font cookfont" :class="item.iconClass" aria-hidden="true" />
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
					<view v-if="showMemberEntrances" class="overview-grid">
						<Skeleton width="100%" height="246rpx" radius="var(--radius-xs)" />
						<Skeleton width="100%" height="246rpx" radius="var(--radius-xs)" />
					</view>
					<Skeleton width="100%" height="380rpx" radius="var(--radius-xs)" />
				</template>

				<template v-else>
					<view v-if="showMemberEntrances" class="overview-grid">
						<view
							class="membership-card"
							hover-class="is-pressed"
							hover-stay-time="100"
							@click="handleBenefitCenter"
						>
							<view class="overview-heading">
								<text class="overview-heading__title">我的会员</text>
								<text class="overview-heading__arrow cookfont icon-back" />
							</view>
							<text class="membership-card__description">{{ membershipCardDescription }}</text>

							<view v-if="sessionStore.isLoggedIn" class="membership-card__summary">
								<text class="membership-card__count">{{ membershipCardTitle }}</text>
								<text class="membership-card__current">{{ membershipCardMeta }}</text>
							</view>
							<template v-else>
								<text class="membership-card__status">去看看</text>
								<text class="membership-card__invite">体验码、会员时长和权益变化都会同步到当前账号。</text>
							</template>
						</view>

					</view>

					<view v-if="showMemberEntrances" class="service-section">
						<text class="service-section__title">会员</text>
						<view class="service-list">
							<view class="service-row" hover-class="is-pressed" hover-stay-time="100" @click="handleBenefitCenter">
								<view class="service-row__icon-wrap service-row__icon-wrap--benefit">
									<text class="service-row__icon-font cookfont icon-wave" aria-hidden="true" />
								</view>
								<view class="service-row__copy">
									<text class="service-row__title">权益中心</text>
								</view>
								<text class="service-row__arrow cookfont icon-back" />
							</view>
							<view class="service-row" hover-class="is-pressed" hover-stay-time="100" @click="handleMembershipCode">
								<view class="service-row__icon-wrap service-row__icon-wrap--membership">
									<text class="service-row__icon-font cookfont icon-qa" aria-hidden="true" />
								</view>
								<view class="service-row__copy">
									<text class="service-row__title">会员兑换码</text>
								</view>
								<text class="service-row__arrow cookfont icon-back" />
							</view>
						</view>
					</view>

					<view class="service-section">
						<text class="service-section__title">我的</text>
						<view class="service-list">
							<view class="service-row" hover-class="is-pressed" hover-stay-time="100" @click="handleEntryClick(notificationEntry)">
								<view class="service-row__icon-wrap">
									<text class="service-row__icon-font cookfont" :class="notificationEntry.iconClass" aria-hidden="true" />
								</view>
								<view class="service-row__copy">
									<text class="service-row__title">{{ notificationEntry.title }}</text>
								</view>
								<text v-if="notificationBadge.unreadCount > 0" class="service-row__badge-count">{{ notificationBadgeText }}</text>
								<view v-else-if="notificationBadge.showReminderDot" class="service-row__badge-dot" />
								<text class="service-row__arrow cookfont icon-back" />
							</view>
							<view class="service-row" hover-class="is-pressed" hover-stay-time="100" @click="handleMedalClick">
								<view class="service-row__icon-wrap">
									<text class="service-row__icon-font cookfont icon-my-medal" aria-hidden="true" />
								</view>
								<view class="service-row__copy">
									<text class="service-row__title">我的勋章</text>
								</view>
								<text class="service-row__arrow cookfont icon-back" />
							</view>
							<view v-for="item in personalEntries" :key="item.title" class="service-row"
								hover-class="is-pressed" hover-stay-time="100" @click="handleEntryClick(item)">
								<view class="service-row__icon-wrap">
									<text class="service-row__icon-font cookfont" :class="item.iconClass" aria-hidden="true" />
								</view>
								<view class="service-row__copy">
									<text class="service-row__title">{{ item.title }}</text>
								</view>
								<text class="service-row__arrow cookfont icon-back" />
							</view>
						</view>
					</view>

					<view class="service-section">
						<text class="service-section__title">厨房知识</text>
						<view class="knowledge-grid">
							<view v-for="item in knowledgeEntries" :key="item.title" class="knowledge-entry"
								hover-class="is-pressed" hover-stay-time="100" @click="handleEntryClick(item)">
									<view class="knowledge-entry__icon-wrap">
										<text class="knowledge-entry__icon-font cookfont" :class="item.iconClass" aria-hidden="true" />
									</view>
									<text class="knowledge-entry__title">{{ item.title }}</text>
								</view>
						</view>
					</view>

					<view class="service-section">
						<text class="service-section__title">设置</text>
						<view class="service-list">
							<template v-for="item in settingEntries" :key="item.title">
								<button v-if="item.openType === 'contact'" class="service-row service-row-button" open-type="contact"
									hover-class="is-pressed" hover-stay-time="100" session-from="source=me-settings">
										<view class="service-row__icon-wrap">
											<text class="service-row__icon-font cookfont" :class="item.iconClass" aria-hidden="true" />
										</view>
											<view class="service-row__copy">
												<text class="service-row__title">{{ item.title }}</text>
											</view>
									<text class="service-row__arrow cookfont icon-back" />
								</button>

								<view v-else class="service-row" hover-class="is-pressed" hover-stay-time="100"
									@click="handleEntryClick(item)">
										<view class="service-row__icon-wrap">
											<text class="service-row__icon-font cookfont" :class="item.iconClass" aria-hidden="true" />
										</view>
											<view class="service-row__copy">
												<text class="service-row__title">{{ item.title }}</text>
											</view>
									<text class="service-row__arrow cookfont icon-back" />
								</view>
							</template>
						</view>
						<view class="service-version">
							<text class="service-version__text"> version {{ APP_VERSION }} </text>
						</view>
					</view>
				</template>
			</view>

		</scroll-view>
	</Layout>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { medalApi } from "@/apis/medal";
import { userApi } from "@/apis/user";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import Skeleton from "@/components/Skeleton/Skeleton.vue";
import TierBadge from "@/components/TierBadge/TierBadge.vue";
import { usePageScrollLock } from "@/composables/usePageScrollLock";
import { KNOWLEDGE_CHANNELS, buildKnowledgeListPath, type KnowledgeChannelCode } from "@/config/knowledge-articles";
import { uniPlatform } from "@/platform/uni";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { useTheme } from "@/composables/useTheme";
import { APP_NAME, APP_VERSION } from "@/config/app";
import { useLoginModalStore } from "@/stores/login-modal";
import {
	EMPTY_BADGE_SNAPSHOT,
	clearNotificationBadgeSnapshot,
	readNotificationBadgeSnapshot,
	refreshNotificationBadgeSnapshot,
	writeNotificationBadgeSnapshot
} from "@/services/notification-badge";
import { useSessionStore } from "@/stores/session";
import { useSettingsStore, type ThemeMode, type ThemePalette, type ThemeSkin } from "@/stores/settings";
import { useUserStore } from "@/stores/user";
import { formatThemeText } from "@/themes";
import { restoreAppSession } from "@/utils/session";

interface PageEntry {
	title: string;
	iconClass: string;
	url?: string;
	openType?: "contact";
	disabledText?: string;
	description?: string;
	requiresLogin?: boolean;
	loginOnlyWhenGuest?: boolean;
}

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));

const sessionStore = useSessionStore();
const userStore = useUserStore();
const loginModalStore = useLoginModalStore();
const settingsStore = useSettingsStore();
const { effectiveSkin, effectivePalette, themeMode, canSwitchPalette } = useTheme();
const { navBarTotalHeight } = useSystemInfo();

const profileLoading = ref(false);
const medalCount = ref<number | null>(null);
const notificationBadge = ref(readNotificationBadgeSnapshot());
const profileHeroVariants = ["profile-hero--mist", "profile-hero--halo", "profile-hero--ripple"] as const;
const profileHeroVariant = profileHeroVariants[Math.floor(Math.random() * profileHeroVariants.length)];
let restoredOnce = false;
let loadMePromise: Promise<void> | null = null;
let loadMedalsPromise: Promise<void> | null = null;
const showMemberEntrances = false;

const profileHeroStyle = computed(() => ({
	"--profile-hero-padding-top": `${navBarTotalHeight.value}px`
}));
const profileName = computed(() => {
	if (!sessionStore.isLoggedIn) return "点击登录";
	return sessionStore.user?.nickname || `${APP_NAME}用户`;
});
const profileCoverUrl = computed(() => userStore.profile?.display?.profileBackgroundUrl || "");
const profileAvatarUrl = computed(() => sessionStore.user?.avatarUrl || userStore.profile?.avatarUrl || "");
const profileAvatarText = computed(() => {
	if (!sessionStore.isLoggedIn) return "我";
	return profileName.value.trim().slice(0, 1) || "我";
});
const profileUidText = computed(() =>
	sessionStore.isLoggedIn ? `UID: ${sessionStore.uid || "--"}` : "登录后同步你的数据"
);
const membershipCardDescription = computed(() => (
	sessionStore.isLoggedIn ? "你的容量、展示和减广告权益都收在这里" : "登录后查看会员状态"
));
const membershipCardTitle = computed(() => `你当前是 ${formatMembershipTier(userStore.profile?.membership?.tier)}`);
const membershipCardMeta = computed(() => formatMembershipValidUntil(userStore.profile?.membership?.validUntil ?? null));
const notificationBadgeText = computed(() => (notificationBadge.value.unreadCount > 99 ? "99+" : String(notificationBadge.value.unreadCount)));
const currentThemeText = computed(() => {
	return formatThemeText(themeMode.value, effectiveSkin.value, effectivePalette.value, canSwitchPalette.value);
});
const coreEntries: PageEntry[] = [
	{
		title: "饭局",
		iconClass: "icon-meal-event",
		url: "/pages_meal/event/index"
	},
	{
		title: "计划",
		iconClass: "icon-meal-plan",
		url: "/pages_meal/plan/index"
	},
	{
		title: "购物清单",
		iconClass: "icon-shopping",
		url: "/pages_pantry/list/index"
	},
	{
		title: "食材",
		iconClass: "icon-pantry",
		url: "/pages_pantry/index/index"
	}
];

const notificationEntry: PageEntry = {
	title: "通知中心",
	iconClass: "icon-notification-center",
		description: "审核、协作、提醒和官方消息都在这里",
	url: "/pages_me/recommend/index",
	requiresLogin: true
};

const personalEntries: PageEntry[] = [
	{
		title: "最近看过",
		iconClass: "icon-history",
		description: "找回最近看过的菜谱",
		url: "/pages_me/recipe-history/index",
		requiresLogin: true
	},
	{
		title: "我的口味",
		iconClass: "icon-my-taste",
		description: "把爱吃、不吃和过敏信息整理清楚",
		url: "/pages_me/taste/index",
		requiresLogin: true
	},
	{
		title: "食材与单位",
		iconClass: "icon-ingredient-units",
		description: "常用食材、分类和单位集中管理",
		url: "/pages_me/ingredient-units/index",
		requiresLogin: false
	}
];

const knowledgeEntryIcons: Record<KnowledgeChannelCode, string> = {
	KITCHEN: "icon-kitchen-prep",
	COOK: "icon-cooking-skills",
	FOOD: "icon-city"
};

type KnowledgeEntryMeta = {
	code: KnowledgeChannelCode;
	title: string;
	description: string;
};

const knowledgeChannelCodes: KnowledgeChannelCode[] = ["KITCHEN", "COOK", "FOOD"];
const knowledgeChannelMeta: Record<KnowledgeChannelCode, KnowledgeEntryMeta> = {
	KITCHEN: KNOWLEDGE_CHANNELS.KITCHEN,
	COOK: KNOWLEDGE_CHANNELS.COOK,
	FOOD: KNOWLEDGE_CHANNELS.FOOD
};
const knowledgeEntries = computed<PageEntry[]>(() => knowledgeChannelCodes.map(code => {
	const channel = knowledgeChannelMeta[code];
	return {
		title: channel.title,
		iconClass: knowledgeEntryIcons[code],
		description: channel.description,
		url: buildKnowledgeListPath(code)
	};
}));

const settingEntries = computed<PageEntry[]>(() => [
	{
		title: "提醒设置",
		iconClass: "icon-reminder-settings",
		description: "看看现在有哪些提醒入口",
		url: "/pages_me/reminder/index",
		requiresLogin: true,
		loginOnlyWhenGuest: true
	},
	{
		title: "主题皮肤",
		iconClass: "icon-theme-skin",
		description: `当前${currentThemeText.value}，换一个你更喜欢的页面风格`,
		url: "/pages_me/theme/index",
		requiresLogin: false
	},
	{
		title: "在线客服",
		iconClass: "icon-service",
		description: "有问题时直接联系客服",
		openType: "contact",
		requiresLogin: false
	},
	{
		title: "账号设置",
		iconClass: "icon-account-settings",
		description: sessionStore.isLoggedIn ? "处理当前账号、缓存和登录状态" : "登录后处理账号和登录状态",
		url: "/pages_me/account/index",
		requiresLogin: true
	},
	{
		title: "隐私政策",
		iconClass: "icon-policy-privacy",
		description: "了解你的信息会如何被使用",
		url: `/pages_web/content/index?url=${encodeURIComponent("https://www.trtst.com/privacy")}`,
		requiresLogin: false
	},
	{
		title: "用户协议",
		iconClass: "icon-policy-user",
		description: "查看产品使用说明和规则",
		url: `/pages_web/content/index?url=${encodeURIComponent("https://www.trtst.com/terms")}`,
		requiresLogin: false
	},
	{
		title: `关于${APP_NAME}`,
		iconClass: "icon-about-app",
		description: "看看产品介绍和当前版本",
		url: `/pages_web/content/index?url=${encodeURIComponent("https://www.trtst.com/about")}`,
		requiresLogin: false
	}
]);

function formatMembershipTier(tier: string | null | undefined) {
	if (tier === "ULTRA") return "Ultra";
	if (tier === "PRO") return "Pro";
	if (tier === "PLUS") return "Plus";
	return "Free";
}

function formatMembershipValidUntil(validUntil: string | null) {
	if (!validUntil) return "当前未开通会员";
	const value = new Date(validUntil);
	if (Number.isNaN(value.getTime())) return "有效期按到账结果为准";
	const yyyy = value.getFullYear();
	const mm = `${value.getMonth() + 1}`.padStart(2, "0");
	const dd = `${value.getDate()}`.padStart(2, "0");
	return `到期时间 ${yyyy}-${mm}-${dd}`;
}

function isDisabledEntry(entry: PageEntry) {
	return Boolean(entry.disabledText && !entry.url && !entry.openType);
}

onShow(() => {
	void syncPageState();
});

async function syncPageState() {
	if (!restoredOnce) {
		await restoreAppSession();
		restoredOnce = true;

		if (sessionStore.isLoggedIn && userStore.profile) {
			profileLoading.value = false;
			return;
		}
	}

	if (sessionStore.isLoggedIn) {
		await Promise.allSettled([loadMe(), loadMedals(), syncNotificationBadge()]);
		return;
	}

	profileLoading.value = false;
	medalCount.value = null;
	clearNotificationBadgeSnapshot();
	notificationBadge.value = EMPTY_BADGE_SNAPSHOT;
}

async function syncNotificationBadge() {
	if (!sessionStore.isLoggedIn) {
		clearNotificationBadgeSnapshot();
		notificationBadge.value = EMPTY_BADGE_SNAPSHOT;
		return;
	}
	notificationBadge.value = readNotificationBadgeSnapshot();
	const snapshot = await refreshNotificationBadgeSnapshot().catch(() => null);
	if (!snapshot) return;
	notificationBadge.value = snapshot;
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

	if (!shouldLoadProfile) {
		profileLoading.value = false;
		return;
	}

	profileLoading.value = true;

	const [profileResult] = await Promise.allSettled([
		shouldLoadProfile ? userApi.getCurrent() : Promise.resolve(null)
	]);

	if (shouldLoadProfile && profileResult.status === "fulfilled" && profileResult.value) {
		userStore.setProfile(profileResult.value, sessionStore.uid);
	}

	if (shouldLoadProfile && profileResult.status === "rejected") {
		await uniPlatform.feedback.toast({
			title: "部分信息加载失败，请稍后重试",
			icon: "none"
		}).catch(() => undefined);
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

function handleMealHubOpen() {
	requireLogin(() => navigateTo("/pages_meal/event/index"));
}

function handleBenefitCenter() {
	requireLogin(() => navigateTo("/pages_me/benefit/index"));
}

function handleMembershipCode() {
	requireLogin(() => navigateTo("/pages_me/membership-code/index"));
}

function handleEntryClick(entry: PageEntry) {
	const openEntry = () => {
		if (entry.url) {
			navigateTo(entry.url);
			return;
		}

		showComingSoon(entry.disabledText || entry.title);
	};

	if (entry.requiresLogin !== true) {
		openEntry();
		return;
	}

	if (entry.loginOnlyWhenGuest) {
		openLogin();
		return;
	}

	requireLogin(openEntry);
}

function handleProfileAction() {
	if (sessionStore.isLoggedIn) {
		navigateTo("/pages_me/profile/index");
		return;
	}

	openLogin();
}

function handleMedalClick() {
	if (sessionStore.isLoggedIn) {
		navigateTo("/pages_me/medal/index");
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
	loginModalStore.open(null, action);
}

async function automatorOpenMedalLogin() {
	handleMedalClick();
	await nextTick();
	return {
		path: sessionStore.isLoggedIn ? "/pages_me/medal/index" : null
	};
}

async function automatorOpenNotificationLogin() {
	handleEntryClick(notificationEntry);
	await nextTick();
	return {
		path: sessionStore.isLoggedIn ? notificationEntry.url || null : null
	};
}

async function automatorClearSession() {
	await sessionStore.clearSession();
	userStore.clearProfile();
	medalCount.value = null;
	await nextTick();
}

async function automatorSwitchLoginModalPhoneMode() {
	loginModalStore.openPhoneMode();
	await nextTick();
}

function automatorReadLoginModalState() {
	return {
		visible: loginModalStore.visible,
		mode: loginModalStore.mode,
		openedInMiniProgram: loginModalStore.openedInMiniProgram,
		appName: APP_NAME,
		slogan: "炊烟晚，人归缓，烟火暖流年",
		wechatButtonText: null,
		switchText: "密码登录",
		phoneTitle: "手机号登录",
		phoneDescription: "验证码会发送到你的手机号",
		phoneSubmitText: "登录",
		codeButtonText: "发送验证码",
		backText: null
	};
}

function automatorResolveEntryAuth(title: string) {
	const entries = [
		...coreEntries,
		notificationEntry,
		...personalEntries,
		...knowledgeEntries.value,
		...settingEntries.value,
		{
			title: "我的勋章",
			requiresLogin: true
		}
	];
	const entry = entries.find(item => item.title === title);
	return {
		found: Boolean(entry),
		requiresLogin: entry?.requiresLogin === true
	};
}

function automatorReadThemeState() {
	return {
		themeMode: themeMode.value,
		effectiveSkin: effectiveSkin.value,
		effectivePalette: effectivePalette.value,
		canSwitchPalette: canSwitchPalette.value,
		currentThemeText: currentThemeText.value,
		themePageStyle: themePageStyle.value,
		colorPage: themeVars.value["--color-page"] ?? ""
	};
}

async function automatorResetThemeSettings() {
	await settingsStore.clearSettings();
	return automatorReadThemeState();
}

async function automatorApplyThemeSettings(snapshot: {
	themeMode?: ThemeMode;
	themeSkin?: ThemeSkin;
	themePalette?: ThemePalette;
}) {
	if (snapshot.themeMode) {
		await settingsStore.setThemeMode(snapshot.themeMode);
	}
	if (snapshot.themeSkin) {
		await settingsStore.setThemeSkin(snapshot.themeSkin);
	}
	if (snapshot.themePalette) {
		await settingsStore.setThemePalette(snapshot.themePalette);
	}
	return automatorReadThemeState();
}

function automatorApplyNotificationBadgeSnapshot(snapshot: {
	unreadCount: number;
	reminderUnreadCount: number;
	showReminderDot: boolean;
	latestTime?: string;
}) {
	writeNotificationBadgeSnapshot({
		unreadCount: snapshot.unreadCount,
		reminderUnreadCount: snapshot.reminderUnreadCount,
		showReminderDot: snapshot.showReminderDot,
		latestTime: snapshot.latestTime ?? ""
	});
	notificationBadge.value = readNotificationBadgeSnapshot();
	return {
		unreadCount: notificationBadge.value.unreadCount,
		showReminderDot: notificationBadge.value.showReminderDot
	};
}

defineExpose({
	automatorOpenMedalLogin,
	automatorOpenNotificationLogin,
	automatorClearSession,
	automatorSwitchLoginModalPhoneMode,
	automatorReadLoginModalState,
	automatorResolveEntryAuth,
	automatorReadThemeState,
	automatorResetThemeSettings,
	automatorApplyThemeSettings,
	automatorApplyNotificationBadgeSnapshot
});

function navigateTo(url: string) {
	void uniPlatform.navigation.navigateTo(url);
}

function showComingSoon(name: string) {
	void uniPlatform.feedback.toast({
		title: `${name}暂未开放`,
		icon: "none"
	});
}
</script>

<style scoped lang="scss">
.nav-title {
	color: var(--color-text);
	font-size: var(--font-size-lg);
	font-weight: var(--font-weight-bold);
}

.me-page {
	height: 100%;
	background: var(--color-page);
}

.me-page::before {
	content: "";
	width: 100%;
	min-height: 520rpx;
	background: var(--page-hero-bg);
}

.profile-hero {
	--profile-hero-padding-top: var(--size-navbar-content);

	position: relative;
	min-height: 520rpx;
	overflow: hidden;
	padding: var(--profile-hero-padding-top) var(--space-page) 74rpx;

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
	background: var(--page-hero-halo-bg);
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
	background: var(--page-hero-mask-bg);
	backdrop-filter: var(--material-mask-filter);
	pointer-events: none;
	-webkit-backdrop-filter: var(--material-mask-filter);
}

.profile-hero__mask {
	position: absolute;
	right: 0;
	bottom: 0;
	left: 0;
	z-index: 2;
	height: 260rpx;
	background: var(--color-page);
	mask-image: var(--page-bottom-mask-image);
	mask-size: 100% 100%;
	pointer-events: none;
	-webkit-mask-image: var(--page-bottom-mask-image);
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
	background: var(--color-tag-primary-bg);
	box-shadow: var(--shadow-card);
}

.profile-row__avatar-image {
	width: 100%;
	height: 100%;
}

.profile-row__avatar-text {
	color: var(--color-tag-primary-text);
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

.profile-row__badge-hit {
	display: inline-flex;
	flex: 0 0 auto;
	align-items: center;
}

.profile-row__name {
	overflow: hidden;
	max-width: 300rpx;
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

.quick-entry__icon-font {
	color: var(--color-text);
	font-size: 52rpx;
	line-height: 1;
}

.quick-entry__title {
	overflow: hidden;
	max-width: 136rpx;
	margin-top: 10rpx;
	color: var(--color-text);
	font-size: var(--font-size-sm);
	font-weight: var(--font-weight-medium);
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
	padding: 0 var(--space-page) calc(var(--tabbar-shell-height) + env(safe-area-inset-bottom));
}

.overview-grid {
	display: grid;
	grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
	gap: var(--space-lg);
}

.membership-card,
.service-list,
.knowledge-grid {
	border-radius: var(--radius-xs);
	background: var(--material-card-bg);
	box-shadow: var(--material-card-shadow);
	-webkit-backdrop-filter: var(--material-card-filter);
	backdrop-filter: var(--material-card-filter);
}

.membership-card {
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
	font-size: 24rpx;
	line-height: 1;
	transform: rotate(180deg);
}

.membership-card__description,
.membership-card__invite,
.membership-card__status {
	display: block;
	font-size: var(--font-size-xs);
	line-height: 1.5;
}

.membership-card__description {
	color: var(--color-text-tertiary);
	margin-top: 8rpx;
}

.membership-card__status {
	margin-top: 26rpx;
	color: var(--color-support-action);
	font-weight: var(--font-weight-bold);
}

.membership-card__invite {
	margin-top: 8rpx;
	color: var(--color-text-tertiary);
}

.membership-card__summary {
	display: flex;
	flex-direction: column;
	gap: 10rpx;
	margin-top: 24rpx;
}

.membership-card__count {
	overflow: hidden;
	max-width: 100%;
	color: var(--color-text);
	font-size: 34rpx;
	font-weight: var(--font-weight-heavy);
	text-overflow: ellipsis;
	white-space: nowrap;
}

.membership-card__current {
	overflow: hidden;
	max-width: 100%;
	color: var(--color-text-secondary);
	font-size: var(--font-size-sm);
	text-overflow: ellipsis;
	white-space: nowrap;
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
.service-row-button+.service-row,
.service-row+.service-row-button,
.service-row-button+.service-row-button {
	border-top: 1rpx solid var(--color-divider);
}

.service-row-button {
	box-sizing: border-box;
	width: 100%;
	margin: 0;
	padding: 0;
	border: 0;
	border-radius: 0;
	background: transparent;
	line-height: inherit;
	text-align: left;
}

.service-row-button::after {
	border: 0;
}

.service-row__icon-wrap {
	display: flex;
	flex: 0 0 auto;
	align-items: center;
	justify-content: center;
	width: 58rpx;
	height: 58rpx;
}

.service-row__icon-font {
	color: var(--color-text);
	font-size: 46rpx;
	line-height: 1;
}

.service-row__icon-wrap--membership {
	background: var(--color-support-notice);
	border-radius: 20rpx;
}

.service-row__icon-wrap--benefit {
	background: var(--color-support-info);
	border-radius: 20rpx;
}

.service-row__copy {
	flex: 1;
	min-width: 0;
	margin-left: var(--space-md);
}

.service-row__title {
	display: block;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--color-text);
	font-size: var(--font-size-md);
	font-weight: var(--font-weight-medium);
}

.service-row__arrow {
	flex: 0 0 auto;
	margin-left: var(--space-lg);
	color: var(--color-text-tertiary);
	font-size: 24rpx;
	line-height: 1;
	transform: rotate(180deg);
}

.service-row__badge-count,
.service-row__badge-dot {
	flex: 0 0 auto;
	margin-left: auto;
}

.service-row__badge-count {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 40rpx;
	height: 40rpx;
	padding: 0 10rpx;
	border-radius: 999rpx;
	background: var(--color-state-danger-base);
	color: var(--notification-badge-text);
	font-size: 22rpx;
	font-weight: var(--font-weight-bold);
	line-height: 1;
}

.service-row__badge-dot {
	width: 16rpx;
	height: 16rpx;
	border-radius: 50%;
	background: var(--color-state-danger-base);
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

.knowledge-entry__icon-font {
	color: var(--color-text);
	font-size: 46rpx;
	line-height: 1;
}

.knowledge-entry__title {
	overflow: hidden;
	max-width: 100%;
	margin-top: 14rpx;
	color: var(--color-text);
	font-size: var(--font-size-md);
	font-weight: var(--font-weight-medium);
	text-overflow: ellipsis;
	white-space: nowrap;
}

.service-version {
	display: flex;
	justify-content: center;
	padding: var(--space-xl) 0 0;
}

.service-version__text {
	color: var(--color-text-tertiary);
	font-size: var(--font-size-md);
}

.option-chip--active .option-chip__text {
	color: var(--color-tag-primary-text);
}

.is-pressed {
	opacity: 0.86;
	transform: scale(0.98);
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
	border: 1rpx solid var(--material-input-border);
	border-radius: var(--radius-md);
	background: var(--material-input-bg);
	box-shadow: var(--material-input-shadow);
	-webkit-backdrop-filter: var(--material-input-filter);
	backdrop-filter: var(--material-input-filter);
	color: var(--color-text);
	font-size: var(--font-size-md);
}

.password-form__error {
	display: block;
	margin-top: var(--space-lg);
	color: var(--color-state-danger-text);
	font-size: var(--font-size-sm);
}

</style>
