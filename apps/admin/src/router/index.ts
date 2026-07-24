import { createRouter, createWebHistory } from "vue-router";
import { ADMIN_APP_NAME } from "@/config/app";
import AdminLayout from "@/layout/AdminLayout.vue";
import { useSessionStore } from "@/stores/session";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      name: "login",
      component: () => import("@/pages/LoginPage.vue"),
      meta: { public: true, title: "登录" }
    },
    {
      path: "/",
      component: AdminLayout,
      redirect: "/users",
      children: [
        {
          path: "users",
          name: "users",
          component: () => import("@/pages/UsersPage.vue"),
          meta: { title: "用户查询" }
        },
        {
          path: "dining-groups",
          name: "dining-groups",
          component: () => import("@/pages/DiningGroupsPage.vue"),
          meta: { title: "饭搭子查询" }
        },
        {
          path: "recipes",
          name: "recipes",
          component: () => import("@/pages/RecipesPage.vue"),
          meta: { title: "菜谱治理" }
        },
        {
          path: "config",
          name: "config",
          component: () => import("@/pages/ConfigPage.vue"),
          meta: { title: "公共配置" }
        }
      ]
    }
  ]
});

router.beforeEach(to => {
  document.title = to.meta.title ? `${String(to.meta.title)} | ${ADMIN_APP_NAME}` : ADMIN_APP_NAME;

  const session = useSessionStore();
  if (!session.isLoggedIn && session.token) {
    session.clearSession();
  }

  if (to.meta.public) {
    return session.isLoggedIn ? { path: "/users" } : true;
  }

  if (!session.isLoggedIn) {
    return {
      path: "/login",
      query: { redirect: to.fullPath }
    };
  }

  return true;
});

export default router;
