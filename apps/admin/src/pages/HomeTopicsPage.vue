<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Delete, Plus } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import { homeTopicsApi, type AdminHomeTopicItem, type AdminHomeTopicsResponse, type HomeTopicStatus, type HomeTopicTodosResponse, type HomeTopicRecipeItem } from "@/apis/home-topics";
import { adminAppConfig } from "@/apis/config";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { formatDateTime } from "@/utils/date";
import { createOperationId } from "@/utils/operation-id";

const loading = ref(true);
const statusBusyId = ref<number | null>(null);
const deleteBusyId = ref<number | null>(null);
const topics = ref<AdminHomeTopicItem[]>([]);
const todos = ref<HomeTopicTodosResponse["items"]>([]);
const todoTotal = ref(0);
const todoCandidates = ref<HomeTopicRecipeItem[]>([]);
const todoSearch = ref("");
const todoTarget = ref<HomeTopicTodosResponse["items"][number] | null>(null);
const todoBusyId = ref<number | null>(null);
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
    DRAFT: 0,
    PUBLISHED: 1,
    UNLISTED: 2
  } satisfies Record<HomeTopicStatus, number>;

  return [...items].sort((left, right) => {
    const statusDiff = order[left.status] - order[right.status];
    if (statusDiff !== 0) return statusDiff;

    const periodDiff = right.periodStartDate.localeCompare(left.periodStartDate);
    if (periodDiff !== 0) return periodDiff;
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

function topicStatusText(status: HomeTopicStatus) {
  return status === "DRAFT" ? "草稿" : status === "PUBLISHED" ? "已发布" : "已下架";
}

function topicActionText(status: HomeTopicStatus) {
  return status === "DRAFT" ? "发布" : status === "PUBLISHED" ? "下架" : "转为草稿";
}

async function loadPage() {
  loading.value = true;
  try {
    const [result, todoResult] = await Promise.all([homeTopicsApi.getTopics(), homeTopicsApi.getTodos()]);
    assignResponse(result);
    todos.value = todoResult.items;
    todoTotal.value = todoResult.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载本周灵感失败");
  } finally {
    loading.value = false;
  }
}

async function searchTodoReplacement(todo: HomeTopicTodosResponse["items"][number]) {
  todoTarget.value = todo;
  try {
    const result = await homeTopicsApi.searchRecipes(todoSearch.value.trim() || undefined);
    todoCandidates.value = result.items;
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : "搜索替代菜失败"); }
}

async function replaceTodo(todo: HomeTopicTodosResponse["items"][number], recipe: HomeTopicRecipeItem) {
  todoBusyId.value = todo.itemId;
  try {
    await homeTopicsApi.replaceItem(todo.itemId, recipe.id, todo.topicVersion, createOperationId());
    todos.value = todos.value.filter(item => item.itemId !== todo.itemId);
    todoTarget.value = null;
    ElMessage.success("已替换失效菜谱");
    await loadPage();
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : "替换失败"); }
  finally { todoBusyId.value = null; }
}

async function dismissTodo(todo: HomeTopicTodosResponse["items"][number]) {
  try {
    await ElMessageBox.confirm(`忽略后会保存处置记录，《${todo.topicTitle}》${todo.weekday}的失效菜将不再出现在待办中。`, "忽略待办", { type: "warning" });
  } catch { return; }
  todoBusyId.value = todo.itemId;
  try {
    const updatedTopic = await homeTopicsApi.dismissTodo(todo.itemId, todo.topicVersion, createOperationId());
    patchTopic(updatedTopic);
    todos.value = todos.value.filter(item => item.itemId !== todo.itemId);
    todoTotal.value = Math.max(0, todoTotal.value - 1);
    ElMessage.success("已忽略并记录");
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : "忽略失败"); }
  finally { todoBusyId.value = null; }
}

function weekdayLabel(value: string) {
  return ({ MONDAY: "周一", TUESDAY: "周二", WEDNESDAY: "周三", THURSDAY: "周四", FRIDAY: "周五", SATURDAY: "周六", SUNDAY: "周日" } as Record<string, string>)[value] ?? value;
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
  const nextStatus: HomeTopicStatus = item.status === "DRAFT" ? "PUBLISHED" : item.status === "PUBLISHED" ? "UNLISTED" : "DRAFT";
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
    ElMessage.success(topicStatusText(result.status));
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "切换专题状态失败");
  } finally {
    statusBusyId.value = null;
  }
}

