<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="勋章详情" full-screen>
    <template #navbar-center>
      <text class="medal-navbar__title">勋章详情</text>
    </template>

    <Login v-if="!sessionStore.isLoggedIn" title="登录后查看勋章详情" description="勋章说明和获得状态只对你自己开放。" />

    <template v-else>
      <view class="detail-page">
        <scroll-view scroll-y class="detail-scroll" show-scrollbar="false">
          <view class="detail-scroll__body" :class="{ 'detail-scroll__body--with-footer': !!item }">
            <view v-if="errorText" class="notice" @click="loadDetail">{{ errorText }}</view>
            <view v-else-if="loading" class="notice">加载中...</view>

            <template v-else-if="item">
              <view class="hero-card" :class="{ 'hero-card--locked': !item.earned }">
                <view class="hero-card__badge-shell">
                  <view class="hero-card__badge">
                    <image v-if="resolveMedalImageUrl(item)" class="hero-card__image" :src="resolveMedalImageUrl(item) || ''" mode="aspectFit" />
                    <text v-else class="cookfont hero-card__icon" :class="getMedalIconClass(item.iconKey)" />
                  </view>
                  <view class="hero-card__badge-base" />
                </view>
                <text class="hero-card__name">{{ item.name }}</text>
                <view class="hero-card__meta">
                  <view class="hero-card__pill">{{ item.categoryName }}</view>
                  <view v-if="item.isLimited" class="hero-card__pill hero-card__pill--limited">限定</view>
                  <view class="hero-card__pill" :class="item.earned ? 'hero-card__pill--earned' : 'hero-card__pill--locked'">
                    {{ statusText }}
                  </view>
                  <SharePillButton />
                </view>
                <text class="hero-card__desc">{{ item.description }}</text>
              </view>
            </template>
          </view>
        </scroll-view>

        <view v-if="item" class="detail-footer">
          <view class="detail-footer__status">
            <text v-if="item.earned" class="detail-footer__value">- {{ earnedAtText }}获得 -</text>
            <text v-if="item.earnedUserCount > 0" class="detail-footer__hint">已有{{ item.earnedUserCount }}人获得。</text>
            <text v-if="showEarlyHint" class="detail-footer__tip">还没多少人拿到，快快去获取吧。</text>
          </view>
          <view class="detail-footer__notice" @click="openNotice">
            <text class="cookfont icon-qa" />
          </view>
        </view>

        <SheetShell v-if="item" :visible="noticeVisible" title="勋章说明" @close="closeNotice">
          <view class="sheet__body">
            <view class="sheet__row">
              <text class="sheet__label">获取条件</text>
              <text class="sheet__value">{{ item.condition }}</text>
            </view>
            <view class="sheet__row">
              <text class="sheet__label">所属类别</text>
              <text class="sheet__value">{{ item.categoryName }}</text>
            </view>
            <view v-if="item.isLimited" class="sheet__row">
              <text class="sheet__label">活动时间</text>
              <text class="sheet__value">{{ formatMedalRange(item) }}</text>
            </view>
            <view class="sheet__row">
              <text class="sheet__label">当前状态</text>
              <text class="sheet__value">{{ statusHint }}</text>
            </view>
          </view>
        </SheetShell>
      </view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { onLoad, onShow, onShareAppMessage } from "@dcloudio/uni-app";
import { medalApi, type UserMedalSummary } from "@/apis/medal";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import SharePillButton from "@/components/Share/SharePillButton.vue";
import { usePageScrollLock, usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSessionStore } from "@/stores/session";
import { formatMedalDate, formatMedalRange, formatMedalState, formatMedalStateHint, getMedalIconClass, resolveMedalImageUrl } from "@/pages_me/medal/present";

const pageStyle = usePageScrollStyle();
const { setLocked: setPageLocked } = usePageScrollLock(Symbol("medal-detail-sheet"));
const sessionStore = useSessionStore();
const loading = ref(false);
const errorText = ref("");
const medalCode = ref("");
const item = ref<UserMedalSummary | null>(null);
const noticeVisible = ref(false);

watch(
  () => noticeVisible.value,
  visible => {
    setPageLocked(visible);
  },
  { immediate: true }
);

const statusText = computed(() => (item.value ? formatMedalState(item.value) : "--"));
const statusHint = computed(() => (item.value ? formatMedalStateHint(item.value) : "--"));
const earnedAtText = computed(() => (item.value?.awardedAt ? formatMedalDate(item.value.awardedAt) : "--"));
const showEarlyHint = computed(() => Boolean(item.value && !item.value.earned && item.value.earnedUserCount < 10));

onLoad(query => {
  medalCode.value = typeof query?.code === "string" ? decodeURIComponent(query.code) : "";
});

onShow(() => {
  if (!sessionStore.isLoggedIn) return;
  void loadDetail();
});

