<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { DataAnalysis, Files, ForkSpoon, House, Setting, SwitchButton, User } from "@element-plus/icons-vue";
import { ADMIN_APP_NAME } from "@/config/app";
import { useSessionStore } from "@/stores/session";

const route = useRoute();
const router = useRouter();
const session = useSessionStore();

const activeMenu = computed(() => route.path);
const openedMenus = computed(() => (route.path.startsWith("/ingredients") ? ["/ingredients"] : []));
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
          <div class="brand-title">{{ ADMIN_APP_NAME }}</div>
          <div class="brand-subtitle">Content Ops</div>
        </div>
      </div>

      <el-menu :default-active="activeMenu" :default-openeds="openedMenus" router class="side-menu">
        <el-menu-item index="/dashboard">
          <el-icon><House /></el-icon>
          <span>首页</span>
        </el-menu-item>
        <el-menu-item index="/users">
          <el-icon><User /></el-icon>
          <span>用户查询</span>
        </el-menu-item>
        <el-menu-item index="/dining-groups">
          <el-icon><DataAnalysis /></el-icon>
          <span>饭搭子查询</span>
        </el-menu-item>
        <el-menu-item index="/recipes">
          <el-icon><Files /></el-icon>
          <span>菜谱治理</span>
        </el-menu-item>
        <el-sub-menu index="/ingredients">
          <template #title>
            <el-icon><ForkSpoon /></el-icon>
            <span>食材治理</span>
          </template>
          <el-menu-item index="/ingredients/categories">系统食材分类</el-menu-item>
          <el-menu-item index="/ingredients/items">系统食材</el-menu-item>
          <el-menu-item index="/ingredients/pending">待审核个人食材</el-menu-item>
          <el-menu-item index="/ingredients/units">单位</el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/config">
          <el-icon><Setting /></el-icon>
          <span>公共配置</span>
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
