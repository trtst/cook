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
  background: var(--tier-badge-free-bg);
  color: var(--tier-badge-free-text);
}

.tier-badge--plus {
  background: var(--tier-badge-plus-bg);
  color: var(--tier-badge-plus-text);
}

.tier-badge--pro {
  background: var(--tier-badge-pro-bg);
  color: var(--tier-badge-pro-text);
}

.tier-badge--ultra {
  background: var(--tier-badge-ultra-bg);
  color: var(--tier-badge-ultra-text);
}
</style>
