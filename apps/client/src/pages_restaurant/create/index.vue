<template>
  <Layout title="创建饭搭子">
    <view class="create-page">
      <Login
        v-if="!sessionStore.isLoggedIn"
        title="登录后创建饭搭子"
        description="登录后可以创建自己的饭搭子，并邀请成员一起使用。"
      />

      <view v-else class="form-panel">
        <text class="form-panel__title">饭搭子名称</text>
        <input
          v-model="name"
          class="form-panel__input"
          maxlength="40"
          placeholder="例如：我的饭搭子"
          :disabled="submitting"
        />
        <button class="form-panel__button" :loading="submitting" :disabled="submitting" @click="handleCreate">
          创建
        </button>
        <text v-if="errorText" class="form-panel__error">{{ errorText }}</text>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { UUID } from "@next-meal/api-client";
import Login from "@/components/Login/Login.vue";
import { useDiningGroupStore } from "@/stores/dining-group";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";

const sessionStore = useSessionStore();
const diningGroupStore = useDiningGroupStore();
const name = ref("我的饭搭子");
const submitting = ref(false);
const errorText = ref("");
const operationId = ref<UUID | "">("");

async function handleCreate() {
  const nextName = name.value.trim();

  if (submitting.value) return;

  if (!nextName) {
    errorText.value = "请输入饭搭子名称";
    return;
  }

  submitting.value = true;
  errorText.value = "";
  operationId.value = operationId.value || createOperationId();

  try {
    await diningGroupStore.createDiningGroup(nextName, operationId.value);
    operationId.value = "";
    uni.showToast({ title: "已创建", icon: "success" });
    uni.switchTab({ url: "/pages/me/index" });
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "创建失败，请稍后重试";
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.create-page {
  padding-bottom: var(--space-md);
}

.form-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.form-panel__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.form-panel__input {
  min-height: 92rpx;
  padding: 0 24rpx;
  border: 2rpx solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-md);
}

.form-panel__button {
  margin-top: var(--space-xs);
  border-radius: var(--radius-lg);
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.form-panel__error {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}
</style>
