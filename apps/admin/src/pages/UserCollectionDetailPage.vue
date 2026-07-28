<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Refresh } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import {
  userRecipeApi,
  type AdminRecipeDomainOverview,
  type AdminUserCollectionRecipe,
  type AdminUserCollectionSummary
} from "@/apis/user-recipe";

const route = useRoute();
const router = useRouter();

const overview = ref<AdminRecipeDomainOverview | null>(null);
const collection = ref<AdminUserCollectionSummary | null>(null);
const items = ref<AdminUserCollectionRecipe[]>([]);
const total = ref(0);
const headerLoading = ref(false);
const itemsLoading = ref(false);
const headerErrorText = ref("");
const itemsErrorText = ref("");
const page = ref(1);
const pageSize = ref(20);

let headerRequest = 0;
let itemsRequest = 0;

const userId = computed(() => String(route.params.userId ?? ""));
const collectionId = computed(() => String(route.params.collectionId ?? ""));
const pageTitle = computed(() => {
  if (!collection.value) return "合集内容";
  return `${collection.value.name} · 合集内容`;
});

function getUserId() {
  const value = userId.value.trim();
  if (!value) throw new Error("用户 ID 缺失");
  return value;
}

function getCollectionId() {
  const value = collectionId.value.trim();
  if (!value) throw new Error("合集 ID 缺失");
  return value;
}

function formatCategory(category?: { name: string } | null) {
  return category?.name || "-";
}

function formatScenes(scenes?: Array<{ name: string }>) {
  if (!scenes?.length) return "-";
  return scenes.map(item => item.name).join(" / ");
}

function backToRecipeDomain() {
  void router.push({
    name: "user-recipe-domain",
    params: { userId: getUserId() },
    query: { tab: "collections" }
  });
}

async function loadDetail() {
  await Promise.all([loadHeader(), loadItems()]);
}

async function loadHeader() {
  const current = ++headerRequest;
  headerLoading.value = true;
  headerErrorText.value = "";
  try {
    const [overviewResult, collectionResult] = await Promise.all([
      userRecipeApi.getOverview(getUserId()),
      userRecipeApi.listCollections(getUserId())
    ]);
    if (current !== headerRequest) return;

    const currentCollection = collectionResult.items.find(item => item.id === getCollectionId()) || null;
    if (!currentCollection) {
      throw new Error("合集不存在或已删除");
    }

    overview.value = overviewResult;
    collection.value = currentCollection;
  } catch (error) {
    if (current !== headerRequest) return;
    overview.value = null;
    collection.value = null;
    headerErrorText.value = error instanceof Error ? error.message : "合集内容加载失败";
    ElMessage.error(headerErrorText.value);
  } finally {
    if (current === headerRequest) {
      headerLoading.value = false;
    }
  }
}

async function loadItems() {
  const current = ++itemsRequest;
  itemsLoading.value = true;
  itemsErrorText.value = "";

  try {
    const recipeResult = await userRecipeApi.listCollectionRecipes(getUserId(), getCollectionId(), {
      page: page.value,
      pageSize: pageSize.value
    });
    if (current !== itemsRequest) return;

    items.value = recipeResult.items;
    total.value = recipeResult.total;
  } catch (error) {
    if (current !== itemsRequest) return;
    items.value = [];
    total.value = 0;
    itemsErrorText.value = error instanceof Error ? error.message : "合集内容加载失败";
    ElMessage.error(itemsErrorText.value);
  } finally {
    if (current === itemsRequest) {
      itemsLoading.value = false;
    }
  }
}

watch(
  () => [route.params.userId, route.params.collectionId],
  () => {
    overview.value = null;
    collection.value = null;
    items.value = [];
    total.value = 0;
    headerErrorText.value = "";
    itemsErrorText.value = "";
    page.value = 1;
    pageSize.value = 20;
    void loadDetail();
  }
);

onMounted(loadDetail);
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel page-toolbar">
      <el-button :icon="ArrowLeft" @click="backToRecipeDomain">返回合集列表</el-button>
      <div class="page-title-block">
        <strong>{{ pageTitle }}</strong>
        <span class="page-subtitle">合集 ID {{ collection?.id || collectionId }}</span>
      </div>
      <div class="toolbar-spacer" />
      <el-button :icon="Refresh" @click="loadDetail">刷新</el-button>
    </div>

    <div class="table-panel">
      <el-skeleton v-if="headerLoading && !collection" :rows="6" animated />

      <el-result v-else-if="headerErrorText && !collection" icon="error" title="合集内容加载失败" :sub-title="headerErrorText" />

      <template v-else-if="collection">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="用户 ID">{{ overview?.user.id || userId }}</el-descriptions-item>
          <el-descriptions-item label="UID">{{ overview?.user.uid || "-" }}</el-descriptions-item>
          <el-descriptions-item label="昵称">{{ overview?.user.nickname || "-" }}</el-descriptions-item>
          <el-descriptions-item label="合集 ID">{{ collection.id }}</el-descriptions-item>
          <el-descriptions-item label="合集名称">{{ collection.name }}</el-descriptions-item>
          <el-descriptions-item label="内容数量">{{ total }}</el-descriptions-item>
          <el-descriptions-item label="合集版本">{{ collection.version }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ collection.updatedAt || "-" }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </div>

    <div class="table-panel">
      <el-alert v-if="itemsErrorText && collection" type="error" :closable="false" :title="itemsErrorText" style="margin-bottom: 16px" />

      <el-table v-loading="itemsLoading" :data="items" row-key="id" empty-text="该合集暂无内容">
        <el-table-column prop="title" label="菜名" min-width="180" />
        <el-table-column label="分类" min-width="140">
          <template #default="{ row }">
            {{ formatCategory(row.category) }}
          </template>
        </el-table-column>
        <el-table-column prop="sourceRecipeId" label="来源菜谱 ID" min-width="260" />
        <el-table-column label="合集归属" min-width="180">
          <template #default="{ row }">
            {{ formatScenes(row.scenes) }}
          </template>
        </el-table-column>
        <el-table-column prop="contentVersionId" label="固定版本 ID" min-width="260" />
        <el-table-column prop="collectedAt" label="收藏时间" min-width="180" />
        <el-table-column prop="updatedAt" label="更新时间" min-width="180" />
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          background
          layout="total, sizes, prev, pager, next"
          :total="total"
          :page-sizes="[20, 50, 100]"
          @current-change="loadItems"
          @size-change="loadItems"
        />
      </div>
    </div>
  </section>
</template>
