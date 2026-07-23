<template>
  <Layout title="个人权益">
    <view class="page">
      <view class="section">
        <text class="section__title">个人权益摘要</text>
        <text class="section__desc">权益只按当前账号解析，和饭搭子成员关系分开管理。</text>

        <view v-if="entitlementItems.length" class="card-list">
          <view v-for="item in entitlementItems" :key="item.label" class="card-item">
            <text class="card-item__label">{{ item.label }}</text>
            <text class="card-item__value">{{ item.value }}</text>
          </view>
        </view>
        <text v-else class="empty-text">登录后查看当前账号的个人权益。</text>
      </view>

      <view class="section">
        <text class="section__title">当前饭搭子关系</text>
        <text class="section__desc">查看你当前所在的饭搭子关系和自己的成员身份。</text>

        <view v-if="relationItems.length" class="card-list">
          <view v-for="item in relationItems" :key="item.label" class="card-item">
            <text class="card-item__label">{{ item.label }}</text>
            <text class="card-item__value">{{ item.value }}</text>
          </view>
        </view>
        <text v-else class="empty-text">暂无饭搭子关系数据。</text>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { diningGroupApi, type StorageUsageSummary } from "@/apis/dining-group";
import { useDiningGroupStore } from "@/stores/dining-group";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";

const sessionStore = useSessionStore();
const userStore = useUserStore();
const diningGroupStore = useDiningGroupStore();
const storageUsage = ref<StorageUsageSummary | null>(null);
const membership = computed(() => userStore.profile?.membership ?? null);
const display = computed(() => userStore.profile?.display ?? null);
const relation = computed(() => diningGroupStore.currentRelationSummary);
const relationUsage = computed(() => diningGroupStore.relationUsage);

const entitlementItems = computed(() => {
  if (!membership.value) return [];

  const items = [
    { label: "个人套餐", value: getTierText(membership.value.tier) },
    { label: "有效期", value: membership.value.validUntil || "长期有效" },
    { label: "我的页背景图", value: display.value?.canUseProfileBackground ? "已开放" : "未开放" },
    { label: "首页背景图", value: display.value?.canUseHomeBackground ? "已开放" : "未开放" }
  ];

  if (storageUsage.value) {
    items.push({
      label: "个人存储",
      value: `${formatBytes(storageUsage.value.usedBytes)} / ${formatBytes(storageUsage.value.limitBytes)}`
    });
  }

  return items;
});

const relationItems = computed(() => {
  if (!relation.value) return [];

  return [
    { label: "关系名称", value: relation.value.name },
    { label: "我的身份", value: getRoleText(relation.value.myRole) },
    { label: "当前成员", value: `${relation.value.memberCount}` },
    { label: "当前上限", value: `${relation.value.memberLimit}` },
    { label: "状态", value: relation.value.state },
    { label: "已加入", value: `${relationUsage.value?.joinedCount ?? 0}` },
    { label: "可加入上限", value: `${relationUsage.value?.joinLimit ?? 0}` }
  ];
});

onShow(() => {
  if (!sessionStore.isLoggedIn) {
    storageUsage.value = null;
    return;
  }

  void diningGroupApi
    .getStorageUsage()
    .then(result => {
      storageUsage.value = result;
    })
    .catch(() => {
      storageUsage.value = null;
    });
});

function getTierText(tier: "FREE" | "PLUS" | "PRO" | "ULTRA") {
  if (tier === "ULTRA") return "Ultra";
  if (tier === "PRO") return "Pro";
  if (tier === "PLUS") return "Plus";
  return "Free";
}

function getRoleText(role: "OWNER" | "ADMIN" | "MEMBER") {
  if (role === "OWNER") return "主理人";
  if (role === "ADMIN") return "管理员";
  return "成员";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];

  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }

  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${unit}`;
}
</script>

<style scoped lang="scss">
.page,
.section,
.card-list,
.card-item {
  display: flex;
  flex-direction: column;
}

.page {
  gap: var(--space-lg);
}

.section {
  gap: var(--space-sm);
}

.section__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.section__desc,
.empty-text,
.card-item__label {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.card-list {
  gap: var(--space-xs);
}

.card-item {
  gap: 4rpx;
  border-radius: var(--radius-xs);
  background: var(--color-bg-subtle);
  padding: var(--space-sm);
}

.card-item__value {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}
</style>
