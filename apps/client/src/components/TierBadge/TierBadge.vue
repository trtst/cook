<template>
  <text class="tier-badge" :class="badgeClass">
    <text class="tier-badge__text">{{ badgeText }}</text>
  </text>
</template>

<script setup lang="ts">
import { computed } from "vue";

type TierValue = "FREE" | "PLUS" | "PRO" | "ULTRA";

const props = withDefaults(
  defineProps<{
    tier?: TierValue;
  }>(),
  {
    tier: "FREE"
  }
);

const badgeText = computed(() => {
  if (props.tier === "ULTRA") return "Ultra";
  if (props.tier === "PRO") return "Pro";
  if (props.tier === "PLUS") return "Plus";
  return "Free";
});

const badgeClass = computed(() => {
  if (props.tier === "ULTRA") return "tier-badge--ultra";
  if (props.tier === "PRO") return "tier-badge--pro";
  if (props.tier === "PLUS") return "tier-badge--plus";
  return "tier-badge--free";
});
</script>

<style scoped lang="scss">
.tier-badge {
  display: inline-block;
  flex: 0 0 auto;
  margin-left: 10rpx;
  padding: 0 12rpx;
  border-radius: var(--radius-xs);
  font-size: var(--font-size-xxs);
  font-weight: var(--font-weight-bold);
  line-height: 1;
  transform: skewX(-18deg);
}

.tier-badge__text {
  display: block;
  padding: 6rpx 0;
  font-size: var(--font-size-xxs);
  font-weight: var(--font-weight-bold);
  line-height: 1;
  transform: skewX(18deg);
}

.tier-badge--free {
  background: linear-gradient(135deg, #f0f2f5 0%, #d7dbe2 100%);
  color: #5f6672;
}

.tier-badge--plus {
  background: linear-gradient(135deg, #ffe8a3 0%, #f6c94c 100%);
  color: #7c5600;
}

.tier-badge--pro {
  background: linear-gradient(135deg, #2d2418 0%, #121212 55%, #a97826 100%);
  color: #f6df9f;
}

.tier-badge--ultra {
  background: linear-gradient(135deg, #1f1710 0%, #0d0d0d 45%, #d9b35b 100%);
  color: #fff1c7;
}
</style>
