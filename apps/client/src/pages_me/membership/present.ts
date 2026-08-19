import type { UserMembership } from "@/apis/user";

export type MembershipTier = UserMembership["tier"];

export interface TierPolicyCard {
  tier: MembershipTier;
  title: string;
  summary: string;
  recipeLimit: string;
  storageLimit: string;
  displayPolicy: string;
  recyclePolicy: string;
  adPolicy: string;
  notes: string[];
}

export const formalSkuLabels = [
  {
    code: "PLUS_30D",
    title: "Plus 月卡",
    status: "当前开放"
  },
  {
    code: "PRO_30D",
    title: "Pro 月卡",
    status: "当前开放"
  },
  {
    code: "PLUS_90D / PLUS_365D / PRO_90D / PRO_365D",
    title: "季卡 / 年卡",
    status: "已预留，默认不可核销"
  }
] as const;

export const tierPolicyCards: TierPolicyCard[] = [
  {
    tier: "FREE",
    title: "Free",
    summary: "保留基础做饭闭环与基础广告位。",
    recipeLimit: "50 道菜谱",
    storageLimit: "100 MB",
    displayPolicy: "默认样式与基础页面壳子",
    recyclePolicy: "删除后直接永久删除",
    adPolicy: "展示普通被动广告位，可主动看激励广告",
    notes: ["无我的页背景图", "无首页背景图", "不开放额外展示资源"]
  },
  {
    tier: "PLUS",
    title: "Plus",
    summary: "扩展个人容量与基础展示权益，减少高打扰广告位。",
    recipeLimit: "120 道菜谱",
    storageLimit: "300 MB",
    displayPolicy: "开放我的页背景图与基础主题皮肤",
    recyclePolicy: "回收站保留 3 天",
    adPolicy: "减少高打扰被动广告位，激励广告仍可主动触发",
    notes: ["开放我的页背景图", "开放基础主题皮肤", "首页背景图仍关闭"]
  },
  {
    tier: "PRO",
    title: "Pro",
    summary: "当前主推正式会员，开放完整个人展示权益。",
    recipeLimit: "200 道菜谱",
    storageLimit: "500 MB",
    displayPolicy: "开放首页背景图与完整个人展示",
    recyclePolicy: "回收站保留 5 天",
    adPolicy: "默认不展示被动广告位，激励广告仅在用户主动领取额外次数时出现",
    notes: ["开放首页背景图", "开放完整个人展示资源", "当前体验码固定映射到 Pro"]
  },
  {
    tier: "ULTRA",
    title: "Ultra",
    summary: "保留更高档位能力，当前不作为首发销售入口。",
    recipeLimit: "350 道菜谱",
    storageLimit: "2 GB",
    displayPolicy: "开放全部展示资源与更高容量",
    recyclePolicy: "回收站保留 7 天",
    adPolicy: "默认不展示被动广告位",
    notes: ["开放全部主题资源", "开放全部个性化展示资源", "当前不在兑换码首发范围内"]
  }
];

export const trialRules = [
  "体验码天数只允许 1 / 3 / 7 三档，不能自由输入其他天数。",
  "同一用户累计体验天数最多 7 天；超过后应直接发正式 Plus / Pro 会员。",
  "已有有效 Plus / Pro / Ultra 会员的用户，不能再兑换体验码。",
  "体验批次可以分批生成和分批停用，单批泄露时只停该批。"
] as const;

export const redeemRules = [
  "兑换成功后，会员时长到账当前登录账号。",
  "正式码 30 天内同一账号只可成功兑换 1 次。",
  "兑换失败按业务提示返回。"
] as const;

export const creditRules = [
  "做饭助手、识图等次数型能力后续单独记账，不按会员无限承诺。",
  "激励广告优先用于换次数或体验资格，不直接替代正式会员销售规则。"
] as const;

export function formatTierLabel(tier: MembershipTier) {
  if (tier === "ULTRA") return "Ultra";
  if (tier === "PRO") return "Pro";
  if (tier === "PLUS") return "Plus";
  return "Free";
}

export function formatTierSummary(tier: MembershipTier) {
  if (tier === "ULTRA") return "更高档位预留";
  if (tier === "PRO") return "完整个人会员权益";
  if (tier === "PLUS") return "基础会员权益";
  return "当前未开通会员";
}

export function formatValidUntil(validUntil: string | null) {
  if (!validUntil) return "当前没有有效会员时长";
  const value = new Date(validUntil);
  if (Number.isNaN(value.getTime())) return "有效期按服务端到账结果为准";
  const yyyy = value.getFullYear();
  const mm = `${value.getMonth() + 1}`.padStart(2, "0");
  const dd = `${value.getDate()}`.padStart(2, "0");
  return `有效期至 ${yyyy}-${mm}-${dd}`;
}
