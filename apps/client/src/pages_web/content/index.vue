<template>
  <web-view v-if="pageUrl" :src="pageUrl" />
  <view v-else class="content-fallback">
    <text class="content-fallback__title">内容暂时不可用</text>
    <text class="content-fallback__text">请稍后再试，或返回上一页。</text>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { buildSiteContentUrl, resolveSiteContent, type SiteContentSlug } from "../config/site-content";

const pageUrl = ref("");

onLoad((query) => {
  const directUrl = typeof query?.url === "string" ? decodeURIComponent(query.url) : "";
  if (/^https:\/\//iu.test(directUrl)) {
    pageUrl.value = directUrl;
    return;
  }

  const slug = typeof query?.slug === "string" ? query.slug : "";
  const meta = resolveSiteContent(slug);
  if (!meta) {
    pageUrl.value = "";
    return;
  }

  pageUrl.value = buildSiteContentUrl(slug as SiteContentSlug);
});
</script>

<style scoped lang="scss">
.content-fallback {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 48rpx;
  background: var(--color-page);
  color: var(--color-text);
  text-align: center;
}

.content-fallback__title {
  font-size: 34rpx;
  font-weight: 700;
}

.content-fallback__text {
  color: var(--color-text-muted);
  font-size: 28rpx;
  line-height: 1.6;
}
</style>
