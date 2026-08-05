<template>
  <DocumentPage v-if="doc" :doc="doc" />

  <div v-else class="not-found">
    <p class="not-found__label">内容未找到</p>
    <h1>这个页面暂时不存在。</h1>
    <RouterLink class="primary-link" to="/">返回首页</RouterLink>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import DocumentPage from "@/components/DocumentPage.vue";
import { docsByPath } from "@/content/docs";

const route = useRoute();
const doc = computed(() => docsByPath.get(route.path) ?? null);
</script>
