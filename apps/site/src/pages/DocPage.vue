<template>
  <DocumentPage v-if="doc" :doc="doc" />

  <div v-else class="not-found">
    <p class="not-found__label">内容未找到</p>
    <h1>这个页面暂时不存在。</h1>
    <RouterLink class="primary-link" to="/">返回首页</RouterLink>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import DocumentPage from "@/components/DocumentPage.vue";
import { docsByPath } from "@/content/docs";
import { resolveSiteContent } from "@/apis/content";

const route = useRoute();
const remoteDoc = ref<ReturnType<typeof mapRemoteDoc> | null>(null);
const fallbackDoc = computed(() => docsByPath.get(route.path) ?? null);
const doc = computed(() => remoteDoc.value ?? fallbackDoc.value ?? null);

function mapRemoteDoc(detail: Awaited<ReturnType<typeof resolveSiteContent>>) {
  const type: "page" | "article" = detail.type === "PAGE" ? "page" : "article";
  return {
    slug: detail.slug,
    path: detail.path,
    type,
    title: detail.title,
    summary: detail.summary,
    updatedAt: detail.updatedAt.slice(0, 10),
    effectiveAt: detail.effectiveAt ? detail.effectiveAt.slice(0, 10) : undefined,
    label: detail.label,
    heroNote: detail.heroNote ?? undefined,
    bodyHtml: detail.bodyHtml
  };
}

async function loadDoc() {
  try {
    remoteDoc.value = mapRemoteDoc(await resolveSiteContent(route.path));
  } catch {
    remoteDoc.value = null;
  }
}

watch(
  () => route.path,
  () => {
    void loadDoc();
  }
);

onMounted(() => {
  void loadDoc();
});
</script>
