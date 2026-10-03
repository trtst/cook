import { requestData, type PageResult, type OperationId, type UUID } from "./http";

export type ImageGenerationType = "INGREDIENT" | "RECIPE";
export type ImageGenerationTargetType = "INGREDIENT" | "RECIPE_COVER" | "RECIPE_STEP" | "WIKI_STEP";
export type RecipeImageFilter = "ALL" | "ANY" | "COVER" | "STEP" | "WIKI_STEP";
export type ImageGenerationProviderId = "ARK_SEEDREAM" | "VOLCENGINE_CV";

export interface ImageGenerationCandidate {
  id: UUID;
  targetType: ImageGenerationTargetType;
  targetId: UUID;
  contentVersionId: UUID;
  stepOrder: number;
  prompt: string;
  tempKey: string;
}

export interface ImageGenerationSlot {
  targetType: ImageGenerationTargetType;
  targetId: UUID;
  contentVersionId: UUID;
  stepOrder: number;
  label: string;
  imageUrl: string | null;
  imagePrompt: string | null;
  candidate: ImageGenerationCandidate | null;
}

export interface ImageGenerationTarget {
  id: UUID;
  title: string;
  categoryId: UUID | null;
  categoryName: string;
  missingCount: number;
  version?: number;
  slots: ImageGenerationSlot[];
}

export interface ImageGenerationSettings {
  provider: ImageGenerationProviderId;
  version: number;
  ingredientKeywords: string;
  recipeCoverKeywords: string;
  recipeStepKeywords: string;
  updatedAt: string;
}

export const imageGenerationApi = {
  getSettings() {
    return requestData<ImageGenerationSettings>("/admin/image-generation/settings");
  },
  saveSettings(payload: Pick<ImageGenerationSettings, "provider" | "version" | "ingredientKeywords" | "recipeCoverKeywords" | "recipeStepKeywords"> & { operationId: OperationId }) {
    const { operationId, ...body } = payload;
    const { version, ...settings } = body;
    return requestData<ImageGenerationSettings>("/admin/image-generation/settings", { method: "PUT", body: { ...settings, expectedVersion: version }, idempotencyKey: operationId });
  },
  listTargets(query: { type: ImageGenerationType; categoryId?: UUID; missingOnly: boolean; recipeImageFilter: RecipeImageFilter; page?: number; pageSize?: number }) {
    const params = new URLSearchParams({ type: query.type, missingOnly: String(query.missingOnly), page: String(query.page ?? 1), pageSize: String(query.pageSize ?? 20) });
    params.set("recipeImageFilter", query.recipeImageFilter);
    if (query.categoryId) params.set("categoryId", String(query.categoryId));
    return requestData<PageResult<ImageGenerationTarget>>(`/admin/image-generation/targets?${params.toString()}`);
  },
  generate(payload: { targetType: ImageGenerationTargetType; targetId: UUID; contentVersionId?: UUID; stepOrder?: number; prompt: string; operationId: OperationId }) {
    const { operationId, ...body } = payload;
    return requestData<ImageGenerationCandidate>("/admin/image-generation/generate", { method: "POST", body, idempotencyKey: operationId });
  },
  deleteCandidate(candidateId: UUID, operationId: OperationId) {
    return requestData<{ deleted: boolean }>(`/admin/image-generation/candidates/${candidateId}`, { method: "DELETE", idempotencyKey: operationId });
  },
  applyCandidate(candidateId: UUID, payload: { operationId: OperationId; expectedVersion?: number }) {
    const { operationId, ...body } = payload;
    return requestData<{ candidateId: UUID; applied: boolean; targetType: ImageGenerationTargetType; targetId: UUID }>(`/admin/image-generation/candidates/${candidateId}/apply`, { method: "POST", body, idempotencyKey: operationId });
  }
};
