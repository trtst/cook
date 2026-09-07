<template>
  <SheetShell
    :visible="visible"
    :title="title"
    :subtitle="subtitle"
    @close="emit('close')"
    @after-close="emit('afterClose')"
  >
    <view class="text-field-sheet">
      <textarea
        v-if="multiline"
        v-model="model"
        class="text-field-sheet__input text-field-sheet__input--textarea"
        :maxlength="maxlength"
        :placeholder="placeholder"
        placeholder-class="text-field-sheet__placeholder"
      />
      <input
        v-else
        v-model="model"
        class="text-field-sheet__input"
        :maxlength="maxlength"
        :placeholder="placeholder"
        placeholder-class="text-field-sheet__placeholder"
      />
    </view>

    <template #footer>
      <view class="text-field-sheet__actions">
        <button
          class="text-field-sheet__button text-field-sheet__button--cancel"
          :class="{ 'text-field-sheet__button--disabled': submitting }"
          @click="handleClose"
        >
          {{ cancelText }}
        </button>
        <button
          class="text-field-sheet__button text-field-sheet__button--confirm"
          :class="{ 'text-field-sheet__button--disabled': submitting || confirmDisabled }"
          @click="handleConfirm"
        >
          {{ submitting ? confirmLoadingText : confirmText }}
        </button>
      </view>
    </template>
  </SheetShell>
</template>

<script setup lang="ts">
import { computed } from "vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";

const props = withDefaults(defineProps<{
  visible: boolean;
  title: string;
  subtitle?: string;
  modelValue: string;
  placeholder?: string;
  maxlength?: number;
  multiline?: boolean;
  submitting?: boolean;
  confirmDisabled?: boolean;
  cancelText?: string;
  confirmText: string;
  confirmLoadingText: string;
}>(), {
  subtitle: "",
  placeholder: "",
  maxlength: 40,
  multiline: false,
  submitting: false,
  confirmDisabled: false,
  cancelText: "取消"
});

const emit = defineEmits<{
  close: [];
  afterClose: [];
  confirm: [];
  "update:modelValue": [value: string];
}>();

const model = computed({
  get: () => props.modelValue,
  set: (value: string) => emit("update:modelValue", value)
});

function handleClose() {
  if (props.submitting) return;
  emit("close");
}

function handleConfirm() {
  if (props.submitting || props.confirmDisabled) return;
  emit("confirm");
}
</script>

<style scoped lang="scss">
.text-field-sheet {
  margin-top: 24rpx;
}

.text-field-sheet__input {
  display: block;
  width: 100%;
  min-height: 88rpx;
  height: 88rpx;
  padding: 0 24rpx;
  border: 1rpx solid var(--material-input-border);
  border-radius: var(--radius-xs);
  background: var(--material-input-bg);
  box-shadow: var(--material-input-shadow);
  box-sizing: border-box;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  -webkit-backdrop-filter: var(--material-input-filter);
  backdrop-filter: var(--material-input-filter);
}

.text-field-sheet__input--textarea {
  min-height: 240rpx;
  height: 240rpx;
  padding: 24rpx;
  line-height: 1.7;
}

.text-field-sheet__placeholder {
  color: var(--color-text-tertiary);
}

.text-field-sheet__actions {
  display: flex;
  gap: 18rpx;
}

.text-field-sheet__button {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  text-align: center;
}

.text-field-sheet__button::after {
  border: 0;
}

.text-field-sheet__button--cancel {
  background: var(--button-secondary-bg);
  color: var(--button-secondary-text);
  -webkit-backdrop-filter: var(--button-secondary-filter);
  backdrop-filter: var(--button-secondary-filter);
}

.text-field-sheet__button--confirm {
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  -webkit-backdrop-filter: var(--button-primary-filter);
  backdrop-filter: var(--button-primary-filter);
}

.text-field-sheet__button--disabled {
  opacity: 0.46;
}
</style>
