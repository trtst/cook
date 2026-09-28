<template>
  <view :class="['slot-card', `slot-card--${item.status.toLowerCase()}`]">
    <template v-if="item.status === 'REPLACING'">
      <view class="slot-card__head">
        <view class="slot-card__head-main">
          <Skeleton width="90rpx" height="22rpx" />
          <Skeleton class="slot-card__skeleton-title" width="250rpx" height="34rpx" />
          <Skeleton class="slot-card__skeleton-reason" width="310rpx" height="22rpx" />
        </view>
        <Skeleton width="122rpx" height="42rpx" radius="var(--radius-pill)" />
      </view>
      <view class="slot-card__meta">
        <Skeleton v-for="index in 3" :key="index" width="130rpx" height="38rpx" radius="var(--radius-pill)" />
      </view>
      <Skeleton class="slot-card__skeleton-note" width="220rpx" height="22rpx" />
      <view class="action-row">
        <Skeleton v-for="index in 3" :key="index" width="168rpx" height="64rpx" radius="var(--radius-pill)" />
      </view>
    </template>
    <template v-else>
      <view class="slot-card__head">
        <view class="slot-card__head-main">
          <text class="slot-card__slot">{{ slotTypeLabel }}</text>
          <text class="slot-card__title">{{ item.title }}</text>
          <text class="slot-card__reason">{{ item.recommendationReason }}</text>
        </view>
        <text class="slot-card__badge">{{ fridgeFitLabel }}</text>
      </view>

      <view class="slot-card__meta">
        <text v-for="tag in metaTags" :key="tag" class="slot-card__meta-item">{{ tag }}</text>
      </view>

      <text v-if="fridgeNote" class="slot-card__fridge-note">{{ fridgeNote }}</text>

      <view class="action-row">
        <view
          class="action-pill action-pill--muted"
          :class="{ 'action-pill--disabled': lockDisabled }"
          :hover-class="lockDisabled ? '' : 'action-pill--hover'"
          hover-stay-time="100"
          @click="toggleLock()"
        >
          {{ item.status === "LOCKED" ? "已锁定" : "锁定" }}
        </view>
        <view
          class="action-pill action-pill--muted action-pill--subtle"
          :class="{ 'action-pill--disabled': removeDisabled }"
          :hover-class="removeDisabled ? '' : 'action-pill--hover'"
          hover-stay-time="100"
          @click="removeSlot()"
        >
          {{ item.status === "REMOVED" ? "已划掉" : "划掉" }}
        </view>
        <view
          class="action-pill action-pill--primary"
          :class="{ 'action-pill--disabled': changeDisabled }"
          :hover-class="changeDisabled ? '' : 'action-pill--hover'"
          hover-stay-time="100"
          @click="replaceSlot()"
        >
          换一道
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Skeleton from "@/components/Skeleton/Skeleton.vue";
import type { RandomSlotViewModel } from "../types/random";

const props = defineProps<{
  item: RandomSlotViewModel;
  disabled?: boolean;
}>();

const FLAVOR_LABELS: Record<string, string> = {
  LIGHT: "清淡",
  NOT_SPICY: "不辣",
  MILD: "微辣",
  SPICY: "辣味",
  SOUR: "酸口",
  SWEET: "甜口",
  SALTY: "咸鲜",
  UMAMI: "鲜味"
};

const emit = defineEmits<{
  toggleLock: [slotId: string];
  remove: [slotId: string];
  replace: [slotId: string];
}>();

const slotTypeLabel = computed(() => {
  switch (props.item.slotType) {
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
      return "水果/小食";
    default:
      return props.item.slotType;
  }
});

const fridgeFitLabel = computed(() => {
  switch (props.item.fridgeFit) {
    case "HIGH":
      return "冰箱匹配高";
    case "MEDIUM":
      return "冰箱匹配中";
    case "LOW":
      return "冰箱匹配低";
    default:
      return "库存未知";
  }
});

const sourceLabel = computed(() => (props.item.sourceType === "MY" ? "我的菜谱" : "灵感菜谱"));

