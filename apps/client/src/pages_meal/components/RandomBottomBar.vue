<template>
  <view class="bottom-bar">
    <view class="bottom-bar__summary">
      <text class="bottom-bar__title">{{ title }}</text>
      <text class="bottom-bar__desc">{{ description }}</text>
    </view>
    <view class="bottom-bar__actions">
      <button
        v-if="showGapButton"
        class="secondary bottom-bar__button"
        :disabled="loading"
        @click="emit('openGap')"
      >
        {{ loading ? "处理中..." : "看看缺什么" }}
      </button>
      <button
        v-if="showShoppingButton"
        class="secondary bottom-bar__button"
        :disabled="shoppingDisabled || loading"
        @click="emit('createShopping')"
      >
        去采购缺口
      </button>
      <button
        v-if="showPlanButton"
        class="primary bottom-bar__button"
        :disabled="planDisabled || loading"
        @click="emit('createPlan')"
      >
        加入计划
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string;
  description: string;
  loading: boolean;
  showGapButton: boolean;
  showPlanButton: boolean;
  showShoppingButton: boolean;
  planDisabled: boolean;
  shoppingDisabled: boolean;
}>();

const emit = defineEmits<{
  openGap: [];
  createPlan: [];
  createShopping: [];
}>();
</script>

<style scoped lang="scss">
.bottom-bar {
  position: sticky;
  bottom: 0;
  margin-top: var(--space-md);
  padding: 24rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  background:
    linear-gradient(180deg, rgba(255, 253, 248, 0.96), rgba(255, 253, 248, 0.99));
  box-shadow: 0 -16rpx 32rpx var(--color-surface-mask-weak);
  -webkit-backdrop-filter: saturate(180%) blur(18rpx);
  backdrop-filter: saturate(180%) blur(18rpx);
}

.bottom-bar__summary {
  min-width: 0;
}

.bottom-bar__title {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-heavy);
}

.bottom-bar__desc {
  display: block;
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
}

.bottom-bar__actions {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}

.bottom-bar__button {
  flex: 1;
  margin: 0;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.primary {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
}
</style>
