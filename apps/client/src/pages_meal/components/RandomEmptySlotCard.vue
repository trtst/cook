<template>
  <view class="empty-slot-card">
    <text class="empty-slot-card__slot">{{ slotLabel }}</text>
    <text class="empty-slot-card__message">暂无符合当前条件的可用菜谱</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { RecipeSlotType } from "../apis/random";

const props = defineProps<{
  slotType: RecipeSlotType;
}>();

const slotLabel = computed(() => {
  switch (props.slotType) {
    case "MEAT":
      return "荤菜";
    case "VEGETABLE":
      return "素菜";
    case "SOUP":
      return "汤";
    case "STAPLE":
      return "主食";
    case "BREAKFAST_STAPLE":
      return "早餐主食";
    case "BREAKFAST_PROTEIN":
      return "早餐蛋白";
    case "BREAKFAST_SIDE":
      return "早餐小菜";
    default:
      return props.slotType;
  }
});
</script>

<style scoped lang="scss">
.empty-slot-card {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 28rpx;
  border: 2rpx dashed var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-muted);
}

.empty-slot-card__slot {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.empty-slot-card__message {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}
</style>
