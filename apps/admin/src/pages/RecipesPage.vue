<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { Plus, Search } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { recipeApi, type AdminInspirationCategorySummary, type AdminRecipeSummary } from "@/apis/recipe";
import type { UUID } from "@/apis/http";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";
import { formatStatusText } from "@/utils/status";

const router = useRouter();
const loading = ref(false);
const categories = ref<AdminInspirationCategorySummary[]>([]);
const recipes = ref<AdminRecipeSummary[]>([]);
const total = ref(0);
let requestId = 0;

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: "",
  categoryId: "" as UUID | "",
  status: "" as "" | "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED"
});

const allRecipeCount = computed(() => categories.value.reduce((sum, item) => sum + item.recipeCount, 0));
const isAllView = computed(() => !query.categoryId);
const currentScopeName = computed(() => {
  if (!query.categoryId) return "全部系统菜谱";
  return categories.value.find(item => item.id === query.categoryId)?.name || "当前分类";
});

useAdminHeaderRefresh(() => {
  void loadPage();
});

async function loadCategories() {
  categories.value = await recipeApi.listInspirationCategories();
  if (query.categoryId && !categories.value.some(item => item.id === query.categoryId)) {
    query.categoryId = "";
  }
}

async function loadRecipes() {
  const current = ++requestId;
  loading.value = true;
  try {
    const result = await recipeApi.list({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword.trim() || undefined,
      categoryId: query.categoryId || undefined,
      status: query.status || undefined
    });
    if (current !== requestId) return;
    recipes.value = result.items;
    total.value = result.total;
  } catch (error) {
    if (current !== requestId) return;
    ElMessage.error(error instanceof Error ? error.message : "加载系统菜谱失败");
  } finally {
    if (current === requestId) loading.value = false;
  }
}

async function loadPage() {
  try {
    await loadCategories();
    await loadRecipes();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载系统菜谱失败");
  }
}

function search() {
  query.page = 1;
  void loadRecipes();
}

async function selectCategory(categoryId: UUID | "") {
  if (query.categoryId === categoryId) return;
  query.categoryId = categoryId;
  query.page = 1;
  query.keyword = "";
  await loadRecipes();
}

async function blockRecipe(recipeId: UUID) {
  try {
    const { value } = await ElMessageBox.prompt("请输入下架原因", "下架系统菜谱", {
      inputValue: "违规或不适合继续曝光",
      inputPlaceholder: "例如：违规或不适合继续曝光",
      confirmButtonText: "确认下架",
      cancelButtonText: "取消"
    });
    await recipeApi.block(recipeId, createOperationId(), value.trim() || "后台下架");
    ElMessage.success("已下架");
    await loadRecipes();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "下架失败");
  }
}

async function unblockRecipe(recipeId: UUID) {
  try {
    await recipeApi.unblock(recipeId, createOperationId());
    ElMessage.success("已恢复");
    await loadRecipes();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "恢复失败");
  }
}

function openDetail(recipeId: UUID) {
  void router.push(`/recipes/${recipeId}`);
}

function openCreate() {
  void router.push("/recipes/create");
}

