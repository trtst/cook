import storyBasilArt from "@/assets/img/story-basil.svg";
import storyCitrusArt from "@/assets/img/story-citrus.svg";
import storyCuttingBoardArt from "@/assets/img/story-cutting-board.svg";
import storyMarketToteArt from "@/assets/img/story-market-tote.svg";
import storyMenuCardArt from "@/assets/img/story-menu-card.svg";
import storyPapayaArt from "@/assets/img/story-papaya.svg";
import storyPantryBasketArt from "@/assets/img/story-pantry-basket.svg";
import storySkilletArt from "@/assets/img/story-skillet.svg";
import storyStockpotArt from "@/assets/img/story-stockpot.svg";
import storyTomatoesArt from "@/assets/img/story-tomatoes.svg";

export type ThemeMode = "system" | "light" | "dark";

export interface SiteLink {
  label: string;
  to: string;
}

export interface SiteHeroAsset {
  slot: "citrus" | "basil" | "papaya" | "tomatoes";
  src: string;
  alt: string;
}

export interface SiteNarrativeLine {
  label: string;
  title: string;
  summary: string;
  art: string;
  artAlt: string;
}

export interface SiteFlowStep {
  index: string;
  title: string;
  summary: string;
  detail: string;
  tone: "forest" | "mist" | "amber";
  art: string;
  artAlt: string;
  artSecondary?: string;
  artSecondaryAlt?: string;
}

export interface SiteRhythmStep {
  index: string;
  title: string;
  summary: string;
  detail: string;
  tone: "forest" | "mist" | "amber";
  art: string;
  artAlt: string;
  artSecondary?: string;
  artSecondaryAlt?: string;
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
  heroEyebrow: "给日常下厨的家",
  heroTitle: "把做饭这件事，过得更从容一点",
  heroSummary: "从一餐一饭的想法，到备菜、采购、开火，炊火记把家里的下厨日常，慢慢理顺。",
  primaryCta: { label: "了解产品", to: "/product" },
  secondaryCta: { label: "生活指南", to: "/guides/kitchen-prep" },
  visualTags: ["慢慢理顺", "日常开火"],
  frictionTitle: "做饭麻烦的，从来不是下锅那一刻。",
  frictionSummary: "真正消耗心力的，是开火之前那些零碎的决定和准备。",
  flowTitle: "决定，准备，开火。",
  flowSummary: "把一顿饭真正会经历的流程排顺，而不是堆出更多零散入口。",
  rhythmTitle: "食材到位，步骤接上，最后成一顿饭。",
  rhythmSummary: "把做饭这件事，慢慢带回它本来的节奏里。",
  closeTitle: "产品说明、FAQ 和生活内容，也放在同一条链路里。",
  closeSummary: "在 PC 上平铺阅读，在小程序里原样打开。想继续了解炊火记，或翻回厨房内容时，都还能顺着这份日常流程往下看。",
  featuredDocSlugs: ["about", "privacy", "faq", "terms"] as const
};

export const SITE_HERO_ASSETS: SiteHeroAsset[] = [
  { slot: "citrus", src: storyCitrusArt, alt: "柑橘果盘插画" },
  { slot: "basil", src: storyBasilArt, alt: "罗勒叶插画" },
  { slot: "papaya", src: storyPapayaArt, alt: "木瓜插画" },
  { slot: "tomatoes", src: storyTomatoesArt, alt: "番茄串插画" }
] as const;

export const SITE_FRICTION_LINES: SiteNarrativeLine[] = [
  {
    label: "01",
    title: "想吃什么",
    summary: "脑子里闪过很多念头，真正开始决定，往往已经到了最饿的时候。",
    art: storyMenuCardArt,
    artAlt: "菜单卡片插画"
  },
  {
    label: "02",
    title: "家里还有什么",
    summary: "冰箱、橱柜和记忆总是对不上，备菜之前，难免要反复确认。",
    art: storyPantryBasketArt,
    artAlt: "食材篮子插画"
  },
  {
    label: "03",
    title: "还要不要再买一趟",
    summary: "缺的东西常常到最后才发现，一顿饭的节奏，也就这样被打断了。",
    art: storyMarketToteArt,
    artAlt: "采购手提袋插画"
  }
] as const;

export const SITE_FLOW_STEPS: SiteFlowStep[] = [
  {
    index: "01",
    title: "先决定",
    summary: "把想吃什么，慢慢收成一顿饭。",
    detail: "从脑海里的念头、收藏过的菜谱，到家里这顿到底吃什么，先把这一顿定下来。",
    tone: "forest",
    art: storyMenuCardArt,
    artAlt: "菜单卡片插画"
  },
  {
    index: "02",
    title: "再准备",
    summary: "先看看家里有什么，再把缺口补齐。",
    detail: "采购不再凭感觉一再发生，而是围着家里还缺什么、顺手该补什么来安排。",
    tone: "mist",
    art: storyCuttingBoardArt,
    artAlt: "切菜板插画"
  },
  {
    index: "03",
    title: "最后开火",
    summary: "让菜谱和厨房经验，在真正做饭的时候接上。",
    detail: "真正下厨时，步骤、火候和准备经验出现在正要用到的位置，而不是散在别的页面里。",
    tone: "amber",
    art: storyStockpotArt,
    artAlt: "炖锅插画",
    artSecondary: storySkilletArt,
    artSecondaryAlt: "平底锅插画"
  }
] as const;

export const SITE_RHYTHM_STEPS: SiteRhythmStep[] = [
  {
    index: "01",
    title: "食材先到位",
    summary: "看到的不只是清单，而是这顿饭真正要用的东西。",
    detail: "需要准备什么、家里已经有什么、哪些是这次要补的，会按做饭的顺序慢慢排清，备菜不用再反复确认。",
    tone: "forest",
    art: storyPantryBasketArt,
    artAlt: "食材篮子插画",
    artSecondary: storyBasilArt,
    artSecondaryAlt: "罗勒叶插画"
  },
  {
    index: "02",
    title: "步骤再接上",
    summary: "该做什么，就在那一步出现。",
    detail: "下锅、翻炒、调味、收汁，步骤、火候和小提醒跟着过程往前走，不用一边做，一边回头翻找。",
    tone: "mist",
    art: storySkilletArt,
    artAlt: "平底锅插画",
    artSecondary: storyCuttingBoardArt,
    artSecondaryAlt: "切菜板插画"
  },
  {
    index: "03",
    title: "最后成一顿饭",
    summary: "从想法到开火，最后落到一顿真正能端上桌的结果。",
    detail: "不是再多看一份菜谱，而是把这顿饭顺顺地做完。",
    tone: "amber",
    art: storyStockpotArt,
    artAlt: "炖锅插画",
    artSecondary: storyTomatoesArt,
    artSecondaryAlt: "番茄串插画"
  }
] as const;
