<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="我的勋章">
    <Login v-if="!sessionStore.isLoggedIn" title="登录后查看勋章墙" description="勋章只记录你真实完成和真实贡献的做饭事实。" />

    <template v-else>
      <view class="hero-card">
        <text class="cookfont hero-card__laurel hero-card__laurel--left hero-card__tone icon-medal-left" />

        <view class="hero-card__content">
          <text class="hero-card__title hero-card__tone">我的勋章墙</text>
          <text class="hero-card__slogan hero-card__tone">认真做饭，也值得被记录</text>
        </view>

        <view class="hero-card__count-block">
          <text class="hero-card__count hero-card__tone">{{ wall?.earnedCount ?? "--" }}</text>
        </view>

        <text class="cookfont hero-card__laurel hero-card__laurel--right hero-card__tone icon-medal-right" />
      </view>

      <view v-if="errorText" class="notice" @click="loadWall">{{ errorText }}</view>
      <view v-else-if="loading" class="notice">加载中...</view>

      <template v-else>
        <view v-if="showCategoryBar" class="sticky-wrap" :style="stickyStyle">
          <view class="sticky-bar">
            <view class="category-fixed">
              <view
                class="category-chip"
                :class="{ 'category-chip--active': activeCategory === firstTab.key }"
                @click="changeCategory(firstTab.key)"
              >
                <text class="category-chip__name">{{ firstTab.name }}</text>
                <text class="category-chip__meta">{{ firstTab.earnedCount }}/{{ firstTab.totalCount }}</text>
              </view>
            </view>

            <scroll-view scroll-x class="category-scroll" show-scrollbar="false">
              <view class="category-row">
                <view
                  v-for="tab in scrollTabs"
                  :key="tab.key"
                  class="category-chip"
                  :class="{ 'category-chip--active': activeCategory === tab.key }"
                  @click="changeCategory(tab.key)"
                >
                  <text class="category-chip__name">{{ tab.name }}</text>
                  <text class="category-chip__meta">{{ tab.earnedCount }}/{{ tab.totalCount }}</text>
                </view>
              </view>
            </scroll-view>
          </view>
        </view>

        <view v-if="filteredItems.length" class="medal-grid">
          <view
            v-for="item in filteredItems"
            :key="item.code"
            class="medal-card"
            :class="{ 'medal-card--earned': item.earned, 'medal-card--locked': !item.earned }"
            @click="openDetail(item.code)"
          >
            <view class="medal-card__badge-shell">
              <view class="medal-card__badge">
                <image v-if="resolveMedalImageUrl(item)" class="medal-card__image" :src="resolveMedalImageUrl(item) || ''" mode="aspectFit" />
                <text v-else class="cookfont medal-card__icon" :class="getMedalIconClass(item.iconKey)" />
              </view>
            </view>
            <text class="medal-card__name">{{ item.name }}</text>
            <text class="medal-card__tag" :class="getTagClass(item)">{{ formatMedalState(item) }}</text>
            <text class="medal-card__meta">{{ formatMedalStateHint(item) }}</text>
          </view>
        </view>

        <view v-else class="empty-card">
          <text class="empty-card__title">这一类勋章还在整理中</text>
          <text class="empty-card__desc">先看看别的分类，或者稍后再回来。</text>
        </view>
      </template>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { medalApi, type MedalWallResponse } from "@/apis/medal";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { formatMedalState, formatMedalStateHint, getMedalIconClass, resolveMedalImageUrl } from "./present";

const pageStyle = usePageScrollStyle();
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();
const loading = ref(false);
const errorText = ref("");
const wall = ref<MedalWallResponse | null>(null);
const activeCategory = ref<"ALL" | string>("ALL");

const tabs = computed(() => [
  {
    key: "ALL",
    name: "全部",
    earnedCount: wall.value?.earnedCount ?? 0,
    totalCount: wall.value?.totalCount ?? 0
  },
  ...((wall.value?.categories ?? []).map(item => ({
    key: item.key,
    name: item.name,
    earnedCount: item.earnedCount,
    totalCount: item.totalCount
  })) as Array<{ key: string; name: string; earnedCount: number; totalCount: number }>)
]);
const showCategoryBar = computed(() => tabs.value.length > 1);
const firstTab = computed(() => tabs.value[0] || { key: "ALL", name: "全部", earnedCount: 0, totalCount: 0 });
const scrollTabs = computed(() => tabs.value.slice(1));
const stickyStyle = computed(() => ({
  top: `${navBarTotalHeight.value}px`
}));

const filteredItems = computed(() => {
  const items = wall.value?.items ?? [];
  if (activeCategory.value === "ALL") return items;
  return items.filter(item => item.category === activeCategory.value);
});

onShow(() => {
  if (!sessionStore.isLoggedIn) return;
  void loadWall();
});

