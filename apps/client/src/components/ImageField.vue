<template>
  <view
    class="image-field"
    :class="[
      `image-field--${variant}`,
      imageSrc ? 'image-field--filled' : 'image-field--empty',
      { 'image-field--tap': selectOnTap }
    ]"
    @click="handleFieldClick"
  >
    <ImageLoader v-if="imageSrc" class="image-field__preview" :src="imageSrc" />

    <template v-if="imageSrc">
      <button class="image-field__action" @click.stop="emitSelect">{{ buttonText }}</button>
      <text v-if="clearable" class="image-field__clear" @click.stop="emitClear">{{ clearText }}</text>
    </template>

    <template v-else>
      <view class="image-field__empty" @click.stop="emitSelect">
        <ImageEmpty v-if="variant === 'cover'" class="image-field__empty-cover" copy="封面图" ratio="fill" />
        <text v-else-if="showPlus" class="cookfont icon-add image-field__plus" />
        <text class="image-field__title">{{ title }}</text>
        <text v-if="description" class="image-field__desc">{{ description }}</text>
      </view>
      <button v-if="showIdleButton" class="image-field__action" @click.stop="emitSelect">{{ buttonText }}</button>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import ImageEmpty from "@/components/ImageEmpty.vue";
import ImageLoader from "@/components/ImageLoader.vue";

type ImageFieldVariant = "cover" | "card";

const props = withDefaults(defineProps<{
  imageSrc?: string;
  variant?: ImageFieldVariant;
  title: string;
  description?: string;
  buttonText: string;
  clearText?: string;
  clearable?: boolean;
}>(), {
  imageSrc: "",
  variant: "card",
  description: "",
  clearText: "删除",
  clearable: true
});

const emit = defineEmits<{
  select: [];
  clear: [];
}>();

const selectOnTap = computed(() => props.variant === "card" || !props.imageSrc);
const showPlus = computed(() => props.variant === "card");
const showIdleButton = computed(() => props.variant === "cover");

function emitSelect() {
  emit("select");
}

function emitClear() {
  emit("clear");
}

function handleFieldClick() {
  if (!selectOnTap.value) return;
  emitSelect();
}
</script>

<style scoped lang="scss">
.image-field {
  position: relative;
  overflow: hidden;
}

.image-field--tap {
  cursor: pointer;
}

.image-field__preview {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.image-field__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.image-field__title,
.image-field__desc,
.image-field__plus {
  display: block;
}

.image-field--cover {
  border-radius: 0;
  box-shadow: none;
}

.image-field--cover.image-field--empty {
  height: 75vw;
  min-height: 0;
  max-height: 660rpx;
  background: var(--page-cover-fresh-shell-bg);
}

.image-field--cover.image-field--filled {
  height: 75vw;
  min-height: 420rpx;
  max-height: 660rpx;
}

.image-field--cover .image-field__preview {
  display: block;
  height: 100%;
}

.image-field--cover .image-field__empty {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}

.image-field--cover .image-field__empty-cover {
  width: 100%;
  height: 100%;
}

.image-field--cover .image-field__title {
  display: none;
  color: var(--color-text);
  font-size: 34rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.2;
}

.image-field--cover .image-field__desc {
  display: none;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.image-field--cover .image-field__action {
  position: absolute;
  left: var(--space-page);
  bottom: calc(var(--space-page) + 20rpx);
}

.image-field--cover .image-field__clear {
  position: absolute;
  right: var(--space-page);
  bottom: calc(var(--space-page) + 8rpx);
}

.image-field--card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  align-content: center;
  gap: 10rpx;
  min-height: 300rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  text-align: center;
}

.image-field--card.image-field--filled {
  align-items: flex-end;
  justify-content: flex-start;
  align-content: flex-end;
  padding: 22rpx;
  text-align: left;
}

.image-field--card .image-field__plus {
  font-size: 36rpx;
  font-weight: var(--font-weight-medium);
  color: inherit;
}

.image-field--card .image-field__title {
  font-size: 30rpx;
  font-weight: var(--font-weight-medium);
  color: inherit;
}

.image-field--card .image-field__desc {
  width: 100%;
  margin-top: 4rpx;
  font-size: 24rpx;
}

.image-field--card .image-field__action {
  position: absolute;
  left: 22rpx;
  bottom: 22rpx;
}

.image-field--card .image-field__clear {
  position: absolute;
  right: 22rpx;
  bottom: 30rpx;
}

.image-field__action {
  z-index: 19;
  height: 50rpx;
  padding: 0 15rpx;
  border: 0;
  border-radius: var(--radius-xs);
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  font-size: 20rpx;
  line-height: 50rpx;
  box-shadow: var(--button-primary-shadow);
  -webkit-backdrop-filter: var(--button-primary-filter);
  backdrop-filter: var(--button-primary-filter);
}

.image-field__action::after {
  border: 0;
}

.image-field__clear {
  z-index: 1;
  color: var(--color-text-inverse);
  font-size: 24rpx;
  line-height: 1.4;
  text-shadow: 0 2rpx 10rpx var(--color-shadow-overlay);
}
</style>
