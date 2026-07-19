<script setup lang="ts">
import type { DiningGroupSummary } from "@next-meal/api-client";
import { onMounted, reactive, ref } from "vue";
import { Refresh, Search } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { adminApi, isUnauthorized } from "@/apis/http";
import { useSessionStore } from "@/stores/session";
import { useRouter } from "vue-router";

const router = useRouter();
const session = useSessionStore();
const loading = ref(false);
const diningGroups = ref<DiningGroupSummary[]>([]);
const total = ref(0);

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: "",
  status: ""
});

async function loadDiningGroups() {
  loading.value = true;
  try {
    const result = await adminApi.admin.listDiningGroups({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      status: query.status || undefined
    });
    diningGroups.value = result.items;
    total.value = result.total;
  } catch (error) {
    if (isUnauthorized(error)) {
      session.clearSession();
      await router.replace("/login");
      return;
    }
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
      </el-select>
      <el-button type="primary" :icon="Search" @click="search">查询</el-button>
      <el-button :icon="Refresh" @click="loadDiningGroups">刷新</el-button>
    </div>

    <div class="table-panel">
      <el-table v-loading="loading" :data="diningGroups" row-key="id">
        <el-table-column prop="name" label="饭搭子名称" min-width="180" />
        <el-table-column prop="status" label="状态" width="120" />
        <el-table-column prop="memberCount" label="成员数" width="100" />
        <el-table-column prop="memberLimit" label="成员上限" width="110" />
        <el-table-column prop="collaborationMode" label="协作模式" min-width="140" />
        <el-table-column prop="sharedQuotaPolicy" label="额度策略" min-width="150" />
        <el-table-column prop="version" label="版本" width="90" />
        <el-table-column prop="createdAt" label="创建时间" min-width="190" />
      </el-table>

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
