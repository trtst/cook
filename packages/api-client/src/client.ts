import type {
  AcceptInviteRequest,
  AcceptInviteResponse,
  AdminListDiningGroupsQuery,
  AdminListDiningGroupsResult,
  AdminListUsersQuery,
  AdminListUsersResult,
  AdminLoginRequest,
  AdminLoginResult,
  AdminUserEntitlementResponse,
  CarryItemsQuery,
  CarryItemsResponse,
  CreateMealGuestInvitationsRequest,
  CreateMealGuestInvitationsResponse,
  CreateInviteRequest,
  CreateInviteResult,
  CreateRecipeVariantRequest,
  CreateRecipeVariantResponse,
  GetCarryBackSnapshotsResponse,
  GetCurrentDiningGroupContextResponse,
  GetCurrentEntitlementsResponse,
  GetOriginalSpaceImportableDataQuery,
  GetOriginalSpaceImportableDataResponse,
  GetStorageUsageResponse,
  ImportCarryBackSnapshotRequest,
  ImportCarryBackSnapshotResponse,
  ImportOriginalSpaceDataRequest,
  ImportOriginalSpaceDataResponse,
  LeaveDiningGroupRequest,
  LeaveDiningGroupResponse,
  PasswordLoginRequest,
  PasswordLoginResult,
  RecipeDetailResponse,
  RecipeImportRequest,
  RecipeImportResponse,
  RefreshSessionResult,
  RespondMealGuestInvitationRequest,
  RespondMealGuestInvitationResponse,
  DiningGroupMembersResult,
  UpdateTasteProfileRequest,
  UpdateCurrentUserRequest,
} from "./contracts";
import { ApiClientError, HttpError, UnauthorizedError } from "./errors";
import type { ApiResponse, TasteProfileResponse, UserBasic, UUID } from "./types";

export type AuthScheme = "none" | "user" | "admin";
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface ApiRequest {
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body?: unknown;
}

export interface ApiRequestResult {
  status: number;
  body: unknown;
}

export type ApiRequestAdapter = (request: ApiRequest) => Promise<ApiRequestResult>;

export interface ApiClientOptions {
  baseUrl: string;
  request: ApiRequestAdapter;
  getAuthHeader?: (scheme: Exclude<AuthScheme, "none">) => Promise<string | null> | string | null;
  onUnauthorized?: (error: UnauthorizedError) => Promise<void> | void;
}

interface RequestOptions {
  method?: HttpMethod;
  auth?: AuthScheme;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
}

function joinUrl(baseUrl: string, path: string, query?: RequestOptions["query"]) {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const routePath = path.startsWith("/") ? path : `/${path}`;
  const queryText = Object.entries(query ?? {})
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");

  return `${base}${routePath}${queryText ? `?${queryText}` : ""}`;
}

function encodePath(value: string) {
  return encodeURIComponent(value);
}

function isApiResponse<T>(body: unknown): body is ApiResponse<T> {
  if (typeof body !== "object" || body === null) return false;

  const candidate = body as Partial<ApiResponse<T>>;
  return typeof candidate.code === "number" && typeof candidate.message === "string" && "data" in candidate;
}

async function resolveHeaders(options: ApiClientOptions, auth: AuthScheme) {
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };

  if (auth !== "none") {
    const authHeader = await options.getAuthHeader?.(auth);

    if (authHeader) {
      headers.Authorization = authHeader;
    }
  }

  return headers;
}

async function requestData<T>(options: ApiClientOptions, path: string, requestOptions: RequestOptions = {}) {
  const auth = requestOptions.auth ?? "user";
  const result = await options.request({
    url: joinUrl(options.baseUrl, path, requestOptions.query),
    method: requestOptions.method ?? "GET",
    headers: await resolveHeaders(options, auth),
    body: requestOptions.body
  });

  if (!isApiResponse<T>(result.body)) {
    if (result.status === 401) {
      const error = new UnauthorizedError();
      if (auth !== "none") {
        await options.onUnauthorized?.(error);
      }
      throw error;
    }

    if (result.status < 200 || result.status >= 300) {
      throw new HttpError(result.status, "请求失败");
    }

    throw new HttpError(result.status, "响应格式不符合契约");
  }

  if (result.body.code === 401) {
    const error = new UnauthorizedError(result.body.message, result.body.data);
    if (auth !== "none") {
      await options.onUnauthorized?.(error);
    }
    throw error;
  }

  if (result.body.code !== 0) {
    throw new ApiClientError(result.body.code, result.body.message, result.body.data);
  }

  if (result.status < 200 || result.status >= 300) {
    throw new HttpError(result.status, "请求失败");
  }

  return result.body.data;
}

