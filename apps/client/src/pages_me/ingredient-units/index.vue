<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="" :show-left="false" navbar-layout="custom-left" full-screen>
    <template #navbar-left>
      <view class="header-tabs">
        <view class="cookfont icon-back header-tabs__back" hover-class="header-tabs__back--hover" hover-stay-time="100" @click="goBack" />
        <view class="nav-tabs">
          <view
            v-for="item in tabs"
            :key="item.value"
            class="nav-tabs__item font-medium"
            :class="{ 'nav-tabs__item--active': activeTab === item.value }"
            @click="switchTab(item.value)"
          >
            {{ item.label }}
          </view>
        </view>
      </view>
    </template>

    <view class="ingredient-units-page">
      <RecipeEmptyState
        v-if="!sessionStore.isLoggedIn"
        class="page-empty"
        :art="emptyStateIllustration"
        title="登录后查看食材与单位"
        description="系统食材、个人食材、单位分类和推荐入口都会收口在这里。点一下开始登录。"
        clickable
        @click="openLogin"
      />

      <template v-else>
        <view v-if="activeTab === 'ingredient'" class="search-row">
          <RecipeSearchBar
            v-model="ingredientKeyword"
            placeholder="搜索食材"
            @confirm="searchIngredients"
            @clear="clearIngredientKeyword"
          />
        </view>

        <view v-if="showIngredientCategoryBar" class="sticky-wrap" :style="stickyStyle">
          <view class="sticky-bar">
            <scroll-view scroll-x class="category-scroll" show-scrollbar="false">
              <view class="category-row">
                <view
                  v-for="item in categories"
                  :key="item.id"
                  class="category-chip"
                  :class="{ 'category-chip--active': ingredientCategoryId === item.id }"
                  @click="changeIngredientCategory(item.id)"
                >
                  <text class="category-chip__name">{{ item.name }}</text>
                </view>
              </view>
            </scroll-view>
          </view>
        </view>

        <view v-if="activeErrorText" class="notice notice--error" @click="loadActiveTab">{{ activeErrorText }}</view>
        <view v-else-if="activeLoading" class="notice">加载中...</view>
        <view v-else-if="activeTab === 'ingredient' && !ingredients.length" class="empty-state">
          <text class="empty-state__title">没有找到食材</text>
          <text class="empty-state__desc">换个关键词或分类看看，也可以从右下角补一条新的食材推荐。</text>
        </view>
        <view v-else-if="activeTab === 'unit' && !unitGroups.length" class="empty-state">
          <text class="empty-state__title">还没有单位</text>
          <text class="empty-state__desc">当前没有可展示的单位，稍后再看，或从右下角先补一个个人单位。</text>
        </view>

        <view v-else class="list" :class="{ 'list--unit': activeTab === 'unit' }">
          <view v-if="activeTab === 'ingredient'" class="ingredient-grid">
            <view v-for="item in ingredients" :key="item.id" class="ingredient-card">
              <view class="ingredient-card__thumb">
                <text class="ingredient-card__unit">{{ item.defaultUnit.name }}</text>
                <image
                  v-if="item.imageUrl"
                  class="ingredient-card__image"
                  :src="item.imageUrl"
                  mode="aspectFill"
                />
                <view v-else class="ingredient-card__fallback">
                  <text class="ingredient-card__fallback-text">暂无缩略图</text>
                </view>
                <view
                  v-if="item.source === 'SYSTEM'"
                  class="ingredient-card__notice"
                  @click.stop="openFeedbackSheet(item)"
                >
                  <text class="cookfont icon-notice ingredient-card__notice-icon" />
                  <text class="ingredient-card__notice-text">纠错</text>
                </view>
              </view>
              <text class="ingredient-card__name">{{ item.name }}</text>
            </view>
          </view>

          <view v-else class="unit-section-list sheet-unit-list">
            <view v-for="group in unitGroups" :key="group.value" class="unit-section sheet-unit-group">
              <text class="unit-section__title sheet-unit-group__title">{{ group.label }}</text>
              <view class="unit-grid sheet-unit-grid">
                <view v-for="item in group.items" :key="item.id" class="unit-card sheet-chip sheet-chip--unit">
                  <text class="unit-card__name">{{ item.name }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>

        <view class="recommend-fab" hover-class="recommend-fab--hover" hover-stay-time="100" @click="openRecommendSheet">
          <text class="cookfont icon-add recommend-fab__icon" />
        </view>
      </template>
    </view>

    <SheetShell
      v-if="sheetMode"
      :visible="Boolean(sheetMode)"
      :panel-style="{ padding: '34rpx 32rpx calc(42rpx + env(safe-area-inset-bottom))' }"
      @close="closeSheet"
    >
      <view class="sheet">
        <view class="sheet__header">
          <view>
            <text class="sheet__title">{{ sheetTitle }}</text>
            <text class="sheet__hint">{{ sheetHint }}</text>
          </view>
          <text class="cookfont icon-close sheet__close" @click="closeSheet" />
        </view>

        <template v-if="sheetMode === 'ingredient'">
          <view class="sheet-field">
            <text class="sheet-field__label">食材名字</text>
            <input
              v-model="ingredientForm.name"
              class="sheet-input"
              maxlength="30"
              placeholder="请输入食材名字"
              placeholder-class="sheet-input__placeholder"
              :disabled="sheetSubmitting"
            />
          </view>

          <view class="sheet-field">
            <text class="sheet-field__label">食材分类</text>
            <view class="sheet-chip-grid">
              <view
                v-for="item in categories"
                :key="item.id"
                class="sheet-chip"
                :class="{ 'sheet-chip--active': ingredientForm.categoryId === item.id }"
                @click="ingredientForm.categoryId = item.id"
              >
                {{ item.name }}
              </view>
            </view>
          </view>

          <view class="sheet-field">
            <text class="sheet-field__label">默认单位</text>
            <view class="sheet-unit-list">
              <view v-for="group in unitGroups" :key="group.value" class="sheet-unit-group">
                <text class="sheet-unit-group__title">{{ group.label }}</text>
                <view class="sheet-unit-grid">
                  <view
                    v-for="item in group.items"
                    :key="item.id"
                    class="sheet-chip sheet-chip--unit"
                    :class="{ 'sheet-chip--active': ingredientForm.defaultUnitId === item.id }"
                    @click="ingredientForm.defaultUnitId = item.id"
                  >
                    {{ item.name }}
                  </view>
                </view>
              </view>
            </view>
          </view>
        </template>

        <template v-else-if="sheetMode === 'unit'">
          <view class="sheet-field">
            <text class="sheet-field__label">单位名字</text>
            <input
              v-model="unitForm.name"
              class="sheet-input"
              maxlength="16"
              placeholder="请输入单位名字"
              placeholder-class="sheet-input__placeholder"
              :disabled="sheetSubmitting"
            />
          </view>

          <view class="sheet-field">
            <text class="sheet-field__label">单位分类</text>
            <view class="sheet-chip-grid">
              <view
                v-for="item in unitTypeItems"
                :key="item.value"
                class="sheet-chip"
                :class="{ 'sheet-chip--active': unitForm.type === item.value }"
                @click="unitForm.type = item.value"
              >
                {{ item.label }}
              </view>
            </view>
          </view>
        </template>

        <template v-else>
          <view class="sheet-field">
            <text class="sheet-field__label">名字</text>
            <input
              v-model="feedbackForm.name"
              class="sheet-input"
              maxlength="30"
              placeholder="请输入正确名字"
              placeholder-class="sheet-input__placeholder"
              :disabled="sheetSubmitting"
            />
          </view>

          <view class="sheet-field">
            <text class="sheet-field__label">分类</text>
            <view class="sheet-chip-grid">
              <view
                v-for="item in categories"
                :key="item.id"
                class="sheet-chip"
                :class="{ 'sheet-chip--active': feedbackForm.categoryId === item.id }"
                @click="feedbackForm.categoryId = item.id"
              >
                {{ item.name }}
              </view>
            </view>
          </view>

          <view class="sheet-field">
            <text class="sheet-field__label">备注</text>
            <textarea
              v-model="feedbackForm.note"
              class="sheet-textarea"
              maxlength="200"
              auto-height
              placeholder="例如：图片与名字不符，或分类需要调整"
              placeholder-class="sheet-input__placeholder"
              :disabled="sheetSubmitting"
            />
          </view>
        </template>

        <text v-if="sheetErrorText" class="sheet__error">{{ sheetErrorText }}</text>

        <view class="sheet__footer">
          <button class="sheet-button sheet-button--ghost" :disabled="sheetSubmitting" @click="closeSheet">取消</button>
          <button class="sheet-button sheet-button--primary" :loading="sheetSubmitting" :disabled="sheetSubmitting" @click="submitSheet">
            {{ sheetSubmitText }}
          </button>
        </view>
      </view>
    </SheetShell>
  </Layout>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import emptyStateIllustration from "@/assets/recipe-page/empty-state.svg";
import { recipeApi, type IngredientCategorySummary, type IngredientSummary, type UnitSummary, type UnitType } from "@/apis/recipe";
import type { UUID } from "@/apis/http";
import Layout from "@/components/Layout/Layout.vue";
import RecipeEmptyState from "@/components/Recipe/RecipeEmptyState.vue";
import RecipeSearchBar from "@/components/Recipe/RecipeSearchBar.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { usePageScrollLock, usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";

type IngredientUnitsTab = "ingredient" | "unit";
type SheetMode = IngredientUnitsTab | "ingredient-feedback";

const pageStyle = usePageScrollStyle();
const { setLocked: setPageLocked } = usePageScrollLock(Symbol("ingredient-units-sheet"));
const { navBarTotalHeight } = useSystemInfo();
const loginModalStore = useLoginModalStore();
const sessionStore = useSessionStore();

const tabs = [
  { label: "食材", value: "ingredient" },
  { label: "单位", value: "unit" }
] as const satisfies Array<{ label: string; value: IngredientUnitsTab }>;

const unitTypeLabelMap: Record<UnitType, string> = {
  WEIGHT: "重量",
  VOLUME: "体积",
  COUNT: "数量",
  SHAPE: "形态",
  CONTAINER: "量具",
  PACKAGE: "包装",
  OTHER: "其他"
};

const unitTypeItems = (["WEIGHT", "VOLUME", "COUNT", "SHAPE", "CONTAINER", "PACKAGE", "OTHER"] as const).map((type) => ({
  value: type,
  label: unitTypeLabelMap[type]
}));

const activeTab = ref<IngredientUnitsTab>("ingredient");
const categories = ref<IngredientCategorySummary[]>([]);
const ingredients = ref<IngredientSummary[]>([]);
const units = ref<UnitSummary[]>([]);
const ingredientKeyword = ref("");
const ingredientCategoryId = ref<UUID | "">("");
const categoryLoading = ref(false);
const ingredientLoading = ref(false);
const unitLoading = ref(false);
const categoryErrorText = ref("");
const ingredientErrorText = ref("");
const unitErrorText = ref("");
const sheetMode = ref<SheetMode | "">("");
const sheetSubmitting = ref(false);
const sheetErrorText = ref("");
const ingredientForm = reactive({
  name: "",
  categoryId: "" as UUID | "",
  defaultUnitId: "" as UUID | ""
});
const unitForm = reactive({
  name: "",
  type: "" as UnitType | ""
});
const feedbackForm = reactive({
  ingredientId: "" as UUID | "",
  originalName: "",
  name: "",
  originalCategoryId: "" as UUID | "",
  categoryId: "" as UUID | "",
  note: ""
});

const stickyStyle = computed(() => ({
  top: `${navBarTotalHeight.value}px`
}));
const showIngredientCategoryBar = computed(
  () => activeTab.value === "ingredient" && ingredientKeyword.value.trim().length === 0 && categories.value.length > 0
);
const activeLoading = computed(() =>
  activeTab.value === "ingredient" ? categoryLoading.value || ingredientLoading.value : unitLoading.value
);
const activeErrorText = computed(() =>
  activeTab.value === "ingredient" ? categoryErrorText.value || ingredientErrorText.value : unitErrorText.value
);
const unitGroups = computed(() =>
  unitTypeItems
    .map((group) => ({
      ...group,
      items: units.value.filter((item) => item.type === group.value)
    }))
    .filter((group) => group.items.length > 0)
);
const sheetTitle = computed(() => {
  if (sheetMode.value === "ingredient") return "推荐食材";
  if (sheetMode.value === "unit") return "推荐单位";
  return "纠错反馈";
});
const sheetHint = computed(() =>
  sheetMode.value === "ingredient"
    ? "系统库里还没有也没关系，先加到你的食材里用，也可以顺手推荐给我们收录。"
    : sheetMode.value === "unit"
      ? "系统里还没有也没关系，先加到你的单位里，做菜时就能直接用。"
      : "可修改名字、分类，或补充备注，帮助我们更快纠正食材信息。"
);
const sheetSubmitText = computed(() => {
  if (sheetMode.value === "ingredient") return "提交推荐";
  if (sheetMode.value === "unit") return "创建个人单位";
  return "确定";
});

let categoryPromise: Promise<void> | null = null;
let unitPromise: Promise<void> | null = null;

onShow(() => {
  if (!sessionStore.isLoggedIn) {
    resetPageState();
    return;
  }
  void loadActiveTab();
});

watch(
  () => Boolean(sheetMode.value),
  (visible) => {
    setPageLocked(visible);
  },
  { immediate: true }
);

function resetPageState() {
  categories.value = [];
  ingredients.value = [];
  units.value = [];
  ingredientKeyword.value = "";
  ingredientCategoryId.value = "";
  categoryErrorText.value = "";
  ingredientErrorText.value = "";
  unitErrorText.value = "";
  closeSheet();
}

async function loadActiveTab() {
  if (!sessionStore.isLoggedIn) return;
  if (activeTab.value === "ingredient") {
    await ensureCategories();
    await loadIngredients();
    return;
  }
  await loadUnits();
}

function switchTab(tab: IngredientUnitsTab) {
  if (activeTab.value === tab) return;
  activeTab.value = tab;
  if (!sessionStore.isLoggedIn) return;
  void loadActiveTab();
}

function goBack() {
  void uniPlatform.navigation.navigateBack();
}

function openLogin(nextAction: (() => void) | null = null) {
  loginModalStore.open(null, () => {
    void loadActiveTab();
    nextAction?.();
  });
}

function searchIngredients() {
  if (!sessionStore.isLoggedIn) return;
  void loadIngredients();
}

function clearIngredientKeyword() {
  if (!sessionStore.isLoggedIn) return;
  void loadIngredients();
}

function changeIngredientCategory(value: UUID) {
  if (ingredientCategoryId.value === value) return;
  ingredientCategoryId.value = value;
  void loadIngredients();
}

async function ensureCategories() {
  if (categories.value.length) return;
  if (categoryPromise) {
    await categoryPromise;
    return;
  }

  categoryLoading.value = true;
  categoryErrorText.value = "";
  categoryPromise = recipeApi
    .listIngredientCategories()
    .then((result) => {
      categories.value = result;
      if (!ingredientCategoryId.value && result.length) {
        ingredientCategoryId.value = result[0].id;
      }
    })
    .catch((error) => {
      categoryErrorText.value = error instanceof Error ? error.message : "分类加载失败";
    })
    .finally(() => {
      categoryLoading.value = false;
      categoryPromise = null;
    });

  await categoryPromise;
}

async function ensureUnits() {
  if (units.value.length) return;
  if (unitPromise) {
    await unitPromise;
    return;
  }
  await loadUnits();
}

async function loadIngredients() {
  ingredientLoading.value = true;
  ingredientErrorText.value = "";

  try {
    if (!ingredientCategoryId.value) {
      ingredients.value = [];
      return;
    }
    const result = await recipeApi.listIngredients({
      page: 1,
      pageSize: 20,
      keyword: ingredientKeyword.value.trim() || undefined,
      categoryId: ingredientKeyword.value.trim() ? undefined : ingredientCategoryId.value
    });
    ingredients.value = result.items;
  } catch (error) {
    ingredientErrorText.value = error instanceof Error ? error.message : "食材加载失败";
  } finally {
    ingredientLoading.value = false;
  }
}

async function loadUnits() {
  if (unitPromise) {
    await unitPromise;
    return;
  }

  unitLoading.value = true;
  unitErrorText.value = "";
  unitPromise = recipeApi
    .listUnits({
      page: 1,
      pageSize: 100
    })
    .then((result) => {
      units.value = result.items;
      if (!unitForm.type && result.items.length) {
        unitForm.type = result.items[0].type;
      }
    })
    .catch((error) => {
      unitErrorText.value = error instanceof Error ? error.message : "单位加载失败";
    })
    .finally(() => {
      unitLoading.value = false;
      unitPromise = null;
    });

  await unitPromise;
}

async function openRecommendSheet() {
  if (!sessionStore.isLoggedIn) {
    openLogin(() => {
      void openRecommendSheet();
    });
    return;
  }

  sheetErrorText.value = "";
  if (activeTab.value === "ingredient") {
    await Promise.all([ensureCategories(), ensureUnits()]);
    ingredientForm.name = "";
    ingredientForm.categoryId = ingredientCategoryId.value || categories.value[0]?.id || "";
    ingredientForm.defaultUnitId = units.value[0]?.id || "";
    sheetMode.value = "ingredient";
    return;
  }

  await ensureUnits();
  unitForm.name = "";
  unitForm.type = units.value[0]?.type || unitTypeItems[0]?.value || "";
  sheetMode.value = "unit";
}

async function openFeedbackSheet(item: IngredientSummary) {
  if (!sessionStore.isLoggedIn) {
    openLogin(() => {
      void openFeedbackSheet(item);
    });
    return;
  }
  await ensureCategories();
  feedbackForm.ingredientId = item.id;
  feedbackForm.originalName = item.name;
  feedbackForm.name = item.name;
  feedbackForm.originalCategoryId = item.categoryId;
  feedbackForm.categoryId = item.categoryId;
  feedbackForm.note = "";
  sheetErrorText.value = "";
  sheetMode.value = "ingredient-feedback";
}

function closeSheet() {
  sheetMode.value = "";
  sheetSubmitting.value = false;
  sheetErrorText.value = "";
}

async function submitSheet() {
  if (!sheetMode.value || sheetSubmitting.value) return;
  if (sheetMode.value === "ingredient") {
    await submitIngredientRecommend();
    return;
  }
  if (sheetMode.value === "ingredient-feedback") {
    await submitIngredientFeedback();
    return;
  }
  await submitUnitCreate();
}

async function submitIngredientRecommend() {
  const name = ingredientForm.name.trim();
  if (!name) {
    sheetErrorText.value = "请先填写食材名字";
    return;
  }
  if (!ingredientForm.categoryId) {
    sheetErrorText.value = "请选择食材分类";
    return;
  }
  if (!ingredientForm.defaultUnitId) {
    sheetErrorText.value = "请选择默认单位";
    return;
  }

  sheetSubmitting.value = true;
  sheetErrorText.value = "";

  try {
    const created = await recipeApi.createIngredient({
      operationId: createOperationId(),
      name,
      categoryId: ingredientForm.categoryId,
      defaultUnitId: ingredientForm.defaultUnitId
    });
    await recipeApi.recommendIngredient(created.id, {
      operationId: createOperationId()
    });
    ingredientKeyword.value = "";
    ingredientCategoryId.value = created.categoryId;
    await Promise.all([loadIngredients(), loadUnits()]);
    closeSheet();
    await uniPlatform.feedback.toast({ title: "已提交推荐", icon: "success" });
  } catch (error) {
    sheetErrorText.value = error instanceof Error ? error.message : "推荐失败";
  } finally {
    sheetSubmitting.value = false;
  }
}

async function submitUnitCreate() {
  const name = unitForm.name.trim();
  if (!name) {
    sheetErrorText.value = "请先填写单位名字";
    return;
  }
  if (!unitForm.type) {
    sheetErrorText.value = "请选择单位分类";
    return;
  }

  sheetSubmitting.value = true;
  sheetErrorText.value = "";

  try {
    await recipeApi.createUnit({
      operationId: createOperationId(),
      name,
      type: unitForm.type
    });
    await loadUnits();
    closeSheet();
    await uniPlatform.feedback.toast({ title: "个人单位已创建", icon: "success" });
  } catch (error) {
    sheetErrorText.value = error instanceof Error ? error.message : "创建失败";
  } finally {
    sheetSubmitting.value = false;
  }
}

async function submitIngredientFeedback() {
  const ingredientId = feedbackForm.ingredientId;
  const name = feedbackForm.name.trim();
  const note = feedbackForm.note.trim();

  if (!ingredientId) {
    sheetErrorText.value = "当前食材信息有误，请重新打开";
    return;
  }
  if (!name) {
    sheetErrorText.value = "请先填写名字";
    return;
  }
  if (!feedbackForm.categoryId) {
    sheetErrorText.value = "请选择分类";
    return;
  }

  const changedName = name !== feedbackForm.originalName;
  const changedCategory = feedbackForm.categoryId !== feedbackForm.originalCategoryId;
  if (!changedName && !changedCategory && !note) {
    sheetErrorText.value = "请至少修改名字、分类，或补充备注";
    return;
  }

  sheetSubmitting.value = true;
  sheetErrorText.value = "";
  try {
    await recipeApi.createIngredientFeedback(ingredientId, {
      operationId: createOperationId(),
      name,
      categoryId: feedbackForm.categoryId,
      note: note || undefined
    });
    closeSheet();
    await uniPlatform.feedback.toast({
      title: "已提交纠错",
      icon: "success"
    });
  } catch (error) {
    sheetErrorText.value = error instanceof Error ? error.message : "提交失败";
  } finally {
    sheetSubmitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.ingredient-units-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 10rpx var(--space-page);
  padding-bottom: calc(184rpx + env(safe-area-inset-bottom));
  background: var(--color-page);
}

.page-empty {
  margin-top: 20rpx;
}

.header-tabs {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-width: 0;
}

.header-tabs__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  color: var(--color-text);
  font-size: 34rpx;
  line-height: 1;
}

.header-tabs__back--hover {
  opacity: 0.82;
}

.nav-tabs {
  display: flex;
  gap: 52rpx;
  align-items: flex-end;
  min-width: 0;
  padding-top: 6rpx;
}

.nav-tabs__item {
  position: relative;
  z-index: 0;
  flex: 0 0 auto;
  padding: 8rpx 0 12rpx;
  color: var(--color-text-secondary);
  font-size: 40rpx;
  font-weight: var(--font-weight-bold);
  line-height: 1;
  white-space: nowrap;
}

.nav-tabs__item--active {
  color: var(--color-text);
}

.nav-tabs__item--active::after {
  content: "";
  position: absolute;
  right: -8rpx;
  bottom: 2rpx;
  left: -8rpx;
  z-index: -1;
  height: 18rpx;
  border-radius: var(--radius-pill);
  background: var(--theme-primary);
  opacity: 0.3;
  transform: rotate(-5deg);
}

.search-row {
  margin-top: 12rpx;
}

.sticky-wrap {
  position: sticky;
  z-index: 20;
  margin-top: 20rpx;
  padding-bottom: 20rpx;
  background: var(--color-page);
}

.sticky-bar {
  display: flex;
  align-items: center;
  min-height: 56rpx;
}

.category-scroll {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
}

.category-row {
  display: flex;
  gap: 16rpx;
  width: max-content;
  padding-right: 24rpx;
}

.category-chip,
.sheet-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.category-chip {
  flex: 0 0 auto;
  height: 56rpx;
  padding: 0 28rpx;
  border: 1rpx solid var(--color-divider);
  border-radius: var(--radius-xs);
  background: var(--color-surface-muted);
}

.category-chip--active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.category-chip__name {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  white-space: nowrap;
}

.category-chip--active .category-chip__name {
  color: var(--color-primary-active);
}

.notice,
.empty-state,
.ingredient-card,
.unit-card {
  border-radius: var(--radius-xs);
  background: var(--color-card);
  box-shadow: var(--shadow-card);
}

.notice,
.empty-state {
  padding: 28rpx;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.notice--error {
  color: var(--color-primary);
}

.empty-state__title {
  display: block;
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: var(--font-weight-semibold);
}

.empty-state__desc {
  display: block;
  margin-top: 12rpx;
}

.list {
  padding-top: 20rpx;
}

.list--unit {
  margin-top: 20rpx;
}

.ingredient-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
}

.ingredient-card__thumb {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border-radius: var(--radius-xs);
  overflow: hidden;
  background: var(--color-surface-muted);
}

.ingredient-card__image {
  width: 100%;
  height: 100%;
}

.ingredient-card__fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0 16rpx;
  text-align: center;
}

