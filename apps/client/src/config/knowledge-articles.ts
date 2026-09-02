export const KNOWLEDGE_CHANNELS = {
  KITCHEN: {
    code: "KITCHEN",
    title: "厨房百事",
    description: "用什么、怎么买、怎么存、怎么备"
  },
  COOK: {
    code: "COOK",
    title: "烹调技法",
    description: "怎么做、为什么这样做、失败怎么救"
  },
  FOOD: {
    code: "FOOD",
    title: "饮食文化",
    description: "餐桌上的节气、地域、传统、人情"
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
