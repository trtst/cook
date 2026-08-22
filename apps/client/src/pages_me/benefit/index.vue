<template>
  <web-view v-if="pageUrl" :src="pageUrl" />
  <view v-else class="benefit-fallback">
    <text class="benefit-fallback__title">权益页暂时不可用</text>
    <text class="benefit-fallback__text">请稍后再试，或返回上一页。</text>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { cfg } from "@/config/env";

const pageUrl = ref("");

onLoad(() => {
  const baseUrl = cfg.siteUrl.replace(/\/+$/u, "");
  pageUrl.value = `${baseUrl}/membership?source=mini_program`;
});
</script>

<style scoped lang="scss">
.benefit-fallback {
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

.benefit-fallback__title {
  font-size: 34rpx;
  font-weight: 700;
}

.benefit-fallback__text {
  color: var(--color-text-muted);
  font-size: 28rpx;
  line-height: 1.6;
}
</style>
