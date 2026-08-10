import { requestData, uploadForm, type OperationId } from "./http";

export type HomeEntryPlacement = "MAIN" | "SIDE_TOP" | "SIDE_BOTTOM" | "QUICK_1" | "QUICK_2" | "QUICK_3" | "QUICK_4";
export type HomeEntryTargetType = "PAGE" | "WEB_VIEW";
export type HomeEntryStatus = "LISTED" | "UNLISTED";

export interface AdminHomeEntryItem {
  id: string;
  placement: HomeEntryPlacement;
  title: string;
  subtitle: string | null;
  status: HomeEntryStatus;
  targetType: HomeEntryTargetType;
  targetValue: string;
  imageUrl: string | null;
  badgeText: string | null;
  version: number;
}

export interface HomeEntryPageTarget {
  label: string;
  value: string;
}

export interface AdminHomeEntriesResponse {
  items: AdminHomeEntryItem[];
  pageTargets: HomeEntryPageTarget[];
}

export interface UpdateHomeEntryItemRequest {
  placement: HomeEntryPlacement;
  title: string;
  subtitle: string | null;
  targetType: HomeEntryTargetType;
  targetValue: string;
  imageUrl: string | null;
  badgeText: string | null;
  expectedVersion: number;
}

export const homeEntriesApi = {
  getEntries() {
    return requestData<AdminHomeEntriesResponse>("/admin/home-entries");
  },
  updateEntries(items: UpdateHomeEntryItemRequest[], operationId: string) {
    return requestData<AdminHomeEntriesResponse>("/admin/home-entries", {
      method: "PUT",
      idempotencyKey: operationId,
      body: { items }
    });
  },
  uploadEntryImage(placement: HomeEntryPlacement, file: File, operationId: OperationId, expectedVersion: number) {
    const formData = new FormData();
    formData.append("expectedVersion", String(expectedVersion));
    formData.append("file", file);
    return uploadForm<AdminHomeEntryItem>(`/admin/home-entries/${encodeURIComponent(placement)}/image`, formData, {
      idempotencyKey: operationId
    });
  },
  clearEntryImage(placement: HomeEntryPlacement, operationId: OperationId, expectedVersion: number) {
    return requestData<AdminHomeEntryItem>(`/admin/home-entries/${encodeURIComponent(placement)}/image`, {
      method: "DELETE",
      body: { expectedVersion },
      idempotencyKey: operationId
    });
  },
  setEntryStatus(placement: HomeEntryPlacement, status: HomeEntryStatus, operationId: OperationId, expectedVersion: number) {
    return requestData<AdminHomeEntryItem>(`/admin/home-entries/${encodeURIComponent(placement)}/status`, {
      method: "POST",
      body: { status, expectedVersion },
      idempotencyKey: operationId
    });
  }
};
