<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="超市模式">
    <view class="summary">
      <text class="summary__title">待买清单</text>
      <text class="summary__description">边买边勾，买完后会自动进入采购记录。</text>
    </view>

    <LoginEmptyState
      v-if="!sessionStore.isLoggedIn"
      title="登录后进入超市模式"
      description="上面的使用说明会继续保留；登录后再看你自己的待买清单并逐条勾选。"
      @success="handleLoginSuccess"
    />

    <template v-else>
      <view v-if="errorText" class="notice" @click="loadItems">{{ errorText }}</view>
      <view v-else-if="loading" class="notice">加载中...</view>
      <Empty v-else-if="!items.length" title="没有待买食材" description="先去采购清单手动添加，或从饭局缺口生成。" />

      <view v-else class="list">
        <view v-for="item in items" :key="item.id" class="card">
          <view class="card__main">
            <text class="card__title">{{ item.name }}</text>
            <text class="card__meta">{{ item.quantityText || "未填数量" }}</text>
          </view>
          <button class="primary" @click="markBought(item.id)">买好了</button>
        </view>
      </view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import type { UUID } from "@/apis/http";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import LoginEmptyState from "@/components/Login/LoginEmptyState.vue";
import { shoppingApi, type ShoppingItemSummary } from "../apis/shopping";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));

const sessionStore = useSessionStore();
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const items = ref<ShoppingItemSummary[]>([]);

onShow(() => {
  if (!sessionStore.isLoggedIn) return;
  void loadItems();
});

async function handleLoginSuccess() {
  await loadItems();
}

async function loadItems() {
  if (!sessionStore.isLoggedIn || loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    const result = await shoppingApi.list("OPEN");
    items.value = result.items;
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "超市模式加载失败";
  } finally {
    loading.value = false;
  }
}

async function markBought(itemId: UUID) {
  if (submitting.value) return;
  submitting.value = true;
  try {
    await shoppingApi.updateStatus(itemId, createOperationId(), "BOUGHT");
    await uniPlatform.feedback.toast({ title: "已标记买好", icon: "success" });
    await loadItems();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "更新失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function automatorApplySession(snapshot: { token: string; uid?: number; expiresAt: string; refreshCheckedAt?: number }) {
  await sessionStore.setSession(snapshot);
}

async function automatorHandleLoginSuccess() {
  await handleLoginSuccess();
  return automatorReadState();
}

function automatorReadState() {
  return {
    loggedIn: sessionStore.isLoggedIn,
    loading: loading.value,
    errorText: errorText.value,
    itemCount: items.value.length,
    itemNames: items.value.map(item => item.name)
  };
}

defineExpose({
  automatorApplySession,
  automatorHandleLoginSuccess,
  automatorReadState
});
</script>

<style scoped lang="scss">
.summary,
.notice,
.card {
  padding: var(--space-md);
  border-radius: var(--radius-md);
  background: var(--color-surface-soft-card);
}

.summary__title,
.summary__description,
.card__title,
.card__meta {
  display: block;
}

.summary__title,
.card__title {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.summary__description,
.card__meta {
  margin-top: 6rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.list {
  margin-top: var(--space-md);
}

.card {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card + .card {
  margin-top: var(--space-sm);
}

.card__main {
  flex: 1;
  min-width: 0;
}

.primary {
  margin-left: var(--space-md);
  border-radius: var(--radius-md);
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
}
</style>
