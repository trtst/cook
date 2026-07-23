import { cfg } from "@/config";
import { get, post, put, type IsoDateTime, type PageResult, type UUID } from "./http";

export interface RecipeIngredientInput {
	name: string;
	amount: string;
}

export interface RecipeStepInput {
	content: string;
}

export interface RecipeImageInput {
	key: string;
	url: string;
	sizeBytes: number;
}

export interface RecipeContentInput {
	name: string;
	ingredients: RecipeIngredientInput[];
	steps: RecipeStepInput[];
	servings: string | null;
	durationMinutes: number | null;
}

export interface RecipeContentPayload extends RecipeContentInput {
	images: RecipeImageInput[];
}

export interface RecipeSummary {
	id: UUID;
	ownerType: "USER" | "SYSTEM";
	title: string;
	coverImageUrl: string | null;
	sourceRecipeId: UUID | null;
	isCustomized: boolean;
	status: "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED";
	updatedAt: IsoDateTime;
}

export interface RecipeDetail extends RecipeSummary {
	ownerUid: number | null;
	content: RecipeContentPayload;
	hiddenBaseImages: string[];
	canEdit: boolean;
	canImport: boolean;
	version: number;
	createdAt: IsoDateTime;
}

export interface RecipeListQuery {
	page?: number;
	pageSize?: number;
	keyword?: string;
	scope?: "mine" | "system" | "all";
}

export interface ImportRecipeResult {
	recipe: RecipeDetail;
	reusedExisting: boolean;
}

export interface DeleteRecipeResult {
	recipeId: UUID;
	status: "RECYCLED" | "DELETED";
	deletedAt: IsoDateTime;
	recycledUntil: IsoDateTime | null;
}

export interface RecipeReportResult {
	id: UUID;
	recipeId: UUID;
	reporterUid: number;
	reason: string;
	status: "OPEN" | "RESOLVED";
	createdAt: IsoDateTime;
}

export interface CreateRecipeRequest {
	operationId: UUID;
	content: RecipeContentInput;
}

export interface UpdateRecipeRequest extends CreateRecipeRequest {
	expectedVersion: number;
}

export const recipeApi = {
	/**
	 * 分页读取菜谱列表。
	 * `scope` 决定读取个人菜谱、系统菜谱或合并视图。
	 */
	list(query: RecipeListQuery) {
		return get<PageResult<RecipeSummary>>(`${cfg.domain}/api/recipes`, { ...query });
	},
	/**
	 * 读取单个菜谱详情。
	 * 返回有效正文、可编辑性、可导入性和版本信息。
	 */
	getDetail(recipeId: UUID) {
		return get<RecipeDetail>(`${cfg.domain}/api/recipes/${encodeURIComponent(recipeId)}`);
	},
	/**
	 * 创建当前用户自己的菜谱。
	 * 正文通过结构化 `content` 写入，写操作携带 `operationId`。
	 */
	create(body: CreateRecipeRequest) {
		return post<RecipeDetail>(`${cfg.domain}/api/recipes`, body);
	},
	/**
	 * 更新当前用户可编辑的菜谱。
	 * 系统菜谱不能直接修改，导入后按个人菜谱规则编辑。
	 */
	update(recipeId: UUID, body: UpdateRecipeRequest) {
		return put<RecipeDetail>(`${cfg.domain}/api/recipes/${encodeURIComponent(recipeId)}`, body);
	},
	/**
	 * 导入系统或可导入菜谱为当前用户自己的菜谱入口。
	 * 重复导入由服务端返回复用结果，不在客户端复制判断。
	 */
	importRecipe(recipeId: UUID, operationId: UUID) {
		return post<ImportRecipeResult>(`${cfg.domain}/api/recipes/${encodeURIComponent(recipeId)}/import`, { operationId });
	},
	/**
	 * 删除当前用户自己的菜谱。
	 * 服务端根据套餐和回收站规则决定进入回收站或直接删除。
	 */
	deleteRecipe(recipeId: UUID, operationId: UUID, expectedVersion: number) {
		return post<DeleteRecipeResult>(`${cfg.domain}/api/recipes/${encodeURIComponent(recipeId)}/delete`, {
			operationId,
			expectedVersion
		});
	},
	/**
	 * 举报可见菜谱内容。
	 * 只提交原因和幂等 ID，审核状态由后台处理。
	 */
	reportRecipe(recipeId: UUID, operationId: UUID, reason: string) {
		return post<RecipeReportResult>(`${cfg.domain}/api/recipes/${encodeURIComponent(recipeId)}/report`, {
			operationId,
			reason
		});
	}
};
