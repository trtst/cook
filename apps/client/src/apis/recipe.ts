import { cfg } from "@/config";
import { get, post, put, type IsoDateTime, type PageResult, type OperationId, type UUID } from "./http";

export type RecipeDifficulty = "BEGINNER" | "EASY" | "SKILLED" | "CHALLENGING";
export type RecipeDuration = "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60";
export type UnitType = "WEIGHT" | "VOLUME" | "COUNT" | "SHAPE" | "CONTAINER" | "PACKAGE" | "OTHER";
export type IngredientSource = "SYSTEM" | "PERSONAL";
export type InspirationSort = "RECOMMENDED" | "LATEST";

export type RecipeAmountInput =
	| {
			kind: "EXACT";
			quantity: string;
			unitId: UUID;
	  }
	| {
			kind: "FUZZY";
			text: "适量" | "少许" | "按需";
	  };

export type RecipeAmountSnapshot =
	| {
			kind: "EXACT";
			quantity: string;
			unitId: UUID;
			unitName: string;
			unitType: UnitType;
	  }
	| {
			kind: "FUZZY";
			text: "适量" | "少许" | "按需";
	  };

export interface RecipeCategorySummary {
	id: UUID;
	name: string;
	version: number;
}

export interface RecipeSceneSummary {
	id: UUID;
	name: string;
	version: number;
}

export interface InspirationCategorySummary {
	id: UUID;
	name: string;
	iconKey: string | null;
}

export interface IngredientCategorySummary {
	id: UUID;
	name: string;
}

export interface UnitSummary {
	id: UUID;
	name: string;
	type: UnitType;
	source: IngredientSource;
}

export interface IngredientSummary {
	id: UUID;
	name: string;
	source: IngredientSource;
	categoryId: UUID;
	defaultUnit: UnitSummary;
	imageUrl: string | null;
	recommendationStatus: "PENDING" | "REJECTED" | null;
	version: number;
}

export interface RecipeIngredientInput {
	ingredientId: UUID;
	amount: RecipeAmountInput;
}

export interface RecipeDraftIngredientInput {
	ingredientId: UUID | null;
	name: string;
	quantity: string;
	unitId: UUID | null;
	fuzzyText: "适量" | "少许" | "按需" | null;
	categoryId: UUID | null;
	defaultUnitId: UUID | null;
	source: IngredientSource | null;
}

export interface RecipeIngredientSnapshot {
	ingredientId: UUID;
	ingredientName: string;
	source: IngredientSource;
	categoryId: UUID;
	amount: RecipeAmountSnapshot;
}

export interface RecipeStepSnapshot {
	text: string;
}

export interface RecipeContentSnapshot {
	name: string;
	story: string | null;
	baseServings: number;
	difficulty: RecipeDifficulty | null;
	duration: RecipeDuration | null;
	tips: string | null;
	ingredients: RecipeIngredientSnapshot[];
	steps: RecipeStepSnapshot[];
}

export interface RecipeDraftContentInput {
	name: string;
	story: string | null;
	categoryId: UUID | null;
	sceneIds: UUID[];
	baseServings: number | null;
	difficulty: RecipeDifficulty | null;
	duration: RecipeDuration | null;
	tips: string | null;
	ingredients: RecipeDraftIngredientInput[];
	steps: RecipeStepSnapshot[];
}

export interface RecipeDraftSummary {
	id: UUID;
	recipeId: UUID | null;
	title: string | null;
	category: RecipeCategorySummary | null;
	version: number;
	updatedAt: IsoDateTime;
}

export interface RecipeDraftDetail {
	id: UUID;
	recipeId: UUID | null;
	version: number;
	content: RecipeDraftContentInput;
	ingredientRefs: IngredientSummary[];
	unitRefs: UnitSummary[];
	category: RecipeCategorySummary | null;
	scenes: RecipeSceneSummary[];
	createdAt: IsoDateTime;
	updatedAt: IsoDateTime;
}

export interface SaveRecipeDraftResponse {
	id: UUID;
	recipeId: UUID | null;
	version: number;
	updatedAt: IsoDateTime;
}

export interface MyRecipeSummary {
	id: UUID;
	title: string;
	coverImageUrl: string | null;
	difficulty: RecipeDifficulty | null;
	duration: RecipeDuration | null;
	category: RecipeCategorySummary;
	version: number;
	updatedAt: IsoDateTime;
}

export interface MyRecipeDetail {
	id: UUID;
	title: string;
	coverImageUrl: string | null;
	category: RecipeCategorySummary;
	scenes: RecipeSceneSummary[];
	contentVersionId: UUID;
	content: RecipeContentSnapshot;
	ingredientRefs: IngredientSummary[];
	unitRefs: UnitSummary[];
	status: "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED";
	version: number;
	createdAt: IsoDateTime;
	updatedAt: IsoDateTime;
}

