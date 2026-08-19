import { createRouter, createWebHistory } from "vue-router";
import { resolveAdminHeaderTitle } from "@/composables/useAdminHeader";
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
          path: "home-feature-board",
          redirect: "/operations/app-home"
        },
        {
          path: "home-entries",
          redirect: "/operations/app-home"
        },
        {
          path: "operations",
          redirect: "/operations/app-home"
        },
        {
          path: "operations/app-home",
          name: "operations-app-home",
          component: () => import("@/pages/HomeEntriesPage.vue"),
          meta: { title: "小程序首页" }
        },
        {
          path: "operations/weekly-topic",
          name: "operations-weekly-topic",
          component: () => import("@/pages/HomeTopicsPage.vue"),
          meta: { title: "本周灵感" }
        },
        {
          path: "operations/weekly-topic/editor",
          name: "operations-weekly-topic-editor",
          component: () => import("@/pages/HomeTopicEditorPage.vue"),
          meta: { title: "编辑本周灵感" }
        },
        {
          path: "operations/table-topic",
          name: "operations-table-topic",
          component: () => import("@/pages/TableTopicsPage.vue"),
          meta: { title: "餐桌话题" }
        },
        {
          path: "operations/table-topic/editor",
          name: "operations-table-topic-editor",
          component: () => import("@/pages/TableTopicEditorPage.vue"),
          meta: { title: "编辑餐桌话题" }
        },
        {
          path: "operations/site-home",
          name: "operations-site-home",
          component: () => import("@/pages/OperationPlaceholderPage.vue"),
          meta: { title: "官网首页", operationPage: "site-home" }
        },
        {
          path: "operations/pre-meal",
          name: "operations-pre-meal",
          component: () => import("@/pages/OperationPlaceholderPage.vue"),
          meta: { title: "餐前准备", operationPage: "pre-meal" }
        },
        {
          path: "operations/kitchen-knowledge",
          name: "operations-kitchen-knowledge",
          component: () => import("@/pages/OperationPlaceholderPage.vue"),
          meta: { title: "厨房知识", operationPage: "kitchen-knowledge" }
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
          path: "medals",
          name: "medals",
          component: () => import("@/pages/MedalTemplatesPage.vue"),
          meta: { title: "勋章治理" }
        },
        {
          path: "recipes",
          redirect: "/recipes/list"
        },
        {
          path: "recipes/categories",
          name: "recipe-categories",
          component: () => import("@/pages/RecipeCategoriesPage.vue"),
          meta: { title: "系统菜谱分类" }
        },
        {
          path: "recipes/list",
          name: "recipe-list",
          component: () => import("@/pages/RecipesPage.vue"),
          meta: { title: "系统菜谱" }
        },
        {
          path: "recipes/imports",
          name: "recipe-import-jobs",
          component: () => import("@/pages/RecipeImportJobsPage.vue"),
          meta: { title: "菜谱导入中心" }
        },
        {
          path: "recipes/imports/:jobId",
          name: "recipe-import-job-detail",
          component: () => import("@/pages/RecipeImportJobDetailPage.vue"),
          meta: { title: "导入任务详情" }
        },
        {
          path: "recipes/import-items/:itemId",
          name: "recipe-import-item-detail",
          component: () => import("@/pages/RecipeImportItemPage.vue"),
          meta: { title: "导入条目修正" }
        },
        {
          path: "recipes/pending",
          name: "recipe-pending",
          component: () => import("@/pages/RecipePendingPage.vue"),
          meta: { title: "待审核个人菜谱" }
        },
        {
          path: "recipes/create",
          name: "recipe-create",
          component: () => import("@/pages/RecipeCreatePage.vue"),
          meta: { title: "新增系统菜谱" }
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
          meta: { title: "系统菜谱详情" }
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
          path: "ingredients/feedbacks",
          name: "ingredient-feedbacks",
          component: () => import("@/pages/IngredientFeedbackPage.vue"),
          meta: { title: "待审核食材纠错" }
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
        },
        {
          path: "membership-codes",
          redirect: "/membership/skus"
        },
        {
          path: "membership",
          redirect: "/membership/skus"
        },
        {
          path: "membership/skus",
          name: "membership-skus",
          component: () => import("@/pages/MembershipGovernancePage.vue"),
          meta: { title: "SKU 管理", membershipPage: "skus" }
        },
        {
          path: "membership/batches",
          name: "membership-batches",
          component: () => import("@/pages/MembershipGovernancePage.vue"),
          meta: { title: "兑换码批次", membershipPage: "batches" }
        },
        {
          path: "membership/generations",
          name: "membership-generations",
          component: () => import("@/pages/MembershipGovernancePage.vue"),
          meta: { title: "创建记录", membershipPage: "generations" }
        },
        {
          path: "membership/codes",
          name: "membership-codes-list",
          component: () => import("@/pages/MembershipGovernancePage.vue"),
          meta: { title: "兑换码列表", membershipPage: "codes" }
        },
        {
          path: "membership/redemptions",
          name: "membership-redemptions",
          component: () => import("@/pages/MembershipGovernancePage.vue"),
          meta: { title: "核销记录", membershipPage: "redemptions" }
        },
        {
          path: "content",
          redirect: "/content/pages"
        },
        {
          path: "content/pages",
          name: "content-pages",
          component: () => import("@/pages/ContentGovernancePage.vue"),
          meta: { title: "固定页", contentPage: "pages" }
        },
        {
          path: "content/articles",
          name: "content-articles",
          component: () => import("@/pages/ContentGovernancePage.vue"),
          meta: { title: "文章列表", contentPage: "articles" }
        },
        {
          path: "content/channels",
          name: "content-channels",
          component: () => import("@/pages/ContentGovernancePage.vue"),
          meta: { title: "栏目管理", contentPage: "channels" }
        },
        {
          path: "content/articles/editor",
          name: "content-editor",
          component: () => import("@/pages/ContentEditorPage.vue"),
          meta: { title: "内容编辑" }
        }
      ]
    }
  ]
});

router.beforeEach(to => {
  const pageTitle = resolveAdminHeaderTitle(to.meta.title);
  document.title = pageTitle ? `${pageTitle} | ${ADMIN_APP_NAME}` : ADMIN_APP_NAME;

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
