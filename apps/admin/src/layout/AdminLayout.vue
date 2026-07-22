<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { DataAnalysis, ForkSpoon, SwitchButton, User } from "@element-plus/icons-vue";
import { useSessionStore } from "@/stores/session";

const route = useRoute();
const router = useRouter();
const session = useSessionStore();

const activeMenu = computed(() => route.path);
const adminName = computed(() => session.admin?.displayName ?? "管理员");

function logout() {
  session.clearSession();
  router.replace("/login");
}
</script>

<template>
  <el-container class="admin-shell">
    <el-aside class="admin-sidebar" width="224px">
      <div class="brand">
        <div class="brand-mark">
          <el-icon><ForkSpoon /></el-icon>
        </div>
        <div>
          <div class="brand-title">下一餐后台</div>
          <div class="brand-subtitle">Content Ops</div>
        </div>
      </div>

      <el-menu :default-active="activeMenu" router class="side-menu">
        <el-menu-item index="/users">
          <el-icon><User /></el-icon>
          <span>用户查询</span>
        </el-menu-item>
        <el-menu-item index="/dining-groups">
          <el-icon><DataAnalysis /></el-icon>
          <span>饭搭子查询</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="admin-header">
        <div class="page-title">{{ route.meta.title }}</div>
        <div class="header-actions">
          <span class="admin-name">{{ adminName }}</span>
          <el-button :icon="SwitchButton" text bg @click="logout">退出</el-button>
        </div>
      </el-header>

      <el-main class="admin-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>
