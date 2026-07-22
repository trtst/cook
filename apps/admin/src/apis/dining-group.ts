import { requestData, type IsoDateTime, type PageQuery, type PageResult, type UUID } from "./http";

export type DiningGroupStatus = "ACTIVE" | "FROZEN" | "ARCHIVED";

export interface AdminDiningGroupSummary {
  id: UUID;
  name: string;
  ownerId: UUID;
  status: DiningGroupStatus;
  version: number;
  memberCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AdminListDiningGroupsQuery extends PageQuery {
  keyword?: string;
  status?: DiningGroupStatus;
}

export const diningGroupApi = {
  list(query: AdminListDiningGroupsQuery) {
    return requestData<PageResult<AdminDiningGroupSummary>>("/admin/dining-groups", {
      query: { ...query }
    });
  }
};
