<template>
  <Layout title="灵感菜谱">
    <view class="panel">
      <text class="panel__title">独立系统菜谱页已并回主页面</text>
      <text class="panel__text">当前日期是 2026-07-25。现在的灵感菜谱浏览统一放在菜谱主页面的“灵感”标签里。</text>
      <button class="panel__button" @click="goRecipeHome">打开菜谱主页面</button>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { uniPlatform } from "@/platform/uni";

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
