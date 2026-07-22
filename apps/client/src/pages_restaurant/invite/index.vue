<template>
  <Layout title="加入饭搭子">
    <view class="invite-page">
      <Login
        v-if="!sessionStore.isLoggedIn"
        title="登录后加入饭搭子"
        description="登录后可以通过邀请加入饭搭子。"
        @success="handleAccept"
      />

      <view v-else class="accept-panel">
        <text class="accept-panel__title">加入饭搭子</text>
        <text class="accept-panel__description">确认加入后，当前账号会成为该饭搭子的成员。</text>
        <button class="accept-panel__button" :loading="submitting" :disabled="submitting || !inviteToken" @click="handleAccept">
          确认加入
        </button>
        <text v-if="errorText" class="accept-panel__error">{{ errorText }}</text>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { ref } from "vue";
import type { UUID } from "@/apis/http";
import Login from "@/components/Login/Login.vue";
import { uniPlatform } from "@/platform/uni";
import { useDiningGroupStore } from "@/stores/dining-group";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";

const sessionStore = useSessionStore();
const diningGroupStore = useDiningGroupStore();
const inviteToken = ref("");
const submitting = ref(false);
const errorText = ref("");
const acceptOperationId = ref<UUID | "">("");

onLoad((query) => {
  const token = Array.isArray(query?.token) ? query?.token[0] : query?.token;
  inviteToken.value = typeof token === "string" ? decodeURIComponent(token) : "";

  if (!inviteToken.value) {
    errorText.value = "邀请链接无效";
  }
});

async function handleAccept() {
  if (submitting.value) return;

  if (!inviteToken.value) {
    errorText.value = "邀请链接无效";
    return;
  }

  submitting.value = true;
  errorText.value = "";
  acceptOperationId.value = acceptOperationId.value || createOperationId();

  try {
    await diningGroupStore.acceptInvite(inviteToken.value, acceptOperationId.value);
    acceptOperationId.value = "";
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "加入失败，请稍后重试";
    return;
  } finally {
    submitting.value = false;
  }

  await uniPlatform.feedback.toast({ title: "已加入", icon: "success" }).catch(() => undefined);
  await uniPlatform.navigation.switchTab("/pages/me/index").catch(() => {
    errorText.value = "已加入，请返回“我的”页查看";
  });
}
</script>

<style scoped lang="scss">
.invite-page {
  padding-bottom: var(--space-md);
}

.accept-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.accept-panel__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.accept-panel__description {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.accept-panel__button {
  border-radius: var(--radius-lg);
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.accept-panel__error {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}
</style>
