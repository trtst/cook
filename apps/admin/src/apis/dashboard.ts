import { requestData } from "./http";

export interface AdminDashboardSummary {
  overview: {
    todayNewUsers: number;
    sevenDayNewUsers: number;
    totalUsers: number;
    openReportCount: number;
    pendingRecipeCount: number;
    pendingIngredientCount: number;
    todayRedeemedCount: number;
  };
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

export interface AdminDashboardTrendPoint {
  date: string;
  label: string;
  newUsers: number;
  totalUsers: number;
  openReportCount: number;
  pendingRecipeCount: number;
  pendingIngredientCount: number;
  membershipGeneratedCount: number;
  membershipRedeemedCount: number;
}

export interface AdminDashboardTrendsResponse {
  range: "7D" | "30D";
  points: AdminDashboardTrendPoint[];
}

export const dashboardApi = {
  getSummary() {
    return requestData<AdminDashboardSummary>("/admin/dashboard/summary");
  },
  getTrends(range: "7D" | "30D") {
    return requestData<AdminDashboardTrendsResponse>("/admin/dashboard/trends", {
      query: { range }
    });
  }
};
