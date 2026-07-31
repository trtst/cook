<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="我的勋章">
    <Login v-if="!sessionStore.isLoggedIn" title="登录后查看勋章墙" description="勋章只记录你真实完成和真实贡献的做饭事实。" />

    <template v-else>
      <view class="hero-card">
        <text class="hero-card__eyebrow">认真做饭，也值得被记录</text>
        <view class="hero-card__count-line">
          <text class="hero-card__count">{{ wall?.earnedCount ?? "--" }}</text>
          <text class="hero-card__unit">/ {{ wall?.totalCount ?? "--" }} 枚</text>
        </view>
        <text class="hero-card__desc">已获得的会高亮展示，未获得的会先留在这里，等你慢慢点亮。</text>
      </view>

      <view v-if="errorText" class="notice" @click="loadWall">{{ errorText }}</view>
      <view v-else-if="loading" class="notice">加载中...</view>

      <template v-else>
        <scroll-view scroll-x class="category-strip" show-scrollbar="false">
          <view class="category-strip__inner">
            <view
              v-for="tab in tabs"
              :key="tab.key"
              class="category-chip"
              :class="{ 'category-chip--active': activeCategory === tab.key }"
              @click="activeCategory = tab.key"
            >
              <text class="category-chip__name">{{ tab.name }}</text>
              <text class="category-chip__meta">{{ tab.earnedCount }}/{{ tab.totalCount }}</text>
            </view>
          </view>
        </scroll-view>

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
                <text class="cookfont medal-card__icon" :class="getMedalIconClass(item.iconKey)" />
              </view>
            </view>
            <text class="medal-card__name">{{ item.name }}</text>
            <text v-if="item.isLimited" class="medal-card__tag">限定</text>
            <text v-else-if="item.earned" class="medal-card__tag medal-card__tag--earned">已点亮</text>
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
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { getMedalIconClass } from "./present";

const pageStyle = usePageScrollStyle();
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
  background:
    radial-gradient(circle at top right, rgba(255, 208, 116, 0.28), transparent 40%),
    linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-muted) 100%);
}

.hero-card__eyebrow,
.hero-card__desc,
.notice,
.category-chip__meta,
.empty-card__desc {
  color: var(--color-text-secondary);
}

.hero-card__count-line,
.category-strip__inner {
  display: flex;
  align-items: center;
}

.hero-card__count-line {
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.hero-card__count {
  color: var(--color-text);
  font-size: 72rpx;
  font-weight: var(--font-weight-semibold);
}

.hero-card__unit {
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
}

.hero-card__desc {
  display: block;
  margin-top: var(--space-sm);
  line-height: 1.6;
}

.notice,
.category-strip,
.empty-card {
  margin-top: var(--space-md);
}

.category-strip {
  white-space: nowrap;
}

.category-strip__inner {
  gap: var(--space-sm);
  padding-right: var(--space-xs);
}

.category-chip {
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  padding: 18rpx 24rpx;
  border-radius: 999rpx;
  background: var(--color-surface);
  color: var(--color-text-secondary);
}

.category-chip--active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.category-chip__name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.category-chip__meta {
  font-size: var(--font-size-xs);
}

.medal-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-sm);
  margin-top: var(--space-md);
}

.medal-card {
  min-height: 240rpx;
  padding: 24rpx 18rpx 20rpx;
  background: var(--color-surface);
  text-align: center;
}

.medal-card--earned {
  box-shadow: 0 12rpx 28rpx rgba(205, 148, 42, 0.12);
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
  width: 112rpx;
  height: 112rpx;
  border-radius: 999rpx;
  background:
    radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.9), transparent 38%),
    linear-gradient(160deg, rgba(255, 211, 125, 0.95) 0%, rgba(215, 149, 42, 0.92) 100%);
  box-shadow: inset 0 0 0 4rpx rgba(255, 255, 255, 0.5);
}

.medal-card--locked .medal-card__badge {
  background: linear-gradient(160deg, rgba(220, 224, 230, 0.95) 0%, rgba(174, 182, 194, 0.92) 100%);
}

.medal-card__icon {
  color: #fffdf5;
  font-size: 48rpx;
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

.empty-card {
  background: var(--color-surface);
  text-align: center;
}

.empty-card__desc {
  display: block;
  margin-top: var(--space-xs);
  line-height: 1.6;
}
</style>
