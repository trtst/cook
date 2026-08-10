<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="现在缺什么" full-screen :navbar-placeholder="false" navbar-transparent>
    <view class="gap-nav-backdrop" :style="navBackdropStyle" />
    <view class="gap-scroll-wrap">
      <RecipeSearchLoading
        :pull-distance="pullDistance"
        :refreshing="refreshing"
        :show-success="showSuccess"
        :refresher-text="refresherText"
        :threshold="refresherThreshold"
      />
      <scroll-view
        class="gap-scroll"
        scroll-y
        refresher-enabled
        refresher-default-style="none"
        :show-scrollbar="false"
        :refresher-threshold="refresherThreshold"
        :refresher-triggered="refresherTriggered"
        @scroll="handleGapScroll"
        @refresherpulling="onRefresherPulling"
        @refresherrefresh="handleRefresherRefresh"
        @refresherrestore="onRefresherRestore"
        @refresherabort="onRefresherRestore"
      >
        <view class="gap-page">
          <view class="gap-hero" :style="heroStyle">
            <text class="gap-hero__eyebrow">全局缺口</text>
            <text class="gap-hero__title">{{ summaryTitle }}</text>
            <text class="gap-hero__description">{{ summaryDescription }}</text>
          </view>

          <view class="gap-content">
            <Login v-if="!sessionStore.isLoggedIn" title="登录后看现在缺什么" description="缺口只按你自己的冰箱和待处理饭局来判断。" />

            <template v-else>
              <view v-if="errorText" class="notice" @click="loadGap">
                <text class="notice__text">{{ errorText }}</text>
                <text class="notice__action">重新加载</text>
              </view>

              <text class="gap-intro">这里只回答缺哪些食材；真正的购买、勾选和删除，继续放在购物清单里处理。</text>

              <view v-if="showLoadingNotice" class="notice">
                <text class="notice__text">正在把待处理饭局的缺口汇总出来...</text>
              </view>

              <view v-else-if="gapItems.length" class="gap-section">
                <text class="gap-section__title">缺口清单</text>
                <text class="gap-section__description">同名食材会按可合法合并的数量收口；每条下面标出它关联的饭局。</text>
                <view class="gap-list">
                  <view v-for="item in gapItems" :key="item.sourceKey || item.id" class="gap-card">
                    <text class="gap-card__title">{{ item.name }}</text>
                    <text class="gap-card__meta">{{ item.quantityText || "未填数量" }}</text>
                    <view v-if="item.sourceTitles.length" class="gap-card__sources">
                      <text v-for="title in item.sourceTitles" :key="`${item.id}-${title}`" class="gap-card__source-chip">{{ title }}</text>
                    </view>
                    <text v-if="item.sourceCount > item.sourceTitles.length" class="gap-card__hint">含 {{ item.sourceCount }} 道菜用量</text>
                  </view>
                </view>
              </view>

              <view v-else class="gap-section">
                <text class="gap-section__title">当前缺口</text>
                <Empty title="暂时没有待补食材" description="如果这几顿饭已经够做，右下角直接去购物清单处理已有待买项就行。" />
              </view>
            </template>
          </view>
        </view>
      </scroll-view>
    </view>

    <button v-if="sessionStore.isLoggedIn" class="shopping-fab" @click="goShoppingList">购物清单</button>
  </Layout>
</template>

<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import RecipeSearchLoading from "@/components/Recipe/RecipeSearchLoading.vue";
import { useCustomRefresher } from "@/composables/useCustomRefresher";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { shoppingApi, type ShoppingItemSummary } from "../apis/shopping";

const pageStyle = usePageScrollStyle();
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();

const GAP_NAV_GAP = 16;
const GAP_NAV_FADE_DISTANCE = 96;

const gapItems = ref<ShoppingItemSummary[]>([]);
const loading = ref(false);
const errorText = ref("");
const gapScrollTop = ref(0);
const {
  threshold: refresherThreshold,
  pullDistance,
  refreshing,
  showSuccess,
  refresherText,
  refresherTriggered,
  onRefresherPulling,
  onRefresherRefresh,
  onRefreshComplete,
  onRefresherRestore
} = useCustomRefresher({
  text: {
    pulling: "下拉刷新缺口",
    canRelease: ["松手刷新缺口"],
    success: "缺口已刷新"
  }
});

const sourceEventCount = computed(() => {
  const titles = new Set<string>();
  gapItems.value.forEach(item => {
    item.sourceTitles.forEach(title => titles.add(title));
  });
  return titles.size;
});
const showLoadingNotice = computed(() => loading.value && !refreshing.value);

const summaryTitle = computed(() => {
  if (!sessionStore.isLoggedIn) return "先登录，再看现在缺什么";
  if (loading.value) return "正在汇总这几顿饭还差什么";
  if (!gapItems.value.length) return "暂时不缺食材";
  if (gapItems.value.length <= 2) return `还差 ${gapItems.value.length} 样，顺手补一下`;
  return `还差 ${gapItems.value.length} 样，先记清再去买`;
});

