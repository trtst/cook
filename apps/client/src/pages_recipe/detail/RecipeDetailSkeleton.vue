<template>
  <view class="recipe-detail-skeleton">
    <view class="recipe-detail-skeleton__cover">
      <Skeleton width="100%" height="100%" radius="0" />
    </view>

    <view class="recipe-detail-skeleton__body">
      <view class="recipe-detail-skeleton__summary">
        <Skeleton width="68%" height="56rpx" radius="12rpx" />
        <Skeleton width="92%" height="28rpx" radius="8rpx" />
        <Skeleton width="44%" height="26rpx" radius="var(--radius-xs)" />
        <view class="recipe-detail-skeleton__info">
          <Skeleton width="28%" height="60rpx" radius="12rpx" />
          <Skeleton width="28%" height="60rpx" radius="12rpx" />
          <Skeleton width="28%" height="60rpx" radius="12rpx" />
        </view>
      </view>

      <view class="recipe-detail-skeleton__section">
        <view class="recipe-detail-skeleton__section-head">
          <Skeleton width="24%" height="34rpx" radius="8rpx" />
          <Skeleton width="16%" height="26rpx" radius="8rpx" />
        </view>
        <view class="recipe-detail-skeleton__ingredient-list">
          <view v-for="index in 5" :key="`ingredient-${index}`" class="recipe-detail-skeleton__ingredient-row">
            <Skeleton width="42%" height="28rpx" radius="8rpx" />
            <Skeleton width="18%" height="28rpx" radius="8rpx" />
          </view>
        </view>
      </view>

      <view class="recipe-detail-skeleton__section">
        <view class="recipe-detail-skeleton__section-head">
          <Skeleton width="16%" height="34rpx" radius="8rpx" />
          <Skeleton width="16%" height="26rpx" radius="8rpx" />
        </view>
        <view class="recipe-detail-skeleton__nutrition">
          <Skeleton width="180rpx" height="180rpx" radius="50%" />
          <Skeleton width="42%" height="112rpx" radius="12rpx" />
        </view>
      </view>

      <view class="recipe-detail-skeleton__section recipe-detail-skeleton__steps">
        <view class="recipe-detail-skeleton__section-head">
          <Skeleton width="16%" height="34rpx" radius="8rpx" />
          <Skeleton width="16%" height="26rpx" radius="8rpx" />
        </view>
        <view v-for="index in 2" :key="`step-${index}`" class="recipe-detail-skeleton__step-card">
          <Skeleton width="100%" height="180rpx" radius="20rpx" />
          <Skeleton width="86%" height="30rpx" radius="8rpx" />
          <Skeleton width="58%" height="30rpx" radius="8rpx" />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import Skeleton from "@/components/Skeleton/Skeleton.vue";
</script>

<style scoped lang="scss">
.recipe-detail-skeleton {
  height: 100%;
  overflow: hidden;
  background: var(--page-ambient-duo-bg);
}

.recipe-detail-skeleton__cover {
  position: relative;
  height: 0;
  padding-top: 75%;
  background: var(--color-surface);
}

.recipe-detail-skeleton__cover > .skeleton {
  position: absolute;
  inset: 0;
}

.recipe-detail-skeleton__body {
  position: relative;
  min-height: 100%;
  margin-top: -54rpx;
  padding: 32rpx 0 max(48rpx, env(safe-area-inset-bottom));
  border-radius: 36rpx 36rpx 0 0;
  background: var(--color-surface);
}

.recipe-detail-skeleton__summary,
.recipe-detail-skeleton__section {
  margin: 0 var(--space-page);
}

.recipe-detail-skeleton__summary {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.recipe-detail-skeleton__info {
  display: flex;
  justify-content: space-between;
  gap: 12rpx;
  margin-top: 30rpx;
  padding-bottom: 20rpx;
}

.recipe-detail-skeleton__info > .skeleton {
  justify-content: center;
}

.recipe-detail-skeleton__section {
  margin-top: 48rpx;
}

.recipe-detail-skeleton__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
}

.recipe-detail-skeleton__ingredient-list {
  margin-top: 24rpx;
}

.recipe-detail-skeleton__ingredient-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  padding: 18rpx 0;
  border-bottom: 1rpx solid var(--color-border-light);
}

.recipe-detail-skeleton__nutrition {
  display: flex;
  align-items: center;
  gap: 28rpx;
  margin-top: 24rpx;
}

.recipe-detail-skeleton__step-card {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 24rpx;
}
</style>
