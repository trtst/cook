import { requestData, uploadForm, type OperationId } from "./http";

export type SystemDataPackage = {
  schemaVersion: "cook.system-data.v1";
  sourceEnvironment: "TEST" | "ONLINE";
  exportedAt: string;
  data: Record<string, unknown[]>;
};

export interface SystemDataPreview {
  schemaVersion: string;
  targetEnvironment: "TEST" | "ONLINE";
  sourceExportedAt: string | null;
  counts: Record<string, { total: number; existing: number; new: number }>;
  conflicts: string[];
  behavior: string;
}

export interface SystemDataImportResult {
  schemaVersion: string;
  targetEnvironment: "TEST" | "ONLINE";
  importedCount: number;
  counts: SystemDataPreview["counts"];
}

function fileForm(file: File) {
  const form = new FormData();
  form.append("file", file);
  return form;
}

export const systemDataApi = {
  exportPackage() {
    return requestData<SystemDataPackage>("/admin/system-data/export");
  },
  preview(file: File) {
    return uploadForm<SystemDataPreview>("/admin/system-data/preview", fileForm(file));
  },
  importPackage(file: File, idempotencyKey: OperationId) {
    return uploadForm<SystemDataImportResult>("/admin/system-data/import", fileForm(file), { idempotencyKey });
  }
};
