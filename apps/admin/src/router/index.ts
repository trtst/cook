import { createRouter, createWebHistory } from "vue-router";
import { ADMIN_APP_NAME } from "@/config/app";
import AdminLayout from "@/layout/AdminLayout.vue";
import { useSessionStore } from "@/stores/session";

const superAdminRoles = ["SUPER_ADMIN"];

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
      meta: { roles: superAdminRoles },
      children: [
        {
          path: "dashboard",
          name: "dashboard",
          component: () => import("@/pages/DashboardPage.vue"),
          meta: { title: "运营看板" }
        },
        {
          path: "users",
          name: "users",
          component: () => import("@/pages/UsersPage.vue"),
          meta: { title: "用户查询" }
        },
        {
          path: "user-recipes/:userId",
          name: "user-recipe-domain",
          component: () => import("@/pages/UserRecipeDomainPage.vue"),
          meta: { title: "用户菜谱域" }
        },
        {
          path: "user-collections/:userId/:collectionId",
          name: "user-collection-detail",
          component: () => import("@/pages/UserCollectionDetailPage.vue"),
          meta: { title: "合集内容" }
        },
        {
          path: "dining-groups",
          name: "dining-groups",
          component: () => import("@/pages/DiningGroupsPage.vue"),
          meta: { title: "饭搭子查询" }
        },
        {
          path: "recipes",
          redirect: "/recipes/list"
        },
        {
          path: "recipes/list",
          name: "recipe-list",
          component: () => import("@/pages/RecipesPage.vue"),
          meta: { title: "菜谱列表" }
        },
        {
          path: "recipes/reports",
          name: "recipe-reports",
          component: () => import("@/pages/RecipeReportsPage.vue"),
          meta: { title: "菜谱举报" }
        },
        {
          path: "recipes/:recipeId",
          name: "recipe-detail",
          component: () => import("@/pages/RecipeDetailPage.vue"),
          meta: { title: "菜谱详情" }
        },
        {
          path: "ingredients",
          redirect: "/ingredients/categories"
        },
        {
          path: "ingredients/categories",
          name: "ingredient-categories",
          component: () => import("@/pages/IngredientsPage.vue"),
          meta: { title: "系统食材分类" }
        },
        {
          path: "ingredients/items",
          name: "ingredient-items",
          component: () => import("@/pages/IngredientItemsPage.vue"),
          meta: { title: "系统食材" }
        },
        {
          path: "ingredients/pending",
          name: "ingredient-pending",
          component: () => import("@/pages/IngredientPendingPage.vue"),
          meta: { title: "待审核个人食材" }
        },
        {
          path: "ingredients/units",
          name: "ingredient-units",
          component: () => import("@/pages/UnitsPage.vue"),
          meta: { title: "单位" }
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
    return session.isLoggedIn ? { path: "/dashboard" } : true;
  }

  if (!session.isLoggedIn) {
    return {
      path: "/login",
      query: { redirect: to.fullPath }
    };
  }

  const requiredRoles = Array.isArray(to.meta.roles) ? to.meta.roles.filter(role => typeof role === "string") : [];
  if (requiredRoles.length > 0) {
    const adminRoles = session.admin?.roles ?? [];
    const hasRole = requiredRoles.some(role => adminRoles.includes(role));
    if (!hasRole) {
      session.clearSession();
      return {
        path: "/login",
        query: { redirect: to.fullPath }
      };
    }
  }

  return true;
});

export default router;
