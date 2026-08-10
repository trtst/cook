<template>
  <view v-if="confirm.visible" class="confirm-layer" @click="handleMask">
    <view class="confirm-mask" :class="`confirm-mask--${confirm.phase}`" />
    <view class="confirm-shell">
      <view class="confirm-card" :class="[`confirm-card--${confirm.phase}`, `confirm-card--${confirm.tone}`]" @click.stop>
        <view class="confirm-card__glow" />
        <view class="confirm-card__accent" />
        <view class="confirm-card__body">
          <text class="confirm-card__title">{{ confirm.title }}</text>
          <text v-if="confirm.content" class="confirm-card__content">{{ confirm.content }}</text>
        </view>
        <view class="confirm-card__actions">
          <button class="confirm-card__button confirm-card__button--ghost" hover-class="none" @click="cancelConfirm">
            {{ confirm.cancelText }}
          </button>
          <button class="confirm-card__button" :class="confirmButtonClass" hover-class="none" @click="acceptConfirm">
            {{ confirm.confirmText }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { usePageScrollLock } from "@/composables/usePageScrollLock";
import { dismissConfirm, submitConfirm, useConfirmState } from "@/feedback/confirm";

const confirm = useConfirmState();
const { setLocked: setPageLocked } = usePageScrollLock(Symbol("confirm"));

const confirmButtonClass = computed(() =>
  confirm.tone === "danger" ? "confirm-card__button--danger" : "confirm-card__button--primary"
);

watch(
  () => confirm.visible,
  (visible) => {
    setPageLocked(visible);
  },
  { immediate: true }
);

function handleMask() {
  if (!confirm.maskClosable) return;
  dismissConfirm();
}

function cancelConfirm() {
  dismissConfirm();
}

function acceptConfirm() {
  submitConfirm();
}
</script>

<style scoped lang="scss">
.confirm-layer {
  position: fixed;
  inset: 0;
  z-index: 1450;
}

.confirm-mask {
  position: absolute;
  inset: 0;
  background: var(--login-popup-backdrop-bg);
  opacity: 0;
  transition: opacity 220ms ease;
}

.confirm-mask--shown {
  opacity: 1;
}

.confirm-mask--leave,
.confirm-mask--enter {
  opacity: 0;
}

.confirm-shell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 48rpx;
}

.confirm-card {
  position: relative;
  width: 100%;
  max-width: 620rpx;
  overflow: hidden;
  border: 1rpx solid var(--color-border);
  border-radius: 0 0 var(--radius-xs) var(--radius-xs);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  opacity: 0;
  transform: translate3d(0, 20rpx, 0) scale(0.96);
  transition: opacity 240ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.confirm-card--shown {
  opacity: 1;
  transform: translate3d(0, 0, 0) scale(1);
}

.confirm-card--leave,
.confirm-card--enter {
  opacity: 0;
}

.confirm-card--leave {
  transform: translate3d(0, 14rpx, 0) scale(0.97);
  transition-duration: 180ms;
}

.confirm-card__glow {
  position: absolute;
  top: -56rpx;
  right: -48rpx;
  width: 400rpx;
  height: 208rpx;
  border-radius: 0 0 0 220rpx;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, var(--color-primary-soft) 100%);
  opacity: 0.82;
}

.confirm-card--danger .confirm-card__glow {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, var(--color-danger-soft) 100%);
}

.confirm-card__accent {
  position: relative;
  z-index: 1;
  height: 10rpx;
  background: linear-gradient(90deg, var(--color-primary) 0%, var(--theme-accent) 100%);
}

.confirm-card--danger .confirm-card__accent {
  background: linear-gradient(90deg, var(--color-danger) 0%, #f6ab62 100%);
}

.confirm-card__body {
  position: relative;
  z-index: 1;
  padding: 34rpx 34rpx 26rpx;
}

.confirm-card__title {
  display: block;
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
}

.confirm-card__content {
  display: block;
  margin-top: 16rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: var(--line-height-loose);
}

.confirm-card__actions {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 18rpx;
  padding: 0 34rpx 34rpx;
}

.confirm-card__button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 70rpx;
  border: 0;
  border-radius: var(--radius-pill);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.confirm-card__button--ghost {
  border: 1rpx solid var(--color-border);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
}

.confirm-card__button--primary {
  background: linear-gradient(
    135deg,
    var(--button-primary-gradient-start) 0%,
    var(--button-primary-gradient-end) 100%
  );
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow);
}

.confirm-card__button--danger {
  background: var(--color-danger-button-bg);
  color: var(--color-danger-button-text);
  box-shadow: 0 18rpx 32rpx var(--color-danger-soft);
}
</style>
