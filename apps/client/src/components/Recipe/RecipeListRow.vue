<template>
  <view class="recipe-list-row" @click="emit('click')">
    <view class="recipe-list-row__cover">
      <ImageLoader class="recipe-list-row__cover-image" :src="coverImageUrl" />
    </view>
    <view class="recipe-list-row__main">
      <text class="recipe-list-row__title">{{ title }}</text>
      <text v-if="meta" class="recipe-list-row__meta">{{ meta }}</text>
      <view v-if="$slots.footer" class="recipe-list-row__footer">
        <slot name="footer" />
      </view>
    </view>
    <view v-if="$slots.tail" class="recipe-list-row__tail">
      <slot name="tail" />
    </view>
  </view>
</template>

<script setup lang="ts">
import ImageLoader from "@/components/ImageLoader.vue";

withDefaults(defineProps<{
  title: string;
  coverImageUrl: string | null;
  meta?: string;
}>(), {
  meta: ""
});

const emit = defineEmits<{
  click: [];
}>();
</script>

<style scoped lang="scss">
.recipe-list-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.recipe-list-row__cover {
  flex: 0 0 208rpx;
  width: 208rpx;
  overflow: hidden;
  aspect-ratio: 4 / 3;
  background: var(--page-cover-fresh-bg);
}

.recipe-list-row__cover-image {
  display: block;
  width: 100%;
  height: 100%;
}

.recipe-list-row__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.recipe-list-row__title,
.recipe-list-row__meta {
  display: block;
}

.recipe-list-row__title {
  display: -webkit-box;
  overflow: hidden;
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.recipe-list-row__meta {
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.recipe-list-row__footer {
  margin-top: 12rpx;
}

.recipe-list-row__tail {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
}

</style>
