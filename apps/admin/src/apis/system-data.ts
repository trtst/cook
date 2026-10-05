import { requestBlob, uploadForm, type OperationId } from "./http";

export const systemDataCategories = [
  { key: "users", label: "用户及个人数据", description: "账号、个人食材和单位、私房菜、计划、冰箱、购物和参与记录等" },
  { key: "medals", label: "勋章", description: "勋章模板" },
  { key: "recipeCategories", label: "菜谱分类", description: "灵感菜谱分类" },
  { key: "recipes", label: "菜谱", description: "系统菜谱及正文、营养和 Wiki 数据" },
  { key: "ingredientCategories", label: "食材分类", description: "平台食材分类" },
  { key: "systemIngredients", label: "系统食材", description: "不含个人食材" },
  { key: "nutrientFoods", label: "食材营养表", description: "低频更新，可按需选择" },
  { key: "units", label: "单位", description: "低频更新，可按需选择" },
  { key: "articles", label: "文章", description: "文章内容及正文图片" },
  { key: "articleChannels", label: "文章栏目", description: "文章所属栏目" }
] as const;

export type SystemDataCategory = (typeof systemDataCategories)[number]["key"];

export type SystemDataPackage = {
  schemaVersion: "cook.data-snapshot.v2";
  sourceEnvironment: "TEST" | "ONLINE";
  exportedAt: string;
  categories: SystemDataCategory[];
  counts: Record<string, number>;
};

export interface SystemDataCategoryCount {
  total: number;
  existing: number;
  new: number;
  removed: number;
}

export interface SystemDataDependency {
  category: SystemDataCategory | "unknown";
  label: string;
  count: number;
}

export interface SystemDataPreview {
  schemaVersion: "cook.data-snapshot.v2";
  targetEnvironment: "TEST" | "ONLINE";
  sourceExportedAt: string | null;
  categories: SystemDataCategory[];
  counts: Record<string, SystemDataCategoryCount>;
  missingDependencies: SystemDataDependency[];
  assetCount: number;
  conflicts: string[];
  previewFingerprint: string;
  behavior: string;
}

export interface SystemDataImportResult {
  schemaVersion: "cook.data-snapshot.v2";
  targetEnvironment: "TEST" | "ONLINE";
  importedCount: number;
  removedCount: number;
  counts: SystemDataPreview["counts"];
}

function fileForm(file: File, previewFingerprint?: string) {
  const form = new FormData();
  form.append("file", file);
  if (previewFingerprint) form.append("previewFingerprint", previewFingerprint);
  return form;
}

export const systemDataApi = {
  exportPackage(categories: SystemDataCategory[]) {
    const query = encodeURIComponent(categories.join(","));
    return requestBlob(`/admin/system-data/export?categories=${query}`);
  },
  preview(file: File) {
    return uploadForm<SystemDataPreview>("/admin/system-data/preview", fileForm(file));
  },
  importPackage(file: File, previewFingerprint: string, idempotencyKey: OperationId) {
    return uploadForm<SystemDataImportResult>("/admin/system-data/import", fileForm(file, previewFingerprint), { idempotencyKey });
  }
};
