<template>
  <view
    class="layout"
    :class="[themeClasses, { 'layout--with-tabbar': showTabbar, 'layout--full-screen': fullScreen }]"
    :style="themeVars"
  >
    <NavBar
      v-if="showNavbar"
      :title="title"
      :show-left="showLeft"
      :layout="navbarLayout"
      :placeholder="navbarPlaceholder"
      :transparent="navbarTransparent"
    >
      <template v-if="$slots['navbar-left']" #left>
        <slot name="navbar-left" />
      </template>
      <template v-if="$slots['navbar-center']" #default>
        <slot name="navbar-center" />
      </template>
      <template v-if="$slots['navbar-right']" #right>
        <slot name="navbar-right" />
      </template>
    </NavBar>
    <view class="layout__body">
      <slot />
    </view>
    <TabBar v-if="showTabbar && currentTab" :current="currentTab" />
    <LoginModal />
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import LoginModal from "@/components/Login/LoginModal.vue";
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
    navbarLayout?: "title" | "custom-left";
  }>(),
  {
    title: "",
    showNavbar: true,
    showLeft: true,
    currentTab: undefined,
    fullScreen: false,
    navbarPlaceholder: true,
    navbarTransparent: false,
    navbarLayout: "title"
  }
);

const { themeClasses, themeVars } = useTheme();
const showTabbar = computed(() => Boolean(props.currentTab));
</script>

<style scoped lang="scss">
.layout {
  min-height: 100vh;
  background: var(--color-page);
  color: var(--color-text);
  font-family: var(--font-family-base);
}

.layout__body {
  min-height: 100vh;
  padding: var(--space-page);
}

.layout--full-screen .layout__body {
  padding: 0;
}

.layout--with-tabbar .layout__body {
  padding-bottom: calc(132rpx + env(safe-area-inset-bottom));
}
</style>
