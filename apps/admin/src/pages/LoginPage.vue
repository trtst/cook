<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Lock, User } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { authApi } from "@/apis/auth";
import { useSessionStore } from "@/stores/session";

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const loading = ref(false);

const form = reactive({
  username: "admin",
  password: ""
});

function getRedirect() {
  const redirect = route.query.redirect;
  return typeof redirect === "string" && redirect.startsWith("/") && !redirect.startsWith("//")
    ? redirect
    : "/users";
}

async function submit() {
  loading.value = true;
  try {
    const result = await authApi.login(form);
    session.setSession(result);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "登录失败");
    return;
  } finally {
    loading.value = false;
  }

  await router.replace(getRedirect()).catch(() => {
    ElMessage.warning("登录成功，请手动进入列表页");
  });
}
</script>

<template>
  <main class="login-page">
    <section class="login-panel">
      <div class="login-copy">
        <div class="login-kicker">Next Meal Admin</div>
        <h1>下一餐后台</h1>
      </div>

      <el-form class="login-form" @submit.prevent="submit">
        <el-form-item>
          <el-input v-model="form.username" :prefix-icon="User" size="large" autocomplete="username" />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="form.password"
            :prefix-icon="Lock"
            size="large"
            type="password"
            autocomplete="current-password"
            show-password
          />
        </el-form-item>
        <el-button class="login-button" type="primary" size="large" :loading="loading" native-type="submit">
          登录
        </el-button>
      </el-form>
    </section>
  </main>
</template>
