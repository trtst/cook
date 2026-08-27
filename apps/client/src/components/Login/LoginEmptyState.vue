<template>
  <Empty
    class="login-empty"
    :title="title"
    :description="description"
    :art="art"
    :plain="plain"
    clickable
    @click="openLogin"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import Empty from "@/components/Empty/Empty.vue";
import { APP_NAME } from "@/config";
import { useLoginModalStore } from "@/stores/login-modal";
import { onLoginSuccess } from "@/utils/session-events";
import { createOperationId } from "@/utils/operation-id";
import type { LoginSuccessPayload } from "./types";

withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    art?: string;
    plain?: boolean;
  }>(),
  {
    title: `登录${APP_NAME}`,
    description: "登录后可以查看你的饭局、下一餐计划和食材与采购。",
    art: "",
    plain: false
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
