<template>
  <Layout :title="recipeId ? '编辑菜谱' : draftId ? '继续草稿' : '新建菜谱'">
    <Login
      v-if="!sessionStore.isLoggedIn"
      title="登录后维护菜谱"
      description="当前日期是 2026-07-25。草稿、发布和删除都只作用于你自己的菜谱。"
    />

    <template v-else>
      <view v-if="loading" class="notice">加载中...</view>
      <view v-else-if="errorText" class="notice" @click="loadPage">{{ errorText }}</view>

      <template v-else>
        <view class="section">
          <text class="label">菜谱名称 *</text>
          <input v-model="form.name" class="input" placeholder="例如：番茄炒蛋" />
        </view>

        <view class="section">
          <text class="label">这道菜的故事</text>
          <textarea v-model="form.story" class="textarea" placeholder="记录这道菜背后的故事" />
        </view>

        <view class="section">
          <text class="label">个人分类 *</text>
          <view v-if="categories.length" class="chip-row">
            <view
              v-for="item in categories"
              :key="item.id"
              class="chip"
              :class="{ 'chip--active': form.categoryId === item.id }"
              @click="form.categoryId = item.id"
            >
              {{ item.name }}
            </view>
          </view>
          <text v-else class="hint">当前还没有个人分类，请先通过接口或后续管理入口创建。</text>
        </view>

        <view class="section">
          <text class="label">个人场景</text>
          <view v-if="scenes.length" class="chip-row">
            <view
              v-for="item in scenes"
              :key="item.id"
              class="chip"
              :class="{ 'chip--active': form.sceneIds.includes(item.id) }"
              @click="toggleScene(item.id)"
            >
              {{ item.name }}
            </view>
          </view>
          <text v-else class="hint">还没有个人场景时可以先留空。</text>
        </view>

        <view class="section grid">
          <view>
            <text class="label">人数 *</text>
            <input v-model="form.baseServingsText" class="input" type="number" placeholder="1 - 20" />
          </view>
          <view>
            <text class="label">时长（分钟）</text>
            <input v-model="form.durationMinutesText" class="input" type="number" placeholder="例如：45" />
          </view>
        </view>

        <view class="section">
          <text class="label">难度</text>
          <view class="chip-row">
            <view
              v-for="item in difficulties"
              :key="item.value"
              class="chip"
              :class="{ 'chip--active': form.difficulty === item.value }"
              @click="form.difficulty = form.difficulty === item.value ? null : item.value"
            >
              {{ item.label }}
            </view>
          </view>
        </view>

        <view class="section">
          <text class="label">食材与用量 *</text>
          <text class="hint">每行一个：`食材名|数量|单位名`，或 `食材名|适量`。食材和单位必须已存在于系统库或你的个人库。</text>
          <textarea
            v-model="ingredientsText"
            class="textarea textarea--large"
            placeholder="鸡蛋|2|个&#10;番茄|2|个&#10;盐|适量"
          />
        </view>

        <view class="section">
          <text class="label">制作步骤 *</text>
          <text class="hint">每行一步。当前文本步骤会在发布时转成正式固定版本。</text>
          <textarea
            v-model="stepsText"
            class="textarea textarea--large"
            placeholder="番茄切块&#10;鸡蛋打散&#10;热锅翻炒"
          />
        </view>

        <view class="section">
          <text class="label">小贴士</text>
          <textarea v-model="form.tips" class="textarea" placeholder="例如：番茄先出汁会更下饭" />
        </view>

        <view class="section">
          <text class="label">预览</text>
          <text class="hint">分类：{{ currentCategoryName }}</text>
          <text class="hint">场景：{{ currentSceneText }}</text>
          <text class="hint">将按 Saturday, July 25, 2026 之后的新菜谱契约保存为草稿和固定版本。</text>
        </view>

        <view class="action-row">
          <button class="secondary" :disabled="submitting" @click="saveDraft">存草稿</button>
          <button class="primary" :disabled="submitting" @click="publishDraft">发布</button>
        </view>

        <view class="action-row" v-if="draftId || recipeId">
          <button v-if="draftId" class="light" :disabled="submitting" @click="removeDraft">删除草稿</button>
          <button v-if="recipeId" class="danger" :disabled="submitting" @click="removeRecipe">删除菜谱</button>
        </view>
      </template>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import {
	recipeApi,
	type IngredientSummary,
	type MyRecipeDetail,
	type RecipeIngredientInput,
	type RecipeDifficulty,
	type RecipeDraftContentInput,
	type RecipeDraftDetail,
	type UnitSummary
} from "@/apis/recipe";
import Login from "@/components/Login/Login.vue";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";

