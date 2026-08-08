<template>
  <view
    class="empty-state"
    :class="{ 'empty-state--art': !!art }"
    :hover-class="clickable ? 'empty-state--hover' : ''"
    hover-stay-time="100"
    @click="handleClick"
  >
    <image v-if="art" class="empty-state__art" :src="art" mode="aspectFit" />
    <text class="empty-state__title">{{ title }}</text>
    <text v-if="description" class="empty-state__description">{{ description }}</text>
  </view>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;
    art?: string;
    clickable?: boolean;
  }>(),
  {
    description: "",
    art: "",
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
.empty-state {
  padding: 48rpx 32rpx;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.empty-state--hover {
  opacity: 0.9;
}

.empty-state--art {
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

.empty-state__art {
  width: 420rpx;
  height: 300rpx;
}

.empty-state__title {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.empty-state--art .empty-state__title {
  margin-top: 8rpx;
  font-size: 36rpx;
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
}

.empty-state__description {
  display: block;
  margin-top: var(--space-sm);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
}

.empty-state--art .empty-state__description {
  margin-top: 14rpx;
  color: var(--color-text-secondary);
  line-height: var(--line-height-loose);
}
</style>