.ingredient-card__fallback-text {
  color: var(--color-text-tertiary);
  font-size: 22rpx;
  line-height: 1.5;
}

.ingredient-card__name {
  display: block;
  margin: 20rpx 0;
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.4;
  text-align: center;
  word-break: break-all;
}

.ingredient-card__unit {
  position: absolute;
  top: 10rpx;
  left: 10rpx;
  z-index: 2;
  max-width: calc(100% - 112rpx);
  padding: 8rpx 14rpx;
  border-radius: var(--radius-pill);
  background: rgba(59, 40, 21, 0.42);
  color: rgba(255, 255, 255, 0.94);
  font-size: 24rpx;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  backdrop-filter: blur(8rpx);
}

.ingredient-card__notice {
  position: absolute;
  right: 10rpx;
  bottom: 10rpx;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 8rpx 14rpx;
  border-radius: var(--radius-pill);
  background: rgba(59, 40, 21, 0.2);
  color: var(--color-text);
  font-size: 20rpx;
  line-height: 1;
  backdrop-filter: blur(8rpx);
}

.ingredient-card__notice-icon {
  color: currentColor;
  font-size: 22rpx;
}

.ingredient-card__notice-text {
  white-space: nowrap;
}

.unit-section-list {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.unit-section__title {
  display: block;
  margin-bottom: 12rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.3;
}

.unit-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14rpx;
}