onShareAppMessage(() => ({
  title: item.value?.name ? `${item.value.name} | 炊火记勋章` : "炊火记勋章",
  path: medalCode.value ? `/pages_me/medal-detail/index?code=${encodeURIComponent(medalCode.value)}` : "/pages_me/medal/index",
  imageUrl: item.value ? resolveMedalImageUrl(item.value) || undefined : undefined
}));

async function loadDetail() {
  if (!sessionStore.isLoggedIn || loading.value) return;
  if (!medalCode.value) {
    errorText.value = "勋章参数缺失";
    return;
  }

  loading.value = true;
  errorText.value = "";
  try {
    const wall = await medalApi.getCurrent();
    const current = wall.items.find(entry => entry.code === medalCode.value) ?? null;
    if (!current) {
      errorText.value = "勋章不存在或暂不可见";
      item.value = null;
      return;
    }
    item.value = current;
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "勋章加载失败";
  } finally {
    loading.value = false;
  }
}

function openNotice() {
  if (!item.value) return;
  noticeVisible.value = true;
}

function closeNotice() {
  noticeVisible.value = false;
}
</script>

<style scoped lang="scss">
.medal-navbar__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.detail-page {
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.detail-scroll {
  flex: 1;
  min-height: 0;
}

.detail-scroll__body {
  height: 100%;
}

.detail-scroll__body--with-footer {
  padding-bottom: calc(180rpx + env(safe-area-inset-bottom));
}

.notice,
.hero-card {
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.notice,
.hero-card {
  padding: var(--space-md);
}

.hero-card {
  padding-top: 100rpx;
  text-align: center;
  background: transparent;
}

.hero-card--locked {
  opacity: 0.82;
}

.hero-card__badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 500rpx;
  height: 500rpx;
  z-index: 1;
}

.hero-card__badge-shell {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
}

.hero-card__badge-base {
  width: 180rpx;
  height: 26rpx;
  margin-top: -22rpx;
  border-radius: 999rpx;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, var(--color-divider) 100%);
  box-shadow:
    0 8rpx 18rpx rgba(44, 35, 30, 0.06),
    inset 0 2rpx 6rpx rgba(255, 255, 255, 0.36);
  filter: blur(0.4rpx);
}

.hero-card--locked .hero-card__image,
.hero-card--locked .hero-card__icon {
  filter: grayscale(1);
}

.hero-card__icon {
  color: #fffdf5;
  font-size: 70rpx;
}

.hero-card__image {
  width: 100%;
  height: 100%;
}

.hero-card__name {
  display: block;
  margin-top: var(--space-md);
  color: var(--color-text);
  font-size: 42rpx;
  font-weight: var(--font-weight-semibold);
}

.hero-card__meta {
  display: flex;
  justify-content: center;
  gap: 24rpx;
  margin-top: var(--space-sm);
}

.hero-card__pill {
  height: 52rpx;
  line-height: 52rpx;
  padding: 0 18rpx;
  border-radius: var(--radius-xs);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: var(--font-size-xs);
}

.hero-card__pill--limited {
  background: var(--color-warning-soft);
  color: var(--color-warning-text);
}

.hero-card__pill--earned {
  background: var(--color-warning-soft);
  color: var(--color-warning-text);
}

.hero-card__pill--locked {
  background: var(--color-divider);
  color: var(--color-text-secondary);
}

.hero-card__desc,
.sheet__label,
.notice {
  color: var(--color-text-secondary);
}

.hero-card__desc {
  display: block;
  margin-top: var(--space-md);
  line-height: 1.7;
}

.sheet__row + .sheet__row {
  margin-top: var(--space-md);
}

.sheet__label {
  display: block;
  font-size: var(--font-size-xs);
}

.sheet__value,
.detail-footer__value {
  display: block;
  margin-top: 12rpx;
  color: var(--color-text);
  line-height: 1.7;
}

.detail-footer {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx var(--space-page) calc(24rpx + env(safe-area-inset-bottom));
  background: var(--color-surface);
  box-shadow: var(--shadow-floating);
  -webkit-backdrop-filter: blur(12rpx);
  backdrop-filter: blur(12rpx);
}

.detail-footer__status {
  min-width: 0;
  text-align: center;
}

.detail-footer__value {
  margin-top: 0;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.detail-footer__hint {
  display: block;
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.detail-footer__tip {
  display: block;
  margin-top: 6rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.detail-footer__notice {
  position: absolute;
  top: 50%;
  right: var(--space-page);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  color: var(--color-divider);
  font-size: 36rpx;
  transform: translateY(calc(-50% - env(safe-area-inset-bottom) / 2));
}

@media (max-width: 420px) {
  .detail-footer__notice {
    width: 68rpx;
    height: 68rpx;
  }
}

.sheet__body {
  padding-top: 0;
}
</style>
