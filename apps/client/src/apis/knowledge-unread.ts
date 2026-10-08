import { cfg } from "@/config";
import { get } from "@/apis/http";
import type { KnowledgeChannelCode } from "@/config/knowledge-articles";

export interface KnowledgeArticleUnreadSummary {
  channels: Array<{
    channelCode: KnowledgeChannelCode;
    hasUnread: boolean;
  }>;
}

const baseUrl = `${cfg.domain}/api/site-contents/articles`;

export const knowledgeUnreadApi = {
  getSummary() {
    return get<KnowledgeArticleUnreadSummary>(`${baseUrl}/unread-summary`, undefined, { auth: true });
  }
};
