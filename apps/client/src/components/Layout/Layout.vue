<template>
	<view class="layout">
		<view class="layout__theme"
			:class="[themeClasses, { 'layout__theme--with-tabbar': showTabbar, 'layout__theme--full-screen': fullScreen }]">
			<NavBar v-if="showNavbar && navbarCenterVisible && $slots['navbar-center']" :title="title" :show-left="showLeft" :capsule-guard="navbarCapsuleGuard"
				:custom-center="true"
				:placeholder="navbarPlaceholder" :transparent="navbarTransparent" :background-opacity="navbarOpacity">
				<slot name="navbar-center" />
				<template v-if="$slots['navbar-right']" #right>
					<slot name="navbar-right" />
				</template>
			</NavBar>
			<NavBar v-else-if="showNavbar" :title="title" :show-left="showLeft" :capsule-guard="navbarCapsuleGuard"
				:placeholder="navbarPlaceholder" :transparent="navbarTransparent" :background-opacity="navbarOpacity">
				<template v-if="$slots['navbar-right']" #right>
					<slot name="navbar-right" />
				</template>
			</NavBar>
			<view class="layout__body">
				<slot />
			</view>
			<TabBar v-if="showTabbar && currentTab" :current="currentTab" />
			<Toast :top-offset="toastTop" />
			<Confirm />
			<LoginModal />
		</view>
	</view>
</template>

<script lang="ts">
export default {
	options: {
		virtualHost: true
	}
};
</script>

<script setup lang="ts">
import { computed } from "vue";
import Confirm from "@/components/Confirm/Confirm.vue";
import LoginModal from "@/components/Login/LoginModal.vue";
import NavBar from "@/components/NavBar/NavBar.vue";
import TabBar from "@/components/TabBar/TabBar.vue";
import Toast from "@/components/Toast/Toast.vue";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { useTheme } from "@/composables/useTheme";
import type { TabKey } from "@/components/TabBar/tabs";

const props = withDefaults(
	defineProps<{
		title?: string;
		showNavbar?: boolean;
		showLeft?: boolean;
		currentTab?: TabKey;
		fullScreen?: boolean;
		navbarPlaceholder?: boolean;
		navbarTransparent?: boolean;
		navbarOpacity?: number;
		navbarCapsuleGuard?: boolean;
		navbarCenterVisible?: boolean;
	}>(),
	{
		title: "",
		showNavbar: true,
		showLeft: true,
		currentTab: undefined,
		fullScreen: false,
		navbarPlaceholder: true,
		navbarTransparent: false,
		navbarOpacity: 1,
		navbarCapsuleGuard: false,
		navbarCenterVisible: true
	}
);

const { themeClasses } = useTheme();
const { navBarTotalHeight, systemInfo } = useSystemInfo();
const showTabbar = computed(() => Boolean(props.currentTab));
const toastTop = computed(() => (props.showNavbar ? navBarTotalHeight.value : systemInfo.value.statusBarHeight));
</script>

<style scoped lang="scss">
@use "@/styles/colors.scss";
@use "@/themes/skins.scss";

.layout {
	height: 100vh;
	overflow: hidden;
	color: var(--color-text);
	font-family: var(--font-family-base);
	background: var(--color-page);
}

.layout__theme {
	display: flex;
	flex-direction: column;
	height: 100%;
}

.layout__body {
	flex: 1;
	min-height: 0;
}
</style>
