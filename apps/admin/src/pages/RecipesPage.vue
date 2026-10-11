<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { Download, Plus, Search } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { recipeApi, type AdminInspirationCategorySummary, type AdminRecipeSummary } from "@/apis/recipe";
import type { UUID } from "@/apis/http";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { formatDateTime } from "@/utils/date";
import { createOperationId } from "@/utils/operation-id";
import { formatStatusText } from "@/utils/status";

const router = useRouter();
const loading = ref(false);
const categories = ref<AdminInspirationCategorySummary[]>([]);
const recipes = ref<AdminRecipeSummary[]>([]);
const selectedRecipes = ref(new Set<UUID>());
const selectedCandidateRecipes = ref(new Set<UUID>());
const total = ref(0);
const blockedRecipeCount = ref(0);
const blockedView = ref(false);
const exporting = ref(false);
const exportingWikiRevision = ref(false);
const confirmingCandidates = ref(false);
const syncingImportedContent = ref(false);
let requestId = 0;

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: "",
  categoryId: "" as UUID | "",
  status: "" as "" | "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED"
});

const allRecipeCount = computed(() => categories.value.reduce((sum, item) => sum + item.recipeCount, 0));
const allCurrentPageRecipesSelected = computed(() => recipes.value.length > 0 && recipes.value.every(item => selectedRecipes.value.has(item.id)));
const isAllView = computed(() => !query.categoryId && !blockedView.value);
const isBlockedView = computed(() => blockedView.value);
const currentScopeName = computed(() => {
  if (blockedView.value) return "下架菜谱";
  if (!query.categoryId) return "全部系统菜谱";
  return categories.value.find(item => item.id === query.categoryId)?.name || "当前分类";
});
function recommendationRankLabel(rank: AdminRecipeSummary["recommendationRank"]) {
  if (rank === "DOWNRANK") return "后移";
  if (rank === "STRONG_DOWNRANK") return "明显后移";
  return "正常推荐";
}

useAdminHeaderRefresh(() => {
  void loadPage();
});

