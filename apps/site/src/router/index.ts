import { createRouter, createWebHistory } from "vue-router";
import { docsByPath, siteDocs } from "@/content/docs";
import { SITE_NAME } from "@/config/app";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("@/pages/HomePage.vue"),
      meta: { title: "官网" }
    },
    ...siteDocs.map((doc) => ({
      path: doc.path,
      name: doc.slug,
      component: () => import("@/pages/DocPage.vue"),
      meta: { title: doc.title }
    })),
    {
      path: "/guides/:slug",
      name: "guide-doc",
      component: () => import("@/pages/DocPage.vue"),
      meta: { title: "生活指南" }
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: () => import("@/pages/NotFoundPage.vue"),
      meta: { title: "页面不存在" }
    }
  ]
});

router.beforeEach((to) => {
  const title = typeof to.meta.title === "string" ? to.meta.title : docsByPath.get(to.path)?.title;
  document.title = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  return true;
});

export default router;
