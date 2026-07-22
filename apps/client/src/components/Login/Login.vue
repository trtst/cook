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
import { ApiClientError } from "@/apis/http";
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
const phone = ref("");
const password = ref("");
const sessionStore = useSessionStore();
const userStore = useUserStore();

async function handleLogin() {
	if (loading.value) return;

	const phoneText = phone.value.trim();
	const passwordText = password.value;
	const validationError = validateLogin(phoneText, passwordText);

	if (validationError) {
		errorText.value = validationError;
		return;
	}

	loading.value = true;
	errorText.value = "";

	try {
		const session = await authApi.loginWithPassword({
			phone: phoneText,
			password: passwordText
		});

		await sessionStore.setSession({
			token: session.token,
			uid: session.user.uid,
			expiresAt: session.expiresAt
		});
		userStore.setProfile(session.user);
		password.value = "";
		emit("success", { session });
	} catch (error) {
		errorText.value = getErrorText(error);
		emit("error", error);
	} finally {
		loading.value = false;
	}
}

function validateLogin(phoneText: string, passwordText: string) {
	if (!phoneText) return "请输入手机号";
	if (!/^1[3-9]\d{9}$/.test(phoneText)) return "请输入正确的手机号";
	if (!passwordText) return "请输入密码";
	if (passwordText.length < 6) return "密码至少 6 位";
	return "";
}

function getErrorText(error: unknown) {
	if (error instanceof ApiClientError) {
		if (error.code === 401) return "手机号或密码错误";
		if (error.code === 429) return error.message || "请求过于频繁，请稍后重试";
		if (error.code === 400) return error.message || "请检查手机号和密码";
	}

	if (error instanceof Error && error.message) {
		return error.message;
	}

	return "登录失败，请稍后重试";
}
</script>
