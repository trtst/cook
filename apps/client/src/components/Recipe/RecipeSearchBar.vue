<template>
  <view class="recipe-search">
    <view class="recipe-search__field" :class="{ 'recipe-search__field--disabled': disabled }">
      <image class="recipe-search__icon" :src="searchIcon" mode="aspectFit" />
      <input
        :value="modelValue"
        class="recipe-search__input"
        :disabled="disabled"
        :placeholder="placeholder"
        placeholder-class="recipe-search__placeholder"
        confirm-type="search"
        @input="handleInput"
        @confirm="handleConfirm"
      />
      <text v-if="showClear && modelValue" class="recipe-search__clear" @click="handleClear">清除</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import searchIcon from "@/assets/recipe-page/search.svg";

withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    disabled?: boolean;
    showClear?: boolean;
  }>(),
  {
    placeholder: "搜索菜谱、食材",
    disabled: false,
    showClear: true
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  confirm: [];
  clear: [];
}>();

function handleInput(event: Event) {
  const value = (event as Event & { detail?: { value?: string } }).detail?.value || "";
  emit("update:modelValue", value);
}

function handleConfirm() {
  emit("confirm");
}

function handleClear() {
  emit("update:modelValue", "");
  emit("clear");
}
</script>

<style scoped lang="scss">
.recipe-search__field {
  display: flex;
  align-items: center;
  height: 80rpx;
  padding: 0 28rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  box-sizing: border-box;
}

.recipe-search__field--disabled {
  opacity: 0.7;
}

.recipe-search__icon {
  flex: 0 0 48rpx;
  width: 48rpx;
  height: 48rpx;
}

.recipe-search__input {
  flex: 1;
  min-width: 0;
  height: 80rpx;
  padding: 0 0 0 16rpx;
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: var(--font-weight-medium);
}

.recipe-search__clear {
  flex: 0 0 auto;
  padding-left: 16rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  line-height: 1;
}

:deep(.recipe-search__placeholder) {
  color: var(--color-text-tertiary);
}
</style>