async function loadCategories() {
  categories.value = await recipeApi.listInspirationCategories();
  if (query.categoryId && !categories.value.some(item => item.id === query.categoryId)) {
    query.categoryId = "";
    blockedView.value = false;
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

async function loadBlockedCount() {
  const result = await recipeApi.list({ page: 1, pageSize: 1, status: "BLOCKED" });
  blockedRecipeCount.value = result.total;
}

async function loadPage() {
  try {
    await Promise.all([loadCategories(), loadBlockedCount()]);
    await loadRecipes();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载系统菜谱失败");
  }
}

function search() {
  selectedRecipes.value.clear();
  selectedCandidateRecipes.value.clear();
  query.page = 1;
  void loadRecipes();
}

function toggleRecipeSelection(row: AdminRecipeSummary, selected: string | number | boolean) {
  if (selected) {
    selectedRecipes.value.add(row.id);
    if (row.hasWikiCandidate) selectedCandidateRecipes.value.add(row.id);
  } else {
    selectedRecipes.value.delete(row.id);
    selectedCandidateRecipes.value.delete(row.id);
  }
}

function toggleCurrentPageSelection() {
  if (allCurrentPageRecipesSelected.value) {
    for (const recipe of recipes.value) {
      selectedRecipes.value.delete(recipe.id);
      selectedCandidateRecipes.value.delete(recipe.id);
    }
    return;
  }
  for (const recipe of recipes.value) {
    selectedRecipes.value.add(recipe.id);
    if (recipe.hasWikiCandidate) selectedCandidateRecipes.value.add(recipe.id);
    else selectedCandidateRecipes.value.delete(recipe.id);
  }
}

async function confirmSelectedCandidates() {
  const recipeIds = Array.from(selectedCandidateRecipes.value);
  if (!recipeIds.length || confirmingCandidates.value) return;
  if (recipeIds.length > 100) {
    ElMessage.warning("一次最多确认 100 道菜谱候选，请减少勾选数量");
    return;
  }
  confirmingCandidates.value = true;
  try {
    await ElMessageBox.confirm(
      `确认处理已勾选的 ${recipeIds.length} 道菜谱候选？完整的助理步骤会成为前台可用 Wiki；不完整的步骤会保留待补充状态。`,
      "批量确认 Wiki 候选",
      { type: "warning", confirmButtonText: "确认候选", cancelButtonText: "取消" }
    );
  } catch (error) {
    confirmingCandidates.value = false;
    if (error !== "cancel" && error !== "close") ElMessage.error(error instanceof Error ? error.message : "确认失败");
    return;
  }
  try {
    const result = await recipeApi.confirmWikiCandidates(recipeIds, createOperationId());
    selectedRecipes.value.clear();
    selectedCandidateRecipes.value.clear();
    await loadRecipes();
    const incompleteCount = result.assistantNeedsReviewRecipeIds.length;
    ElMessage.success(`已确认 ${result.confirmedRecipeIds.length} 道菜谱候选${incompleteCount ? `；${incompleteCount} 道助理步骤仍需补充` : ""}`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "批量确认 Wiki 候选失败");
  } finally {
    confirmingCandidates.value = false;
  }
}

async function syncSelectedImportedContent() {
  const recipeIds = Array.from(selectedRecipes.value);
  if (!recipeIds.length || syncingImportedContent.value) return;
  if (recipeIds.length > 100) {
    ElMessage.warning("一次最多同步 100 道菜谱，请减少勾选数量");
    return;
  }
  try {
    await ElMessageBox.confirm(
      `将从每道菜谱唯一关联的已发布导入 JSON 同步正文，创建新版本。当前封面图、步骤图、Wiki 和分类会保留；关联不明确或步骤图片无法安全对位的菜谱会跳过。确认同步 ${recipeIds.length} 道菜谱？`,
      "批量同步导入正文",
      { type: "warning", confirmButtonText: "开始同步", cancelButtonText: "取消" }
    );
  } catch (error) {
    if (error !== "cancel" && error !== "close") ElMessage.error(error instanceof Error ? error.message : "同步失败");
    return;
  }
  syncingImportedContent.value = true;
  try {
    const result = await recipeApi.syncContentFromImports(recipeIds, createOperationId());
    selectedRecipes.value.clear();
    selectedCandidateRecipes.value.clear();
    await loadRecipes();
    if (result.skippedCount) {
      const skipped = result.items
        .filter(item => item.status === "SKIPPED")
        .map(item => `${item.recipeId}：${item.message || "未同步"}`)
        .join("\n");
      await ElMessageBox.alert(
        `成功同步 ${result.syncedCount} 道，跳过 ${result.skippedCount} 道。\n\n${skipped}`,
        "导入正文同步结果",
        { confirmButtonText: "知道了", customClass: "recipe-import-sync-result" }
      );
    } else {
      ElMessage.success(`已从导入 JSON 同步 ${result.syncedCount} 道菜谱正文`);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "批量同步导入正文失败");
  } finally {
    syncingImportedContent.value = false;
  }
}

async function exportFilteredRecipes() {
  // 无选择时按当前筛选条件分页导出；有选择时只导出跨页保留的菜谱。
  if (exporting.value) return;
  exporting.value = true;
  try {
    const filters = {
      categoryId: query.categoryId || undefined,
      keyword: query.keyword.trim() || undefined,
      status: query.status || undefined
    };
    let page = await recipeApi.exportImages({ ...filters, page: 1, pageSize: 100 });
    const allItems = [...page.items];
    while (page.hasNext) {
      page = await recipeApi.exportImages({ ...filters, page: page.page + 1, pageSize: page.pageSize });
      allItems.push(...page.items);
    }
    const items = selectedRecipes.value.size > 0
      ? allItems.filter(item => selectedRecipes.value.has(item.recipeId))
      : allItems;
    if (!items.length) {
      ElMessage.info("当前筛选没有可导出的菜谱");
      return;
    }
    const exportData = Object.fromEntries(items.map(item => [String(item.recipeId), {
      contentVersionId: item.contentVersionId,
      title: item.title,
      description: item.description,
      keywords: item.keywords,
      tips: item.tips,
      steps: item.steps,
      wikiSteps: item.wikiSteps
    }]));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `recipes-${new Date().toISOString().replace(/[:.]/gu, "-")}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    ElMessage.success(`已导出 ${items.length} 道菜谱`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "导出菜谱失败");
  } finally {
    exporting.value = false;
  }
}

async function exportWikiRevision() {
  if (exportingWikiRevision.value) return;
  if (selectedRecipes.value.size > 100) {
    ElMessage.warning("一次最多导出 100 道菜谱 Wiki，请减少勾选数量");
    return;
  }
  exportingWikiRevision.value = true;
  try {
    const result = await recipeApi.exportWikiRevision(selectedRecipes.value.size
      ? { recipeIds: Array.from(selectedRecipes.value) }
      : {
          categoryId: query.categoryId || undefined,
          keyword: query.keyword.trim() || undefined
        });
    if (!result.recipes.length) {
      ElMessage.info("当前筛选没有可修订的 READY Wiki");
      return;
    }
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `recipe-wiki-revision-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    ElMessage.success(`已导出 ${result.recipes.length} 道菜谱的 Wiki 修订文件`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "导出 Wiki 修订文件失败");
  } finally {
    exportingWikiRevision.value = false;
  }
}

async function selectCategory(categoryId: UUID | "") {
  if (query.categoryId === categoryId && !blockedView.value) return;
  selectedRecipes.value.clear();
  selectedCandidateRecipes.value.clear();
  blockedView.value = false;
  query.categoryId = categoryId;
  query.status = "";
  query.page = 1;
  query.keyword = "";
  await loadRecipes();
}

async function selectBlockedView() {
  if (blockedView.value) return;
  selectedRecipes.value.clear();
  selectedCandidateRecipes.value.clear();
  blockedView.value = true;
  query.categoryId = "";
  query.status = "BLOCKED";
  query.page = 1;
  query.keyword = "";
  await loadRecipes();
}

function handleStatusChange() {
  blockedView.value = false;
  search();
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

async function deleteBlockedRecipe(row: AdminRecipeSummary) {
  try {
    await ElMessageBox.confirm(
      `确认删除下架菜谱“${row.title}”？删除后不可恢复，也不会继续出现在下架分类。`,
      "删除下架菜谱",
      {
        type: "warning",
        confirmButtonText: "删除",
        cancelButtonText: "取消"
      }
    );
    await recipeApi.deleteBlocked(row.id, {
      operationId: createOperationId(),
      expectedVersion: row.version
    });
    ElMessage.success("下架菜谱已删除");
    if (recipes.value.length === 1 && query.page > 1) query.page -= 1;
    await loadPage();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "删除下架菜谱失败");
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
        <el-select v-model="query.status" class="toolbar-select" placeholder="状态" clearable :disabled="isBlockedView" @change="handleStatusChange">
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
        <span class="recipe-selection-count">已选 {{ selectedRecipes.size }} 道</span>
        <el-button
          type="success"
          :loading="confirmingCandidates"
          :disabled="selectedCandidateRecipes.size === 0 || exporting || syncingImportedContent"
          @click="confirmSelectedCandidates"
        >
          一键确认候选（{{ selectedCandidateRecipes.size }}）
        </el-button>
        <el-button
          type="warning"
          :loading="syncingImportedContent"
          :disabled="selectedRecipes.size === 0 || confirmingCandidates || exporting"
          @click="syncSelectedImportedContent"
        >
          批量同步导入正文（{{ selectedRecipes.size }}）
        </el-button>
        <el-button text @click="toggleCurrentPageSelection">
          {{ allCurrentPageRecipesSelected ? "取消本页全选" : "全选当前页" }}
        </el-button>
        <el-button :icon="Download" :loading="exporting" @click="exportFilteredRecipes">批量导出</el-button>
        <el-button :icon="Download" :loading="exportingWikiRevision" :disabled="blockedView || (query.status !== '' && query.status !== 'ACTIVE') || exporting || confirmingCandidates || syncingImportedContent" @click="exportWikiRevision">导出 Wiki 修订文件</el-button>
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
        <span
          class="category-item"
          :class="{ 'category-item--active': isBlockedView }"
          @click="selectBlockedView"
        >
          <span class="category-item__name">下架</span>
          <span class="category-item__count">{{ blockedRecipeCount }}</span>
        </span>
      </div>
    </div>

    <div class="table-panel recipe-table-panel">
      <div v-loading="loading" class="recipe-card-grid">
        <article v-for="row in recipes" :key="row.id" class="recipe-card">
          <div class="recipe-card__cover" @click="openDetail(row.id)">
            <img v-if="row.coverImageUrl" :src="row.coverImageUrl" :alt="`${row.title} 封面`" class="recipe-card__image" />
            <div v-else class="recipe-card__empty">暂无封面</div>
            <el-checkbox
              class="recipe-card__select"
              :model-value="selectedRecipes.has(row.id)"
              aria-label="选择菜谱"
              @click.stop
              @change="toggleRecipeSelection(row, $event)"
            />
            <span v-if="row.status !== 'ACTIVE'" class="recipe-card__status">{{ formatStatusText(row.status) }}</span>
            <span v-if="isAllView" class="recipe-card__category">{{ row.inspirationCategoryName }}</span>
            <el-tag v-if="row.hasWikiCandidate" class="recipe-card__candidate" type="warning" size="small">Wiki 有候选</el-tag>
          </div>
          <div class="recipe-card__body">
            <div class="recipe-card__title" @click="openDetail(row.id)">{{ row.title }}</div>
            <div class="recipe-card__meta">
              <span>{{ formatDateTime(row.updatedAt) }}</span>
              <span v-if="row.ownerUid !== null">源自 UID {{ row.ownerUid }}</span>
              <el-tag v-if="row.recommendationRank !== 'NORMAL'" type="warning" size="small">{{ recommendationRankLabel(row.recommendationRank) }}</el-tag>
            </div>
          </div>
          <div class="recipe-card__actions">
            <el-button link type="primary" @click="openDetail(row.id)">详情</el-button>
            <el-button v-if="row.status === 'ACTIVE'" link type="danger" @click="blockRecipe(row.id)">下架</el-button>
            <template v-else-if="row.status === 'BLOCKED'">
              <el-button link type="primary" @click="unblockRecipe(row.id)">恢复</el-button>
              <el-button link type="danger" @click="deleteBlockedRecipe(row)">删除</el-button>
            </template>
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

.recipe-toolbar .toolbar-select {
  width: 100px;
}

.recipe-selection-count {
  color: #78716c;
  font-size: 13px;
  white-space: nowrap;
}

.toolbar-search--wide {
  width: 250px;
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

.recipe-card__select {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.92);
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

.recipe-card__candidate {
  position: absolute;
  right: 10px;
  bottom: 10px;
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
