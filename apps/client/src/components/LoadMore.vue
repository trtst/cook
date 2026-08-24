<template>
  <view v-if="isVisible" class="load-more-footer">
    <text
      class="load-more-footer__text"
      :class="{ 'load-more-footer__text--action': isAction }"
      @click="handleClick"
    >
      {{ currentText }}
    </text>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{
  loading: boolean;
  hasNext: boolean;
  showDone?: boolean;
  actionMode?: "scroll" | "tap";
  nextText?: string;
  loadingText?: string;
  doneText?: string;
}>(), {
  showDone: false,
  actionMode: "scroll",
  nextText: "再往上翻翻，还有更多内容",
  loadingText: "别急，正在帮你接着找",
  doneText: "已经翻到底啦"
});

const emit = defineEmits<{
  click: [];
}>();

const isVisible = computed(() => props.loading || props.hasNext || props.showDone);
const isAction = computed(() => !props.loading && props.hasNext && props.actionMode === "tap");
const currentText = computed(() => {
  if (props.loading) return props.loadingText;
  return props.hasNext ? props.nextText : props.doneText;
});

function handleClick() {
  if (!isAction.value) return;
  emit("click");
}
</script>

<style scoped lang="scss">
.load-more-footer {
  display: flex;
  grid-column: 1 / -1;
  justify-content: center;
  width: 100%;
  padding: 28rpx 0 36rpx;
  box-sizing: border-box;
}

.load-more-footer__text {
  font-size: 24rpx;
  line-height: 1.6;
  color: #8c8c8c;
}

.load-more-footer__text--action {
  color: #5f6f52;
}
</style>
