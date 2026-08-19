<template>
  <div class="doc-page">
    <header class="doc-page__hero">
      <p class="doc-page__label">{{ doc.label }}</p>
      <h1 class="doc-page__title">{{ doc.title }}</h1>
      <p class="doc-page__summary">{{ doc.summary }}</p>
      <p v-if="doc.heroNote" class="doc-page__hero-note">{{ doc.heroNote }}</p>
      <div class="doc-page__meta">
        <span>更新于 {{ doc.updatedAt }}</span>
        <span v-if="doc.effectiveAt">生效于 {{ doc.effectiveAt }}</span>
      </div>
    </header>

    <div class="doc-page__layout">
      <aside class="doc-page__toc">
        <p class="doc-page__toc-title">目录</p>
        <a v-for="section in doc.sections ?? []" :key="section.id" class="doc-page__toc-link" :href="`#${section.id}`">
          {{ section.title }}
        </a>
      </aside>

      <article class="doc-page__body">
        <section v-for="(section, index) in doc.sections ?? []" :key="section.id" :id="section.id" class="doc-section">
          <button
            class="doc-section__toggle"
            :class="{ 'doc-section__toggle--compact': compact }"
            type="button"
            @click="toggleSection(section.id)"
          >
            <span>{{ section.title }}</span>
            <span v-if="compact" class="doc-section__toggle-icon">{{ isOpen(section.id) ? "−" : "+" }}</span>
          </button>

          <div v-if="!compact || isOpen(section.id)" class="doc-section__content">
            <p v-if="section.summary" class="doc-section__summary">{{ section.summary }}</p>
            <p v-for="paragraph in section.paragraphs" :key="paragraph" class="doc-section__paragraph">
              {{ paragraph }}
            </p>
            <ul v-if="section.bullets?.length" class="doc-section__list">
              <li v-for="bullet in section.bullets" :key="bullet">{{ bullet }}</li>
            </ul>
          </div>

          <div v-if="compact && index < (doc.sections?.length ?? 0) - 1" class="doc-section__divider" />
        </section>

        <div v-if="!doc.sections?.length && richBodyHtml" class="doc-rich-body" v-html="richBodyHtml" />
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { SiteDoc } from "@/content/docs";
import { sanitizeContentHtml } from "@/utils/content-html";

const props = defineProps<{
  doc: SiteDoc;
}>();

const compact = ref(false);
const openIds = ref<Set<string>>(new Set());
const richBodyHtml = computed(() => (props.doc.bodyHtml ? sanitizeContentHtml(props.doc.bodyHtml) : ""));
let query: MediaQueryList | null = null;

function setCompactState(nextCompact: boolean) {
  compact.value = nextCompact;
  if (nextCompact) {
    openIds.value = new Set((props.doc.sections ?? []).slice(0, 1).map((section) => section.id));
    return;
  }

  openIds.value = new Set((props.doc.sections ?? []).map((section) => section.id));
}

function handleQueryChange(event: MediaQueryListEvent) {
  setCompactState(event.matches);
}

function isOpen(id: string) {
  return openIds.value.has(id);
}

function toggleSection(id: string) {
  if (!compact.value) return;
  const next = new Set(openIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  openIds.value = next;
}

onMounted(() => {
  if (typeof window === "undefined") return;
  query = window.matchMedia("(max-width: 960px)");
  setCompactState(query.matches);
  query.addEventListener("change", handleQueryChange);
});

onBeforeUnmount(() => {
  query?.removeEventListener("change", handleQueryChange);
});
</script>

<style scoped lang="scss">
.doc-rich-body :deep(img) {
  max-width: 100%;
  border-radius: 18px;
}

.doc-rich-body :deep(p),
.doc-rich-body :deep(li),
.doc-rich-body :deep(blockquote) {
  line-height: 1.9;
}

.doc-rich-body :deep(blockquote) {
  margin: 16px 0;
  padding: 12px 16px;
  border-left: 4px solid var(--site-accent, #2563eb);
  background: rgb(37 99 235 / 6%);
  border-radius: 12px;
}
</style>
