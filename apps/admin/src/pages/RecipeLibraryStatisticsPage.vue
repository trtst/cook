<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { Download } from "@element-plus/icons-vue";
import { homeTopicsApi, type HomeTopicRecipeStatsDimension, type HomeTopicRecipeStatsDimensionKey, type HomeTopicRecipeStatsMissingRecipe, type HomeTopicRecipeStatsSnapshot } from "@/apis/home-topics";
import { recipeApi } from "@/apis/recipe";
import RecipeStatsChart from "@/components/RecipeStatsChart.vue";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";

type FacetKey = Exclude<HomeTopicRecipeStatsDimensionKey, "nutrition">;
type RecipeStatsDimensionKey = HomeTopicRecipeStatsDimensionKey;

const router = useRouter();
const loading = ref(false);
const rebuilding = ref(false);
const snapshot = ref<HomeTopicRecipeStatsSnapshot | null>(null);
const selectedDimension = ref<FacetKey>("dishRoles");
const queryDimension = ref<RecipeStatsDimensionKey>("dishRoles");
const missingDrawerVisible = ref(false);
const missingLoading = ref(false);
const missingRecipes = ref<HomeTopicRecipeStatsMissingRecipe[]>([]);
const selectedMissingRecipes = ref<HomeTopicRecipeStatsMissingRecipe[]>([]);
const missingPage = ref(1);
const missingPageSize = ref(100);
const missingTotal = ref(0);
const missingCheckedAt = ref("");
const exportingMissingRecipes = ref(false);
const missingFilterValue = ref<string | undefined>();
let missingRequestId = 0;

useAdminHeaderRefresh(() => {
  void loadSnapshot();
});

const facetDefinitions: Array<{ key: FacetKey; label: string }> = [
  { key: "dishRoles", label: "菜品角色" },
  { key: "proteins", label: "主蛋白" },
  { key: "cuisines", label: "菜系" },
  { key: "dishStyles", label: "菜式 / 做法" },
  { key: "difficulties", label: "难度" },
  { key: "durations", label: "制作时长" },
  { key: "primaryIngredients", label: "主要食材" },
  { key: "allIngredients", label: "核心类别食材" }
];

const labelMaps: Partial<Record<FacetKey, Record<string, string>>> = {
  cuisines: {
    OTHER: "其他（OTHER）",
    SICHUAN_HUNAN: "川湘",
    CANTONESE: "粤菜",
    NORTHERN: "北方菜",
    JIANG_ZHE: "江浙",
    FUSION: "融合菜",
    FUJIAN: "闽菜",
    TAIWAN: "台湾菜"
  },
  proteins: {
    NONE: "无主蛋白",
    PORK: "猪肉",
    CHICKEN: "鸡肉",
    BEEF: "牛肉",
    EGG: "鸡蛋",
    FISH: "鱼类",
    SEAFOOD: "非鱼类水产",
    DUCK: "鸭肉",
    PLANT: "植物蛋白",
    OTHER: "其他"
  },
  dishRoles: { MAIN: "主菜", SOUP: "汤羹", VEGETABLE: "蔬菜", STAPLE: "主食", COLD_DISH: "凉菜" },
  dishStyles: {
    STIR_FRY: "炒",
    SOUP: "煮汤",
    STEW: "炖",
    FRIED: "炸",
    STEAMED: "蒸",
    COLD_DISH: "凉拌",
    STAPLE_FOOD: "主食制作",
    BRAISED: "焖 / 卤",
    BBQ: "烧烤"
  },
  difficulties: { EASY: "简单", BEGINNER: "入门", SKILLED: "熟练" },
  durations: {
    WITHIN_15: "15 分钟内",
    BETWEEN_15_30: "15–30 分钟",
    BETWEEN_30_60: "30–60 分钟",
    OVER_60: "60 分钟以上"
  }
};

const coverageRows = computed(() => {
  if (!snapshot.value) return [];
  return facetDefinitions.map(definition => {
    const dimension = snapshot.value!.facets[definition.key];
    return {
      ...definition,
      ...dimension,
      countLabel: definition.key === "allIngredients" ? "包含菜谱数" : "已标注数"
    };
  });
});

