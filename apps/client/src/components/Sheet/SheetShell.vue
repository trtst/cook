<template>
  <view
    class="sheet-shell"
    :class="{ 'sheet-shell--visible': visible }"
    :style="shellStyle"
    @click.stop
    @touchmove.stop.prevent
  >
    <view class="sheet-shell__mask" @click.stop="handleMask" />
    <view class="sheet-shell__panel" :style="panelStyle" @click.stop>
      <slot :close="requestClose" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type StyleValue } from "vue";

const props = withDefaults(
  defineProps<{
    visible: boolean;
    zIndex?: number;
    panelStyle?: StyleValue;
    maskClosable?: boolean;
  }>(),
  {
    zIndex: 1300,
    panelStyle: undefined,
    maskClosable: true
  }
);

const emit = defineEmits<{
  close: [];
}>();

const shellStyle = computed(() => ({
  zIndex: String(props.zIndex)
}));

function requestClose() {
  emit("close");
}

function handleMask() {
  if (!props.maskClosable) return;
  requestClose();
}
</script>

<style scoped lang="scss">
.sheet-shell {
  position: fixed;
  inset: 0;
}

.sheet-shell__mask {
  position: absolute;
  inset: 0;
  background: var(--login-popup-backdrop-bg);
  -webkit-backdrop-filter: blur(10rpx) saturate(145%);
  backdrop-filter: blur(10rpx) saturate(145%);
  opacity: 0;
  transition: opacity 220ms ease;
}

.sheet-shell__panel {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  max-height: 82vh;
  padding: 34rpx 32rpx calc(42rpx + env(safe-area-inset-bottom));
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  background: linear-gradient(180deg, var(--color-surface) 0%, var(--color-page) 100%);
  box-shadow: 0 -12rpx 60rpx rgba(59, 40, 21, 0.12);
  overflow-y: auto;
  opacity: 0.98;
  transform: translateY(calc(100% + env(safe-area-inset-bottom)));
  transition:
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 260ms ease;
  will-change: transform, opacity;
}

.sheet-shell--visible .sheet-shell__mask {
  opacity: 1;
}

.sheet-shell--visible .sheet-shell__panel {
  opacity: 1;
  transform: translateY(0);
}
</style>
