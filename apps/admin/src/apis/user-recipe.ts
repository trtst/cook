import { requestData, type IsoDateTime, type PageQuery, type PageResult, type UUID } from "./http";

export interface AdminRecipeDomainUser {
  id: UUID;
  uid: number;
  nickname: string | null;
}

export interface AdminRecipeDomainCategory {
  id: UUID;
  name: string;
  version?: number;
}

export interface AdminRecipeDomainScene {
  id: UUID;
  name: string;
  version?: number;
}

export interface AdminRecipeDomainOverview {
  user: AdminRecipeDomainUser;
  publishedCount: number;
  draftCount: number;
  collectionCount: number;
  sceneCount: number;
  latestPublishedAt: IsoDateTime | null;
  latestDraftAt: IsoDateTime | null;
  latestCollectionAt: IsoDateTime | null;
}

export interface AdminUserPublishedRecipe {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  difficulty?: string | null;
  duration?: string | null;
  category: AdminRecipeDomainCategory;
  version: number;
  updatedAt: IsoDateTime;
}

export interface AdminUserDraftRecipe {
  id: UUID;
  recipeId: UUID | null;
  title: string | null;
  category: AdminRecipeDomainCategory | null;
  version: number;
  updatedAt: IsoDateTime;
}

export interface AdminUserCollectionSummary {
  id: UUID;
  name: string;
  recipeCount: number;
  version: number;
  updatedAt: IsoDateTime | null;
}

export interface AdminUserCollectionListResponse {
  items: AdminUserCollectionSummary[];
  totalCount: number;
}

export interface AdminUserCollectionRecipe {
  id: UUID;
  sourceRecipeId: UUID;
  title: string;
  coverImageUrl: string | null;
  difficulty?: string | null;
  duration?: string | null;
  category: AdminRecipeDomainCategory;
  scenes: AdminRecipeDomainScene[];
  contentVersionId: UUID;
  collectedAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

function getRecipeDomainPath(userId: UUID) {
  return `/admin/users/${encodeURIComponent(String(userId))}/recipe-domain`;
}

function getUserPath(userId: UUID) {
  return `/admin/users/${encodeURIComponent(String(userId))}`;
}

export const userRecipeApi = {
  getOverview(userId: UUID) {
    return requestData<AdminRecipeDomainOverview>(getRecipeDomainPath(userId));
  },
  listPublished(userId: UUID, query: PageQuery) {
    return requestData<PageResult<AdminUserPublishedRecipe>>(`${getUserPath(userId)}/recipes`, {
      query: { ...query }
    });
  },
  listDrafts(userId: UUID, query: PageQuery) {
    return requestData<PageResult<AdminUserDraftRecipe>>(`${getUserPath(userId)}/recipe-drafts`, {
      query: { ...query }
    });
  },
  listCollections(userId: UUID) {
    return requestData<AdminUserCollectionListResponse>(`${getUserPath(userId)}/collections`);
  },
  listCollectionRecipes(userId: UUID, collectionId: UUID, query: PageQuery) {
    return requestData<PageResult<AdminUserCollectionRecipe>>(
      `${getUserPath(userId)}/collections/${encodeURIComponent(String(collectionId))}/recipes`,
      {
        query: { ...query }
      }
    );
  }
};
