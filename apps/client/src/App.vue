<script setup lang="ts">
import { onLaunch } from "@dcloudio/uni-app";
import { userApi } from "@/apis/user";
import { useSessionStore } from "@/stores/session";
import { useSettingsStore } from "@/stores/settings";
import { useUserStore } from "@/stores/user";
import { initSystemInfo } from "@/composables/useSystemInfo";
import { initTheme } from "@/composables/useTheme";

onLaunch(() => {
  initSystemInfo();
  initTheme();
  void useSettingsStore().restore();
  void restoreCurrentUser();
});

async function restoreCurrentUser() {
  const sessionStore = useSessionStore();
  const userStore = useUserStore();

  await sessionStore.restore();
  if (!sessionStore.isLoggedIn) return;

  try {
    userStore.setProfile(await userApi.getCurrent());
  } catch {
    userStore.clearProfile();
  }
}
</script>

<style lang="scss">
@use "@/styles/colors.scss";
@use "@/themes/skins.scss";

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