async function deleteTopic(item: AdminHomeTopicItem) {
  if (item.status !== "DRAFT") {
    ElMessage.warning("只有草稿周刊可以删除，请先转为草稿");
    return;
  }

  try {
    await ElMessageBox.confirm(`删除后，《${item.title}》及本期推荐配置会被移除，前台不再可访问。`, "确认删除", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
      confirmButtonClass: "el-button--danger"
    });
  } catch {
    return;
  }

  deleteBusyId.value = item.id;
  try {
    const result = await homeTopicsApi.deleteTopic(
      item.id,
      {
        expectedVersion: item.version
      },
      createOperationId()
    );
    assignResponse(result);
    ElMessage.success("专题已删除");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "删除专题失败");
  } finally {
    deleteBusyId.value = null;
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

      <section class="surface-panel todo-panel">
        <div class="todo-panel__head"><div><h4>失效菜谱待办</h4><p>忽略后会保留操作者与菜谱项记录。</p></div><strong>{{ todoTotal }}</strong></div>
        <div v-if="todos.length" class="todo-list">
          <article v-for="todo in todos" :key="todo.itemId" class="todo-row">
            <div><strong>{{ todo.topicTitle }} · {{ weekdayLabel(todo.weekday) }}</strong><p>第 {{ todo.issueNo }} 期 · {{ todo.periodStartDate }} · {{ todo.recipeName }}</p></div>
            <div class="todo-row__actions">
              <el-button size="small" @click="openEdit(todo.topicId)">查看周刊</el-button>
              <el-button size="small" type="primary" @click="searchTodoReplacement(todo)">替换菜谱</el-button>
              <el-button size="small" :loading="todoBusyId === todo.itemId" @click="dismissTodo(todo)">忽略并记录</el-button>
            </div>
          </article>
        </div>
        <el-empty v-else description="暂无待处理的失效菜谱" :image-size="56" />
      </section>

      <el-dialog :model-value="Boolean(todoTarget)" title="选择替代菜谱" width="620px" @close="todoTarget = null" @closed="todoCandidates = []">
        <p v-if="todoTarget" class="todo-dialog__summary">{{ todoTarget.topicTitle }} · {{ todoTarget.weekday }} · {{ todoTarget.recipeName }}</p>
        <div class="todo-dialog__search"><el-input v-model="todoSearch" placeholder="菜名、食材或菜谱 ID" @keyup.enter="todoTarget && searchTodoReplacement(todoTarget)" /><el-button @click="todoTarget && searchTodoReplacement(todoTarget)">搜索</el-button></div>
        <div class="todo-candidates">
          <article v-for="recipe in todoCandidates" :key="recipe.id" class="todo-candidate">
            <span>{{ recipe.title }}</span>
            <el-button size="small" type="primary" :loading="todoTarget ? todoBusyId === todoTarget.itemId : false" @click="todoTarget && replaceTodo(todoTarget, recipe)">替换</el-button>
          </article>
          <el-empty v-if="!todoCandidates.length" description="搜索可公开菜谱后选择替代项" :image-size="48" />
        </div>
      </el-dialog>

      <section v-if="hasTopics" class="surface-panel topic-list">
        <article v-for="item in topics" :key="item.id" class="topic-row">
          <img v-if="getTopicCover(item)" :src="getTopicCover(item)" alt="专题封面" class="topic-row__cover" />
          <div v-else class="topic-row__cover topic-row__cover--empty">本周灵感</div>

          <div class="topic-row__main">
            <div class="topic-row__head">
              <h4>{{ item.title }}</h4>
              <span class="topic-row__status" :class="{ 'topic-row__status--listed': item.status === 'PUBLISHED' }">
                {{ topicStatusText(item.status) }}
              </span>
            </div>
            <p v-if="item.subTitle" class="topic-row__sub">{{ item.subTitle }}</p>
            <p class="topic-row__meta">
              第 {{ item.issueNo }} 期 · {{ item.recTypeText }} · {{ item.periodStartDate }} ～ {{ item.periodEndDate }} · {{ item.items.length }} 道可公开菜
              <span v-if="item.scheduledPublishAt"> · 预约 {{ formatDateTime(item.scheduledPublishAt) }}</span>
              <span v-else-if="item.publishedAt"> · 发布于 {{ formatDateTime(item.publishedAt) }}</span>
            </p>
          </div>

          <div class="topic-row__actions">
            <el-button plain @click="openEdit(item.id)">编辑</el-button>
            <el-button :loading="statusBusyId === item.id" @click="toggleTopicStatus(item)">
              {{ topicActionText(item.status) }}
            </el-button>
            <el-button
              plain
              type="danger"
              :icon="Delete"
              :loading="deleteBusyId === item.id"
              :disabled="item.status !== 'DRAFT'"
              @click="deleteTopic(item)"
            >
              删除
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
  width: 96px;
  height: 128px;
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
