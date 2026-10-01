<template>
  <Layout :class="themeClasses" :title="title" full-screen :navbar-placeholder="false" navbar-transparent>
    <scroll-view class="legal-page" scroll-y :show-scrollbar="false" :style="pageBodyStyle">
      <view v-if="loading" class="legal-state">
        <text class="legal-state__text">正在加载内容…</text>
      </view>

      <view v-else-if="emptyState" class="legal-state" @click="retryDocument">
        <text class="legal-state__title">{{ emptyState.title }}</text>
        <text class="legal-state__text">{{ emptyState.description }}</text>
        <text v-if="emptyState.canRetry" class="legal-state__action">点击重试</text>
      </view>

      <view v-else-if="detail" class="legal-content">
        <text v-if="effectiveDate" class="legal-content__date">生效日期：{{ effectiveDate }}</text>
        <ArticleBody :html="detail.bodyHtml" />
      </view>
    </scroll-view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiClientError, HttpError } from "@/apis/http";
import Layout from "@/components/Layout/Layout.vue";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { useTheme } from "@/composables/useTheme";
import ArticleBody from "./ArticleBody.vue";
import { siteContentApi, type SiteContentDetail } from "../apis/site-content";

const props = defineProps<{
  title: string;
  path: string;
}>();

const { themeClasses } = useTheme();
const { navBarTotalHeight } = useSystemInfo();
const pageBodyStyle = computed(() => ({ paddingTop: `calc(${navBarTotalHeight.value}px + 24rpx)` }));
const detail = ref<SiteContentDetail | null>(null);
const loading = ref(false);
const errorState = ref<"unpublished" | "failed" | "">("");
const emptyState = computed(() => {
  if (errorState.value === "unpublished") {
    return {
      title: "内容准备中",
      description: "相关内容正在整理，暂未发布。",
      canRetry: false
    };
  }
  if (errorState.value === "failed") {
    return {
      title: "内容加载失败",
      description: "请检查网络后重试。",
      canRetry: true
    };
  }
  return null;
});
const effectiveDate = computed(() => detail.value?.effectiveAt?.slice(0, 10) ?? "");

onMounted(() => {
  void loadDocument();
});

async function loadDocument() {
  loading.value = true;
  errorState.value = "";
  try {
    const result = await siteContentApi.getPublishedPage(props.path);
    if (!result.ok) {
      detail.value = null;
      errorState.value = result.code === 404 ? "unpublished" : "failed";
      return;
    }

    detail.value = result.data;
  } catch (error) {
    detail.value = null;
    errorState.value = isNotPublishedError(error) ? "unpublished" : "failed";
  } finally {
    loading.value = false;
  }
}

function isNotPublishedError(error: unknown) {
  return (error instanceof ApiClientError && error.code === 404) || (error instanceof HttpError && error.status === 404);
}

function retryDocument() {
  if (emptyState.value?.canRetry) void loadDocument();
}
</script>

<style scoped lang="scss">
.legal-page {
  box-sizing: border-box;
  height: 100%;
  padding: 0 32rpx 48rpx;
  background: var(--color-page);
}

.legal-content {
  padding: 8rpx 0 48rpx;
}

.legal-content__date {
  display: block;
  margin-bottom: 32rpx;
  color: var(--color-text-tertiary);
  font-size: 24rpx;
}

.legal-state {
  display: flex;
  min-height: 440rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  color: var(--color-text-tertiary);
  text-align: center;
}

.legal-state__title {
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: var(--font-weight-bold);
}

.legal-state__text {
  font-size: 26rpx;
}

.legal-state__action {
  color: var(--color-support-action);
  font-size: 26rpx;
}
</style>
