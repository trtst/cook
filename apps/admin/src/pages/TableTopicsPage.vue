<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Plus } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import { tableTopicsApi, type AdminTableTopicItem, type AdminTableTopicsResponse, type TableTopicStatus } from "@/apis/table-topics";
import { adminAppConfig } from "@/apis/config";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { formatDateTimeMinute } from "@/utils/date";
import { createOperationId } from "@/utils/operation-id";

const loading = ref(true);
const statusBusyId = ref<number | null>(null);
const topics = ref<AdminTableTopicItem[]>([]);
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

function sortTopics(items: AdminTableTopicItem[]) {
  const order = {
    LISTED: 0,
    UNLISTED: 1
  } satisfies Record<TableTopicStatus, number>;

  return [...items].sort((left, right) => {
    const statusDiff = order[left.status] - order[right.status];
    if (statusDiff !== 0) return statusDiff;

    const timeDiff = new Date(right.activityAt).getTime() - new Date(left.activityAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return right.id - left.id;
  });
}

function assignResponse(result: AdminTableTopicsResponse) {
  topics.value = sortTopics(result.topics);
}

function patchTopic(item: AdminTableTopicItem) {
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

function topicStatusText(status: TableTopicStatus) {
  return status === "LISTED" ? "已上架" : "未上架";
}

function topicActionText(status: TableTopicStatus) {
  return status === "LISTED" ? "下架" : "上架";
}

async function loadPage() {
  loading.value = true;
  try {
    const result = await tableTopicsApi.getTopics();
    assignResponse(result);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载餐桌话题失败");
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  void router.push("/operations/table-topic/editor");
}

function openEdit(topicId: number) {
  void router.push({
    path: "/operations/table-topic/editor",
    query: { topicId: String(topicId) }
  });
}

async function toggleTopicStatus(item: AdminTableTopicItem) {
  const nextStatus: TableTopicStatus = item.status === "LISTED" ? "UNLISTED" : "LISTED";
  if (nextStatus === "UNLISTED") {
    try {
      await ElMessageBox.confirm(`下架后，前台餐桌话题列表不会再显示《${item.title}》。`, "确认下架", {
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
    const result = await tableTopicsApi.setTopicStatus(
      item.id,
      {
        status: nextStatus,
        expectedVersion: item.version
      },
      createOperationId()
    );
    patchTopic(result);
    ElMessage.success(result.status === "LISTED" ? "话题已上架" : "话题已下架");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "切换话题状态失败");
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
          <h3>餐桌话题</h3>
          <p class="section-panel__hint">前台按活动时间倒序展示历次话题，参与数来自用户真实点击参与。</p>
        </div>
        <el-button type="primary" :icon="Plus" @click="openCreate">新建话题</el-button>
      </div>

      <section v-if="hasTopics" class="surface-panel topic-list">
        <article v-for="item in topics" :key="item.id" class="topic-row">
          <img v-if="getTopicCover(item)" :src="getTopicCover(item)" alt="话题封面" class="topic-row__cover" />
          <div v-else class="topic-row__cover topic-row__cover--empty">餐桌话题</div>

          <div class="topic-row__main">
            <div class="topic-row__head">
              <h4>{{ item.title }}</h4>
              <span class="topic-row__status" :class="{ 'topic-row__status--listed': item.status === 'LISTED' }">
                {{ topicStatusText(item.status) }}
              </span>
            </div>
            <p class="topic-row__summary">{{ item.summary }}</p>
            <p class="topic-row__meta">
              {{ formatDateTimeMinute(item.activityAt) }} · {{ item.participantCount }} 人参与 · {{ item.targetType === "WEB_VIEW" ? "H5 详情" : "站内详情" }}
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
        <h4>还没有话题</h4>
        <p>先新建一条，再决定什么时候上架到前台列表。</p>
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
  grid-template-columns: 156px minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  padding: 14px;
  border: 1px solid #e8edf2;
  border-radius: 20px;
  background: #fff;
}

.topic-row__cover {
  width: 156px;
  height: 108px;
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
  margin-bottom: 8px;
}

.topic-row__head h4 {
  margin: 0;
  color: #111827;
  font-size: 18px;
}

.topic-row__status {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: #eef2f7;
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
}

.topic-row__status--listed {
  background: #e4f4ea;
  color: #1f7a45;
}

.topic-row__summary {
  margin: 0 0 10px;
  color: #374151;
  line-height: 1.6;
}

.topic-row__meta {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}

.topic-row__actions {
  display: flex;
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
</style>