const proteinLabel = computed(() => {
  switch (props.item.mainProteinType) {
    case "PORK":
      return "猪肉";
    case "CHICKEN":
      return "鸡肉";
    case "BEEF":
      return "牛肉";
    case "LAMB":
      return "羊肉";
    case "DUCK":
      return "鸭肉";
    case "FISH":
      return "鱼鲜";
    default:
      return "素菜";
  }
});

const displayFlavorTags = computed(() => {
  return props.item.flavorTags.flatMap(tag => {
    const label = formatFlavorTag(tag);
    return label ? [label] : [];
  });
});

const metaTags = computed<string[]>(() => {
  return [
    sourceLabel.value,
    props.item.durationText,
    props.item.servings ? `${props.item.servings}人份` : "",
    props.item.mainProteinType ? proteinLabel.value : "",
    ...displayFlavorTags.value
  ].flatMap(tag => (tag ? [tag] : []));
});

const fridgeNote = computed(() => {
  if (props.item.matchedIngredients.length) {
    const names = props.item.matchedIngredients.slice(0, 2).join("、");
    const suffix = props.item.matchedIngredients.length > 2 ? "等" : "";
    return `已有：${names}${suffix}`;
  }
  switch (props.item.fridgeFit) {
    case "HIGH":
      return "冰箱里主料基本都有";
    case "MEDIUM":
      return "有一部分食材可直接用";
    default:
      return "";
  }
});

const interactionDisabled = computed(() => props.disabled || props.item.status === "REPLACING" || props.item.status === "REMOVED");
const lockDisabled = computed(() => interactionDisabled.value);
const removeDisabled = computed(() => props.disabled || props.item.status === "REPLACING" || props.item.status === "LOCKED");
const changeDisabled = computed(() => interactionDisabled.value || props.item.status === "LOCKED");

function formatFlavorTag(tag: string) {
  const value = tag.trim();
  if (!value) return "";
  const key = value.toUpperCase();
  if (FLAVOR_LABELS[key]) return FLAVOR_LABELS[key];
  if (/^[A-Z0-9_]+$/.test(value)) return "";
  return value;
}

function toggleLock() {
  if (interactionDisabled.value) return;
  emit("toggleLock", props.item.slotId);
}

function removeSlot() {
  if (removeDisabled.value) return;
  emit("remove", props.item.slotId);
}

function replaceSlot() {
  if (changeDisabled.value) return;
  emit("replace", props.item.slotId);
}
</script>

<style scoped lang="scss">
.slot-card {
  padding: 24rpx;
  border-radius: var(--radius-lg);
  background: var(--color-surface-soft-card);
  box-shadow: var(--shadow-card);
}

.slot-card--locked {
  box-shadow:
    var(--shadow-card),
    inset 0 0 0 1rpx var(--color-border-active);
}

.slot-card--removed {
  opacity: 0.72;
}

.slot-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.slot-card__head-main {
  min-width: 0;
  flex: 1;
}

.slot-card__slot {
  display: block;
  color: var(--color-support-action);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
}

.slot-card__title {
  display: block;
  margin-top: 8rpx;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
}

.slot-card__reason {
  display: block;
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.slot-card__skeleton-title {
  margin-top: 8rpx;
}

.slot-card__skeleton-reason {
  margin-top: 8rpx;
}

.slot-card__badge {
  flex: 0 0 auto;
  padding: 8rpx 16rpx;
  border-radius: var(--radius-pill);
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
}

.slot-card__meta,
.action-row {
  display: flex;
  flex-wrap: wrap;
}

.slot-card__meta {
  gap: 10rpx;
  margin-top: 16rpx;
}

.slot-card__meta-item {
  padding: 8rpx 14rpx;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
}

.slot-card__meta-item {
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
}

.slot-card__fridge-note {
  display: block;
  margin-top: 16rpx;
  color: var(--color-state-success-text);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
}

.slot-card__skeleton-note {
  margin-top: 16rpx;
}

.action-row {
  gap: 12rpx;
  margin-top: 22rpx;
}

.action-pill--disabled {
  opacity: 0.7;
}
</style>
