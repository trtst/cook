<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="食材与采购">
    <Login v-if="!sessionStore.isLoggedIn" title="登录后查看食材与采购" description="冰箱、缺口和购物清单都归你本人所有，需要登录后查看。" />
    <template v-else>
      <view class="summary">
        <text class="summary__title">食材与采购</text>
        <text class="summary__description">把个人冰箱库存、饭局缺口和购物清单放在同一个入口里。</text>
      </view>

      <view class="entry-list">
        <view
          v-for="item in pantryEntries"
          :key="item.title"
          class="entry"
          hover-class="entry--hover"
          hover-stay-time="100"
          @click="navigateTo(item.url)"
        >
          <view class="entry__text">
            <text class="entry__title">{{ item.title }}</text>
            <text class="entry__description">{{ item.description }}</text>
          </view>
          <text class="entry__arrow">›</text>
        </view>
      </view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import Login from "@/components/Login/Login.vue";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";

const pageStyle = usePageScrollStyle();

const sessionStore = useSessionStore();

const pantryEntries = [
  {
    title: "食材缺口",
    description: "看下一餐还差什么",
    url: "/pages_pantry/gap/index"
  },
  {
    title: "购物清单",
    description: "待买食材集中处理",
    url: "/pages_pantry/list/index"
  },
  {
    title: "超市模式",
    description: "边买边勾，减少漏买",
    url: "/pages_pantry/supermarket/index"
  },
  {
    title: "采购记录",
    description: "回看已完成清单",
    url: "/pages_pantry/history/index"
  },
  {
    title: "冰箱库存",
    description: "按状态查看并维护你自己的库存",
    url: "/pages_pantry/fridge/index"
  }
];

function navigateTo(url: string) {
  void uniPlatform.navigation.navigateTo(url);
}
</script>

<style scoped lang="scss">
.summary {
  padding: var(--space-lg);
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.summary__title {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
}

.summary__description {
  display: block;
  margin-top: var(--space-sm);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
}

.entry-list {
  margin-top: var(--space-md);
}

.entry {
  display: flex;
  align-items: center;
  min-height: var(--size-list-item);
  padding: var(--space-md);
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.entry + .entry {
  margin-top: var(--space-sm);
}

.entry--hover {
  opacity: 0.88;
}

.entry__text {
  flex: 1;
  min-width: 0;
}

.entry__title,
.entry__description {
  display: block;
}

.entry__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.entry__description {
  margin-top: 6rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.entry__arrow {
  margin-left: var(--space-md);
  color: var(--color-text-tertiary);
  font-size: 44rpx;
  line-height: 1;
}
</style>