export interface CollectionSceneSummary {
	id: UUID;
	name: string;
	version: number;
	recipeCount: number;
	updatedAt: IsoDateTime | null;
}

export interface CollectionListResponse {
	items: CollectionSceneSummary[];
	totalCount: number;
}

export interface CollectedRecipeSummary {
	id: UUID;
	sourceRecipeId: UUID;
	title: string;
	coverImageUrl: string | null;
	difficulty: RecipeDifficulty | null;
	duration: RecipeDuration | null;
	category: InspirationCategorySummary;
	scenes: RecipeSceneSummary[];
	contentVersionId: UUID;
	collectedAt: IsoDateTime;
	updatedAt: IsoDateTime;
}

export interface CollectedRecipeDetail {
	id: UUID;
	sourceRecipeId: UUID;
	title: string;
	coverImageUrl: string | null;
	category: InspirationCategorySummary;
	scenes: RecipeSceneSummary[];
	contentVersionId: UUID;
	content: RecipeContentSnapshot;
	collectedAt: IsoDateTime;
	updatedAt: IsoDateTime;
}

export interface InspirationRecipeSummary {
	id: UUID;
	title: string;
	coverImageUrl: string | null;
	difficulty: RecipeDifficulty | null;
	duration: RecipeDuration | null;
	category: InspirationCategorySummary;
	likeCount: number;
	collectCount: number;
	updatedAt: IsoDateTime;
}

export interface InspirationRecipeDetail {
	id: UUID;
	title: string;
	coverImageUrl: string | null;
	category: InspirationCategorySummary;
	contentVersionId: UUID;
	content: RecipeContentSnapshot;
	likeCount: number;
	collectCount: number;
	curatedByName: string | null;
	updatedAt: IsoDateTime;
}

export interface RecipeReportResult {
	id: UUID;
	recipeId: UUID;
	reporterUid: number;
	reason: string;
	status: "OPEN" | "RESOLVED";
	createdAt: IsoDateTime;
}

export interface DeleteRecipeDraftResult {
	draftId: UUID;
	deletedAt: IsoDateTime;
}

export interface DeleteRecipeResult {
	recipeId: UUID;
	status: "RECYCLED" | "DELETED";
	deletedAt: IsoDateTime;
	recycledUntil: IsoDateTime | null;
}

export interface PublishRecipeDraftResult {
	recipe: MyRecipeDetail;
}

export interface ReorderItem {
	id: UUID;
	expectedVersion: number;
}

export interface IngredientQuery {
	page?: number;
	pageSize?: number;
	keyword?: string;
	categoryId?: UUID;
	source?: "SYSTEM" | "PERSONAL" | "ALL";
}

export interface UnitQuery {
	page?: number;
	pageSize?: number;
	keyword?: string;
	type?: UnitType;
	source?: "SYSTEM" | "PERSONAL" | "ALL";
}

export interface RecipeDraftQuery {
	page?: number;
	pageSize?: number;
	keyword?: string;
}

export interface MyRecipeQuery {
	page?: number;
	pageSize?: number;
	keyword?: string;
	categoryId?: UUID;
}

export interface InspirationRecipeQuery {
	page?: number;
	pageSize?: number;
	keyword?: string;
	categoryId?: UUID;
	sort?: InspirationSort;
	difficulty?: RecipeDifficulty;
	duration?: RecipeDuration;
}

export interface CollectionRecipeQuery {
	page?: number;
	pageSize?: number;
	sceneId?: UUID;
}

export interface CreateRecipeDraftRequest {
	operationId: OperationId;
	recipeId: UUID | null;
	content: RecipeDraftContentInput;
}

export interface UpdateRecipeDraftRequest {
	operationId: OperationId;
	expectedVersion: number;
	content: RecipeDraftContentInput;
}

export interface PublishRecipeDraftRequest {
	operationId: OperationId;
	expectedVersion: number;
}

export interface DeleteRecipeDraftRequest extends PublishRecipeDraftRequest {}

export interface RenameTagRequest extends PublishRecipeDraftRequest {
	name: string;
}

export interface CreateTagRequest {
	operationId: OperationId;
	name: string;
}

export interface CreateUnitRequest {
	operationId: OperationId;
	name: string;
	type: UnitType;
}

export interface CreateIngredientRequest {
	operationId: OperationId;
	name: string;
	categoryId: UUID;
	defaultUnitId: UUID;
}

export interface UpdateIngredientRequest extends CreateIngredientRequest {
	expectedVersion: number;
}

export type IngredientRecommendationStatus = "PENDING" | "REJECTED" | "ADOPTED" | "MERGED";

