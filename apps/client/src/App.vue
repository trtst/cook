<script setup lang="ts">
import { onLaunch, onShow } from "@dcloudio/uni-app";
import { refreshSessionIfNeeded } from "@/apis/auth";
import { useAppConfigStore } from "@/stores/app-config";
import { useSettingsStore } from "@/stores/settings";
import { initSystemInfo } from "@/composables/useSystemInfo";
import { initTheme } from "@/composables/useTheme";
import { restoreAppSession } from "@/utils/session";

onLaunch(() => {
	initSystemInfo();
	initTheme();
	void useSettingsStore().restore();
	void useAppConfigStore().load().catch(() => undefined);
	void restoreAppSession();
});

onShow(() => {
	void refreshSessionIfNeeded().catch(() => undefined);
});
</script>

<style lang="scss">
@use "@/styles/colors.scss";
@use "@/styles/layout.scss";
@use "@/assets/fonts/font.scss";
@use "@/themes/skins.scss";



/* Black / Heavy / 900 */
@font-face {
	font-family: 'SC-Black';
	font-display: block;
	src: url("https://static.yueniuzq.com/static/font/NotoSerifSCBlack.ttf") format("truetype");
	font-weight: 900;
	font-style: normal;
	font-display: swap;
}

/* Bold / 700 */
@font-face {
	font-family: 'SC-Bold';
	font-display: block;
	src: url("https://static.yueniuzq.com/static/font/NotoSerifSCBold.ttf") format("truetype");
	font-weight: 700;
	font-style: normal;
	font-display: swap;
}

/* Medium / 500 */
@font-face {
	font-family: 'SC-Medium';
	font-display: block;
	src: url("https://static.yueniuzq.com/static/font/NotoSerifSCMedium.ttf") format("truetype");
	font-weight: 500;
	font-style: normal;
	font-display: swap;
}

.font-black {
	font-family: 'SC-Black';
}

.font-bold {
	font-family: 'SC-Bold';
}

.font-medium {
	font-family: 'SC-Medium';
}


page {
	height: 100vh;
	overflow: hidden;
	background: var(--color-page);
	color: var(--color-text);
	font-family: var(--font-family-base);
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