async function loadWall() {
  if (!sessionStore.isLoggedIn || loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    const result = await medalApi.getCurrent();
    wall.value = result;
    const availableKeys = new Set(["ALL", ...result.categories.map(item => item.key)]);
    if (!availableKeys.has(activeCategory.value)) {
      activeCategory.value = "ALL";
    }
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "勋章加载失败";
  } finally {
    loading.value = false;
  }
}

function openDetail(code: string) {
  void uniPlatform.navigation.navigateTo(`/pages_me/medal-detail/index?code=${encodeURIComponent(code)}`);
}

function changeCategory(categoryKey: string) {
  if (activeCategory.value === categoryKey) return;
  activeCategory.value = categoryKey;
}

function getTagClass(item: { earned: boolean; isLimited: boolean }) {
  if (item.earned) return "medal-card__tag--earned";
  if (item.isLimited) return "medal-card__tag--limited";
  return "medal-card__tag--locked";
}
</script>

<style scoped lang="scss">
.hero-card,
.notice,
.empty-card,
.medal-card {
  border-radius: var(--radius-lg);
}

.hero-card,
.notice,
.empty-card {
  padding: var(--space-md);
}

.hero-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  min-height: 208rpx;
  overflow: hidden;
}

.hero-card__tone {
  background: linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary-active) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}

.notice,
.empty-card__desc,
.medal-card__meta {
  color: var(--color-text-secondary);
}

.hero-card__content,
.hero-card__count-block,
.sticky-bar,
.category-row {
  display: flex;
  align-items: center;
}

.hero-card__content {
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 10rpx;
}

.hero-card__title {
  font-size: 60rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.05;
}

.hero-card__slogan {
  font-size: 26rpx;
  line-height: 1.4;
}

.hero-card__count-block {
  flex: 0 0 auto;
  justify-content: center;
}

.hero-card__count {
  font-size: 120rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 0.9;
}

.hero-card__laurel {
  flex: 0 0 auto;
  font-size: 108rpx;
  line-height: 1;
  opacity: 0.92;
}

.notice,
.empty-card {
  margin-top: var(--space-md);
}

.sticky-wrap {
  position: sticky;
  z-index: 20;
  margin: var(--space-md) calc(var(--space-page) * -1) 0;
  padding: 0 var(--space-page) 16rpx;
  background: var(--color-page);
}

.sticky-bar {
  position: relative;
  min-height: 56rpx;
}

.category-fixed {
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
  padding-right: 16rpx;
  background: var(--color-page);
}

.category-scroll {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
}

.category-row {
  width: max-content;
  gap: 16rpx;
  padding-right: 24rpx;
}

.category-chip {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  height: 56rpx;
  gap: 10rpx;
  padding: 0 28rpx;
  border: 1rpx solid var(--color-divider);
  border-radius: var(--radius-xs);
  box-sizing: border-box;
  background: var(--color-surface-muted);
}

.category-chip--active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.category-chip__name {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  white-space: nowrap;
}

.category-chip__meta {
  color: var(--color-text-tertiary);
  font-size: 20rpx;
  line-height: 1;
  white-space: nowrap;
}

.category-chip--active .category-chip__name,
.category-chip--active .category-chip__meta {
  color: var(--color-primary-active);
}

.medal-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-page);
  margin-top: var(--space-md);
}

.medal-card {
  min-height: 240rpx;
  text-align: center;
}

.medal-card--locked {
  opacity: 0.72;
}

.medal-card__badge-shell {
  display: flex;
  justify-content: center;
}

.medal-card__badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 200rpx;
  height: 200rpx;
}

.medal-card--locked .medal-card__image,
.medal-card--locked .medal-card__icon {
  filter: grayscale(1);
}

.medal-card__icon {
  color: #fffdf5;
  font-size: 48rpx;
}

.medal-card__image {
  width: 100%;
  height: 100%;
}

.medal-card__name,
.empty-card__title {
  display: block;
  margin-top: var(--space-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  line-height: 1.4;
}

.medal-card__tag {
  display: inline-flex;
  margin-top: 12rpx;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: 20rpx;
}

.medal-card__tag--earned {
  background: rgba(255, 214, 133, 0.28);
  color: #9a6114;
}

.medal-card__tag--limited {
  background: rgba(245, 166, 35, 0.12);
  color: #b26a08;
}

.medal-card__tag--locked {
  background: rgba(148, 163, 184, 0.14);
  color: #64748b;
}

.medal-card__meta {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  line-height: 1.5;
}

.empty-card {
  background: var(--color-surface);
  text-align: center;
}

.empty-card__desc {
  display: block;
  margin-top: var(--space-xs);
  line-height: 1.6;
}

@media (max-width: 420px) {
  .hero-card {
    gap: 14rpx;
    min-height: 188rpx;
  }

  .hero-card__title {
    font-size: 48rpx;
  }

  .hero-card__slogan {
    font-size: 24rpx;
  }

  .hero-card__count {
    font-size: 96rpx;
  }

  .hero-card__laurel {
    font-size: 92rpx;
  }
}
</style>
