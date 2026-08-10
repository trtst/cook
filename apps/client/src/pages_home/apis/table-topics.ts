import { cfg } from "@/config";
import { get, post } from "@/apis/http";

export type TableTopicTargetType = "PAGE" | "WEB_VIEW";

export interface TableTopicListItem {
  id: number;
  title: string;
  coverImageUrl: string | null;
  activityAt: string;
  participantCount: number;
}

export interface TableTopicDetail extends TableTopicListItem {
  summary: string;
  joined: boolean;
  targetType: TableTopicTargetType;
  targetValue: string | null;
}

interface TableTopicListResponse {
  items: TableTopicListItem[];
}

interface TableTopicDetailResponse {
  topic: TableTopicDetail;
}

export const tableTopicsApi = {
  getTopics() {
    return get<TableTopicListResponse>(`${cfg.domain}/api/table-topics`, undefined, { auth: false });
  },
  getTopic(topicId: number) {
    return get<TableTopicDetailResponse>(`${cfg.domain}/api/table-topics/${encodeURIComponent(String(topicId))}`);
  },
  participate(topicId: number, operationId: string) {
    return post<TableTopicDetailResponse>(
      `${cfg.domain}/api/table-topics/${encodeURIComponent(String(topicId))}/participate`,
      undefined,
      { idempotencyKey: operationId }
    );
  }
};
