import { requestData } from "./http";

export interface AdminDashboardSummary {
  user: {
    total: number;
    activeCount: number;
    disabledCount: number;
  };
  diningGroup: {
    total: number;
    activeCount: number;
    memberCount: number;
  };
  recipe: {
    total: number;
    activeCount: number;
    blockedCount: number;
    recycledCount: number;
    openReportCount: number;
  };
  ingredient: {
    categoryCount: number;
    itemCount: number;
    unitCount: number;
  };
}

export const dashboardApi = {
  getSummary() {
    return requestData<AdminDashboardSummary>("/admin/dashboard/summary");
  }
};
