<template>
  <Layout title="切换饭搭子">
    <view class="switch-page">
      <Login
        v-if="!sessionStore.isLoggedIn"
        title="登录后切换饭搭子"
        description="登录后可以查看并切换已加入的饭搭子。"
        @success="loadDiningGroups"
      />

      <template v-else>
        <view class="switch-header">
          <text class="switch-header__title">我的饭搭子</text>
          <text class="switch-header__action" @click="loadDiningGroups">刷新</text>
        </view>

        <view v-if="loading" class="status-panel">
          <text class="status-panel__text">加载中</text>
        </view>

        <view v-else-if="diningGroups.length" class="group-list">
          <view
            v-for="diningGroup in diningGroups"
            :key="diningGroup.id"
            class="group-item"
            :class="{ 'group-item--active': diningGroup.id === diningGroupStore.currentDiningGroupId }"
            hover-class="group-item--hover"
            hover-stay-time="100"
            @click="handleSwitch(diningGroup.id)"
          >
            <view class="group-item__main">
              <text class="group-item__name">{{ diningGroup.name }}</text>
              <text class="group-item__meta">{{ diningGroup.memberCount }} / {{ diningGroup.memberLimit }} 人 · {{ roleLabels[diningGroup.myRole] ?? diningGroup.myRole }}</text>
            </view>
            <text v-if="diningGroup.id === diningGroupStore.currentDiningGroupId" class="group-item__status">当前</text>
          </view>
        </view>

        <view v-else class="status-panel">
          <text class="status-panel__text">还没有饭搭子</text>
          <button class="status-panel__button" @click="navigateToCreate">去创建</button>
        </view>

        <text v-if="errorText" class="switch-page__error">{{ errorText }}</text>
      </template>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { DiningGroupRole, UUID } from "@next-meal/api-client";
import Login from "@/components/Login/Login.vue";
import { useDiningGroupStore } from "@/stores/dining-group";
import { useSessionStore } from "@/stores/session";

const sessionStore = useSessionStore();
const diningGroupStore = useDiningGroupStore();
const loading = ref(false);
const errorText = ref("");
const diningGroups = computed(() => diningGroupStore.diningGroups);
const roleLabels: Record<DiningGroupRole, string> = {
  OWNER: "主理人",
  ADMIN: "管理员",
  MEMBER: "成员"
};

onMounted(() => {
  if (sessionStore.isLoggedIn) {
    void loadDiningGroups();
  }
});

async function loadDiningGroups() {
  if (loading.value) return;

  loading.value = true;
  errorText.value = "";

  try {
    await diningGroupStore.refreshMine();
  } catch {
    errorText.value = "饭搭子加载失败";
  } finally {
    loading.value = false;
  }
}

async function handleSwitch(diningGroupId: UUID) {
  if (diningGroupId === diningGroupStore.currentDiningGroupId) return;

  await diningGroupStore.switchDiningGroup(diningGroupId);
  uni.showToast({ title: "已切换", icon: "success" });
  uni.navigateBack();
}

function navigateToCreate() {
  uni.navigateTo({ url: "/pages_restaurant/create/index" });
}
</script>

<style scoped lang="scss">
.switch-page {
  padding-bottom: var(--space-md);
}

.switch-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
}

.switch-header__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.switch-header__action {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
}

.group-list,
.status-panel {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.group-item {
  display: flex;
  align-items: center;
  min-height: 112rpx;
  padding: 20rpx 24rpx;
  border: 2rpx solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.group-item--active {
  border-color: var(--color-primary);
}

.group-item--hover {
  opacity: 0.88;
}

.group-item__main {
  flex: 1;
  min-width: 0;
}

.group-item__name,
.group-item__meta {
  display: block;
}

.group-item__name {
  overflow: hidden;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-item__meta {
  margin-top: 6rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.group-item__status {
  flex: 0 0 auto;
  margin-left: 16rpx;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.status-panel {
  padding: 24rpx 0;
}

.status-panel__text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.status-panel__button {
  border-radius: var(--radius-lg);
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.switch-page__error {
  display: block;
  margin-top: var(--space-sm);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}
</style>
