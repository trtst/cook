<template>
  <Layout title="成员管理">
    <view class="members-page">
      <Login
        v-if="!sessionStore.isLoggedIn"
        title="登录后管理成员"
        description="登录后可以为当前饭搭子生成邀请。"
        @success="loadMine"
      />

      <template v-else>
        <view v-if="currentDiningGroup" class="invite-panel">
          <text class="invite-panel__title">{{ currentDiningGroup.name }}</text>
          <text class="invite-panel__meta">当前 {{ currentDiningGroup.memberCount }} / {{ currentDiningGroup.memberLimit }} 人</text>

          <view class="member-list">
            <view class="member-list__header">
              <text class="member-list__title">成员</text>
              <text class="member-list__action" @click="loadMembers">刷新</text>
            </view>

            <view v-if="membersLoading" class="member-list__status">
              <text class="member-list__status-text">加载中</text>
            </view>

            <view v-else-if="members.length" class="member-list__items">
              <view v-for="member in members" :key="member.id" class="member-item">
                <view class="member-item__avatar">
                  <text class="member-item__avatar-text">{{ getAvatarText(member.user.nickname) }}</text>
                </view>
                <view class="member-item__main">
                  <text class="member-item__name">{{ member.user.nickname || "未命名成员" }}</text>
                  <text class="member-item__meta">UID {{ member.user.uid }}</text>
                </view>
                <text class="member-item__role">{{ roleLabels[member.role] ?? member.role }}</text>
              </view>
            </view>

            <view v-else class="member-list__status">
              <text class="member-list__status-text">暂无成员</text>
            </view>
          </view>

          <button class="invite-panel__button" :loading="submitting" :disabled="submitting" @click="handleCreateInvite">
            生成邀请
          </button>

          <view v-if="sharePath" class="share-box">
            <text class="share-box__label">邀请路径</text>
            <text class="share-box__path">{{ sharePath }}</text>
            <button class="share-box__button" @click="handleCopy">复制</button>
          </view>

          <text v-if="errorText" class="invite-panel__error">{{ errorText }}</text>
        </view>

        <view v-else class="empty-panel">
          <text class="empty-panel__title">饭搭子加载中</text>
          <text class="member-list__status-text">账号创建后会自动拥有单人饭搭子。</text>
        </view>
      </template>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { DiningGroupRole } from "@/apis/dining-group";
import type { UUID } from "@/apis/http";
import Login from "@/components/Login/Login.vue";
import { useDiningGroupStore } from "@/stores/dining-group";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";

const sessionStore = useSessionStore();
const diningGroupStore = useDiningGroupStore();
const submitting = ref(false);
const membersLoading = ref(false);
const errorText = ref("");
const sharePath = ref("");
const inviteOperationId = ref<UUID | "">("");
const currentDiningGroup = computed(() => diningGroupStore.currentDiningGroup);
const members = computed(() => diningGroupStore.members);
const roleLabels: Record<DiningGroupRole, string> = {
  OWNER: "主理人",
  ADMIN: "管理员",
  MEMBER: "成员"
};

onMounted(() => {
  if (sessionStore.isLoggedIn) {
    void loadMine();
  }
});

watch(
  () => currentDiningGroup.value?.id,
  (diningGroupId) => {
    if (sessionStore.isLoggedIn && diningGroupId) {
      void loadMembers();
    }
  }
);

async function loadMine() {
  try {
    await diningGroupStore.refreshCurrent();
    await loadMembers();
  } catch {
    errorText.value = "饭搭子加载失败";
  }
}

async function loadMembers() {
  const diningGroupId = currentDiningGroup.value?.id as UUID | undefined;

  if (!diningGroupId || membersLoading.value) return;

  membersLoading.value = true;
  errorText.value = "";

  try {
    await diningGroupStore.refreshMembers(diningGroupId);
  } catch {
    errorText.value = "成员加载失败";
  } finally {
    membersLoading.value = false;
  }
}

async function handleCreateInvite() {
  const diningGroupId = currentDiningGroup.value?.id as UUID | undefined;

  if (!diningGroupId || submitting.value) return;

  submitting.value = true;
  errorText.value = "";
  inviteOperationId.value = inviteOperationId.value || createOperationId();

  try {
    const result = await diningGroupStore.createInvite(diningGroupId, inviteOperationId.value);
    inviteOperationId.value = "";
    sharePath.value = result.sharePath;
    uni.showToast({ title: "已生成", icon: "success" });
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "生成邀请失败";
  } finally {
    submitting.value = false;
  }
}

function handleCopy() {
  if (!sharePath.value) return;
  uni.setClipboardData({
    data: sharePath.value,
    success: () => uni.showToast({ title: "已复制", icon: "success" })
  });
}

function getAvatarText(nickname: string | null) {
  return nickname?.trim().slice(0, 1) || "饭";
}
</script>

<style scoped lang="scss">
.members-page {
  padding-bottom: var(--space-md);
}

.invite-panel,
.empty-panel,
.share-box,
.member-list,
.member-list__items {
  display: flex;
  flex-direction: column;
}

.invite-panel,
.empty-panel {
  gap: var(--space-sm);
}

.invite-panel__title,
.empty-panel__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.invite-panel__meta {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.member-list {
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.member-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.member-list__title {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.member-list__action {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
}

.member-list__items {
  gap: 12rpx;
}

.member-item {
  display: flex;
  align-items: center;
  min-height: 104rpx;
  padding: 18rpx 20rpx;
  border: 2rpx solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.member-item__avatar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
}

.member-item__avatar-text {
  color: var(--color-primary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.member-item__main {
  flex: 1;
  min-width: 0;
  margin-left: 18rpx;
}

.member-item__name,
.member-item__meta {
  display: block;
}

.member-item__name {
  overflow: hidden;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-item__meta {
  margin-top: 4rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.member-item__role {
  flex: 0 0 auto;
  margin-left: 16rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.member-list__status {
  padding: 24rpx 0;
}

.member-list__status-text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.invite-panel__button,
.empty-panel__button,
.share-box__button {
  border-radius: var(--radius-lg);
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.share-box {
  gap: 12rpx;
  margin-top: var(--space-sm);
  padding: 24rpx;
  border: 2rpx solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.share-box__label {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.share-box__path {
  overflow-wrap: break-word;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.invite-panel__error {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}
</style>
