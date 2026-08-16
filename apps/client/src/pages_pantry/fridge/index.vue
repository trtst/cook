<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="冰箱库存">
    <view class="redirect-state">
      <text class="redirect-state__title">正在进入食材主页...</text>
      <text class="redirect-state__description">旧的冰箱库存入口已并到食材主页，这里会自动跳转。</text>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { uniPlatform } from "@/platform/uni";

const pageStyle = usePageScrollStyle();

onLoad(() => {
  void uniPlatform.navigation.redirectTo("/pages_pantry/index/index");
});
</script>

<style scoped lang="scss">
.redirect-state {
  padding: 120rpx var(--space-page);
}

.redirect-state__title,
.redirect-state__description {
  display: block;
}

.redirect-state__title {
  color: var(--color-text);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
}

.redirect-state__description {
  margin-top: 12rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  line-height: 1.6;
}
</style>