onMounted(() => {
  void loadPage();
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel recipe-toolbar">
      <div class="recipe-toolbar__group">
        <el-select v-model="query.status" class="toolbar-select" placeholder="状态" clearable @change="search">
          <el-option :label="formatStatusText('ACTIVE')" value="ACTIVE" />
          <el-option :label="formatStatusText('RECYCLED')" value="RECYCLED" />
          <el-option :label="formatStatusText('BLOCKED')" value="BLOCKED" />
          <el-option :label="formatStatusText('DELETED')" value="DELETED" />
        </el-select>
        <el-input
          v-model="query.keyword"
          class="toolbar-search toolbar-search--wide"
          :placeholder="isAllView ? '在全部系统菜谱内搜索菜名 / 食材' : '在当前分类内搜索菜名 / 食材'"
          clearable
          @clear="search"
          @keyup.enter="search"
        />
        <el-button class="toolbar-search-button" type="primary" :icon="Search" @click="search">搜索</el-button>
      </div>
      <div class="toolbar-spacer" />
      <div class="recipe-toolbar__actions">
        <el-button class="toolbar-main-action" type="primary" :icon="Plus" @click="openCreate">新增系统菜谱</el-button>
      </div>
    </div>

    <div class="category-panel table-panel">
      <div class="category-panel__title">菜谱分类</div>
      <div class="category-panel__list">
        <span
          class="category-item"
          :class="{ 'category-item--active': isAllView }"
          @click="selectCategory('')"
        >
          <span class="category-item__name">全部系统菜谱</span>
          <span class="category-item__count">{{ allRecipeCount }}</span>
        </span>
        <span
          v-for="item in categories"
          :key="item.id"
          class="category-item"
          :class="{ 'category-item--active': item.id === query.categoryId }"
          @click="selectCategory(item.id)"
        >
          <span class="category-item__name">{{ item.name }}</span>
          <span class="category-item__count">{{ item.recipeCount }}</span>
        </span>
      </div>
    </div>

    <div class="table-panel recipe-table-panel">
      <div v-loading="loading" class="recipe-card-grid">
        <article v-for="row in recipes" :key="row.id" class="recipe-card">
          <div class="recipe-card__cover" @click="openDetail(row.id)">
            <img v-if="row.coverImageUrl" :src="row.coverImageUrl" :alt="`${row.title} 封面`" class="recipe-card__image" />
            <div v-else class="recipe-card__empty">暂无封面</div>
            <span v-if="row.status !== 'ACTIVE'" class="recipe-card__status">{{ formatStatusText(row.status) }}</span>
            <span v-if="isAllView" class="recipe-card__category">{{ row.inspirationCategoryName }}</span>
          </div>
          <div class="recipe-card__body">
            <div class="recipe-card__title" @click="openDetail(row.id)">{{ row.title }}</div>
            <div class="recipe-card__meta">
              <span>{{ row.updatedAt }}</span>
              <span v-if="row.ownerUid !== null">源自 UID {{ row.ownerUid }}</span>
            </div>
          </div>
          <div class="recipe-card__actions">
            <el-button link type="primary" @click="openDetail(row.id)">详情</el-button>
            <el-button v-if="row.status === 'ACTIVE'" link type="danger" @click="blockRecipe(row.id)">下架</el-button>
            <el-button v-else-if="row.status === 'BLOCKED'" link type="primary" @click="unblockRecipe(row.id)">恢复</el-button>
          </div>
        </article>
        <el-empty v-if="!loading && recipes.length === 0" description="当前条件下暂无系统菜谱" />
      </div>

      <div class="recipe-table-panel__footer">
        <div class="table-hint">{{ currentScopeName }}共 {{ total }} 条，可按分类、状态和关键词组合筛选。</div>
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          background
          layout="total, sizes, prev, pager, next"
          :total="total"
          :page-sizes="[20, 50, 100]"
          @current-change="loadRecipes"
          @size-change="search"
        />
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.category-panel {
  display: flex;
  align-items: center;
  gap: 18px;
  padding-top: 14px;
  padding-bottom: 14px;
}

.category-panel__title {
  flex: none;
  font-size: 16px;
  font-weight: 700;
  color: #1f1f1f;
}

.category-panel__list {
  display: flex;
  flex: 1 1 auto;
  gap: 8px;
  align-items: center;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.category-panel__list::-webkit-scrollbar {
  display: none;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
  padding: 6px 10px;
  border-bottom: 2px solid transparent;
  color: #57534e;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}

.category-item:hover {
  color: #7c5f22;
  background: #fbf7ed;
}

.category-item--active {
  color: #7c5f22;
  border-bottom-color: #c89b38;
  background: #fbf7ed;
}

.category-item__name {
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
}

.category-item__count {
  flex: none;
  color: #8b7f6a;
  font-size: 12px;
}

.recipe-toolbar {
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px 16px;
}

.recipe-toolbar__group,
.recipe-toolbar__actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.toolbar-search--wide {
  width: 320px;
}

.toolbar-search-button,
.toolbar-main-action {
  border-color: #c89b38;
  background: #c89b38;
  color: #fff;
}

.toolbar-search-button:hover,
.toolbar-search-button:focus-visible,
.toolbar-main-action:hover,
.toolbar-main-action:focus-visible {
  border-color: #d4ad57;
  background: #d4ad57;
  color: #fff;
}

.recipe-table-panel {
  display: grid;
  gap: 16px;
}

.recipe-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.recipe-card {
  display: grid;
  overflow: hidden;
  border: 1px solid #ece7df;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 12px 28px rgba(28, 25, 23, 0.05);
}

.recipe-card__cover {
  position: relative;
  aspect-ratio: 4 / 3;
  background: linear-gradient(180deg, #fbf7ed 0%, #f3e7c2 100%);
  cursor: pointer;
}

.recipe-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.recipe-card__empty {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: #7c5f22;
  font-size: 14px;
  font-weight: 600;
}

.recipe-card__status,
.recipe-card__category {
  position: absolute;
  top: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.4;
  backdrop-filter: blur(8px);
}

.recipe-card__status {
  right: 12px;
  background: rgba(68, 64, 60, 0.88);
  color: #fff;
}

.recipe-card__category {
  left: 12px;
  background: rgba(251, 247, 237, 0.92);
  color: #7c5f22;
}

.recipe-card__body {
  display: grid;
  gap: 8px;
  padding: 14px 16px 10px;
}

.recipe-card__title {
  color: #1f1f1f;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  cursor: pointer;
}

.recipe-card__meta {
  display: grid;
  gap: 4px;
  color: #78716c;
  font-size: 12px;
  line-height: 1.5;
}

.recipe-card__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px 16px;
}

.recipe-table-panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

@media (max-width: 1200px) {
  .recipe-toolbar__group {
    width: 100%;
  }
}
</style>
