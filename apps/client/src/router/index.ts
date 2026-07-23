import { uniPlatform } from "@/platform/uni";

export const router = {
	navigateTo: uniPlatform.navigation.navigateTo,
	redirectTo: uniPlatform.navigation.redirectTo,
	switchTab: uniPlatform.navigation.switchTab,
	reLaunch: uniPlatform.navigation.reLaunch
};
