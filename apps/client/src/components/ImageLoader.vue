<template>
  <view class="image-loader">
    <ImageEmpty v-if="stage === 'empty'" class="image-loader__empty" ratio="fill" />

    <template v-else>
      <view v-if="stage === 'loading'" class="image-loader__loading">
        <view class="loader" />
      </view>
      <image
        :key="imageSrc"
        class="image-loader__image"
        :class="{ 'image-loader__image--loaded': stage === 'loaded' }"
        :src="imageSrc"
        mode="aspectFill"
        @load="markLoaded"
      />
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ImageEmpty from "@/components/ImageEmpty.vue";
import { imageStage } from "./image-stage";

const props = withDefaults(defineProps<{
  src?: string | null;
}>(), {
  src: ""
});

const loadedSrc = ref("");
const imageSrc = computed(() => props.src ?? "");

watch(
  () => props.src,
  () => {
    loadedSrc.value = "";
  },
  { flush: "sync" }
);

const stage = computed(() => imageStage(imageSrc.value, loadedSrc.value));

function markLoaded() {
  loadedSrc.value = imageSrc.value;
}
</script>

<style scoped lang="scss">
.image-loader {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--page-cover-fresh-bg);
}

.image-loader__empty,
.image-loader__image {
  display: block;
  width: 100%;
  height: 100%;
}

.image-loader__loading {
  position: absolute;
  z-index: 1;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--page-cover-fresh-bg);
  pointer-events: none;
}

.image-loader__image {
  opacity: 0;
  transition: opacity 180ms ease;
}

.image-loader__image--loaded {
  opacity: 1;
}

.loader {
  position: relative;
  width: 128rpx;
  height: 128rpx;
  overflow: hidden;
  border-radius: var(--radius-xs);
  background: var(--color-surface);
}

.loader::before {
  position: absolute;
  bottom: 20px;
  left: 5px;
  width: 80rpx;
  height: 80rpx;
  content: "";
  border-radius: var(--radius-xs);
  background: var(--color-primary-selected);
  box-shadow: 50rpx -30rpx 0 4rpx var(--color-primary-active);
  transform: rotate(45deg) translate(30%, 40%);
  animation: image-loader-slide 2s infinite ease-in-out alternate;
}

.loader::after {
  position: absolute;
  top: 20rpx;
  left: 20rpx;
  width: 32rpx;
  height: 32rpx;
  content: "";
  border-radius: 50%;
  background: var(--theme-secondary);
  transform: rotate(0deg);
  transform-origin: 70rpx 290rpx;
  animation: image-loader-rotate 2s infinite ease-in-out;
}

@keyframes image-loader-slide {
  0%,
  100% {
    bottom: -70rpx;
  }

  25%,
  75% {
    bottom: -4rpx;
  }

  20%,
  80% {
    bottom: 4rpx;
  }
}

@keyframes image-loader-rotate {
  0% {
    transform: rotate(-15deg);
  }

  25%,
  75% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(25deg);
  }
}
</style>
