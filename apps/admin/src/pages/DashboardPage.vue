<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { dashboardApi, type AdminDashboardTrendPoint, type AdminDashboardTrendsResponse, type AdminDashboardSummary } from "@/apis/dashboard";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";

type TrendRange = "7D" | "30D";

const router = useRouter();
const loading = ref(false);
const summary = ref<AdminDashboardSummary | null>(null);
const trends = ref<AdminDashboardTrendsResponse | null>(null);
const activeRange = ref<TrendRange>("7D");

useAdminHeaderRefresh(() => {
  void loadDashboard();
});

function open(path: string) {
  void router.push(path);
}

function formatCount(value: number) {
  return value.toLocaleString("zh-CN");
}

function chartPath(points: number[]) {
  if (!points.length) return "";
  const max = Math.max(...points, 1);
  const width = 320;
  const height = 120;
  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - (point / max) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function areaPath(points: number[]) {
  if (!points.length) return "";
  const line = chartPath(points);
  const width = 320;
  const height = 120;
  return `${line} L ${width},${height} L 0,${height} Z`;
}

function seriesValues(points: AdminDashboardTrendPoint[], key: keyof AdminDashboardTrendPoint) {
  return points.map(point => Number(point[key] ?? 0));
}

async function loadDashboard() {
  loading.value = true;
  try {
    const [summaryResult, trendResult] = await Promise.all([dashboardApi.getSummary(), dashboardApi.getTrends(activeRange.value)]);
    summary.value = summaryResult;
    trends.value = trendResult;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载运营看板失败");
  } finally {
    loading.value = false;
  }
}

async function changeRange(range: TrendRange) {
  activeRange.value = range;
  loading.value = true;
  try {
    trends.value = await dashboardApi.getTrends(range);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载趋势图失败");
  } finally {
    loading.value = false;
  }
}

const overviewCards = computed(() => {
  if (!summary.value) return [];
  return [
    { label: "今日新用户", value: summary.value.overview.todayNewUsers, hint: "今天新增注册用户", path: "/users" },
    { label: "7 日新用户", value: summary.value.overview.sevenDayNewUsers, hint: "最近 7 天累计新增", path: "/users" },
    { label: "累计用户", value: summary.value.overview.totalUsers, hint: "当前全部用户", path: "/users" },
    { label: "待处理举报", value: summary.value.overview.openReportCount, hint: "待处理菜谱举报", path: "/recipes/reports" },
    { label: "待审核菜谱", value: summary.value.overview.pendingRecipeCount, hint: "个人菜谱投稿待审核", path: "/recipes/pending" },
    { label: "待审核食材", value: summary.value.overview.pendingIngredientCount, hint: "个人食材待审核", path: "/ingredients/pending" },
    { label: "今日核销", value: summary.value.overview.todayRedeemedCount, hint: "今日成功核销兑换码", path: "/membership/redemptions" }
  ];
});

const trendCards = computed(() => {
  const points = trends.value?.points ?? [];
  return [
    {
      title: "用户增长趋势",
      lines: [
        { label: "新用户", color: "#2563eb", points: seriesValues(points, "newUsers") },
        { label: "累计用户", color: "#0f766e", points: seriesValues(points, "totalUsers") }
      ]
    },
    {
      title: "审核与举报待办",
      lines: [
        { label: "举报", color: "#dc2626", points: seriesValues(points, "openReportCount") },
        { label: "菜谱审核", color: "#d97706", points: seriesValues(points, "pendingRecipeCount") },
        { label: "食材审核", color: "#7c3aed", points: seriesValues(points, "pendingIngredientCount") }
      ]
    },
    {
      title: "兑换码生成与核销",
      lines: [
        { label: "生成", color: "#0f766e", points: seriesValues(points, "membershipGeneratedCount") },
        { label: "核销", color: "#2563eb", points: seriesValues(points, "membershipRedeemedCount") }
      ]
    }
  ];
});

const summarySections = computed(() => {
  if (!summary.value) return [];
  return [
    {
      title: "用户与关系",
      items: [
        { label: "启用中用户", value: summary.value.user.activeCount, path: "/users" },
        { label: "禁用中用户", value: summary.value.user.disabledCount, path: "/users" },
        { label: "生效中饭搭子", value: summary.value.diningGroup.activeCount, path: "/users" },
        { label: "当前成员关系", value: summary.value.diningGroup.memberCount, path: "/users" }
      ]
    },
    {
      title: "内容与基础资料",
      items: [
        { label: "菜谱总数", value: summary.value.recipe.total, path: "/recipes/list" },
        { label: "系统食材", value: summary.value.ingredient.itemCount, path: "/ingredients/items" },
        { label: "食材分类", value: summary.value.ingredient.categoryCount, path: "/ingredients/categories" },
        { label: "系统单位", value: summary.value.ingredient.unitCount, path: "/ingredients/units" }
      ]
    }
  ];
});

onMounted(() => {
  void loadDashboard();
});
</script>

<template>
  <section class="page-stack">
    <div v-loading="loading" class="page-stack">
      <div class="dashboard-top-grid">
        <button v-for="card in overviewCards" :key="card.label" type="button" class="metric-panel metric-panel--link dashboard-top-card" @click="open(card.path)">
          <span class="metric-label">{{ card.label }}</span>
          <strong>{{ formatCount(card.value) }}</strong>
          <span class="metric-meta">{{ card.hint }}</span>
        </button>
      </div>

      <div class="table-panel dashboard-trends">
        <div class="panel-heading dashboard-trends__heading">
          <h2>核心趋势</h2>
          <div class="range-switch">
            <el-segmented :model-value="activeRange" :options="[{ label: '最近 7 天', value: '7D' }, { label: '最近 30 天', value: '30D' }]" @change="changeRange($event as TrendRange)" />
          </div>
        </div>

        <div v-if="trends?.points.length" class="trend-grid">
          <article v-for="card in trendCards" :key="card.title" class="trend-card">
            <header class="trend-card__header">
              <h3>{{ card.title }}</h3>
              <div class="trend-card__legend">
                <span v-for="line in card.lines" :key="line.label" class="legend-item">
                  <i :style="{ backgroundColor: line.color }" />
                  {{ line.label }}
                </span>
              </div>
            </header>
            <svg class="trend-card__svg" viewBox="0 0 320 140" preserveAspectRatio="none">
              <path
                v-for="(line, index) in card.lines"
                :key="`${card.title}-${line.label}-area`"
                :d="index === 0 ? areaPath(line.points) : ''"
                :fill="index === 0 ? 'rgba(37,99,235,0.08)' : 'transparent'"
              />
              <path v-for="line in card.lines" :key="`${card.title}-${line.label}`" :d="chartPath(line.points)" :stroke="line.color" stroke-width="3" fill="none" stroke-linecap="round" />
            </svg>
            <div class="trend-card__footer">
              <span>{{ trends.points[0]?.label }}</span>
              <span>{{ trends.points[trends.points.length - 1]?.label }}</span>
            </div>
          </article>
        </div>
        <div v-else class="dashboard-empty">暂无趋势数据</div>
      </div>

      <div v-for="section in summarySections" :key="section.title" class="table-panel dashboard-section">
        <div class="panel-heading">
          <h2>{{ section.title }}</h2>
        </div>
        <div class="summary-grid dashboard-section__grid">
          <button v-for="item in section.items" :key="item.label" type="button" class="metric-panel metric-panel--link" @click="open(item.path)">
            <span class="metric-label">{{ item.label }}</span>
            <strong>{{ formatCount(item.value) }}</strong>
          </button>
        </div>
      </div>

      <div class="table-panel">
        <div class="panel-heading">
          <h2>常用入口</h2>
        </div>
        <div class="entry-grid">
          <button type="button" class="entry-item entry-item--button" @click="open('/membership/skus')">SKU 管理</button>
          <button type="button" class="entry-item entry-item--button" @click="open('/membership/redemptions')">核销记录</button>
          <button type="button" class="entry-item entry-item--button" @click="open('/content/pages')">固定页</button>
          <button type="button" class="entry-item entry-item--button" @click="open('/content/articles')">文章列表</button>
          <button type="button" class="entry-item entry-item--button" @click="open('/recipes/reports')">菜谱举报</button>
          <button type="button" class="entry-item entry-item--button" @click="open('/recipes/pending')">待审核菜谱</button>
          <button type="button" class="entry-item entry-item--button" @click="open('/ingredients/pending')">待审核食材</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.dashboard-top-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.dashboard-top-card {
  min-height: 132px;
  background:
    linear-gradient(135deg, rgb(37 99 235 / 12%), transparent 52%),
    #fff;
}

.dashboard-trends__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.trend-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  padding: 0 16px 16px;
}

