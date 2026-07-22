<template>
  <Layout title="菜谱" current-tab="recipe" :show-left="false">
    <view class="recipe-page" :class="themeClasses">
      <view class="recipe-header">
        <view>
          <text class="recipe-header__title">我的菜谱</text>
          <text class="recipe-header__subtitle">先看自家常吃，再去大厅补充灵感。</text>
        </view>
        <view class="recipe-header__action" hover-class="recipe-header__action--hover" hover-stay-time="100" @click="navigateTo('/pages_recipe/import/index')">
          <text class="recipe-header__action-text">导入</text>
        </view>
      </view>

      <template v-if="recipeLoading">
        <view class="recipe-skeleton">
          <Skeleton width="100%" height="86rpx" radius="var(--radius-pill)" />
          <Skeleton width="100%" height="240rpx" radius="var(--entry-card-radius)" />
          <Skeleton layout="row" :count="3" width="208rpx" height="196rpx" radius="var(--entry-card-radius)" />
          <Skeleton layout="column" :count="2" width="100%" height="132rpx" radius="var(--radius-lg)" />
        </view>
      </template>

      <template v-else>
        <view class="search-entry" hover-class="search-entry--hover" hover-stay-time="100" @click="navigateTo('/pages_recipe/list/index')">
          <text class="search-entry__icon">⌕</text>
          <text class="search-entry__text">搜索菜名、食材或做法</text>
        </view>

        <view class="private-panel">
          <view class="private-panel__copy">
            <text class="private-panel__label">私人菜谱</text>
            <text class="private-panel__title">把家里常吃的菜，放在最顺手的位置</text>
            <text class="private-panel__description">登录后展示当前饭搭子的私有菜谱、最近编辑和快速复做。</text>
          </view>
          <view class="private-panel__art">
            <view class="private-panel__book" />
            <view class="private-panel__bookmark" />
          </view>
        </view>

        <Login
          v-if="!sessionStore.isLoggedIn"
          class="recipe-login"
          title="登录后查看你的私人菜谱"
          description="系统菜谱大厅可直接浏览，收藏、导入和编辑需要登录后使用。"
        />

        <view v-else class="recipe-section">
          <view class="section-heading">
            <text class="section-heading__title">最近使用</text>
            <text class="section-heading__action" @click="navigateTo('/pages_recipe/list/index')">全部</text>
          </view>
          <scroll-view class="recent-list" scroll-x :show-scrollbar="false" enable-flex>
            <view
              v-for="item in recentRecipes"
              :key="item.name"
              class="recent-card"
              hover-class="recent-card--hover"
              hover-stay-time="100"
              @click="navigateTo('/pages_recipe/detail/index')"
            >
              <text class="recent-card__name">{{ item.name }}</text>
              <text class="recent-card__meta">{{ item.meta }}</text>
              <view class="recent-card__plate">
                <view class="recent-card__food" />
              </view>
            </view>
          </scroll-view>
        </view>

        <view class="recipe-section">
          <view class="section-heading">
            <text class="section-heading__title">菜谱大厅</text>
            <text class="section-heading__action" @click="navigateTo('/pages_recipe/system/index')">浏览</text>
          </view>
          <view class="hall-list">
            <view
              v-for="item in hallEntries"
              :key="item.title"
              class="hall-card"
              hover-class="hall-card--hover"
              hover-stay-time="100"
              @click="navigateTo(item.url)"
            >
              <view>
                <text class="hall-card__title">{{ item.title }}</text>
                <text class="hall-card__description">{{ item.description }}</text>
              </view>
              <text class="hall-card__arrow">›</text>
            </view>
          </view>
        </view>
      </template>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useTheme } from "@/composables/useTheme";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";

const sessionStore = useSessionStore();
const { themeClasses } = useTheme();
const recipeLoading = ref(false);

const recentRecipes = [
  { name: "番茄牛腩", meta: "45 分钟 · 适合晚餐" },
  { name: "青椒炒蛋", meta: "12 分钟 · 快手菜" },
  { name: "菌菇鸡汤", meta: "60 分钟 · 周末" }
];

const hallEntries = [
  {
    title: "系统菜谱大厅",
    description: "按食材、口味和场景快速浏览，再导入到私人菜谱。",
    url: "/pages_recipe/system/index"
  },
  {
    title: "链接或文字导入",
    description: "把外部菜谱整理成家里的做法，不占主流程。",
    url: "/pages_recipe/import/index"
  }
];

