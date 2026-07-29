<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="灵感入口">
    <view class="panel">
      <text class="panel__title">独立导入页已下线</text>
      <text class="panel__text">从 2026-07-25 起，灵感浏览、搜索和筛选统一回到菜谱主页面的“灵感”标签。</text>
      <button class="panel__button" @click="goRecipeHome">回到菜谱主页面</button>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { uniPlatform } from "@/platform/uni";

const pageStyle = usePageScrollStyle();

function goRecipeHome() {
	void uniPlatform.navigation.switchTab("/pages/recipe/index");
}
</script>

<style scoped lang="scss">
.panel {
	padding: var(--space-lg);
	border-radius: var(--radius-lg);
	background: var(--color-surface);
}

.panel__title,
.panel__text {
	display: block;
}

.panel__title {
	color: var(--color-text);
	font-size: var(--font-size-lg);
	font-weight: var(--font-weight-bold);
}

.panel__text {
	margin-top: var(--space-sm);
	color: var(--color-text-secondary);
	font-size: var(--font-size-md);
	line-height: 1.6;
}

.panel__button {
	margin-top: var(--space-lg);
	border-radius: var(--radius-md);
	background: var(--color-primary);
	color: var(--color-primary-foreground);
}
</style>
