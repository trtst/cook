<template>
  <view class="meal-footer__actions" :class="{ 'meal-footer__actions--meal': meal }">
    <template v-if="quickAction">
      <button
        v-if="quickAsButton"
        class="meal-footer__quick meal-footer__quick--button"
        :class="{ 'meal-footer__quick--disabled': quickAction.disabled || submitting }"
        :disabled="quickAction.disabled || submitting"
        :open-type="quickOpenType"
        @click="emit('quick')"
      >
        <text class="cookfont meal-footer__quick-icon" :class="quickAction.iconClass" />
        <text class="meal-footer__quick-label">{{ quickAction.label }}</text>
        <text v-if="quickStatus" class="meal-footer__quick-status">{{ quickStatus }}</text>
      </button>
      <view
        v-else
        class="meal-footer__quick"
        :class="{ 'meal-footer__quick--disabled': quickAction.disabled || submitting }"
        @click="quickBlocked || quickAction.disabled || submitting ? undefined : emit('quick')"
      >
        <text class="cookfont meal-footer__quick-icon" :class="quickAction.iconClass" />
        <text class="meal-footer__quick-label">{{ quickAction.label }}</text>
        <text v-if="quickStatus" class="meal-footer__quick-status">{{ quickStatus }}</text>
      </view>
    </template>

    <view class="meal-footer__buttons" :class="{ 'meal-footer__buttons--single': singleButton }">
      <button
        v-if="secondaryAction"
        class="meal-footer__button meal-footer__button--ghost"
        :class="{ 'meal-footer__button--disabled': secondaryAction.disabled || submitting }"
        @click="emit('secondary')"
      >
        {{ secondaryAction.label }}
      </button>
      <button
        v-if="primaryAction"
        class="meal-footer__button meal-footer__button--primary"
        :class="{ 'meal-footer__button--disabled': primaryAction.disabled || (primaryVisualDisabled ?? submitting) }"
        :disabled="primaryNativeDisabled"
        @click="emit('primary')"
      >
        <text class="meal-footer__button-content">{{ primaryAction.label }}</text>
        <text v-if="primaryGapText" class="meal-footer__button-badge">{{ primaryGapText }}</text>
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  quickAction?: { label: string; iconClass?: string; disabled?: boolean } | null;
  quickStatus?: string;
  secondaryAction?: { label: string; disabled?: boolean } | null;
  primaryAction?: { label: string; disabled?: boolean } | null;
  meal?: boolean;
  primaryGapText?: string;
  singleButton?: boolean;
  submitting?: boolean;
  primaryVisualDisabled?: boolean;
  quickBlocked?: boolean;
  quickAsButton?: boolean;
  quickOpenType?: string;
  primaryNativeDisabled?: boolean;
}>();

const emit = defineEmits<{
  (event: "quick"): void;
  (event: "secondary"): void;
  (event: "primary"): void;
}>();
</script>

<style scoped lang="scss">
.meal-footer__actions {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 0;
  box-sizing: border-box;
}

.meal-footer__actions--meal {
  margin-top: 16rpx;
}

.meal-footer__quick {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  min-width: 86rpx;
}

.meal-footer__quick--button {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
}

.meal-footer__quick--button::after {
  border: 0;
}

.meal-footer__quick--disabled {
  opacity: 0.42;
}

.meal-footer__quick-icon {
  color: var(--color-text);
  font-size: 30rpx;
}

.meal-footer__quick-label {
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.4;
}

.meal-footer__quick-status {
	color: var(--color-text-secondary);
	font-size: 20rpx;
	line-height: 1.2;
}

.meal-footer__buttons {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 14rpx;
}

.meal-footer__buttons--single .meal-footer__button {
  flex: 1 1 100%;
  width: 100%;
}

.meal-footer__buttons--ended {
  gap: 18rpx;
}

.meal-footer__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 90rpx;
  margin: 0;
  padding: 0 28rpx;
  border: 0;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1;
  box-sizing: border-box;
}

.meal-footer__button::after {
  display: none;
  border: 0;
}

.meal-footer__button--ghost {
  color: var(--button-secondary-text);
  background: var(--button-secondary-bg);
}

.meal-footer__button--primary {
  color: var(--button-primary-text);
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
}

.meal-footer__button--disabled {
  opacity: 0.46;
  box-shadow: var(--button-primary-shadow);
}

.meal-footer__button-content {
  line-height: 1;
}

.meal-footer__button-badge {
  margin-left: 10rpx;
  padding: 8rpx 12rpx;
  border-radius: 999rpx;
  background: var(--color-surface-mask-weak);
  font-size: 22rpx;
  line-height: 1;
}
</style>
