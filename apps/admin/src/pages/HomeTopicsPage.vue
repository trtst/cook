<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Plus } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import { homeTopicsApi, type AdminHomeTopicItem, type AdminHomeTopicsResponse, type HomeTopicStatus } from "@/apis/home-topics";
import { adminAppConfig } from "@/apis/config";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";

const loading = ref(true);
const statusBusyId = ref<number | null>(null);
const topics = ref<AdminHomeTopicItem[]>([]);
const router = useRouter();
const apiOrigin = resolveApiOrigin();
const hasTopics = computed(() => topics.value.length > 0);

useAdminHeaderRefresh(() => {
  void loadPage();
});

function resolveApiOrigin() {
  try {
    return new URL(adminAppConfig.apiBaseUrl).origin;
  } catch {
    return window.location.origin;
  }
}

function sortTopics(items: AdminHomeTopicItem[]) {
  const order = {
    LISTED: 0,
    UNLISTED: 1
  } satisfies Record<HomeTopicStatus, number>;

  return [...items].sort((left, right) => {
    const statusDiff = order[left.status] - order[right.status];
    if (statusDiff !== 0) return statusDiff;

    const publishedDiff = new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
    if (publishedDiff !== 0) return publishedDiff;
    return right.id - left.id;
  });
}

function assignResponse(result: AdminHomeTopicsResponse) {
  topics.value = sortTopics(result.topics);
}

function patchTopic(item: AdminHomeTopicItem) {
  const nextTopics = topics.value.filter(entry => entry.id !== item.id);
  nextTopics.push(item);
  topics.value = sortTopics(nextTopics);
}

