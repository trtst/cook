<template>
  <view
    class="sheet-shell"
    :class="{ 'sheet-shell--visible': visible }"
    :style="shellStyle"
  >
    <view class="sheet-shell__mask" @click.stop="handleMask" />
    <view
      class="sheet-shell__panel"
      :style="panelStyle"
      @click.stop
      @transitionend="handlePanelTransitionEnd"
    >
      <view v-if="showHeaderBar" class="sheet-shell__header">
        <view class="sheet-shell__header-main">
          <view class="sheet-shell__title-row">
            <view class="sheet-shell__title-main">
              <text v-if="title" class="sheet-shell__title">{{ title }}</text>
              <slot name="title-extra" />
            </view>
            <text
              v-if="showClose"
              class="cookfont icon-close sheet-shell__close"
              @click.stop="requestClose"
            />
          </view>
          <text v-if="subtitle" class="sheet-shell__subtitle">{{ subtitle }}</text>
        </view>
      </view>
      <view
        class="sheet-shell__body"
        :class="{
          'sheet-shell__body--flush': bodyPadding === 'none',
          'sheet-shell__body--safe': !hasFooter
        }"
      >
        <slot :close="requestClose" />
      </view>
      <view v-if="hasFooter" class="sheet-shell__footer">
        <slot name="footer" :close="requestClose" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, useSlots, watch, type StyleValue } from "vue";

const props = withDefaults(
  defineProps<{
    visible: boolean;
    title?: string;
    subtitle?: string;
    showHeader?: boolean;
    showClose?: boolean;
    bodyPadding?: "default" | "none";
    zIndex?: number;
    panelStyle?: StyleValue;
    maskClosable?: boolean;
  }>(),
  {
    title: "",
    subtitle: "",
    showHeader: true,
    showClose: true,
    bodyPadding: "default",
    zIndex: 1300,
    panelStyle: undefined,
    maskClosable: true
  }
);

const emit = defineEmits<{
  close: [];
  afterClose: [];
}>();

const slots = useSlots();
const closing = ref(false);

const shellStyle = computed(() => ({
  zIndex: String(props.zIndex)
}));
const hasFooter = computed(() => Boolean(slots.footer));
const showHeaderBar = computed(() => {
  if (!props.showHeader) return false;
  return Boolean(props.title || props.subtitle || props.showClose || slots["title-extra"]);
});

watch(
  () => props.visible,
  (nextVisible, previousVisible) => {
    if (previousVisible && !nextVisible) {
      closing.value = true;
      return;
    }
    if (nextVisible) {
      closing.value = false;
    }
  }
);

function requestClose() {
  emit("close");
}

function handleMask() {
  if (!props.maskClosable) return;
  requestClose();
}

function handlePanelTransitionEnd(event: Event) {
  if (event.target !== event.currentTarget || props.visible || !closing.value) return;
  closing.value = false;
  emit("afterClose");
}
</script>

<style scoped lang="scss">
.sheet-shell {
  position: fixed;
  inset: 0;
  pointer-events: none;
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
  display: flex;
  flex-direction: column;
  max-height: 82vh;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  background: linear-gradient(180deg, var(--color-surface) 0%, var(--color-page) 100%);
  box-shadow: 0 -12rpx 60rpx rgba(59, 40, 21, 0.12);
  overflow: hidden;
  opacity: 0.98;
  transform: translateY(calc(100% + env(safe-area-inset-bottom)));
  transition:
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 260ms ease;
  will-change: transform, opacity;
}

.sheet-shell__header,
.sheet-shell__body,
.sheet-shell__footer {
  padding-right: 32rpx;
  padding-left: 32rpx;
}

.sheet-shell__header {
  flex: 0 0 auto;
  padding-top: 34rpx;
}

.sheet-shell__header-main {
  min-width: 0;
}

.sheet-shell__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  min-width: 0;
}

.sheet-shell__title-main {
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-width: 0;
  flex: 1;
}

.sheet-shell__title {
  color: var(--color-text);
  font-size: 38rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.2;
}

.sheet-shell__subtitle {
  display: block;
  margin-top: 10rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.sheet-shell__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 30rpx;
}

.sheet-shell__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding-top: 24rpx;
}

.sheet-shell__body--safe {
  padding-bottom: calc(42rpx + env(safe-area-inset-bottom));
}

.sheet-shell__body--flush {
  padding-right: 0;
  padding-left: 0;
}

.sheet-shell__footer {
  flex: 0 0 auto;
  padding-top: 30rpx;
  padding-bottom: calc(42rpx + env(safe-area-inset-bottom));
}

.sheet-shell__header + .sheet-shell__body {
  padding-top: 0;
}

.sheet-shell:not(.sheet-shell--visible) .sheet-shell__footer,
.sheet-shell:not(.sheet-shell--visible) .sheet-shell__body,
.sheet-shell:not(.sheet-shell--visible) .sheet-shell__header {
  pointer-events: none;
}

.sheet-shell--visible {
  pointer-events: auto;
}

.sheet-shell--visible .sheet-shell__mask {
  opacity: 1;
}

.sheet-shell--visible .sheet-shell__panel {
  opacity: 1;
  transform: translateY(0);
}
</style>
