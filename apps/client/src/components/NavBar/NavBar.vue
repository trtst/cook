<template>
  <view class="navbar">
    <view
      class="navbar__fixed"
      :class="{ 'navbar__fixed--static': !fixed, 'navbar__fixed--transparent': transparent }"
      :style="fixedStyle"
    >
      <view class="navbar__status" :style="statusStyle" />
      <view class="navbar__inner" :style="innerStyle">
        <view class="navbar__side" :class="{ 'navbar__side--custom-left': isCustomLeft && !showLeft && hasLeftSlot }">
          <view
            v-if="showLeft"
            class="cookfont icon-back navbar__icon"
            hover-class="navbar__icon--hover"
            hover-stay-time="100"
            @click="handleLeftClick"
          />
          <slot v-else name="left" />
        </view>

        <view class="navbar__center">
          <slot>
            <text class="navbar__title">{{ title }}</text>
          </slot>
        </view>

        <view
          class="navbar__side navbar__side--right"
          :class="{
            'navbar__side--custom-right': isCustomLeft && hasRightSlot,
            'navbar__side--slot-right': hasRightSlot
          }"
        >
          <slot name="right" />
        </view>
      </view>
    </view>
    <view v-if="fixed && placeholder" class="navbar__placeholder" :style="placeholderStyle" />
  </view>
</template>

<script setup lang="ts">
import { computed, useSlots } from "vue";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";

const props = withDefaults(
  defineProps<{
    title?: string;
    showLeft?: boolean;
    fixed?: boolean;
    placeholder?: boolean;
    transparent?: boolean;
    backgroundOpacity?: number;
    layout?: "title" | "custom-left";
  }>(),
  {
    title: "",
    showLeft: true,
    fixed: true,
    placeholder: true,
    transparent: false,
    backgroundOpacity: 1,
    layout: "title"
  }
);

const { navBarHeight, navBarTotalHeight, navSideGuardWidth, systemInfo } = useSystemInfo();
const slots = useSlots();

const canGoBack = computed(() => getCurrentPages().length > 1);
const hasLeftSlot = computed(() => Boolean(slots.left));
const hasRightSlot = computed(() => Boolean(slots.right));
const isCustomLeft = computed(() => props.layout === "custom-left");

const fixedStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`
}));

const statusStyle = computed(() => ({
  height: `${systemInfo.value.statusBarHeight}px`
}));

const innerStyle = computed(() => ({
  "--navbar-side-width": `${navSideGuardWidth.value}px`,
  "--navbar-capsule-width": `${navSideGuardWidth.value}px`,
  height: `${navBarHeight.value}px`
}));

const placeholderStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`
}));

function handleLeftClick() {
  if (canGoBack.value) {
    void uniPlatform.navigation.navigateBack();
    return;
  }

  void uniPlatform.navigation.switchTab("/pages/home/index");
}
</script>

<style scoped lang="scss">
.navbar__fixed {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 800;
  overflow: hidden;
  background: var(--color-page);
}

.navbar__fixed--static {
  position: relative;
}

.navbar__fixed--transparent {
  background: transparent;
}

:global(.theme-dark) .navbar__fixed--transparent {
  background: var(--color-surface-mask-strong);
}

.navbar__inner {
  --navbar-side-width: 44px;

  display: flex;
  align-items: center;
  padding: 0 var(--space-page);
}

.navbar__side {
  display: flex;
  flex: 0 0 var(--navbar-side-width);
  align-items: center;
  width: var(--navbar-side-width);
  min-width: var(--navbar-side-width);
}

.navbar__side--custom-left {
  flex: 1 1 auto;
  width: auto;
  min-width: 0;
}

.navbar__side--right {
  justify-content: flex-end;
}

.navbar__side--slot-right {
  flex: 0 0 auto;
  width: auto;
  min-width: 0;
  padding-right: var(--navbar-capsule-width);
}

.navbar__side--custom-right {
  flex: 0 0 auto;
  width: auto;
  min-width: 0;
}

.navbar__center {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.navbar__title {
  overflow: hidden;
  max-width: 420rpx;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: 700;
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.navbar__icon {
  display: flex;
  align-items: center;
  width: 64rpx;
  height: 64rpx;
  color: var(--color-text);
  line-height: 1;
}

.navbar__icon--hover {
  opacity: 0.68;
}
</style>