.unit-card {
  min-height: 68rpx;
  padding: 0 16rpx;
  text-align: center;
}

.unit-card__name {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.35;
  word-break: break-all;
}

.recommend-fab {
  position: fixed;
  right: 32rpx;
  bottom: calc(52rpx + env(safe-area-inset-bottom));
  z-index: 40;
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  height: 84rpx;
  padding: 0 30rpx;
  border-radius: var(--radius-pill);
  background: linear-gradient(
    135deg,
    var(--button-primary-gradient-start) 0%,
    var(--button-primary-gradient-end) 100%
  );
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}

.recommend-fab--hover {
  opacity: 0.92;
}

.recommend-fab__icon {
  font-size: 24rpx;
  line-height: 1;
  color: currentColor;
}

.sheet__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}

.sheet__title,
.sheet__hint,
.sheet-field__label,
.sheet__error {
  display: block;
}

.sheet__title {
  color: var(--color-text);
  font-size: 34rpx;
  font-weight: var(--font-weight-bold);
  line-height: 1.2;
}

.sheet__hint {
  margin-top: 10rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.sheet__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: 22rpx;
}

.sheet-field {
  margin-top: 28rpx;
}

.sheet-field__label {
  margin-bottom: 16rpx;
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.3;
}

.sheet-input {
  width: 100%;
  height: 82rpx;
  padding: 0 24rpx;
  border: 1rpx solid rgba(109, 92, 72, 0.1);
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-sizing: border-box;
  color: var(--color-text);
  font-size: 28rpx;
}