const sessionStore = useSessionStore();
const recipeId = ref("");
const draftId = ref("");
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const draftVersion = ref<number | null>(null);
const recipeVersion = ref<number | null>(null);
const categories = ref<Array<{ id: string; name: string; version: number }>>([]);
const scenes = ref<Array<{ id: string; name: string; version: number }>>([]);
const ingredients = ref<IngredientSummary[]>([]);
const units = ref<UnitSummary[]>([]);
const ingredientsText = ref("");
const stepsText = ref("");

const form = reactive({
	name: "",
	story: "",
	categoryId: "" as string | null,
	sceneIds: [] as string[],
	baseServingsText: "",
	difficulty: null as RecipeDifficulty | null,
	durationMinutesText: "",
	tips: ""
});

const difficulties = [
	{ value: "EASY" as const, label: "简单" },
	{ value: "MEDIUM" as const, label: "中等" },
	{ value: "HARD" as const, label: "困难" }
];
const fuzzyAmounts = ["适量", "少许", "按需"] as const;

type FuzzyAmount = (typeof fuzzyAmounts)[number];

const currentCategoryName = computed(() => categories.value.find(item => item.id === form.categoryId)?.name || "未选择");
const currentSceneText = computed(() => {
	if (!form.sceneIds.length) return "未选择";
	return scenes.value.filter(item => form.sceneIds.includes(item.id)).map(item => item.name).join("、");
});

onLoad((query) => {
	const rawRecipeId = Array.isArray(query?.recipeId) ? query.recipeId[0] : query?.recipeId;
	const rawDraftId = Array.isArray(query?.draftId) ? query.draftId[0] : query?.draftId;
	recipeId.value = typeof rawRecipeId === "string" ? decodeURIComponent(rawRecipeId) : "";
	draftId.value = typeof rawDraftId === "string" ? decodeURIComponent(rawDraftId) : "";
	if (sessionStore.isLoggedIn) {
		void loadPage();
	}
});

async function loadPage() {
	if (!sessionStore.isLoggedIn || loading.value) return;
	loading.value = true;
	errorText.value = "";
	try {
		const [categoryList, sceneList, ingredientResult, unitResult] = await Promise.all([
			recipeApi.listCategories(),
			recipeApi.listScenes(),
			recipeApi.listIngredients({ page: 1, pageSize: 200, source: "ALL" }),
			recipeApi.listUnits({ page: 1, pageSize: 200, source: "ALL" })
		]);
		categories.value = categoryList;
		scenes.value = sceneList;
		ingredients.value = ingredientResult.items;
		units.value = unitResult.items;

		if (draftId.value) {
			const draft = await recipeApi.getDraft(draftId.value);
			fillFromDraft(draft);
		} else if (recipeId.value) {
			const recipe = await recipeApi.getMyRecipe(recipeId.value);
			fillFromRecipe(recipe);
		}
	} catch (error) {
		errorText.value = error instanceof Error ? error.message : "页面加载失败";
	} finally {
		loading.value = false;
	}
}

function fillFromDraft(draft: RecipeDraftDetail) {
	draftVersion.value = draft.version;
	recipeId.value = draft.recipeId || recipeId.value;
	fillForm(draft.content);
}

function fillFromRecipe(recipe: MyRecipeDetail) {
	recipeVersion.value = recipe.version;
	const content: RecipeDraftContentInput = {
		name: recipe.content.name,
		story: recipe.content.story,
		categoryId: recipe.category.id,
		sceneIds: recipe.scenes.map(item => item.id),
		baseServings: recipe.content.baseServings,
		difficulty: recipe.content.difficulty,
		durationMinutes: recipe.content.durationMinutes,
		tips: recipe.content.tips,
		ingredients: recipe.content.ingredients.map(item => ({
			ingredientId: item.ingredientId,
			amount: item.amount.kind === "EXACT"
				? {
						kind: "EXACT",
						quantity: item.amount.quantity,
						unitId: item.amount.unitId
				  }
				: {
						kind: "FUZZY",
						text: item.amount.text
				  }
		})),
		steps: recipe.content.steps
	};
	fillForm(content);
}

