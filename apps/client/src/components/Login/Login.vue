<template>
  <view class="login">
    <text class="login__eyebrow">需要登录</text>
    <text class="login__title">{{ title }}</text>
    <text class="login__description">{{ description }}</text>
    <button class="login__button" @click="openLogin">
      {{ buttonText }}
    </button>
  </view>
</template>

<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import { APP_NAME } from "@/config";
import { useLoginModalStore } from "@/stores/login-modal";
import { onLoginSuccess } from "@/utils/session-events";
import { createOperationId } from "@/utils/operation-id";
import type { LoginSuccessPayload } from "./types";
import "./login.scss";

withDefaults(
	defineProps<{
		title?: string;
		description?: string;
		buttonText?: string;
	}>(),
	{
		title: `登录${APP_NAME}`,
		description: "登录后可以查看你的饭搭子、下一餐计划和食材与采购。",
		buttonText: "打开登录"
	}
);

const emit = defineEmits<{
	success: [payload: LoginSuccessPayload];
}>();
const loginModalStore = useLoginModalStore();
const sourceId = createOperationId();
const stopListening = onLoginSuccess((payload) => {
	if (payload.sourceId !== sourceId) return;
	emit("success", { session: payload.session });
});

onBeforeUnmount(() => {
	stopListening();
});

function openLogin() {
	loginModalStore.open(sourceId);
}
</script>
