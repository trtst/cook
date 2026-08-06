<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { DataAnalysis, Files, ForkSpoon, House, Refresh, Setting, SwitchButton, User } from "@element-plus/icons-vue";
import { resolveAdminHeaderTitle, useAdminHeaderState } from "@/composables/useAdminHeader";
import { ADMIN_APP_NAME } from "@/config/app";
import { useSessionStore } from "@/stores/session";

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const headerState = useAdminHeaderState();
const headerTitle = computed(() => {
  const sharedTitle = resolveAdminHeaderTitle(headerState.title.value);
  if (sharedTitle) return sharedTitle;

  const routeTitle = resolveAdminHeaderTitle(route.meta.title);
  if (routeTitle) return routeTitle;

  for (let index = route.matched.length - 1; index >= 0; index -= 1) {
    const matchedTitle = resolveAdminHeaderTitle(route.matched[index]?.meta?.title);
    if (matchedTitle) return matchedTitle;
  }

  return "";
});
const hasHeaderRefresh = computed(() => Boolean(headerState.refresh.value));

const activeMenu = computed(() => {
  if (route.path.startsWith("/operations/")) {
    if (route.path.startsWith("/operations/weekly-topic/editor")) {
      return "/operations/weekly-topic";
    }
    return route.path;
  }
  if (
    route.path.startsWith("/recipes/") &&
    route.path !== "/recipes/list" &&
    route.path !== "/recipes/reports" &&
    route.path !== "/recipes/categories" &&
    route.path !== "/recipes/imports" &&
    route.path !== "/recipes/pending"
  ) {
    if (route.path.startsWith("/recipes/imports") || route.path.startsWith("/recipes/import-items")) {
      return "/recipes/imports";
    }
    return "/recipes/list";
  }
  return route.path;
});
const openedMenus = computed(() => {
  const menus: string[] = [];
  if (route.path.startsWith("/recipes")) {
    menus.push("/recipes");
  }
  if (route.path.startsWith("/ingredients")) {
    menus.push("/ingredients");
  }
  if (route.path.startsWith("/operations")) {
    menus.push("/operations");
  }
  return menus;
});
const adminName = computed(() => session.admin?.displayName ?? "管理员");

function logout() {
  session.clearSession();
  router.replace("/login");
}

function triggerHeaderRefresh() {
  void headerState.refresh.value?.();
}
</script>

<template>
  <el-container class="admin-shell">
    <el-aside class="admin-sidebar" width="224px">
      <div class="brand">
        <div class="brand-mark">
          <el-icon><ForkSpoon /></el-icon>
        </div>
        <div class="brand-title">{{ ADMIN_APP_NAME }}</div>
      </div>

      <el-menu :default-active="activeMenu" :default-openeds="openedMenus" router class="side-menu">
        <el-menu-item index="/dashboard">
          <el-icon><House /></el-icon>
          <span>首页</span>
        </el-menu-item>
        <el-sub-menu index="/operations">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>运营</span>
          </template>
          <el-menu-item index="/operations/app-home">小程序首页</el-menu-item>
          <el-menu-item index="/operations/weekly-topic">本周灵感</el-menu-item>
          <el-menu-item index="/operations/site-home">官网首页</el-menu-item>
          <el-menu-item index="/operations/pre-meal">餐前准备</el-menu-item>
          <el-menu-item index="/operations/kitchen-knowledge">厨房知识</el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/users">
          <el-icon><User /></el-icon>
          <span>用户查询</span>
        </el-menu-item>
        <el-menu-item index="/dining-groups">
          <el-icon><DataAnalysis /></el-icon>
          <span>饭搭子查询</span>
        </el-menu-item>
        <el-menu-item index="/medals">
          <el-icon><Files /></el-icon>
          <span>勋章治理</span>
        </el-menu-item>
        <el-sub-menu index="/recipes">
          <template #title>
            <el-icon><Files /></el-icon>
            <span>菜谱治理</span>
          </template>
          <el-menu-item index="/recipes/categories">系统菜谱分类</el-menu-item>
          <el-menu-item index="/recipes/list">系统菜谱</el-menu-item>
          <el-menu-item index="/recipes/imports">菜谱导入中心</el-menu-item>
          <el-menu-item index="/recipes/pending">待审核个人菜谱</el-menu-item>
          <el-menu-item index="/recipes/reports">菜谱举报</el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="/ingredients">
          <template #title>
            <el-icon><ForkSpoon /></el-icon>
            <span>食材治理</span>
          </template>
          <el-menu-item index="/ingredients/categories">系统食材分类</el-menu-item>
          <el-menu-item index="/ingredients/items">系统食材</el-menu-item>
          <el-menu-item index="/ingredients/pending">待审核个人食材</el-menu-item>
          <el-menu-item index="/ingredients/feedbacks">待审核食材纠错</el-menu-item>
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
        <div class="page-title-wrap">
          <div class="page-title">{{ headerTitle }}</div>
          <el-button v-if="hasHeaderRefresh" class="header-refresh" type="primary" :icon="Refresh" @click="triggerHeaderRefresh" />
        </div>
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
