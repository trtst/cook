<template>
  <view
    class="taste-tag-input"
    :class="{ 'taste-tag-input--disabled': disabled }"
  >
    <view v-for="(tag, index) in modelValue" :key="`${tag}-${index}`" class="taste-tag-input__tag">
      <text class="taste-tag-input__text">{{ tag }}</text>
      <view class="taste-tag-input__remove" @click.stop="removeTag(index)">
        <text>×</text>
      </view>
    </view>

    <input
      v-model="draft"
      class="taste-tag-input__input"
      :maxlength="maxLength"
      :placeholder="modelValue.length >= maxCount ? `最多 ${maxCount} 项` : placeholder"
      :disabled="disabled || modelValue.length >= maxCount"
      confirm-type="done"
      @confirm="handleConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";

const props = withDefaults(defineProps<{
  modelValue: string[];
  placeholder?: string;
  disabled?: boolean;
  maxCount?: number;
  maxLength?: number;
}>(), {
  modelValue: () => [],
  placeholder: "输入后按回车添加",
  disabled: false,
  maxCount: 50,
  maxLength: 64
});

const emit = defineEmits<{
  "update:modelValue": [value: string[]];
  confirm: [value: string];
}>();

const draft = ref("");

function handleConfirm() {
  if (props.disabled || props.modelValue.length >= props.maxCount) return;

  const label = draft.value.trim();
  draft.value = "";
  if (!label || label.length > props.maxLength || props.modelValue.includes(label)) return;

  emit("update:modelValue", [...props.modelValue, label]);
  emit("confirm", label);
}

function removeTag(index: number) {
  if (props.disabled) return;
  emit("update:modelValue", props.modelValue.filter((_, tagIndex) => tagIndex !== index));
}
</script>

<style scoped lang="scss">
.taste-tag-input {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12rpx;
  box-sizing: border-box;
  width: 100%;
  min-height: 84rpx;
  margin-top: var(--space-sm);
  padding: 14rpx var(--space-md);
  border: 1rpx solid var(--material-input-border);
  border-radius: var(--radius-xs);
  background: var(--material-input-bg);
  box-shadow: var(--material-input-shadow);
  -webkit-backdrop-filter: var(--material-input-filter);
  backdrop-filter: var(--material-input-filter);
  color: var(--color-text);
}

.taste-tag-input--disabled {
  opacity: 0.56;
}

.taste-tag-input__tag {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  min-height: 52rpx;
  max-width: 100%;
  padding: 0 12rpx 0 18rpx;
  border-radius: var(--radius-pill);
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
  font-size: var(--font-size-sm);
}

.taste-tag-input__text {
  overflow: hidden;
  max-width: 520rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.taste-tag-input__remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34rpx;
  height: 34rpx;
  border-radius: 50%;
  color: var(--color-tag-primary-text);
  font-size: 28rpx;
  line-height: 1;
}

.taste-tag-input__input {
  flex: 1;
  min-width: 180rpx;
  height: 52rpx;
  padding: 0;
  color: var(--color-text);
  font-size: var(--font-size-md);
  line-height: 52rpx;
}
</style>
