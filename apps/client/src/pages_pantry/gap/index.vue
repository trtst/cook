<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="食材缺口">
    <Login v-if="!sessionStore.isLoggedIn" title="登录后看饭局缺口" description="缺口只按你自己的冰箱计算。" />

    <template v-else>
      <view class="section">
        <text class="section__title">选择一个已创建的饭局</text>
        <view v-if="events.length" class="event-list">
          <view
            v-for="item in events"
            :key="item.id"
            class="event-chip"
            :class="{ 'event-chip--active': selectedEventId === item.id }"
            @click="selectEvent(item.id)"
          >
            {{ item.title }} · {{ item.planDate }}
          </view>
        </view>
        <Empty v-else title="还没有饭局" description="先在计划页发起一场饭局。" />
      </view>

      <view v-if="selectedEventId" class="section">
        <button class="secondary" :disabled="submitting" @click="loadGap">刷新缺口</button>
        <button class="primary" :disabled="submitting || !gapItems.length" @click="createGap">写入购物清单</button>
      </view>

      <view v-if="errorText" class="notice" @click="loadGap">{{ errorText }}</view>
      <view v-if="loading" class="notice">加载中...</view>
      <Empty v-else-if="selectedEventId && !gapItems.length" title="没有缺口" description="当前冰箱已经能覆盖这场饭局。" />

      <view v-else-if="gapItems.length" class="list">
        <view v-for="item in gapItems" :key="item.sourceKey || item.id" class="card">
          <text class="card__title">{{ item.name }}</text>
          <text class="card__meta">{{ item.quantityText || "未填数量" }}</text>
        </view>
      </view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import Login from "@/components/Login/Login.vue";
import { pantryMealApi } from "../apis/meal";
import { shoppingApi, type ShoppingItemSummary } from "../apis/shopping";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";

const pageStyle = usePageScrollStyle();

const sessionStore = useSessionStore();
const events = ref<Array<{ id: string; title: string; planDate: string }>>([]);
const selectedEventId = ref("");
const gapItems = ref<ShoppingItemSummary[]>([]);
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");

onShow(() => {
  if (!sessionStore.isLoggedIn) return;
  void loadEvents();
});

async function loadEvents() {
  if (loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    const planResult = await pantryMealApi.listPlans({ page: 1, pageSize: 50 });
    events.value = planResult.items
      .filter(item => item.diningEventId)
      .map(item => ({
        id: item.diningEventId as string,
        title: item.title,
        planDate: item.planDate
      }));
    if (!selectedEventId.value && events.value[0]) {
      selectedEventId.value = events.value[0].id;
      await loadGap();
    }
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "饭局加载失败";
  } finally {
    loading.value = false;
  }
}

function selectEvent(eventId: string) {
  selectedEventId.value = eventId;
  void loadGap();
}

async function loadGap() {
  if (!selectedEventId.value || submitting.value) return;
  submitting.value = true;
  errorText.value = "";
  try {
    gapItems.value = await shoppingApi.previewGap(selectedEventId.value);
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "缺口加载失败";
  } finally {
    submitting.value = false;
  }
}

async function createGap() {
  if (!selectedEventId.value || submitting.value) return;
  submitting.value = true;
  try {
    gapItems.value = await shoppingApi.createEventGap(selectedEventId.value, createOperationId());
    await uniPlatform.feedback.toast({ title: "已写入购物清单", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "写入失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.section,
.notice,
.card {
  padding: var(--space-md);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.section + .section,
.list {
  margin-top: var(--space-md);
}

.section__title,
.card__title,
.card__meta {
  display: block;
}

.section__title,
.card__title {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.card__meta {
  margin-top: 6rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.event-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.event-chip {
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
}

.event-chip--active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.primary,
.secondary {
  margin-top: var(--space-sm);
  border-radius: var(--radius-md);
}

.primary {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.card + .card {
  margin-top: var(--space-sm);
}
</style>
