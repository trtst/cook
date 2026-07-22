<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { Refresh, Search } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import {
  diningGroupApi,
  type AdminDiningGroupSummary,
  type DiningGroupStatus
} from "@/apis/dining-group";
const loading = ref(false);
const diningGroups = ref<AdminDiningGroupSummary[]>([]);
const total = ref(0);

const query = reactive<{
  page: number;
  pageSize: number;
  keyword: string;
  status: DiningGroupStatus | "";
}>({
  page: 1,
  pageSize: 20,
  keyword: "",
  status: ""
});

async function loadDiningGroups() {
  loading.value = true;
  try {
    const result = await diningGroupApi.list({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      status: query.status || undefined
    });
    diningGroups.value = result.items;
    total.value = result.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

function search() {
  query.page = 1;
  void loadDiningGroups();
}

onMounted(loadDiningGroups);
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel">
      <el-input
        v-model="query.keyword"
        class="toolbar-search"
        placeholder="饭搭子名称"
        clearable
        @keyup.enter="search"
      />
      <el-select v-model="query.status" class="toolbar-select" placeholder="状态" clearable>
        <el-option label="ACTIVE" value="ACTIVE" />
        <el-option label="FROZEN" value="FROZEN" />
        <el-option label="ARCHIVED" value="ARCHIVED" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="search">查询</el-button>
      <el-button :icon="Refresh" @click="loadDiningGroups">刷新</el-button>
    </div>

    <div class="table-panel">
      <el-table v-loading="loading" :data="diningGroups" row-key="id">
        <el-table-column prop="name" label="饭搭子名称" min-width="180" />
        <el-table-column prop="status" label="状态" width="120" />
        <el-table-column prop="memberCount" label="有效成员数" width="120" />
        <el-table-column prop="ownerId" label="主理人 ID" min-width="280" />
        <el-table-column prop="version" label="版本" width="90" />
        <el-table-column prop="createdAt" label="创建时间" min-width="190" />
      </el-table>

      <div class="table-hint">成员数按当前有效长期成员口径展示，仅统计 ACTIVE / RESTRICTED。</div>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          background
          layout="total, sizes, prev, pager, next"
          :total="total"
          :page-sizes="[20, 50, 100]"
          @current-change="loadDiningGroups"
          @size-change="search"
        />
      </div>
    </div>
  </section>
</template>
