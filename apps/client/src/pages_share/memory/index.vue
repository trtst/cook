<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="饭搭子卡"><text class="title">饭搭子卡</text></Layout>
</template>

<script setup lang="ts">
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";

const pageStyle = usePageScrollStyle();
</script>


<style scoped lang="scss">.title{font-size:var(--font-size-lg);font-weight:600;color:var(--color-text)}</style>
