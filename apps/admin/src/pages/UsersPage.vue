<script setup lang="ts">
import type { UserProfile } from "@next-meal/api-client";
import { onMounted, reactive, ref } from "vue";
import { Refresh, Search } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { adminApi, isUnauthorized } from "@/apis/http";
import { useSessionStore } from "@/stores/session";
import { useRouter } from "vue-router";

const router = useRouter();
const session = useSessionStore();
const loading = ref(false);
const users = ref<UserProfile[]>([]);
const total = ref(0);

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: ""
});

async function loadUsers() {
  loading.value = true;
  try {
    const result = await adminApi.admin.listUsers({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined
    });
    users.value = result.items;
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
  void loadUsers();
}

onMounted(loadUsers);
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel">
      <el-input
        v-model="query.keyword"
        class="toolbar-search"
        placeholder="昵称 / 手机号"
        clearable
        @keyup.enter="search"
      />
      <el-button type="primary" :icon="Search" @click="search">查询</el-button>
      <el-button :icon="Refresh" @click="loadUsers">刷新</el-button>
    </div>

    <div class="table-panel">
      <el-table v-loading="loading" :data="users" row-key="id">
        <el-table-column prop="uid" label="UID" width="110" />
        <el-table-column prop="nickname" label="昵称" min-width="160">
          <template #default="{ row }">
            {{ row.nickname || "-" }}
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号" min-width="150">
          <template #default="{ row }">
            {{ row.phone || "-" }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120" />
        <el-table-column prop="createdAt" label="创建时间" min-width="190" />
        <el-table-column prop="updatedAt" label="更新时间" min-width="190" />
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          background
          layout="total, sizes, prev, pager, next"
          :total="total"
          :page-sizes="[20, 50, 100]"
          @current-change="loadUsers"
          @size-change="search"
        />
      </div>
    </div>
  </section>
</template>
