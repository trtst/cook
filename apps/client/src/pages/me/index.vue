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
									<view v-if="sessionStore.isLoggedIn" class="profile-row__badge-hit" @click.stop="handleBenefitCenter">
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
					<view class="overview-grid">
						<view class="dining-card" hover-class="is-pressed" hover-stay-time="100"
							@click="handleMealHubOpen">
							<view class="overview-heading">
								<text class="overview-heading__title">饭局</text>
								<text class="overview-heading__arrow cookfont icon-back" />
							</view>
							<text class="dining-card__description">发起、查看和收口最近的饭局</text>

							<view v-if="sessionStore.isLoggedIn" class="dining-card__summary">
								<text class="dining-card__count">{{ mealHubTitle }}</text>
								<text class="dining-card__current">{{ mealHubDescription }}</text>
							</view>
							<template v-else>
								<text class="dining-card__status">去看看</text>
								<text class="dining-card__invite">登录后查看你发起的和你参加的饭局。</text>
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
						<text class="service-section__title">权益服务</text>
						<view class="service-list">
							<view class="service-row" hover-class="is-pressed" hover-stay-time="100" @click="handleBenefitCenter">
								<view class="service-row__icon-wrap service-row__icon-wrap--benefit">
									<text class="service-row__icon-mark">益</text>
								</view>
								<view class="service-row__copy">
									<text class="service-row__title">权益中心</text>
									<text class="service-row__description">查看当前会员、体验码与广告减免规则</text>
								</view>
								<text class="service-row__arrow cookfont icon-back" />
							</view>
							<view class="service-row" hover-class="is-pressed" hover-stay-time="100" @click="handleMembershipCode">
								<view class="service-row__icon-wrap service-row__icon-wrap--membership">
									<text class="service-row__icon-mark">码</text>
								</view>
								<view class="service-row__copy">
									<text class="service-row__title">会员兑换码</text>
									<text class="service-row__description">站外购买后，在这里输入兑换码到账</text>
								</view>
								<text class="service-row__arrow cookfont icon-back" />
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
							<template v-for="item in settingEntries" :key="item.title">
								<button v-if="item.openType === 'contact'" class="service-row service-row-button" open-type="contact"
									hover-class="is-pressed" hover-stay-time="100" session-from="source=me-settings">
									<view class="service-row__icon-wrap">
										<image class="service-row__icon" :src="item.iconSrc" mode="aspectFit" />
									</view>
									<view class="service-row__copy">
										<text class="service-row__title">{{ item.title }}</text>
									</view>
									<text class="service-row__arrow cookfont icon-back" />
								</button>

								<view v-else class="service-row" hover-class="is-pressed" hover-stay-time="100"
									@click="handleEntryClick(item)">
									<view class="service-row__icon-wrap">
										<image class="service-row__icon" :src="item.iconSrc" mode="aspectFit" />
									</view>
									<view class="service-row__copy">
										<text class="service-row__title">{{ item.title }}</text>
									</view>
									<text class="service-row__arrow cookfont icon-back" />
								</view>
							</template>
						</view>
						<view class="service-version">
							<text class="service-version__text">-- Ver {{ APP_VERSION }} --</text>
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

		</scroll-view>
	</Layout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import aboutIcon from "@/assets/me-actions/about.svg";
import categoriesUnitsIcon from "@/assets/me-actions/categories-units.svg";
import cookingSkillsIcon from "@/assets/me-actions/cooking-skills.svg";
import cookwareIcon from "@/assets/me-actions/cookware.svg";
import diningEventIcon from "@/assets/me-actions/dining-event.svg";
import feedbackIcon from "@/assets/me-actions/feedback.svg";
import kitchenPrepIcon from "@/assets/me-actions/kitchen-prep.svg";
import mealPlanIcon from "@/assets/me-actions/meal-plan.svg";
import notificationsIcon from "@/assets/me-actions/notifications.svg";
import pantryIcon from "@/assets/me-actions/pantry.svg";
import privacyIcon from "@/assets/me-actions/privacy.svg";
import recipeSkillsIcon from "@/assets/me-actions/recipe-skills.svg";
import remindersIcon from "@/assets/me-actions/reminders.svg";
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
import { APP_NAME, APP_VERSION } from "@/config/app";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import type { ThemePalette } from "@/themes";
import { restoreAppSession } from "@/utils/session";

interface PageEntry {
	title: string;
	iconSrc: string;
	url?: string;
	openType?: "contact";
	disabledText?: string;
	description?: string;
	requiresLogin?: boolean;
}

const pageStyle = usePageScrollStyle();

const sessionStore = useSessionStore();
const userStore = useUserStore();
const loginModalStore = useLoginModalStore();
const { effectiveSkin, effectivePalette, themeMode, canSwitchPalette } = useTheme();
const { navBarTotalHeight } = useSystemInfo();