export interface IngredientRecommendationSummary {
	id: UUID;
	ingredientId: UUID;
	ingredientVersion: number;
	ingredientName: string;
	status: IngredientRecommendationStatus;
	category: IngredientCategorySummary;
	defaultUnit: UnitSummary;
	reviewNote: string | null;
	reviewAdvice: string | null;
	adoptedIngredient: IngredientSummary | null;
	mergedIngredient: IngredientSummary | null;
	createdAt: IsoDateTime;
	updatedAt: IsoDateTime;
	reviewedAt: IsoDateTime | null;
}

export interface IngredientRecommendationQuery {
	page?: number;
	pageSize?: number;
}

export interface RecommendIngredientRequest {
	operationId: OperationId;
}

export interface SaveCollectionRecipeRequest {
	operationId: OperationId;
	sourceRecipeId: UUID;
	sourceVersionId: UUID;
	sceneIds: UUID[];
}

export interface SaveCollectionRecipeResponse {
	recipe: CollectedRecipeDetail;
}

function assertSaveRecipeDraftResponse(result: SaveRecipeDraftResponse) {
	if (!Number.isInteger(Number(result.id)) || Number(result.id) < 1) {
		throw new Error("草稿保存响应缺少草稿ID");
	}
	if (!Number.isInteger(result.version) || result.version < 1) {
		throw new Error("草稿保存响应版本无效");
	}
	if (!result.updatedAt) {
		throw new Error("草稿保存响应时间无效");
	}
	return result;
}

