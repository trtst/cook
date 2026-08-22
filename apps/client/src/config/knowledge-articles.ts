export const KNOWLEDGE_CHANNELS = {
  KITCHEN_PREP: {
    code: "KITCHEN_PREP",
    title: "厨房准备",
    description: "备菜与收纳"
  },
  COOKING_SKILLS: {
    code: "COOKING_SKILLS",
    title: "烹饪技巧",
    description: "火候与做法"
  },
  RECIPE_SKILLS: {
    code: "RECIPE_SKILLS",
    title: "食谱技巧",
    description: "配方与替换"
  }
} as const;

export type KnowledgeChannelCode = keyof typeof KNOWLEDGE_CHANNELS;

export function getKnowledgeChannel(code: string | null | undefined) {
  if (!code) return null;
  return KNOWLEDGE_CHANNELS[code as KnowledgeChannelCode] ?? null;
}

export function buildKnowledgeListPath(channelCode: KnowledgeChannelCode) {
  return `/pages_me/knowledge-list/index?channelCode=${encodeURIComponent(channelCode)}`;
}

export function buildKnowledgeDetailPath(articleId: number) {
  return `/pages_me/knowledge-detail/index?articleId=${encodeURIComponent(String(articleId))}`;
}
