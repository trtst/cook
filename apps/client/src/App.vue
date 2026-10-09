<script setup lang="ts">
import { onLaunch, onShow } from "@dcloudio/uni-app";
import { refreshSessionIfNeeded } from "@/apis/auth";
import { useAppConfigStore } from "@/stores/app-config";
import { useSettingsStore } from "@/stores/settings";
import { initSystemInfo } from "@/composables/useSystemInfo";
import { initTheme } from "@/composables/useTheme";
import { restoreAppSession } from "@/utils/session";
import { clearLegacyPlanOrder } from "@/utils/session-cleanup";

onLaunch(() => {
	clearLegacyPlanOrder();
	initSystemInfo();
	initTheme();
	void useAppConfigStore().loadOnLaunch();
	void useSettingsStore().restore();
	void restoreAppSession();
});

onShow(() => {
	useAppConfigStore().startForegroundCycle();
	void refreshSessionIfNeeded().catch(() => undefined);
});
</script>

<style lang="scss">
@use "@/styles/colors.scss";
@use "@/styles/action-pill.scss";
@use "@/styles/layout.scss";
@use "@/styles/nav-tabs.scss";
@use "@/assets/fonts/font.scss";
@use "@/themes/skins.scss";

@font-face {
	font-family: 'SC-Medium';
	font-display: block;
	src: url("https://static.trtst.com/O/fonts/chuihuoji_Medium.ttf") format("truetype");
	font-weight: 500;
	font-style: normal;
	font-display: swap;
}

@font-face {
	font-family: 'CHJ-Kai';
	font-display: block;
	src: url("https://static.trtst.com/O/fonts/chuihuoji_han.ttf") format("truetype");
	font-weight: 500;
	font-style: normal;
	font-display: swap;
}

.font-medium {
	font-family: 'CHJ-Kai';
}

page {
	height: 100vh;
	overflow: hidden;
	color: var(--color-text);
	font-family: 'SC-Medium', var(--font-family-base);
}

::-webkit-scrollbar {
	width: 0;
	height: 0;
	color: transparent;
	display: none;
}

view,
text,
button,
input,
textarea {
	box-sizing: border-box;
}
</style>