const selectedDimensionDefinition = computed(() =>
  facetDefinitions.find(item => item.key === selectedDimension.value) ?? facetDefinitions[0]!
);
const selectedDimensionStats = computed<HomeTopicRecipeStatsDimension | null>(() =>
  snapshot.value?.facets[selectedDimension.value] ?? null
);

function selectDimensionRow(row: (typeof coverageRows.value)[number] | null) {
  if (row) selectedDimension.value = row.key;
}

const nutritionStatusRows = computed(() => {
  if (!snapshot.value) return [];
  return ([
    { key: "COMPLETE", label: "较完整" },
    { key: "ESTIMATED", label: "含估算" },
    { key: "INSUFFICIENT", label: "数据不足" },
    { key: "NONE", label: "无分析" }
  ] as const).map(item => {
    const count = snapshot.value!.nutrition.statusCounts[item.key];
    return { ...item, count, share: count / Math.max(snapshot.value!.totalPublicRecipes, 1) };
  });
});

const nutritionFieldRows = computed(() => {
  if (!snapshot.value) return [];
  return [
    { label: "热量", count: snapshot.value.nutrition.fieldCoverage.calories },
    { label: "蛋白质", count: snapshot.value.nutrition.fieldCoverage.protein },
    { label: "脂肪", count: snapshot.value.nutrition.fieldCoverage.fat },
    { label: "碳水化合物", count: snapshot.value.nutrition.fieldCoverage.carbohydrate }
  ];
});

const chartFacetDefinitions: Array<{ key: FacetKey; title: string }> = [
  { key: "dishRoles", title: "菜品角色" },
  { key: "proteins", title: "主蛋白" },
  { key: "cuisines", title: "菜系" },
  { key: "dishStyles", title: "菜式 / 做法" },
  { key: "primaryIngredients", title: "主要食材业务标签 TOP 8" }
];

const chartFacetRows = computed(() => {
  if (!snapshot.value) return [];
  return chartFacetDefinitions.map(definition => {
    const dimension = snapshot.value!.facets[definition.key];
    const values = dimension.values.slice(0, 8);
    return {
      ...definition,
      labels: values.map(item => getFacetLabel(definition.key, item.value)),
      values: values.map(item => item.count)
    };
  });
});

type InsightItem = { title: string; detail: string; dimension: FacetKey; value?: string };

const insightItems = computed<InsightItem[]>(() => {
  if (!snapshot.value) return [];
  const stats = snapshot.value;
  const cuisineOther = stats.facets.cuisines.values.find(item => item.value === "OTHER");
  const proteinOther = stats.facets.proteins.values.find(item => item.value === "OTHER");
  const items: InsightItem[] = [];
  if (proteinOther && proteinOther.count > 0) items.push({
    title: "主蛋白标签仍有 OTHER",
    detail: `OTHER ${proteinOther.count} 道；非鱼类水产 ${stats.facets.proteins.values.find(item => item.value === "SEAFOOD")?.count ?? 0} 道。`,
    dimension: "proteins",
    value: "OTHER"
  });
  if (cuisineOther && cuisineOther.count > 0) items.push({
    title: "菜系标签集中在 OTHER",
    detail: `OTHER ${cuisineOther.count} 道（${formatPercent(cuisineOther.shareOfTotal)}）；缺失 ${stats.facets.cuisines.missingCount} 道。`,
    dimension: "cuisines",
    value: "OTHER"
  });
  if ((stats.facets.primaryIngredients.missingCount ?? 0) > 0) items.push({
    title: "主要食材尚有缺标",
    detail: `缺失 ${stats.facets.primaryIngredients.missingCount ?? 0} 道；覆盖率 ${formatPercent(stats.facets.primaryIngredients.coverageRate ?? 0)}。`,
    dimension: "primaryIngredients"
  });
  return items;
});

