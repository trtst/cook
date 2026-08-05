<template>
  <div class="site-shell">
    <header ref="headerRef" class="site-shell__header">
      <div class="site-shell__header-inner">
        <button
          class="site-shell__menu-toggle"
          type="button"
          aria-label="打开导航"
          :aria-expanded="menuOpen ? 'true' : 'false'"
          aria-controls="site-mobile-drawer"
          @click="menuOpen = true"
        >
          <span />
          <span />
          <span />
        </button>

        <RouterLink class="site-shell__brand" to="/">
          <img class="site-shell__brand-mark" :src="logoSrc" alt="炊火记 logo" />
        </RouterLink>

        <nav class="site-shell__nav" aria-label="站点导航">
          <RouterLink v-for="item in SITE_HEADER_LINKS" :key="item.to" :to="item.to">{{ item.label }}</RouterLink>
        </nav>

        <div class="site-shell__header-spacer" aria-hidden="true" />
      </div>
    </header>

    <Transition name="site-shell__drawer">
      <div v-if="menuOpen" class="site-shell__drawer-shell">
        <button class="site-shell__drawer-mask" type="button" aria-label="关闭导航" @click="menuOpen = false" />

        <aside id="site-mobile-drawer" class="site-shell__drawer" aria-label="移动端导航">
          <div class="site-shell__drawer-head">
            <span>导航</span>
            <button class="site-shell__drawer-close" type="button" aria-label="关闭导航" @click="menuOpen = false">
              <span />
              <span />
            </button>
          </div>

          <nav class="site-shell__drawer-nav" aria-label="移动端站点导航">
            <RouterLink v-for="item in SITE_HEADER_LINKS" :key="item.to" :to="item.to" @click="menuOpen = false">
              {{ item.label }}
            </RouterLink>
          </nav>
        </aside>
      </div>
    </Transition>

    <main class="site-shell__main">
      <RouterView />
    </main>

    <footer class="site-shell__footer">
      <div class="site-shell__footer-inner">
        <p>{{ SITE_NAME }} · {{ SITE_NAME_EN }}</p>
        <div class="site-shell__footer-side">
          <div class="site-shell__footer-links">
            <RouterLink v-for="item in SITE_FOOTER_LINKS" :key="item.to" :to="item.to">{{ item.label }}</RouterLink>
          </div>
          <div class="site-shell__theme site-shell__theme--footer">
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
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import darkLogoSrc from "@/assets/img/logo.png";
import lightLogoSrc from "@/assets/img/assets-logo.png";
import {
  SITE_FOOTER_LINKS,
  SITE_HEADER_LINKS,
  SITE_NAME,
  SITE_NAME_EN,
  SITE_THEME_KEY,
  SITE_THEME_OPTIONS,
  type ThemeMode
} from "@/config/app";

const route = useRoute();
const themeMode = ref<ThemeMode>("system");
const systemDark = ref(false);
const headerRef = ref<HTMLElement | null>(null);
const menuOpen = ref(false);
let query: MediaQueryList | null = null;
let resizeObserver: ResizeObserver | null = null;

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

function applyHeaderHeight() {
  const height = headerRef.value?.offsetHeight ?? 0;
  document.documentElement.style.setProperty("--site-header-height", `${height}px`);
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
  applyHeaderHeight();

  resizeObserver = new ResizeObserver(() => {
    applyHeaderHeight();
  });

  if (headerRef.value) {
    resizeObserver.observe(headerRef.value);
  }

  window.addEventListener("resize", applyHeaderHeight);
});

onBeforeUnmount(() => {
  query?.removeEventListener("change", handleSystemTheme);
  resizeObserver?.disconnect();
  window.removeEventListener("resize", applyHeaderHeight);
  document.body.style.overflow = "";
});

watch(themeMode, (value) => {
  window.localStorage.setItem(SITE_THEME_KEY, value);
  applyTheme(resolvedTheme.value);
});

watch(resolvedTheme, (value) => {
  applyTheme(value);
});

watch(menuOpen, (value) => {
  document.body.style.overflow = value ? "hidden" : "";
});

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false;
  }
);
</script>
