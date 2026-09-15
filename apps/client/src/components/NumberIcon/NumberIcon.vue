<template>
  <view class="number-icon" aria-hidden="true">
    <text
      v-for="(digit, index) in digits"
      :key="`${digit}-${index}`"
      :class="['cookfont', `icon-number-${digit}`, 'number-icon__digit']"
    />
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  value: number;
}>();

const digits = computed(() => String(props.value).split(""));
</script>

<style scoped lang="scss">
.number-icon {
  display: inline-flex;
  align-items: center;
  font-size: inherit;
  font-style: inherit;
  line-height: inherit;
}

.number-icon__digit {
  color: inherit;
  font-size: inherit;
  font-style: inherit;
  line-height: inherit;
}
</style>
