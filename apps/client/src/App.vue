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
@use "@/themes/skins.scss";

/* 在线链接服务仅供平台体验和调试使用，平台不承诺服务的稳定性，企业客户需下载字体包自行发布使用并做好备份。 */
@font-face {
  font-family: "阿里妈妈方圆体 VF Regular";
  src:
    url("//at.alicdn.com/wf/webfont/l9YzNPwvbPQs/kJBX7iP6vDbv.woff2") format("woff2"),
    url("//at.alicdn.com/wf/webfont/l9YzNPwvbPQs/q6jC32Ou0NlF.woff") format("woff");
  font-display: swap;
  font-variation-settings: "BEVL" 1, "wght" 700;
}

.webfont {
  /* Chrome 140 以下版本需要显式声明可变字体轴。 */
  font-family: "阿里妈妈方圆体 VF Regular";
  font-variation-settings: "BEVL" 1, "wght" 700;
}

page {
  min-height: 100%;
  background: var(--color-page);
  color: var(--color-text);
  font-family: var(--font-family-base);
}

view,
text,
button,
input,
textarea {
  box-sizing: border-box;
}
</style>