function formatCount(value: number) {
  return value.toLocaleString("zh-CN");
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function getFacetLabel(key: FacetKey, value: string) {
  return labelMaps[key]?.[value] ?? value;
}

async function loadMissingRecipes() {
  const current = ++missingRequestId;
  missingLoading.value = true;
  missingRecipes.value = [];
  missingTotal.value = 0;
  try {
    const result = await homeTopicsApi.getMissingRecipeStats({
      dimension: queryDimension.value,
      value: missingFilterValue.value,
      page: missingPage.value,
      pageSize: missingPageSize.value
    });
    if (current !== missingRequestId) return;
    missingRecipes.value = result.items;
    missingTotal.value = result.total;
    missingCheckedAt.value = result.checkedAt;
  } catch (error) {
    if (current === missingRequestId) ElMessage.error(error instanceof Error ? error.message : "加载缺失菜谱失败");
  } finally {
    if (current === missingRequestId) missingLoading.value = false;
  }
}

function showRecipeStats(dimension: RecipeStatsDimensionKey, value?: string) {
  queryDimension.value = dimension;
  if (dimension !== "nutrition") selectedDimension.value = dimension;
  missingFilterValue.value = value;
  selectedMissingRecipes.value = [];
  missingPage.value = 1;
  missingDrawerVisible.value = true;
  void loadMissingRecipes();
}

function handleMissingSelectionChange(value: HomeTopicRecipeStatsMissingRecipe[]) {
  selectedMissingRecipes.value = value;
}

function downloadWikiJson(fileName: string, body: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function exportMissingRecipes() {
  const recipeIds = selectedMissingRecipes.value.map(item => item.id);
  if (!recipeIds.length) {
    ElMessage.warning("请先勾选要导出的菜谱");
    return;
  }
  if (recipeIds.length > 100) {
    ElMessage.warning("一次最多导出 100 道菜谱");
    return;
  }
  exportingMissingRecipes.value = true;
  try {
    const document = await recipeApi.exportFullJson({ recipeIds });
    downloadWikiJson(`recipe-library-full-${queryDimension.value}-${new Date().toISOString().slice(0, 10)}.json`, document);
    ElMessage.success(`已导出 ${document.recipes.length} 道完整菜谱`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "批量导出失败");
  } finally {
    exportingMissingRecipes.value = false;
  }
}

const missingDrawerTitle = computed(() => missingFilterValue.value
  ? queryDimension.value === "nutrition"
    ? `营养分析：${nutritionStatusRows.value.find(item => item.key === missingFilterValue.value)?.label ?? (missingFilterValue.value === "HAS_ANALYSIS" ? "有分析结果" : missingFilterValue.value)}`
    : `${selectedDimensionDefinition.value.label}：${getFacetLabel(selectedDimension.value, missingFilterValue.value)}`
  : queryDimension.value === "nutrition"
    ? "无营养分析"
    : queryDimension.value === "primaryIngredients"
      ? "缺少主要食材标签"
      : `缺少${selectedDimensionDefinition.value.label}标签`
);

function changeMissingPage(page: number) {
  missingPage.value = page;
  void loadMissingRecipes();
}

function editMissingRecipe(recipeId: number) {
  missingDrawerVisible.value = false;
  void router.push({ name: "recipe-detail", params: { recipeId } });
}

async function loadSnapshot() {
  loading.value = true;
  try {
    const result = await homeTopicsApi.getRecipeStats();
    snapshot.value = result.snapshot;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载菜谱库统计失败");
  } finally {
    loading.value = false;
  }
}

async function rebuildSnapshot() {
  rebuilding.value = true;
  try {
    const result = await homeTopicsApi.rebuildRecipeStats(createOperationId());
    snapshot.value = result.snapshot;
    ElMessage.success("菜谱库统计已重建");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "重建菜谱库统计失败");
  } finally {
    rebuilding.value = false;
  }
}

onMounted(() => {
  void loadSnapshot();
});
</script>

<template>
  <section v-loading="loading" class="page-stack recipe-stats-page">
    <header class="stats-heading">
      <div class="stats-heading__title">
        <h1>菜谱库统计</h1>
        <span v-if="snapshot" class="stats-heading__meta">快照生成时间：{{ formatDate(snapshot.generatedAt) }}</span>
      </div>
      <el-button type="primary" :loading="rebuilding" @click="rebuildSnapshot">重建统计</el-button>
    </header>

    <el-empty v-if="!snapshot && !loading" description="尚未生成菜谱库统计快照" />

    <template v-if="snapshot">
      <section class="stats-overview">
        <article class="stats-overview__card stats-overview__card--primary">
          <span>公开灵感菜谱</span>
          <strong>{{ formatCount(snapshot.totalPublicRecipes) }}</strong>
          <small>当前公开版本</small>
        </article>
        <article class="stats-overview__card">
          <span>菜品角色标签覆盖</span>
          <strong>{{ formatPercent(snapshot.facets.dishRoles.coverageRate ?? 0) }}</strong>
          <small>{{ formatCount(snapshot.facets.dishRoles.confirmedCount) }} 道已标注</small>
        </article>
        <article class="stats-overview__card">
          <span>主要食材标签覆盖</span>
          <strong>{{ formatPercent(snapshot.facets.primaryIngredients.coverageRate ?? 0) }}</strong>
          <small>{{ formatCount(snapshot.facets.primaryIngredients.missingCount ?? 0) }} 道缺少标签</small>
        </article>
        <button
          type="button"
          class="stats-overview__card stats-overview__card--interactive"
          aria-label="查看有营养分析结果的菜谱"
          @click="showRecipeStats('nutrition', 'HAS_ANALYSIS')"
        >
          <span>营养分析覆盖</span>
          <strong>{{ formatPercent(snapshot.nutrition.hasNutritionAnalysis / Math.max(snapshot.totalPublicRecipes, 1)) }}</strong>
          <small>{{ formatCount(snapshot.nutrition.hasNutritionAnalysis) }} 道有分析结果</small>
          <small class="stats-overview__action">查看菜谱 →</small>
        </button>
      </section>

      <section class="stats-section">
        <header class="section-heading"><h2>分类图表</h2></header>
        <div class="chart-grid">
          <RecipeStatsChart
            v-for="item in chartFacetRows"
            :key="item.key"
            :title="item.title"
            :labels="item.labels"
            :values="item.values"
            :total="snapshot.totalPublicRecipes"
            type="bar"
          />
          <RecipeStatsChart
            title="营养分析状态"
            :labels="nutritionStatusRows.map(item => item.label)"
            :values="nutritionStatusRows.map(item => item.count)"
            :total="snapshot.totalPublicRecipes"
            type="doughnut"
          />
        </div>
      </section>

      <section class="stats-section">
        <header class="section-heading"><h2>分类数据</h2></header>
        <el-table
          :data="coverageRows"
          size="small"
          stripe
          row-key="key"
          highlight-current-row
          :current-row-key="selectedDimension"
          @current-change="selectDimensionRow"
        >
          <el-table-column prop="label" label="统计维度" min-width="180" />
          <el-table-column label="菜谱数" width="210" align="right">
            <template #default="{ row }">
              <span v-if="row.key === 'allIngredients'">含有 {{ formatCount(row.confirmedCount) }} 道 · 无需此类食材 {{ formatCount(row.notApplicableCount) }} 道</span>
              <span v-else>{{ row.countLabel }} {{ formatCount(row.confirmedCount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="缺失" width="130" align="right">
            <template #default="{ row }">
              <span v-if="row.key === 'allIngredients'">{{ formatCount(row.missingCount) }}</span>
              <span v-else-if="!row.coverageApplicable">不适用</span>
              <el-button v-else link type="primary" :disabled="row.missingCount === 0" @click.stop="showRecipeStats(row.key)">
                {{ formatCount(row.missingCount ?? 0) }}
              </el-button>
            </template>
          </el-table-column>
          <el-table-column label="覆盖率" min-width="210">
            <template #default="{ row }">
              <div v-if="row.key === 'allIngredients'" class="coverage-cell">
                <el-progress :percentage="row.coverageRate * 100" :show-text="false" :stroke-width="7" />
                <span>{{ formatPercent(row.coverageRate) }}</span>
              </div>
              <div v-else-if="row.coverageApplicable" class="coverage-cell">
                <el-progress :percentage="(row.coverageRate ?? 0) * 100" :show-text="false" :stroke-width="7" />
                <span>{{ formatPercent(row.coverageRate ?? 0) }}</span>
              </div>
              <span v-else-if="row.key !== 'allIngredients'">不适用</span>
            </template>
          </el-table-column>
        </el-table>
        <div class="facet-detail">
          <h3>{{ selectedDimensionDefinition.label }}分布</h3>
          <el-table :data="selectedDimensionStats?.values ?? []" size="small" stripe max-height="380">
            <el-table-column label="分类" min-width="180">
              <template #default="{ row }">{{ getFacetLabel(selectedDimension, row.value) }}</template>
            </el-table-column>
            <el-table-column label="菜谱数" width="120" align="right">
              <template #default="{ row }">{{ formatCount(row.count) }}</template>
            </el-table-column>
            <el-table-column label="占全部菜谱" width="160" align="right">
              <template #default="{ row }">{{ formatPercent(row.shareOfTotal) }}</template>
            </el-table-column>
            <el-table-column label="占已标注菜谱" width="180" align="right">
              <template #default="{ row }">{{ formatPercent(row.shareOfConfirmed) }}</template>
            </el-table-column>
          </el-table>
        </div>
      </section>

      <section class="stats-section">
        <header class="section-heading"><h2>营养数据覆盖</h2></header>
        <div class="nutrition-status-grid">
          <button
            v-for="item in nutritionStatusRows"
            :key="item.key"
            type="button"
            class="nutrition-status nutrition-status--interactive"
            @click="showRecipeStats('nutrition', item.key)"
          >
            <span>{{ item.label }}</span>
            <strong>{{ formatCount(item.count) }}</strong>
            <small>{{ formatPercent(item.share) }}</small>
          </button>
        </div>
        <el-table
          :data="nutritionFieldRows"
          size="small"
          stripe
        >
          <el-table-column prop="label" label="营养字段" />
          <el-table-column label="有值菜谱数" width="160" align="right">
            <template #default="{ row }">{{ formatCount(row.count) }}</template>
          </el-table-column>
          <el-table-column label="占全部菜谱" width="180" align="right">
            <template #default="{ row }">{{ formatPercent(row.count / Math.max(snapshot.totalPublicRecipes, 1)) }}</template>
          </el-table-column>
        </el-table>
        <el-alert
          class="nutrition-alert"
          type="info"
          :closable="false"
          title="钠、膳食纤维和添加糖暂无数据，因此不计算健康评分。"
        />
      </section>

      <section class="stats-section">
        <header class="section-heading"><h2>待核对</h2></header>
        <div class="insight-grid">
          <button
            v-for="item in insightItems"
            :key="item.title"
            type="button"
            class="insight-item"
            @click="showRecipeStats(item.dimension, item.value)"
          >
            <span class="insight-item__heading">
              <strong>{{ item.title }}</strong>
              <span class="insight-item__action">查看菜谱 →</span>
            </span>
            <span class="insight-item__detail">{{ item.detail }}</span>
          </button>
        </div>
      </section>

    </template>

    <el-drawer
      v-model="missingDrawerVisible"
      :title="missingDrawerTitle"
      size="640px"
      destroy-on-close
    >
      <div v-loading="missingLoading" class="missing-drawer">
        <div class="missing-drawer__toolbar">
          <div class="missing-drawer__meta">{{ formatCount(missingTotal) }} 道 · 实时查询于 {{ missingCheckedAt ? formatDate(missingCheckedAt) : "—" }}</div>
          <el-button :icon="Download" :loading="exportingMissingRecipes" :disabled="!selectedMissingRecipes.length" @click="exportMissingRecipes">
            批量导出（{{ selectedMissingRecipes.length }}）
          </el-button>
        </div>
        <el-table :data="missingRecipes" size="small" stripe row-key="id" reserve-selection @selection-change="handleMissingSelectionChange">
          <el-table-column type="selection" width="48" />
          <el-table-column prop="id" label="ID" width="110" />
          <el-table-column prop="title" label="菜谱" min-width="220" show-overflow-tooltip />
          <el-table-column label="操作" width="100" align="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="editMissingRecipe(row.id)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!missingLoading && missingTotal === 0" :description="missingFilterValue ? '当前没有匹配菜谱' : '当前没有缺失菜谱'" />
        <el-pagination
          v-if="missingTotal > missingPageSize"
          layout="total, prev, pager, next"
          :total="missingTotal"
          :current-page="missingPage"
          :page-size="missingPageSize"
          @current-change="changeMissingPage"
        />
      </div>
    </el-drawer>
  </section>
</template>

<style scoped lang="scss">
.recipe-stats-page {
  gap: 16px;
}

.stats-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stats-heading {
  justify-content: space-between;
  padding: 4px 2px;
}

.stats-heading h1 {
  margin: 0;
  color: #292524;
  font-size: 22px;
}

.stats-heading__title {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 12px;
}

.stats-heading__meta {
  color: #78716c;
  font-size: 13px;
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.stats-overview__card,
.nutrition-status,
.insight-item {
  border: 1px solid #e7e5e4;
  border-radius: 10px;
  background: #fff;
}

.stats-overview__card {
  display: flex;
  min-height: 112px;
  flex-direction: column;
  justify-content: center;
  gap: 7px;
  padding: 16px 18px;
  color: inherit;
  font: inherit;
  text-align: left;
}

.stats-overview__card--interactive,
.nutrition-status--interactive {
  cursor: pointer;
  transition: border-color 120ms ease, background-color 120ms ease;
}

.stats-overview__card--interactive:hover,
.stats-overview__card--interactive:focus-visible,
.nutrition-status--interactive:hover,
.nutrition-status--interactive:focus-visible {
  border-color: #d6a66f;
  background-color: #fffbf5;
}

.stats-overview__card--interactive:focus-visible,
.nutrition-status--interactive:focus-visible {
  outline: 2px solid #d6a66f;
  outline-offset: 2px;
}

.stats-overview__action {
  color: #a16207 !important;
}

.stats-overview__card--primary {
  background: linear-gradient(135deg, #fff8ee, #fff);
  border-color: #f1dfc7;
}

.stats-overview__card span,
.nutrition-status span {
  color: #78716c;
  font-size: 13px;
}

.stats-overview__card strong {
  color: #292524;
  font-size: 28px;
  line-height: 1;
}

.stats-overview__card small,
.nutrition-status small {
  color: #a8a29e;
  font-size: 12px;
}

.stats-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-heading h2 {
  margin: 0;
  color: #292524;
  font-size: 17px;
  font-weight: 600;
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.coverage-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.coverage-cell .el-progress {
  width: 70px;
}

.coverage-cell span {
  width: 46px;
  color: #57534e;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.facet-detail {
  margin-top: 0;
}

.facet-detail h3 {
  margin: 0 0 12px;
  color: #44403c;
  font-size: 15px;
}

.missing-drawer {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 160px;
}

.missing-drawer__meta {
  color: #78716c;
  font-size: 13px;
}

.missing-drawer__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.nutrition-status-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.nutrition-status {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
}

.nutrition-status strong {
  color: #292524;
  font-size: 22px;
}

.nutrition-alert {
  margin-top: 0;
}

.insight-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.insight-item {
  display: block;
  width: 100%;
  padding: 14px 16px;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 120ms ease, background-color 120ms ease;
}

.insight-item:hover,
.insight-item:focus-visible {
  border-color: #d6a66f;
  background: #fffbf5;
}

.insight-item:focus-visible {
  outline: 2px solid #d6a66f;
  outline-offset: 2px;
}

.insight-item__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.insight-item__action {
  flex: 0 0 auto;
  color: #a16207;
  font-size: 12px;
}

.insight-item__detail {
  display: block;
  margin-top: 8px;
  color: #78716c;
  font-size: 13px;
  line-height: 1.6;
}

.insight-item strong {
  color: #44403c;
  font-size: 14px;
}

@media (max-width: 1100px) {
  .stats-overview,
  .nutrition-status-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .chart-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .insight-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .stats-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .stats-heading__title {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .stats-overview,
  .nutrition-status-grid {
    grid-template-columns: 1fr;
  }

  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>