const summaryDescription = computed(() => {
  if (!sessionStore.isLoggedIn) return "登录后按你自己的冰箱和待处理饭局来判断食材缺口。";
  if (loading.value) return "把当前待处理饭局一起重算后，再给你一份合并过的缺口总览。";
  if (!gapItems.value.length) return "当前待处理饭局里没有明显缺口；如果已有待买项，直接去购物清单处理就行。";
  if (!sourceEventCount.value) return "先把缺的食材看清，再去购物清单执行真正的采购。";
  return `当前缺口涉及 ${sourceEventCount.value} 场饭局；同名食材会尽量合并，每条下面会标出对应饭局。`;
});

const navProgress = computed(() => Math.min(1, Math.max(0, gapScrollTop.value / GAP_NAV_FADE_DISTANCE)));
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: `${navProgress.value}`
}));
const heroStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + GAP_NAV_GAP}px`
}));

onShow(() => {
  if (!sessionStore.isLoggedIn) return;
  void loadGap();
});

async function loadGap() {
  if (loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    gapItems.value = await shoppingApi.previewGap();
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "缺口加载失败";
  } finally {
    loading.value = false;
  }
}

function goShoppingList() {
  void uniPlatform.navigation.navigateTo("/pages_pantry/list/index");
}

function handleGapScroll(event: { detail?: { scrollTop?: number } }) {
  gapScrollTop.value = event.detail?.scrollTop ?? 0;
}

async function handleRefresherRefresh() {
  const shouldRefresh = onRefresherRefresh();
  if (!shouldRefresh) {
    onRefresherRestore();
    return;
  }

  try {
    await loadGap();
    await onRefreshComplete();
  } finally {
    onRefresherRestore();
  }
}
</script>

<style scoped lang="scss">
.gap-nav-backdrop {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 799;
  overflow: hidden;
  border-bottom: 1rpx solid var(--color-border);
  background: var(--color-tabbar-bg);
  box-shadow: 0 10rpx 24rpx var(--color-surface-mask-weak);
  pointer-events: none;
  -webkit-backdrop-filter: saturate(180%) blur(22rpx);
  backdrop-filter: saturate(180%) blur(22rpx);
  transition: opacity 180ms ease;
}

.gap-scroll-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
}

.gap-scroll {
  height: 100%;
  background: var(--color-page);
}

.gap-page {
  min-height: 100%;
  padding-bottom: calc(180rpx + env(safe-area-inset-bottom));
}

.gap-hero {
  padding: 64rpx var(--space-page) 164rpx;
  background:
    linear-gradient(180deg, var(--color-surface-mask-weak), var(--color-surface-mask-medium)),
    radial-gradient(circle at 18% 26%, rgba(255, 220, 168, 0.46), transparent 30%),
    radial-gradient(circle at 84% 18%, rgba(190, 228, 188, 0.34), transparent 28%),
    linear-gradient(145deg, rgba(255, 246, 230, 0.96), rgba(252, 249, 242, 0.98));
}

.gap-content {
  position: relative;
  z-index: 1;
  margin-top: -96rpx;
  padding: 0 var(--space-page);
}

.gap-hero__eyebrow,
.gap-hero__title,
.gap-hero__description,
.gap-intro,
.gap-section__title,
.gap-section__description,
.gap-card__title,
.gap-card__meta,
.gap-card__hint,
.notice__text,
.notice__action {
  display: block;
}

.gap-hero__eyebrow {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.gap-hero__title,
.gap-section__title,
.gap-card__title {
  color: var(--color-text);
  font-weight: var(--font-weight-heavy);
}

.gap-hero__title {
  margin-top: 10rpx;
  font-size: 42rpx;
  line-height: 1.2;
}

.gap-hero__description,
.gap-intro,
.gap-section__description,
.gap-card__meta,
.gap-card__hint,
.notice__text,
.notice__action,
.gap-card__source-chip {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.gap-card__hint {
  margin-top: 10rpx;
  font-size: var(--font-size-xs);
}

.gap-hero__description,
.gap-section__description {
  margin-top: 12rpx;
}

.gap-intro,
.notice,
.gap-section {
  margin-top: var(--space-md);
}

.gap-intro {
  color: var(--color-text-secondary);
}

.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 24rpx;
  border-radius: var(--radius-lg);
  background: rgba(255, 243, 219, 0.96);
  color: #8b4d12;
}

.notice__action {
  font-weight: var(--font-weight-heavy);
}

.gap-section__title {
  font-size: 34rpx;
  line-height: 1.28;
}

.gap-section__description {
  color: var(--color-text-secondary);
}

.gap-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 20rpx;
}

.gap-card {
  padding: 20rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.gap-card__meta {
  margin-top: 8rpx;
}

.gap-card__sources {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 14rpx;
}

.gap-card__source-chip {
  padding: 8rpx 18rpx;
  border-radius: var(--radius-pill);
  background: rgba(255, 248, 234, 0.92);
  color: #83511b;
  font-size: var(--font-size-xs);
}

.shopping-fab {
  position: fixed;
  right: var(--space-page);
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  z-index: 810;
  min-width: 200rpx;
  margin: 0;
  border-radius: var(--radius-pill);
  background: linear-gradient(135deg, #2f6f4e, #4d8f6d);
  color: #fffdf8;
  box-shadow: 0 18rpx 36rpx rgba(47, 111, 78, 0.26);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}
</style>