function getTopicCover(item: { coverImageUrl: string | null; version: number }) {
  const raw = item.coverImageUrl?.trim() || "";
  if (!raw) return "";
  const baseUrl = raw.startsWith("/") ? new URL(raw, apiOrigin).toString() : raw;
  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}t=${item.version}`;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function recTypeText(value: AdminHomeTopicItem["recType"]) {
  if (value === "WEEKEND_GATHERING") return "周末聚餐";
  if (value === "QUICK_AFTER_WORK") return "下班快做";
  if (value === "HOME_STYLE") return "家常下饭";
  if (value === "ONE_PERSON") return "一人食";
  if (value === "BREAKFAST") return "早餐灵感";
  return "轻松一餐";
}

function topicStatusText(status: HomeTopicStatus) {
  return status === "LISTED" ? "已上架" : "未上架";
}

function topicActionText(status: HomeTopicStatus) {
  return status === "LISTED" ? "下架" : "上架";
}

async function loadPage() {
  loading.value = true;
  try {
    const result = await homeTopicsApi.getTopics();
    assignResponse(result);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载本周灵感失败");
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  void router.push("/operations/weekly-topic/editor");
}

function openEdit(topicId: number) {
  void router.push({
    path: "/operations/weekly-topic/editor",
    query: { topicId: String(topicId) }
  });
}

async function toggleTopicStatus(item: AdminHomeTopicItem) {
  const nextStatus: HomeTopicStatus = item.status === "LISTED" ? "UNLISTED" : "LISTED";
  if (nextStatus === "UNLISTED") {
    try {
      await ElMessageBox.confirm(`下架后，前台“本周灵感”与往期列表都不会再显示《${item.title}》。`, "确认下架", {
        type: "warning",
        confirmButtonText: "下架",
        cancelButtonText: "取消"
      });
    } catch {
      return;
    }
  }

  statusBusyId.value = item.id;
  try {
    const result = await homeTopicsApi.setTopicStatus(
      item.id,
      {
        status: nextStatus,
        expectedVersion: item.version
      },
      createOperationId()
    );
    patchTopic(result);
    ElMessage.success(result.status === "LISTED" ? "专题已上架" : "专题已下架");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "切换专题状态失败");
  } finally {
    statusBusyId.value = null;
  }
}

onMounted(() => {
  void loadPage();
});
</script>

<template>
  <section class="page-stack">
    <section v-loading="loading" class="section-panel">
      <div class="section-panel__header">
        <div>
          <h3>本周灵感</h3>
          <p class="section-panel__hint">专题列表和创建/编辑页已经拆开。这里先看列表，再进入独立编辑页。</p>
        </div>
        <el-button type="primary" :icon="Plus" @click="openCreate">新建专题</el-button>
      </div>

      <section v-if="hasTopics" class="surface-panel topic-list">
        <article v-for="item in topics" :key="item.id" class="topic-row">
          <img v-if="getTopicCover(item)" :src="getTopicCover(item)" alt="专题封面" class="topic-row__cover" />
          <div v-else class="topic-row__cover topic-row__cover--empty">本周灵感</div>

          <div class="topic-row__main">
            <div class="topic-row__head">
              <h4>{{ item.title }}</h4>
              <span class="topic-row__status" :class="{ 'topic-row__status--listed': item.status === 'LISTED' }">
                {{ topicStatusText(item.status) }}
              </span>
            </div>
            <p v-if="item.subTitle" class="topic-row__sub">{{ item.subTitle }}</p>
            <p class="topic-row__meta">
              第 {{ item.issueNo }} 期 · {{ recTypeText(item.recType) }} · {{ item.items.length }} 道菜 · 更新于 {{ formatTime(item.updatedAt) }}
            </p>
          </div>

          <div class="topic-row__actions">
            <el-button plain @click="openEdit(item.id)">编辑</el-button>
            <el-button :loading="statusBusyId === item.id" @click="toggleTopicStatus(item)">
              {{ topicActionText(item.status) }}
            </el-button>
          </div>
        </article>
      </section>

      <section v-else class="surface-panel topic-empty">
        <h4>还没有专题</h4>
        <p>先新建一篇，再决定什么时候上架到前台。</p>
        <el-button type="primary" :icon="Plus" @click="openCreate">去新建</el-button>
      </section>
    </section>
  </section>
</template>

<style scoped lang="scss">
.section-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.section-panel__header h3 {
  margin: 0 0 6px;
  color: #111827;
}

.section-panel__hint {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.6;
}

.surface-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border: 1px solid #eef2f7;
  border-radius: 24px;
  background: linear-gradient(180deg, #ffffff, #fbfdff);
}

.topic-list {
  gap: 14px;
}

.topic-row {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  padding: 14px;
  border: 1px solid #e8edf2;
  border-radius: 20px;
  background: #fff;
}

.topic-row__cover {
  width: 132px;
  height: 96px;
  border-radius: 16px;
  object-fit: cover;
  background: #f3f4f6;
}

.topic-row__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #48614f;
  font-size: 16px;
  font-weight: 700;
}

.topic-row__main {
  min-width: 0;
}

.topic-row__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.topic-row__head h4 {
  margin: 0;
  color: #111827;
  font-size: 18px;
}

.topic-row__status {
  padding: 5px 10px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 12px;
  font-weight: 600;
}

.topic-row__status--listed {
  background: rgba(47, 111, 78, 0.14);
  color: #2f6f4e;
}

.topic-row__sub,
.topic-row__meta {
  margin: 0;
  color: #6b7280;
  line-height: 1.6;
}

.topic-row__sub {
  margin-bottom: 4px;
  color: #476252;
  font-size: 14px;
  font-weight: 600;
}

.topic-row__meta {
  font-size: 12px;
}

.topic-row__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topic-empty {
  align-items: flex-start;
}

.topic-empty h4 {
  margin: 0;
  color: #111827;
}

.topic-empty p {
  margin: 0;
  color: #6b7280;
}

@media (max-width: 960px) {
  .section-panel__header,
  .topic-row {
    grid-template-columns: minmax(0, 1fr);
    display: grid;
  }

  .topic-row__cover {
    width: 100%;
    height: 180px;
  }

  .topic-row__actions {
    justify-content: flex-start;
  }
}
</style>