export function createApiClient(options: ApiClientOptions) {
  return {
    auth: {
      loginWithPassword(body: PasswordLoginRequest) {
        return requestData<PasswordLoginResult>(options, "/auth/login", {
          method: "POST",
          auth: "none",
          body
        });
      },
      refreshSession() {
        return requestData<RefreshSessionResult>(options, "/auth/refresh", {
          method: "POST",
          auth: "user"
        });
      }
    },
    user: {
      getCurrent() {
        return requestData<UserBasic>(options, "/users/me", {
          auth: "user"
        });
      },
      updateCurrent(body: UpdateCurrentUserRequest) {
        return requestData<UserBasic>(options, "/users/me", {
          method: "PUT",
          auth: "user",
          body
        });
      },
      getTasteProfile() {
        return requestData<TasteProfileResponse>(options, "/users/me/taste-profile", {
          auth: "user"
        });
      },
      updateTasteProfile(body: UpdateTasteProfileRequest) {
        return requestData<TasteProfileResponse>(options, "/users/me/taste-profile", {
          method: "PUT",
          auth: "user",
          body
        });
      }
    },
    diningGroup: {
      getCurrent() {
        return requestData<GetCurrentDiningGroupContextResponse>(options, "/dining-groups/current", {
          auth: "user"
        });
      },
      listMembers(diningGroupId: UUID) {
        return requestData<DiningGroupMembersResult>(options, "/dining-group-members", {
          auth: "user",
          query: { diningGroupId }
        });
      },
      createInvite(body: CreateInviteRequest) {
        return requestData<CreateInviteResult>(options, "/dining-group-invites", {
          method: "POST",
          auth: "user",
          body
        });
      },
      acceptInvite(inviteToken: string, body: AcceptInviteRequest) {
        return requestData<AcceptInviteResponse>(options, `/dining-group-invites/${encodePath(inviteToken)}/accept`, {
          method: "POST",
          auth: "user",
          body
        });
      },
      leave(diningGroupId: UUID, body: LeaveDiningGroupRequest) {
        return requestData<LeaveDiningGroupResponse>(options, `/dining-groups/${encodePath(diningGroupId)}/leave`, {
          method: "POST",
          auth: "user",
          body
        });
      }
    },
    originalSpace: {
      listImportable(query: GetOriginalSpaceImportableDataQuery) {
        return requestData<GetOriginalSpaceImportableDataResponse>(options, "/original-space/importable-data", {
          auth: "user",
          query: { ...query }
        });
      },
      importData(body: ImportOriginalSpaceDataRequest) {
        return requestData<ImportOriginalSpaceDataResponse>(options, "/original-space/imports", {
          method: "POST",
          auth: "user",
          body
        });
      }
    },
    carryBack: {
      list() {
        return requestData<GetCarryBackSnapshotsResponse>(options, "/carry-back-snapshots", {
          auth: "user"
        });
      },
      listItems(query: CarryItemsQuery) {
        return requestData<CarryItemsResponse>(options, "/carry-back-snapshot-items", {
          auth: "user",
          query: { ...query }
        });
      },
      importData(snapshotId: UUID, body: ImportCarryBackSnapshotRequest) {
        return requestData<ImportCarryBackSnapshotResponse>(
          options,
          `/carry-back-snapshots/${encodePath(snapshotId)}/imports`,
          {
            method: "POST",
            auth: "user",
            body
          }
        );
      }
    },
    entitlement: {
      getCurrent() {
        return requestData<GetCurrentEntitlementsResponse>(options, "/entitlements/current", {
          auth: "user"
        });
      }
    },
    storage: {
      getUsage() {
        return requestData<GetStorageUsageResponse>(options, "/storage-usage", {
          auth: "user"
        });
      }
    },
    mealGuest: {
      create(mealPlanId: UUID, body: CreateMealGuestInvitationsRequest) {
        return requestData<CreateMealGuestInvitationsResponse>(
          options,
          `/meal-plans/${encodePath(mealPlanId)}/guest-invitations`,
          {
            method: "POST",
            auth: "user",
            body
          }
        );
      },
      respond(invitationId: UUID, body: RespondMealGuestInvitationRequest) {
        return requestData<RespondMealGuestInvitationResponse>(
          options,
          `/meal-guest-invitations/${encodePath(invitationId)}/respond`,
          {
            method: "POST",
            auth: "user",
            body
          }
        );
      }
    },
    recipe: {
      get(recipeId: UUID) {
        return requestData<RecipeDetailResponse>(options, `/recipes/${encodePath(recipeId)}`, {
          auth: "user"
        });
      },
      importRecipe(body: RecipeImportRequest) {
        return requestData<RecipeImportResponse>(options, "/recipe-imports", {
          method: "POST",
          auth: "user",
          body
        });
      },
      createVariant(body: CreateRecipeVariantRequest) {
        return requestData<CreateRecipeVariantResponse>(options, "/recipe-variants", {
          method: "POST",
          auth: "user",
          body
        });
      }
    },
    admin: {
      login(body: AdminLoginRequest) {
        return requestData<AdminLoginResult>(options, "/admin/auth/login", {
          method: "POST",
          auth: "none",
          body
        });
      },
      listUsers(query: AdminListUsersQuery) {
        return requestData<AdminListUsersResult>(options, "/admin/users", {
          auth: "admin",
          query: { ...query }
        });
      },
      listDiningGroups(query: AdminListDiningGroupsQuery) {
        return requestData<AdminListDiningGroupsResult>(options, "/admin/dining-groups", {
          auth: "admin",
          query: { ...query }
        });
      },
      getUserEntitlements(userId: UUID) {
        return requestData<AdminUserEntitlementResponse>(options, "/admin/user-entitlements", {
          auth: "admin",
          query: { userId }
        });
      }
    }
  };
}