:deep(.sheet-input__placeholder) {
  color: var(--color-text-tertiary);
}

.sheet-textarea {
  width: 100%;
  min-height: 164rpx;
  padding: 20rpx 24rpx;
  border: 1rpx solid rgba(109, 92, 72, 0.1);
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-sizing: border-box;
  color: var(--color-text);
  font-size: 28rpx;
  line-height: 1.6;
}

.sheet-chip-grid,
.sheet-unit-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14rpx;
}

.sheet-chip {
  min-height: 76rpx;
  padding: 0 16rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.35;
  text-align: center;
  word-break: break-all;
}

.sheet-chip--unit {
  min-height: 68rpx;
}

.sheet-chip--active {
  background: var(--color-primary-soft);
  color: var(--color-primary-active);
  box-shadow: inset 0 0 0 1rpx var(--color-border);
}

.sheet-unit-list {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.sheet-unit-group__title {
  display: block;
  margin-bottom: 12rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.3;
}

.sheet__error {
  margin-top: 24rpx;
  color: var(--color-danger-text);
  font-size: 24rpx;
  line-height: 1.6;
}

.sheet__footer {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 30rpx;
}

.sheet-button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 88rpx;
  min-height: 88rpx;
  border-radius: var(--radius-pill);
  font-size: 30rpx;
  font-weight: var(--font-weight-bold);
  line-height: 1;
}

.sheet-button::after {
  border: 0;
}

.sheet-button--ghost {
  background: var(--color-surface);
  color: var(--color-text);
}

.sheet-button--primary {
  background: linear-gradient(
    135deg,
    var(--button-primary-gradient-start) 0%,
    var(--button-primary-gradient-end) 100%
  );
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow);
}
</style>
