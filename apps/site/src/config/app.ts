import cookingSkillsIcon from "@/assets/img/cooking-skills.svg";
import kitchenPrepIcon from "@/assets/img/kitchen-prep.svg";
import pantryIcon from "@/assets/img/pantry.svg";
import recipeSkillsIcon from "@/assets/img/recipe-skills.svg";

export type ThemeMode = "system" | "light" | "dark";

export interface SiteLink {
  label: string;
  to: string;
}

export interface SiteGuideLink {
  title: string;
  summary: string;
  path: string;
  icon: string;
}

export const SITE_NAME = "炊火记";
export const SITE_NAME_EN = "Ember";
export const SITE_SLOGAN = "炊烟晚，人归缓，烟火暖流年";
export const SITE_THEME_KEY = "cook_site_theme";

export const SITE_THEME_OPTIONS: Array<{ label: string; value: ThemeMode }> = [
  { label: "自适应", value: "system" },
  { label: "浅", value: "light" },
  { label: "深", value: "dark" }
];

export const SITE_HEADER_LINKS: SiteLink[] = [
  { label: "首页", to: "/" },
  { label: "产品", to: "/product" },
  { label: "场景", to: "/scenes" },
  { label: "FAQ", to: "/faq" },
  { label: "关于", to: "/about" }
];

export const SITE_FOOTER_LINKS: SiteLink[] = [
  { label: "隐私政策", to: "/privacy" },
  { label: "用户协议", to: "/terms" },
  { label: "更新日志", to: "/changelog" }
];

export const SITE_HOME_CONFIG = {
  heroEyebrow: "Kitchen planning for everyday life",
  heroTitleLead: "把家里的",
  heroTitleHighlight: "下一顿",
  heroTitleTail: "安排好",
  heroSummary: "从想吃什么，到备菜、采购、真正开火，炊火记把做饭这件事安排得更轻一点。",
  heroNote: "适合情侣、小家庭、经常下厨的人",
  primaryCta: { label: "先看产品", to: "/product" },
  secondaryCta: { label: "常见问题", to: "/faq" },
  visualTags: ["备菜", "厨房", "轻协作", "顺路采购"],
  guideTitle: "厨房准备、烹饪技巧、食谱技巧，都放进一套展示链路里。",
  contentTitle: "官网先负责展示，后续再接后台编辑。",
  contentSummary: "PC 平铺，小程序内嵌，未来只维护一份内容。",
  featuredDocSlugs: ["about", "privacy", "faq", "terms"] as const
};

export const SITE_PLAN_STEPS = [
  { index: "01", title: "先决定", summary: "把想吃什么收成一顿饭。" },
  { index: "02", title: "再准备", summary: "先看冰箱，再补缺口。" },
  { index: "03", title: "最后开火", summary: "菜谱和厨房技巧接上。" }
] as const;

export const SITE_GUIDE_LINKS: SiteGuideLink[] = [
  { title: "厨房准备", summary: "收纳、切配、工具顺序。", path: "/guides/kitchen-prep", icon: kitchenPrepIcon },
  { title: "烹饪技巧", summary: "火候、顺序、常见失误。", path: "/guides/cooking-skills", icon: cookingSkillsIcon },
  { title: "食谱技巧", summary: "家常菜更稳定地做出来。", path: "/guides/recipe-skills", icon: recipeSkillsIcon },
  { title: "冰箱与采购", summary: "围绕缺口安排采购。", path: "/product", icon: pantryIcon }
];

export const SITE_INGREDIENT_RIBBON = ["罗勒", "番茄", "南瓜", "迷迭香", "牛油果", "柠檬", "香菇", "蒜头"] as const;
