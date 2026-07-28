<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { Refresh } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { dashboardApi, type AdminDashboardSummary } from "@/apis/dashboard";

const router = useRouter();
const loading = ref(false);
const summary = ref<AdminDashboardSummary | null>(null);

async function loadSummary() {
  loading.value = true;
  try {
    summary.value = await dashboardApi.getSummary();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载首页摘要失败");
  } finally {
    loading.value = false;
  }
}

function open(path: string) {
  void router.push(path);
}

function formatCount(value: number) {
  return value.toLocaleString("zh-CN");
}

const topCards = computed(() => {
  if (!summary.value) return [];
  return [
    {
      label: "待处理举报",
      value: summary.value.recipe.openReportCount,
      hint: "点击进入举报列表",
      path: "/recipes"
    },
    {
      label: "启用中用户",
      value: summary.value.user.activeCount,
      hint: "当前可正常登录的用户",
      path: "/users"
    },
    {
      label: "生效中饭搭子",
      value: summary.value.diningGroup.activeCount,
      hint: "状态为 ACTIVE 的饭搭子",
      path: "/dining-groups"
    },
    {
      label: "系统食材",
      value: summary.value.ingredient.itemCount,
      hint: "后台运营维护的系统食材",
      path: "/ingredients/items"
    }
  ];
});

const sections = computed(() => {
  if (!summary.value) return [];
  return [
    {
      title: "用户概览",
      items: [
        { label: "用户总数", value: summary.value.user.total, hint: "当前全部用户", path: "/users" },
        { label: "启用中", value: summary.value.user.activeCount, hint: "状态 ACTIVE", path: "/users" },
        { label: "禁用中", value: summary.value.user.disabledCount, hint: "状态 DISABLED", path: "/users" }
      ]
    },
    {
      title: "饭搭子概览",
      items: [
        { label: "饭搭子总数", value: summary.value.diningGroup.total, hint: "全部关系对象", path: "/dining-groups" },
        {
          label: "生效中饭搭子",
          value: summary.value.diningGroup.activeCount,
          hint: "状态 ACTIVE",
          path: "/dining-groups"
        },
        {
          label: "当前成员关系",
          value: summary.value.diningGroup.memberCount,
          hint: "只统计 ACTIVE / RESTRICTED",
          path: "/dining-groups"
        }
      ]
    },
    {
      title: "内容治理",
      items: [
        { label: "菜谱总数", value: summary.value.recipe.total, hint: "系统 + 个人菜谱", path: "/recipes" },
        { label: "正常菜谱", value: summary.value.recipe.activeCount, hint: "状态 ACTIVE", path: "/recipes" },
        { label: "已下架", value: summary.value.recipe.blockedCount, hint: "状态 BLOCKED", path: "/recipes" },
        { label: "已回收", value: summary.value.recipe.recycledCount, hint: "状态 RECYCLED", path: "/recipes" },
        { label: "待处理举报", value: summary.value.recipe.openReportCount, hint: "举报状态 OPEN", path: "/recipes" }
      ]
    },
    {
      title: "基础资料",
      items: [
        {
          label: "系统食材分类",
          value: summary.value.ingredient.categoryCount,
          hint: "用于统一分类管理",
          path: "/ingredients/categories"
        },
        {
          label: "系统食材",
          value: summary.value.ingredient.itemCount,
          hint: "用于录菜和购物合并",
          path: "/ingredients/items"
        },
        {
          label: "系统单位",
          value: summary.value.ingredient.unitCount,
          hint: "按类型统一复用",
          path: "/ingredients/units"
        }
      ]
    }
  ];
});

onMounted(() => {
  void loadSummary();
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel page-toolbar">
      <div class="page-title-block">
        <strong>运营看板</strong>
        <div class="page-subtitle">首页聚合当前待处理内容、平台概览和食材治理基础数据。</div>
      </div>
      <div class="toolbar-spacer" />
      <el-button :icon="Refresh" @click="loadSummary">刷新</el-button>
    </div>

    <div v-loading="loading" class="page-stack">
      <div v-if="summary" class="dashboard-top-grid">
        <button
          v-for="card in topCards"
          :key="card.label"
          type="button"
          class="metric-panel metric-panel--link dashboard-top-card"
          @click="open(card.path)"
        >
          <span class="metric-label">{{ card.label }}</span>
          <strong>{{ formatCount(card.value) }}</strong>
          <span class="metric-meta">{{ card.hint }}</span>
        </button>
      </div>

      <div v-for="section in sections" :key="section.title" class="table-panel dashboard-section">
        <div class="panel-heading dashboard-section__heading">
          <h2>{{ section.title }}</h2>
        </div>
        <div class="summary-grid dashboard-section__grid">
          <button
            v-for="item in section.items"
            :key="item.label"
            type="button"
            class="metric-panel metric-panel--link"
            @click="open(item.path)"
          >
            <span class="metric-label">{{ item.label }}</span>
            <strong>{{ formatCount(item.value) }}</strong>
            <span class="metric-meta">{{ item.hint }}</span>
          </button>
        </div>
      </div>

      <div class="table-panel">
        <div class="panel-heading">
          <h2>常用入口</h2>
        </div>
        <div class="entry-grid">
          <button type="button" class="entry-item entry-item--button" @click="open('/users')">用户查询</button>
          <button type="button" class="entry-item entry-item--button" @click="open('/dining-groups')">饭搭子查询</button>
          <button type="button" class="entry-item entry-item--button" @click="open('/recipes')">菜谱治理</button>
          <button type="button" class="entry-item entry-item--button" @click="open('/ingredients/categories')">系统食材分类</button>
          <button type="button" class="entry-item entry-item--button" @click="open('/ingredients/items')">系统食材</button>
          <button type="button" class="entry-item entry-item--button" @click="open('/ingredients/units')">单位</button>
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

.dashboard-section {
  padding: 0 0 16px;
}

.dashboard-section__heading {
  padding-bottom: 16px;
}

.dashboard-section__grid {
  padding: 0 16px;
}

.dashboard-top-card {
  min-height: 132px;
  background:
    linear-gradient(135deg, rgb(37 99 235 / 12%), transparent 50%),
    #fff;
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
</style>
