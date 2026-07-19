import { createRouter, createWebHistory } from "vue-router";
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
      redirect: "/dashboard",
      children: [
        {
          path: "dashboard",
          name: "dashboard",
          component: () => import("@/pages/DashboardPage.vue"),
          meta: { title: "工作台" }
        },
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
        }
      ]
    }
  ]
});

router.beforeEach(to => {
  document.title = to.meta.title ? `${String(to.meta.title)} | 下一餐后台` : "下一餐后台";

  const session = useSessionStore();
  if (to.meta.public) {
    return session.isLoggedIn ? { path: "/dashboard" } : true;
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
