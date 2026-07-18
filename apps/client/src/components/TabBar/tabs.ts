import type { ThemeTabbarIconName } from "@/themes";

export type TabKey = "home" | "recipe" | "me";

export interface TabItem {
  key: TabKey;
  text: string;
  iconName: ThemeTabbarIconName;
  pagePath: string;
}

export const TAB_ITEMS: TabItem[] = [
  {
    key: "home",
    text: "首页",
    iconName: "home",
    pagePath: "/pages/home/index"
  },
  {
    key: "recipe",
    text: "菜谱",
    iconName: "recipe",
    pagePath: "/pages/recipe/index"
  },
  {
    key: "me",
    text: "我的",
    iconName: "me",
    pagePath: "/pages/me/index"
  }
];