function fillForm(content: RecipeDraftContentInput) {
	form.name = content.name;
	form.story = content.story || "";
	form.categoryId = content.categoryId;
	form.sceneIds = [...content.sceneIds];
	form.baseServingsText = content.baseServings ? String(content.baseServings) : "";
	form.difficulty = content.difficulty;
	form.durationMinutesText = content.durationMinutes ? String(content.durationMinutes) : "";
	form.tips = content.tips || "";
	ingredientsText.value = content.ingredients
		.map(item => {
			const ingredient = ingredients.value.find(entry => entry.id === item.ingredientId);
			if (!ingredient) return "";
			const amount = item.amount;
			if (amount.kind === "FUZZY") return `${ingredient.name}|${amount.text}`;
			const unit = units.value.find(entry => entry.id === amount.unitId);
			return `${ingredient.name}|${amount.quantity}|${unit?.name || ""}`;
		})
		.filter(Boolean)
		.join("\n");
	stepsText.value = content.steps.map(item => item.text).join("\n");
}

function toggleScene(sceneId: string) {
	if (form.sceneIds.includes(sceneId)) {
		form.sceneIds = form.sceneIds.filter(item => item !== sceneId);
		return;
	}
	form.sceneIds = [...form.sceneIds, sceneId];
}

async function saveDraft() {
	if (submitting.value) return;
	submitting.value = true;
	try {
		const content = buildDraftContent();
		if (draftId.value && draftVersion.value !== null) {
			const result = await recipeApi.updateDraft(draftId.value, {
				operationId: createOperationId(),
				expectedVersion: draftVersion.value,
				content
			});
			draftVersion.value = result.version;
			await uniPlatform.feedback.toast({ title: "草稿已保存", icon: "success" });
			return;
		}

		const result = await recipeApi.createDraft({
			operationId: createOperationId(),
			recipeId: recipeId.value || null,
			content
		});
		draftId.value = result.id;
		draftVersion.value = result.version;
		await uniPlatform.feedback.toast({ title: "草稿已创建", icon: "success" });
	} catch (error) {
		await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "保存失败", icon: "none" });
	} finally {
		submitting.value = false;
	}
}

async function publishDraft() {
	if (submitting.value) return;
	submitting.value = true;
	try {
		if (!draftId.value || draftVersion.value === null) {
			const created = await recipeApi.createDraft({
				operationId: createOperationId(),
				recipeId: recipeId.value || null,
				content: buildDraftContent()
			});
			draftId.value = created.id;
			draftVersion.value = created.version;
		}

		const result = await recipeApi.publishDraft(draftId.value, {
			operationId: createOperationId(),
			expectedVersion: draftVersion.value as number
		});
		await uniPlatform.feedback.toast({ title: "已发布", icon: "success" });
		void uniPlatform.navigation.redirectTo(`/pages_recipe/detail/index?recipeId=${encodeURIComponent(result.recipe.id)}&kind=my`);
	} catch (error) {
		await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "发布失败", icon: "none" });
	} finally {
		submitting.value = false;
	}
}

async function removeDraft() {
	if (!draftId.value || draftVersion.value === null || submitting.value) return;
	submitting.value = true;
	try {
		await recipeApi.deleteDraft(draftId.value, {
			operationId: createOperationId(),
			expectedVersion: draftVersion.value
		});
		await uniPlatform.feedback.toast({ title: "草稿已删除", icon: "success" });
		void uniPlatform.navigation.redirectTo("/pages_recipe/list/index");
	} catch (error) {
		await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "删除失败", icon: "none" });
	} finally {
		submitting.value = false;
	}
}

