<template>
  <view
    class="recipe-empty"
    :hover-class="clickable ? 'recipe-empty--hover' : ''"
    hover-stay-time="100"
    @click="handleClick"
  >
    <image class="recipe-empty__art" :src="art" mode="aspectFit" />
    <text class="recipe-empty__title">{{ title }}</text>
    <text class="recipe-empty__description">{{ description }}</text>
  </view>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    art: string;
    title: string;
    description: string;
    clickable?: boolean;
  }>(),
  {
    clickable: false
  }
);

const emit = defineEmits<{
  click: [];
}>();

function handleClick() {
  if (!props.clickable) return;
  emit("click");
}
</script>

<style scoped lang="scss">
.recipe-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: var(--space-md);
  padding: 40rpx 28rpx 44rpx;
  border: 1rpx solid var(--color-border);
  border-radius: 36rpx;
  background: linear-gradient(180deg, var(--color-surface) 0%, var(--entry-board-bg) 100%);
  text-align: center;
}

.recipe-empty--hover {
  opacity: 0.9;
}

.recipe-empty__art {
  width: 420rpx;
  height: 300rpx;
}

.recipe-empty__title,
.recipe-empty__description {
  display: block;
}

.recipe-empty__title {
  margin-top: 8rpx;
  color: var(--color-text);
  font-size: 36rpx;
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
}

.recipe-empty__description {
  margin-top: 14rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  line-height: var(--line-height-loose);
}
</style>
