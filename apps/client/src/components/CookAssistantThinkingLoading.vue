<template>
  <view v-if="visible" class="cook-assistant-thinking-loading" aria-live="polite" @click="handleCancel">
    <view class="cook-assistant-thinking-loading__content" @click.stop>
      <view class="loader-con" aria-hidden="true">
        <view style="--i: 0;" class="pfile" />
        <view style="--i: 1;" class="pfile" />
        <view style="--i: 2;" class="pfile" />
        <view style="--i: 3;" class="pfile" />
        <view style="--i: 4;" class="pfile" />
        <view style="--i: 5;" class="pfile" />
      </view>
      <text :key="thinkingCopy" class="cook-assistant-thinking-loading__copy">{{ thinkingCopy }}...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  cancel: [];
}>();

function handleCancel() {
  emit("cancel");
}

const THINKING_COPY_INTERVAL_MS = 900;
const thinkingCopies = [
  "先看看",
  "这道菜怎么做",
  "食材准备中",
  "步骤理一理",
  "顺序排好了",
  "火候也照顾到",
  "每一步都接上",
  "让做饭更从容",
  "马上就可以开做啦"
];
const thinkingIndex = ref(0);
const thinkingCopy = computed(() => thinkingCopies[thinkingIndex.value] || thinkingCopies[0]);
let thinkingTimer: ReturnType<typeof setInterval> | null = null;

function stopThinkingCopy() {
  if (thinkingTimer) {
    clearInterval(thinkingTimer);
    thinkingTimer = null;
  }
}

function startThinkingCopy() {
  stopThinkingCopy();
  thinkingIndex.value = 0;
  thinkingTimer = setInterval(() => {
    thinkingIndex.value = (thinkingIndex.value + 1) % thinkingCopies.length;
  }, THINKING_COPY_INTERVAL_MS);
}

watch(
  () => props.visible,
  visible => {
    if (visible) {
      startThinkingCopy();
    } else {
      stopThinkingCopy();
    }
  },
  { immediate: true }
);

onBeforeUnmount(stopThinkingCopy);
</script>

<style scoped lang="scss">
.cook-assistant-thinking-loading {
  position: fixed;
  inset: 0;
  z-index: 1500;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-mask-medium);
  -webkit-backdrop-filter: var(--material-mask-filter);
  backdrop-filter: var(--material-mask-filter);
}

.cook-assistant-thinking-loading__content {
  display: flex;
  align-items: center;
  width: min(76vw, 560rpx);
  flex-direction: column;
  gap: 8rpx;
}

.loader-con {
  position: relative;
  width: 100%;
  height: 150rpx;
  overflow: hidden;
}

.pfile {
  position: absolute;
  bottom: 25rpx;
  width: 80rpx;
  height: 100rpx;
  background: linear-gradient(90deg, var(--button-primary-gradient-start), var(--button-primary-gradient-end));
  border-radius: 4rpx;
  transform-origin: center;
  animation: flyRight 5s ease-in-out infinite;
  opacity: 0;
}

.pfile::before {
  position: absolute;
  top: 12rpx;
  left: 12rpx;
  width: 56rpx;
  height: 8rpx;
  border-radius: 4rpx;
  background-color: var(--button-primary-text);
  content: "";
}

.pfile::after {
  position: absolute;
  top: 26rpx;
  left: 12rpx;
  width: 36rpx;
  height: 8rpx;
  border-radius: 4rpx;
  background-color: var(--button-primary-text);
  content: "";
}

.pfile {
  animation-delay: calc(var(--i) * 0.6s);
}

.cook-assistant-thinking-loading__copy {
  color: var(--color-primary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  line-height: 1.6;
  animation: thinkingCopy 900ms ease-in-out;
}

@keyframes flyRight {
  0% {
    left: -10%;
    transform: scale(0);
    opacity: 0;
  }

  50% {
    left: 45%;
    transform: scale(1.2);
    opacity: 1;
  }

  100% {
    left: 100%;
    transform: scale(0);
    opacity: 0;
  }
}

@keyframes thinkingCopy {
  0%,
  100% {
    transform: translateY(4rpx);
    opacity: 0.36;
  }

  35%,
  65% {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
