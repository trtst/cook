<template>
  <view class="login">
    <text class="login__title">{{ title }}</text>
    <text class="login__description">{{ description }}</text>
    <input
      v-model="phone"
      class="login__input"
      type="number"
      maxlength="11"
      placeholder="手机号"
      :disabled="loading"
    />
    <input
      v-model="password"
      class="login__input"
      password
      placeholder="密码"
      :disabled="loading"
    />
    <button class="login__button" :loading="loading" :disabled="loading" @click="handleLogin">
      {{ buttonText }}
    </button>
    <text v-if="errorText" class="login__error">{{ errorText }}</text>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { authApi } from "@/apis/auth";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import type { LoginSuccessPayload } from "./types";
import "./login.scss";

withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    buttonText?: string;
  }>(),
  {
    title: "登录下一餐",
    description: "登录后可以查看你的饭搭子、下一餐计划和食材与采购。",
    buttonText: "登录"
  }
);

const emit = defineEmits<{
  success: [payload: LoginSuccessPayload];
  error: [error: unknown];
}>();

const loading = ref(false);
const errorText = ref("");
const phone = ref("13800000000");
const password = ref("change-me");
const sessionStore = useSessionStore();
const userStore = useUserStore();

async function handleLogin() {
  if (loading.value) return;

  loading.value = true;
  errorText.value = "";

  try {
    const session = await authApi.loginWithPassword({
      phone: phone.value.trim(),
      password: password.value
    });

    await sessionStore.setSession({
      token: session.token,
      userId: session.user.id,
      expiresAt: session.expiresAt
    });
    userStore.setProfile(session.user);
    emit("success", { session });
  } catch (error) {
    errorText.value = "手机号或密码错误";
    emit("error", error);
  } finally {
    loading.value = false;
  }
}
</script>
