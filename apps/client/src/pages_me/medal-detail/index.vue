<template>
  <page-meta :page-style="pageStyle" />
  <Layout :title="item?.name || '勋章详情'" full-screen>
    <Login v-if="!sessionStore.isLoggedIn" title="登录后查看勋章详情" description="勋章说明和获得状态只对你自己开放。" />

    <template v-else>
      <view v-if="errorText" class="notice" @click="loadDetail">{{ errorText }}</view>
      <view v-else-if="loading" class="notice">加载中...</view>

      <template v-else-if="item">
        <view class="detail-page">
          <view class="hero-card" :class="{ 'hero-card--locked': !item.earned }">
            <view class="hero-card__badge">
              <text class="cookfont hero-card__icon" :class="getMedalIconClass(item.iconKey)" />
            </view>
            <text class="hero-card__name">{{ item.name }}</text>
            <view class="hero-card__meta">
              <text class="hero-card__pill">{{ item.categoryName }}</text>
              <text v-if="item.isLimited" class="hero-card__pill hero-card__pill--limited">限定</text>
            </view>
            <text class="hero-card__desc">{{ item.description }}</text>
          </view>

          <view class="info-card">
            <view class="info-row">
              <text class="info-row__label">获取条件</text>
              <text class="info-row__value">{{ item.condition }}</text>
            </view>
            <view class="info-row">
              <text class="info-row__label">所属类别</text>
              <text class="info-row__value">{{ item.categoryName }}</text>
            </view>
            <view v-if="item.isLimited" class="info-row">
              <text class="info-row__label">活动时间</text>
              <text class="info-row__value">{{ formatMedalRange(item) }}</text>
            </view>
          </view>
        </view>

        <view class="detail-footer">
          <view class="detail-footer__status">
            <text class="detail-footer__label">获得状态</text>
            <text class="detail-footer__value">{{ footerText }}</text>
          </view>
          <view class="detail-footer__notice" @click="openNotice">
            <text class="cookfont icon-notice" />
          </view>
        </view>

        <SheetShell v-if="showNoticeSheet" :visible="noticeVisible" @close="closeNotice">
          <template #default="{ close }">
            <view class="sheet">
              <view class="sheet__head">
                <text class="sheet__title">勋章说明</text>
                <text class="cookfont icon-close sheet__close" @click="close" />
              </view>
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
                  <text class="sheet__label">获得时间</text>
                  <text class="sheet__value">{{ item.earned ? formatMedalDate(item.awardedAt) : "尚未获得" }}</text>
                </view>
              </view>
            </view>
          </template>
        </SheetShell>
      </template>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { medalApi, type UserMedalSummary } from "@/apis/medal";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSessionStore } from "@/stores/session";
import { formatMedalDate, formatMedalRange, getMedalIconClass } from "@/pages_me/medal/present";

const pageStyle = usePageScrollStyle();
const sessionStore = useSessionStore();
const loading = ref(false);
const errorText = ref("");
const medalCode = ref("");
const item = ref<UserMedalSummary | null>(null);
const showNoticeSheet = ref(false);
const noticeVisible = ref(false);
let noticeTimer: ReturnType<typeof setTimeout> | null = null;

const footerText = computed(() => {
  if (!item.value) return "--";
  return item.value.earned ? `${formatMedalDate(item.value.awardedAt)} 获得` : "尚未获得";
});

onLoad(query => {
  medalCode.value = typeof query?.code === "string" ? decodeURIComponent(query.code) : "";
});

onShow(() => {
  if (!sessionStore.isLoggedIn) return;
  void loadDetail();
});

onBeforeUnmount(() => {
  if (noticeTimer) {
    clearTimeout(noticeTimer);
    noticeTimer = null;
  }
});

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
  if (noticeTimer) {
    clearTimeout(noticeTimer);
    noticeTimer = null;
  }
  showNoticeSheet.value = true;
  setTimeout(() => {
    noticeVisible.value = true;
  }, 16);
}

function closeNotice() {
  noticeVisible.value = false;
  if (noticeTimer) {
    clearTimeout(noticeTimer);
  }
  noticeTimer = setTimeout(() => {
    showNoticeSheet.value = false;
    noticeTimer = null;
  }, 260);
}
</script>

<style scoped lang="scss">
.detail-page {
  padding: 0 0 calc(164rpx + env(safe-area-inset-bottom));
}

.notice,
.hero-card,
.info-card {
  margin: var(--space-md) var(--space-page) 0;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.notice,
.hero-card,
.info-card {
  padding: var(--space-md);
}

.hero-card {
  text-align: center;
  background:
    radial-gradient(circle at top right, rgba(255, 210, 126, 0.26), transparent 42%),
    linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-muted) 100%);
}

.hero-card--locked {
  opacity: 0.82;
}

.hero-card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 180rpx;
  height: 180rpx;
  border-radius: 999rpx;
  background:
    radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.92), transparent 36%),
    linear-gradient(160deg, rgba(255, 211, 125, 0.96) 0%, rgba(215, 149, 42, 0.94) 100%);
  box-shadow: inset 0 0 0 6rpx rgba(255, 255, 255, 0.5);
}

.hero-card--locked .hero-card__badge {
  background: linear-gradient(160deg, rgba(220, 224, 230, 0.95) 0%, rgba(174, 182, 194, 0.92) 100%);
}

.hero-card__icon {
  color: #fffdf5;
  font-size: 70rpx;
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
  gap: 12rpx;
  margin-top: var(--space-sm);
}

.hero-card__pill {
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: var(--font-size-xs);
}

.hero-card__pill--limited {
  background: rgba(255, 214, 133, 0.28);
  color: #9a6114;
}

.hero-card__desc,
.info-row__label,
.detail-footer__label,
.sheet__label,
.notice {
  color: var(--color-text-secondary);
}

.hero-card__desc {
  display: block;
  margin-top: var(--space-md);
  line-height: 1.7;
}

.info-row + .info-row,
.sheet__row + .sheet__row {
  margin-top: var(--space-md);
}

.info-row__label,
.sheet__label {
  display: block;
  font-size: var(--font-size-xs);
}

.info-row__value,
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
  justify-content: space-between;
  gap: var(--space-md);
  padding: 24rpx var(--space-page) calc(24rpx + env(safe-area-inset-bottom));
  background: rgba(255, 253, 248, 0.96);
  box-shadow: 0 -10rpx 32rpx rgba(59, 40, 21, 0.08);
  -webkit-backdrop-filter: blur(12rpx);
  backdrop-filter: blur(12rpx);
}

.detail-footer__status {
  min-width: 0;
}

.detail-footer__label {
  display: block;
  font-size: var(--font-size-xs);
}

.detail-footer__value {
  margin-top: 8rpx;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.detail-footer__notice {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 84rpx;
  height: 84rpx;
  border-radius: 999rpx;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 38rpx;
  flex-shrink: 0;
}

.sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}

.sheet__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.sheet__close {
  color: var(--color-text-secondary);
  font-size: 34rpx;
}

.sheet__body {
  margin-top: var(--space-md);
}
</style>