export const recipeApi = {
	listCategories() {
		return get<RecipeCategorySummary[]>(`${cfg.domain}/api/recipe-categories`);
	},
	createCategory(body: CreateTagRequest) {
		return post<RecipeCategorySummary>(`${cfg.domain}/api/recipe-categories`, { name: body.name }, { idempotencyKey: body.operationId });
	},
	updateCategory(categoryId: UUID, body: RenameTagRequest) {
		return put<RecipeCategorySummary>(
			`${cfg.domain}/api/recipe-categories/${encodeURIComponent(String(categoryId))}`,
			{ expectedVersion: body.expectedVersion, name: body.name },
			{ idempotencyKey: body.operationId }
		);
	},
	reorderCategories(operationId: OperationId, items: ReorderItem[]) {
		return post<RecipeCategorySummary[]>(`${cfg.domain}/api/recipe-categories/reorder`, { items }, { idempotencyKey: operationId });
	},
	listScenes() {
		return get<RecipeSceneSummary[]>(`${cfg.domain}/api/recipe-scenes`);
	},
	createScene(body: CreateTagRequest) {
		return post<RecipeSceneSummary>(`${cfg.domain}/api/recipe-scenes`, { name: body.name }, { idempotencyKey: body.operationId });
	},
	updateScene(sceneId: UUID, body: RenameTagRequest) {
		return put<RecipeSceneSummary>(
			`${cfg.domain}/api/recipe-scenes/${encodeURIComponent(String(sceneId))}`,
			{ expectedVersion: body.expectedVersion, name: body.name },
			{ idempotencyKey: body.operationId }
		);
	},
	reorderScenes(operationId: OperationId, items: ReorderItem[]) {
		return post<RecipeSceneSummary[]>(`${cfg.domain}/api/recipe-scenes/reorder`, { items }, { idempotencyKey: operationId });
	},
	listIngredientCategories() {
		return get<IngredientCategorySummary[]>(`${cfg.domain}/api/ingredient-categories`);
	},
	listIngredients(query: IngredientQuery) {
		return get<PageResult<IngredientSummary>>(`${cfg.domain}/api/ingredients`, { ...query });
	},
	createIngredient(body: CreateIngredientRequest) {
		const { operationId, ...payload } = body;
		return post<IngredientSummary>(`${cfg.domain}/api/ingredients`, payload, { idempotencyKey: operationId });
	},
	updateIngredient(ingredientId: UUID, body: UpdateIngredientRequest) {
		const { operationId, ...payload } = body;
		return put<IngredientSummary>(`${cfg.domain}/api/ingredients/${encodeURIComponent(String(ingredientId))}`, payload, {
			idempotencyKey: operationId
		});
	},
	recommendIngredient(ingredientId: UUID, body: RecommendIngredientRequest) {
		return post<IngredientRecommendationSummary>(
			`${cfg.domain}/api/ingredients/${encodeURIComponent(String(ingredientId))}/recommendations`,
			undefined,
			{ idempotencyKey: body.operationId }
		);
	},
	listIngredientRecommendations(query: IngredientRecommendationQuery) {
		return get<PageResult<IngredientRecommendationSummary>>(`${cfg.domain}/api/ingredient-recommendations`, { ...query });
	},
	listUnits(query: UnitQuery) {
		return get<PageResult<UnitSummary>>(`${cfg.domain}/api/units`, { ...query });
	},
	createUnit(body: CreateUnitRequest) {
		const { operationId, ...payload } = body;
		return post<UnitSummary>(`${cfg.domain}/api/units`, payload, { idempotencyKey: operationId });
	},
	listDrafts(query: RecipeDraftQuery) {
		return get<PageResult<RecipeDraftSummary>>(`${cfg.domain}/api/recipe-drafts`, { ...query });
	},
	async createDraft(body: CreateRecipeDraftRequest) {
		const { operationId, ...payload } = body;
		const result = await post<SaveRecipeDraftResponse>(`${cfg.domain}/api/recipe-drafts`, payload, { idempotencyKey: operationId });
		return assertSaveRecipeDraftResponse(result);
	},
	getDraft(draftId: UUID) {
		return get<RecipeDraftDetail>(`${cfg.domain}/api/recipe-drafts/${encodeURIComponent(String(draftId))}`);
	},
	async updateDraft(draftId: UUID, body: UpdateRecipeDraftRequest) {
		const { operationId, ...payload } = body;
		const result = await put<SaveRecipeDraftResponse>(
			`${cfg.domain}/api/recipe-drafts/${encodeURIComponent(String(draftId))}`,
			payload,
			{ idempotencyKey: operationId }
		);
		return assertSaveRecipeDraftResponse(result);
	},
	deleteDraft(draftId: UUID, body: DeleteRecipeDraftRequest) {
		return post<DeleteRecipeDraftResult>(
			`${cfg.domain}/api/recipe-drafts/${encodeURIComponent(String(draftId))}/delete`,
			{ expectedVersion: body.expectedVersion },
			{ idempotencyKey: body.operationId }
		);
	},
	publishDraft(draftId: UUID, body: PublishRecipeDraftRequest) {
		return post<PublishRecipeDraftResult>(
			`${cfg.domain}/api/recipe-drafts/${encodeURIComponent(String(draftId))}/publish`,
			{ expectedVersion: body.expectedVersion },
			{ idempotencyKey: body.operationId }
		);
	},
	listMyRecipes(query: MyRecipeQuery) {
		return get<PageResult<MyRecipeSummary>>(`${cfg.domain}/api/recipes`, { ...query });
	},
	getMyRecipe(recipeId: UUID) {
		return get<MyRecipeDetail>(`${cfg.domain}/api/recipes/${encodeURIComponent(String(recipeId))}`);
	},
	listCollections() {
		return get<CollectionListResponse>(`${cfg.domain}/api/collections`);
	},
	listCollectionRecipes(query: CollectionRecipeQuery) {
		return get<PageResult<CollectedRecipeSummary>>(`${cfg.domain}/api/collections/recipes`, { ...query });
	},
	getCollectionRecipe(collectionRecipeId: UUID) {
		return get<CollectedRecipeDetail>(`${cfg.domain}/api/collections/recipes/${encodeURIComponent(String(collectionRecipeId))}`);
	},
	collectRecipe(body: SaveCollectionRecipeRequest) {
		const { operationId, ...payload } = body;
		return post<SaveCollectionRecipeResponse>(`${cfg.domain}/api/collections/recipes`, payload, { idempotencyKey: operationId });
	},
	reorderRecipes(operationId: OperationId, categoryId: UUID, items: ReorderItem[]) {
		return post<MyRecipeSummary[]>(`${cfg.domain}/api/recipes/reorder`, { categoryId, items }, { idempotencyKey: operationId });
	},
	deleteRecipe(recipeId: UUID, operationId: OperationId, expectedVersion: number) {
		return post<DeleteRecipeResult>(
			`${cfg.domain}/api/recipes/${encodeURIComponent(String(recipeId))}/delete`,
			{ expectedVersion },
			{ idempotencyKey: operationId }
		);
	},
	listInspirationCategories() {
		return get<InspirationCategorySummary[]>(`${cfg.domain}/api/inspiration-categories`, undefined, {
			auth: false
		});
	},
	listInspirationRecipes(query: InspirationRecipeQuery) {
		return get<PageResult<InspirationRecipeSummary>>(`${cfg.domain}/api/inspiration-recipes`, { ...query }, { auth: false });
	},
	getInspirationRecipe(recipeId: UUID) {
		return get<InspirationRecipeDetail>(`${cfg.domain}/api/inspiration-recipes/${encodeURIComponent(String(recipeId))}`, undefined, { auth: false });
	},
	reportRecipe(recipeId: UUID, operationId: OperationId, reason: string) {
		return post<RecipeReportResult>(
			`${cfg.domain}/api/recipes/${encodeURIComponent(String(recipeId))}/report`,
			{ reason },
			{ idempotencyKey: operationId }
		);
	}
};
