<template>
  <div class="site-shell">
    <header class="site-shell__header">
      <div class="site-shell__header-inner">
        <RouterLink class="site-shell__brand" to="/">
          <img class="site-shell__brand-mark" :src="logoSrc" alt="炊火记 logo" />
        </RouterLink>

        <nav class="site-shell__nav">
          <RouterLink v-for="item in SITE_HEADER_LINKS" :key="item.to" :to="item.to">{{ item.label }}</RouterLink>
        </nav>

        <div class="site-shell__actions">
          <div class="site-shell__theme">
            <button
              v-for="option in SITE_THEME_OPTIONS"
              :key="option.value"
              class="site-shell__theme-button"
              :class="{ 'site-shell__theme-button--active': themeMode === option.value }"
              type="button"
              @click="themeMode = option.value"
            >
              {{ option.label }}
            </button>
          </div>

          <RouterLink class="site-shell__cta" :to="SITE_HOME_CONFIG.primaryCta.to">开始安排</RouterLink>
        </div>
      </div>
    </header>

    <main class="site-shell__main">
      <RouterView />
    </main>

    <footer class="site-shell__footer">
      <div class="site-shell__footer-inner">
        <p>{{ SITE_NAME }} · {{ SITE_NAME_EN }}</p>
        <div class="site-shell__footer-links">
          <RouterLink v-for="item in SITE_FOOTER_LINKS" :key="item.to" :to="item.to">{{ item.label }}</RouterLink>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, RouterView } from "vue-router";
import darkLogoSrc from "@/assets/img/logo.png";
import lightLogoSrc from "@/assets/img/assets-logo.png";
import {
  SITE_FOOTER_LINKS,
  SITE_HEADER_LINKS,
  SITE_HOME_CONFIG,
  SITE_NAME,
  SITE_NAME_EN,
  SITE_THEME_KEY,
  SITE_THEME_OPTIONS,
  type ThemeMode
} from "@/config/app";

const themeMode = ref<ThemeMode>("system");
const systemDark = ref(false);
let query: MediaQueryList | null = null;

const resolvedTheme = computed(() => {
  if (themeMode.value === "system") {
    return systemDark.value ? "dark" : "light";
  }
  return themeMode.value;
});

const logoSrc = computed(() => (resolvedTheme.value === "dark" ? darkLogoSrc : lightLogoSrc));

function applyTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
}

function handleSystemTheme(event: MediaQueryListEvent) {
  systemDark.value = event.matches;
}

onMounted(() => {
  const stored = window.localStorage.getItem(SITE_THEME_KEY);
  if (stored === "system" || stored === "light" || stored === "dark") {
    themeMode.value = stored;
  }

  query = window.matchMedia("(prefers-color-scheme: dark)");
  systemDark.value = query.matches;
  query.addEventListener("change", handleSystemTheme);
  applyTheme(resolvedTheme.value);
});

onBeforeUnmount(() => {
  query?.removeEventListener("change", handleSystemTheme);
});

watch(themeMode, (value) => {
  window.localStorage.setItem(SITE_THEME_KEY, value);
  applyTheme(resolvedTheme.value);
});

watch(resolvedTheme, (value) => {
  applyTheme(value);
});
</script>