async function removeRecipe() {
	if (!recipeId.value || recipeVersion.value === null || submitting.value) return;
	submitting.value = true;
	try {
		await recipeApi.deleteRecipe(recipeId.value, createOperationId(), recipeVersion.value);
		await uniPlatform.feedback.toast({ title: "菜谱已删除", icon: "success" });
		void uniPlatform.navigation.redirectTo("/pages_recipe/list/index");
	} catch (error) {
		await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "删除失败", icon: "none" });
	} finally {
		submitting.value = false;
	}
}

function buildDraftContent(): RecipeDraftContentInput {
	return {
		name: form.name.trim(),
		story: form.story.trim() || null,
		categoryId: form.categoryId || null,
		sceneIds: [...form.sceneIds],
		baseServings: form.baseServingsText ? Number(form.baseServingsText) : null,
		difficulty: form.difficulty,
		durationMinutes: form.durationMinutesText ? Number(form.durationMinutesText) : null,
		tips: form.tips.trim() || null,
		ingredients: parseIngredients(),
		steps: stepsText.value
			.split("\n")
			.map(item => item.trim())
			.filter(Boolean)
			.map(text => ({ text }))
	};
}

function parseIngredients(): RecipeIngredientInput[] {
	return ingredientsText.value
		.split("\n")
		.map(item => item.trim())
		.filter(Boolean)
		.map(line => {
			const parts = line.split("|").map(item => item.trim());
			const ingredientName = parts[0] || "";
			const amountText = parts[1] || "";
			const unitName = parts[2] || "";
			const ingredient = ingredients.value.find(item => normalizeText(item.name) === normalizeText(ingredientName));
			if (!ingredient) {
				throw new Error(`未找到食材：${ingredientName}`);
			}
			if (isFuzzyAmount(amountText)) {
				return {
					ingredientId: ingredient.id,
					amount: {
						kind: "FUZZY" as const,
						text: amountText
					}
				};
			}
			const unit = units.value.find(item => normalizeText(item.name) === normalizeText(unitName));
			if (!unit) {
				throw new Error(`未找到单位：${unitName}`);
			}
			return {
				ingredientId: ingredient.id,
				amount: {
					kind: "EXACT" as const,
					quantity: amountText,
					unitId: unit.id
				}
			};
		});
}

function normalizeText(value: string) {
	return value.trim().toLowerCase().replace(/\s+/g, "");
}

function isFuzzyAmount(value: string): value is FuzzyAmount {
	return fuzzyAmounts.includes(value as FuzzyAmount);
}
</script>

<style scoped lang="scss">
.notice,
.section {
	padding: var(--space-md);
	border-radius: var(--radius-md);
	background: var(--color-surface);
}

.section + .section,
.action-row {
	margin-top: var(--space-md);
}

.label {
	display: block;
	margin-bottom: var(--space-sm);
	color: var(--color-text);
	font-size: var(--font-size-md);
	font-weight: var(--font-weight-semibold);
}

.hint {
	display: block;
	margin-top: 8rpx;
	color: var(--color-text-secondary);
	font-size: var(--font-size-sm);
	line-height: 1.6;
}

.input,
.textarea {
	width: 100%;
	padding: 20rpx 24rpx;
	border: 1rpx solid var(--color-border);
	border-radius: var(--radius-md);
	background: var(--color-surface-muted);
	box-sizing: border-box;
}

.textarea {
	min-height: 180rpx;
}

.textarea--large {
	min-height: 260rpx;
}

.chip-row,
.grid,
.action-row {
	display: flex;
	gap: var(--space-sm);
}

.chip-row {
	flex-wrap: wrap;
}

.chip {
	padding: 14rpx 24rpx;
	border-radius: 999rpx;
	background: var(--color-surface-muted);
	color: var(--color-text-secondary);
	font-size: var(--font-size-sm);
}

.chip--active {
	background: var(--color-primary-soft);
	color: var(--color-primary);
}

.grid > view {
	flex: 1;
}

.action-row button {
	flex: 1;
	border-radius: var(--radius-md);
}

.primary {
	background: var(--color-primary);
	color: var(--color-primary-foreground);
}

.secondary {
	background: var(--color-surface-muted);
	color: var(--color-text);
}

.light {
	background: var(--color-surface);
	color: var(--color-text);
	border: 1rpx solid var(--color-border);
}

.danger {
	background: var(--color-danger-button-bg);
	color: var(--color-danger-button-text);
}
</style>
