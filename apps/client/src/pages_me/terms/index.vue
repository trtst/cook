<template>
  <page-meta :page-style="themePageStyle" />
  <LegalDocument title="用户协议" path="/terms" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import LegalDocument from "../components/LegalDocument.vue";

const pageStyle = usePageScrollStyle();
const { themeVars } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
</script>