.trend-card {
  border: 1px solid #ebeef5;
  border-radius: 20px;
  padding: 16px;
  background: linear-gradient(180deg, #fff, #f8fafc);
}

.trend-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.trend-card__legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px 12px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #606266;
}

.legend-item i {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  display: inline-block;
}

.trend-card__svg {
  width: 100%;
  height: 140px;
}

.trend-card__footer {
  display: flex;
  justify-content: space-between;
  color: #909399;
  font-size: 12px;
}

.dashboard-empty {
  padding: 32px 16px;
  color: #909399;
}

.dashboard-section__grid {
  padding: 0 16px;
}

.metric-panel--link,
.entry-item--button {
  width: 100%;
  text-align: left;
  cursor: pointer;
  border: 1px solid #e5e7eb;
}

.metric-panel--link {
  transition:
    border-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.metric-panel--link:hover {
  border-color: #93c5fd;
  box-shadow: 0 12px 28px rgb(37 99 235 / 10%);
  transform: translateY(-1px);
}

.metric-meta {
  font-size: 13px;
  color: #6b7280;
}

.entry-item--button {
  font: inherit;
}

@media (max-width: 1200px) {
  .dashboard-top-grid,
  .trend-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .dashboard-top-grid,
  .trend-grid {
    grid-template-columns: 1fr;
  }

  .dashboard-trends__heading,
  .trend-card__header {
    flex-direction: column;
  }

  .trend-card__legend {
    justify-content: flex-start;
  }
}
</style>
