<template>
  <view class="navbar">
    <view
      class="navbar__fixed"
      :class="{ 'navbar__fixed--static': !fixed, 'navbar__fixed--transparent': transparent }"
      :style="fixedStyle"
    >
      <view class="navbar__status" :style="statusStyle" />
      <view class="navbar__inner" :style="innerStyle">
        <view class="navbar__side" :class="{ 'navbar__side--hidden': !showLeft }">
          <view
            v-if="showLeft"
            class="cookfont navbar__icon"
            :class="leftIconClass"
            hover-class="navbar__icon--hover"
            hover-stay-time="100"
            @click="handleLeftClick"
          />
        </view>

        <view class="navbar__center">
          <slot v-if="customCenter" />
          <text v-else-if="title" class="navbar__title">{{ title }}</text>
        </view>

        <view
          class="navbar__side navbar__side--right"
          :class="{
            'navbar__side--capsule': useCapsuleRight
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
import { computed } from "vue";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";

const props = withDefaults(
  defineProps<{
    // 普通标题文本。没有传默认 slot 时展示；传了默认 slot 时由调用方完全接管中间内容。
    title?: string;
    // 是否显示左侧区域。false 时左侧 side 整体折叠为 0，不保留图标宽度。
    showLeft?: boolean;
    // 是否固定在页面顶部。false 时导航栏按普通文档流占位。
    fixed?: boolean;
    // fixed=true 时是否额外渲染等高占位，避免页面内容顶到导航栏下方。
    placeholder?: boolean;
    // 是否使用透明背景，常用于首页、详情页这类有顶部封面或渐变背景的页面。
    transparent?: boolean;
    // 导航栏背景透明度。当前预留给滚动渐变类页面使用，实际背景色仍由样式层控制。
    backgroundOpacity?: number;
    // 是否显式避让微信右上角胶囊。只在小程序端生效，会把右侧 side 宽度改为胶囊宽度。
    capsuleGuard?: boolean;
    // 是否由默认 slot 接管中间区域。小程序端不能可靠依赖 $slots 判断 fallback。
    customCenter?: boolean;
  }>(),
  {
    title: "",
    showLeft: true,
    fixed: true,
    placeholder: true,
    transparent: false,
    backgroundOpacity: 1,
    capsuleGuard: false,
    customCenter: false
  }
);

const { navBarHeight, navBarTotalHeight, navCapsuleWidth, systemInfo } = useSystemInfo();

const canGoBack = computed(() => getCurrentPages().length > 1);
const leftIconClass = computed(() => (canGoBack.value ? "icon-back" : "icon-homepage"));
const isMiniProgram = computed(() => uniPlatform.system.getRuntimeChannel() === "mini_program");
const useCapsuleRight = computed(() => isMiniProgram.value && props.capsuleGuard);

const fixedStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`
}));

const statusStyle = computed(() => ({
  height: `${systemInfo.value.statusBarHeight}px`
}));

const innerStyle = computed(() => ({
  "--navbar-capsule-width": `${navCapsuleWidth.value}px`,
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
  --navbar-side-width: 64rpx;
  --navbar-capsule-width: 44px;

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

.navbar__side--right {
  justify-content: flex-end;
}

.navbar__side--capsule {
  flex-basis: var(--navbar-capsule-width);
  width: var(--navbar-capsule-width);
  min-width: var(--navbar-capsule-width);
}

.navbar__side--hidden {
  flex-basis: 0;
  width: 0;
  min-width: 0;
  overflow: hidden;
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