function navigateTo(url: string) {
  void uniPlatform.navigation.navigateTo(url);
}
</script>

<style scoped lang="scss">
.recipe-page {
  padding-bottom: var(--space-md);
}

.recipe-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-lg);
}

.recipe-header__title {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
}

.recipe-header__subtitle {
  display: block;
  margin-top: 10rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
}

.recipe-header__action {
  flex: 0 0 auto;
  padding: 16rpx 24rpx;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
}

.recipe-header__action--hover,
.search-entry--hover,
.recent-card--hover,
.hall-card--hover {
  opacity: 0.86;
}

.recipe-header__action-text {
  color: var(--color-text-inverse);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.recipe-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.search-entry {
  display: flex;
  align-items: center;
  height: 86rpx;
  padding: 0 var(--space-lg);
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
}

.search-entry__icon {
  color: var(--color-primary);
  font-size: 34rpx;
  font-weight: var(--font-weight-bold);
}

.search-entry__text {
  margin-left: 14rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-md);
}

.private-panel {
  position: relative;
  overflow: hidden;
  min-height: 260rpx;
  margin-top: var(--space-md);
  padding: 34rpx 32rpx;
  border-radius: var(--entry-board-radius);
  background: linear-gradient(135deg, var(--entry-primary-bg), var(--entry-board-bg));
}

.private-panel__copy {
  position: relative;
  z-index: 1;
  width: 430rpx;
}

.private-panel__label,
.private-panel__title,
.private-panel__description {
  display: block;
}

.private-panel__label {
  color: var(--entry-accent);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.private-panel__title {
  margin-top: 12rpx;
  color: var(--entry-ink);
  font-size: 38rpx;
  font-weight: var(--entry-title-weight);
  line-height: var(--line-height-tight);
}

.private-panel__description {
  margin-top: 14rpx;
  color: var(--entry-muted-text);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.private-panel__art {
  position: absolute;
  right: 28rpx;
  bottom: 24rpx;
  width: 170rpx;
  height: 150rpx;
}

.private-panel__book {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 118rpx;
  height: 140rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 30rpx 30rpx 18rpx 18rpx;
  background: var(--entry-photo-bg);
  transform: rotate(7deg);
}

.private-panel__bookmark {
  position: absolute;
  top: 8rpx;
  left: 22rpx;
  width: 52rpx;
  height: 82rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 999rpx;
  background: var(--entry-accent);
  transform: rotate(-18deg);
}

.recipe-login,
.recipe-section {
  margin-top: var(--space-md);
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.section-heading__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.section-heading__action {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.recent-list {
  width: 100%;
  white-space: nowrap;
}

.recent-card {
  position: relative;
  display: inline-block;
  overflow: hidden;
  width: 220rpx;
  height: 204rpx;
  margin-right: var(--space-md);
  padding: 24rpx;
  border-radius: var(--entry-card-radius);
  background: var(--color-surface);
  vertical-align: top;
}

.recent-card__name,
.recent-card__meta {
  position: relative;
  z-index: 1;
  display: block;
}

.recent-card__name {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.recent-card__meta {
  margin-top: 10rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
}

.recent-card__plate {
  position: absolute;
  right: 20rpx;
  bottom: 18rpx;
  width: 88rpx;
  height: 58rpx;
  border: 5rpx solid var(--entry-outline);
  border-radius: 50%;
  background: var(--entry-photo-plate-bg);
  transform: rotate(-8deg);
}

.recent-card__food {
  position: absolute;
  top: 16rpx;
  left: 30rpx;
  width: 28rpx;
  height: 22rpx;
  border-radius: 50%;
  background: var(--entry-food-yellow);
  box-shadow: -20rpx 8rpx 0 var(--entry-food-orange), 22rpx 6rpx 0 var(--entry-food-green);
}

.hall-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.hall-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 132rpx;
  padding: 24rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.hall-card__title,
.hall-card__description {
  display: block;
}

.hall-card__title {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.hall-card__description {
  margin-top: 8rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.hall-card__arrow {
  flex: 0 0 auto;
  margin-left: var(--space-md);
  color: var(--color-primary);
  font-size: 42rpx;
  font-weight: var(--font-weight-bold);
}
</style>
