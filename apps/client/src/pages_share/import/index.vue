<template>
  <Layout title="加入分享饭局">
    <Login
      v-if="!sessionStore.isLoggedIn"
      title="登录后加入饭局"
      description="分享预览可直接看；加入饭局需要登录并建立可信身份。"
    />

    <template v-else>
      <view class="section">
        <text class="section__title">本次展示名称</text>
        <input v-model="guestName" class="input" placeholder="例如：周末来吃饭的我" />
        <button class="primary" :disabled="submitting || !shareToken || !guestName.trim()" @click="acceptInvite">确认加入</button>
      </view>

      <view v-if="errorText" class="notice">{{ errorText }}</view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { ref } from "vue";
import Login from "@/components/Login/Login.vue";
import { shareApi } from "@/apis/share";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";

const sessionStore = useSessionStore();
const shareToken = ref("");
const guestName = ref("");
const submitting = ref(false);
const errorText = ref("");

onLoad((query) => {
  const raw = Array.isArray(query?.token) ? query.token[0] : query?.token;
  shareToken.value = typeof raw === "string" ? decodeURIComponent(raw) : "";
  if (sessionStore.isLoggedIn) {
    guestName.value = `用户 ${sessionStore.uid || ""}`.trim();
  }
});

async function acceptInvite() {
  if (!shareToken.value || !guestName.value.trim() || submitting.value) return;
  submitting.value = true;
  errorText.value = "";
  try {
    const result = await shareApi.acceptInvite(shareToken.value, createOperationId(), guestName.value.trim());
    await uniPlatform.feedback.toast({ title: "已加入饭局", icon: "success" });
    if (result.participants.length) {
      await uniPlatform.clipboard.set(result.id);
    }
    void uniPlatform.navigation.redirectTo("/pages_meal/plan/index");
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "加入失败";
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.section,
.notice {
  padding: var(--space-md);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.section__title {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.input {
  width: 100%;
  margin-top: var(--space-sm);
  padding: 20rpx 24rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  box-sizing: border-box;
}

.primary {
  margin-top: var(--space-sm);
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.notice {
  margin-top: var(--space-md);
  color: var(--color-danger-text);
}
</style>