const profileLoading = ref(false);
const profileEditorOpen = ref(false);
const profileSaving = ref(false);
const medalCount = ref<number | null>(null);
const profileNameDraft = ref("");
const profileEditErrorText = ref("");
const profileHeroVariants = ["profile-hero--mist", "profile-hero--halo", "profile-hero--ripple"] as const;
const profileHeroVariant = profileHeroVariants[Math.floor(Math.random() * profileHeroVariants.length)];
const { setLocked: setPageLocked } = usePageScrollLock(Symbol("me-page-modal"));
let restoredOnce = false;
let loadMePromise: Promise<void> | null = null;
let loadMedalsPromise: Promise<void> | null = null;

const profileHeroStyle = computed(() => ({
	"--profile-hero-padding-top": `${navBarTotalHeight.value}px`
}));
watch(
	() => profileEditorOpen.value,
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
const mealHubTitle = computed(() => "发起和查看最近饭局");
const mealHubDescription = computed(() => "菜单、参与人和回忆都会收在这里。");
const currentThemeText = computed(() => {
	const modeLabel = themeModeLabels[themeMode.value];
	const skinLabel = skinLabelMap[effectiveSkin.value] || "基础";
	if (!canSwitchPalette.value) return `${modeLabel} · ${skinLabel}`;
	return `${modeLabel} · ${skinLabel} · ${paletteLabels[effectivePalette.value]}`;
});

const themeModeLabels = {
	system: "跟随系统",
	light: "浅色",
	dark: "深色"
} as const;
const skinLabelMap = {
	default: "基础",
	"apple-glass": "玻璃",
	"warm-couple": "暖调",
	"handdrawn-food": "手绘"
} as const;
const paletteLabels: Record<ThemePalette, string> = {
	default: "默认",
	warm: "暖黄",
	olive: "橄榄",
	cool: "冷蓝"
};
const coreEntries: PageEntry[] = [
	{
		title: "饭局",
		iconSrc: diningEventIcon,
		url: "/pages_meal/event/index"
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

const settingEntries = computed<PageEntry[]>(() => [
	{
		title: "提醒设置",
		iconSrc: remindersIcon,
		description: "进入提醒设置页查看当前提醒入口",
		url: "/pages_me/reminder/index"
	},
	{
		title: "主题皮肤",
		iconSrc: themeIcon,
		description: currentThemeText.value,
		url: "/pages_me/theme/index",
		requiresLogin: false
	},
	{
		title: "在线客服",
		iconSrc: feedbackIcon,
		description: "直接进入微信客服会话",
		openType: "contact",
		requiresLogin: false
	},
	{
		title: "账号设置",
		iconSrc: notificationsIcon,
		description: sessionStore.isLoggedIn ? "清除缓存与退出登录" : "登录后管理当前账号",
		url: "/pages_me/account/index"
	},
	{
		title: "隐私政策",
		iconSrc: privacyIcon,
		url: `/pages_web/content/index?url=${encodeURIComponent("https://www.trtst.com/privacy")}`,
		requiresLogin: false
	},
	{
		title: "用户协议",
		iconSrc: privacyIcon,
		url: `/pages_web/content/index?url=${encodeURIComponent("https://www.trtst.com/terms")}`,
		requiresLogin: false
	},
	{
		title: `关于${APP_NAME}`,
		iconSrc: aboutIcon,
		url: `/pages_web/content/index?url=${encodeURIComponent("https://www.trtst.com/about")}`,
		requiresLogin: false
	}
]);

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
		await Promise.allSettled([loadMe(), loadMedals()]);
		return;
	}

	profileLoading.value = false;
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

	if (!shouldLoadProfile) {
		profileLoading.value = false;
		return;
	}

	profileLoading.value = true;

	const [profileResult] = await Promise.allSettled([
		shouldLoadProfile ? userApi.getCurrent() : Promise.resolve(null)
	]);

	if (shouldLoadProfile && profileResult.status === "fulfilled" && profileResult.value) {
		userStore.setProfile(profileResult.value);
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

.profile-row__badge-hit {
	display: inline-flex;
	flex: 0 0 auto;
	align-items: center;
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
	padding: 0 var(--space-page) calc(var(--tabbar-shell-height) + env(safe-area-inset-bottom));
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
	font-size: 24rpx;
	line-height: 1;
	transform: rotate(180deg);
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

.service-row__icon {
	display: block;
	width: 58rpx;
	height: 58rpx;
}

.service-row__icon-wrap--membership {
	background: color-mix(in srgb, var(--theme-primary) 9%, var(--color-page));
	border-radius: 20rpx;
}

.service-row__icon-wrap--benefit {
	background: color-mix(in srgb, var(--theme-primary) 10%, var(--color-page));
	border-radius: 20rpx;
}

.service-row__icon-mark {
	color: var(--theme-primary);
	font-size: 30rpx;
	font-weight: 700;
	line-height: 1;
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
	font-size: 24rpx;
	line-height: 1;
	transform: rotate(180deg);
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

.service-version {
	display: flex;
	justify-content: center;
	padding: var(--space-xl) 0 0;
}

.service-version__text {
	color: color-mix(in srgb, var(--color-text-tertiary) 46%, var(--color-page));
	font-size: var(--font-size-md);
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
