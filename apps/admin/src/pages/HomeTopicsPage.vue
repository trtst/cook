<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Delete, Plus, Upload } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import { homeTopicsApi, type AdminHomeTopicItem, type AdminHomeTopicsResponse, type HomeTopicStatus, type HomeTopicBatchImportInput, type HomeTopicBatchPreviewResponse, type HomeTopicBatchImportResponse } from "@/apis/home-topics";
import { adminAppConfig } from "@/apis/config";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { formatDateTime } from "@/utils/date";
import { createOperationId } from "@/utils/operation-id";

const loading = ref(true);
const statusBusyId = ref<number | null>(null);
const scheduleBusyId = ref<number | null>(null);
const scheduleDialogOpen = ref(false);
const scheduleInput = ref("");
const scheduleTarget = ref<AdminHomeTopicItem | null>(null);
const deleteBusyId = ref<number | null>(null);
const topics = ref<AdminHomeTopicItem[]>([]);
const importDialogOpen = ref(false);
const importJson = ref("");
const previewSource = ref("");
const importBusy = ref(false);
const importBatch = ref<HomeTopicBatchImportInput | null>(null);
const importPreview = ref<HomeTopicBatchPreviewResponse | null>(null);
const importResult = ref<HomeTopicBatchImportResponse | null>(null);
const router = useRouter();
const apiOrigin = resolveApiOrigin();
const hasTopics = computed(() => topics.value.length > 0);
const importableCount = computed(() => previewSource.value === importJson.value ? importPreview.value?.issues.filter(item => item.valid).length ?? 0 : 0);

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

function toShanghaiDateInput(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(value));
  const field = (name: string) => parts.find(part => part.type === name)?.value ?? "";
  return `${field("year")}-${field("month")}-${field("day")} ${field("hour")}:${field("minute")}:${field("second")}`;
}

function openSchedule(item: AdminHomeTopicItem) {
  scheduleTarget.value = item;
  scheduleInput.value = toShanghaiDateInput(item.scheduledPublishAt ?? defaultScheduleInstant(item.periodStartDate));
  scheduleDialogOpen.value = true;
}

function defaultScheduleInstant(periodStartDate: string) {
  const date = new Date(`${periodStartDate}T00:00:00.000Z`);
  if (date.getUTCDay() === 1) date.setUTCDate(date.getUTCDate() - 1);
  const dateText = date.toISOString().slice(0, 10);
  return new Date(`${dateText}T00:00:00+08:00`).toISOString();
}

async function saveSchedule() {
  const item = scheduleTarget.value;
  if (!item || !scheduleInput.value || new Date(`${scheduleInput.value.replace(" ", "T")}+08:00`).getTime() <= Date.now()) {
    ElMessage.warning("请选择晚于当前时间的发布时间");
    return;
  }
  scheduleBusyId.value = item.id;
  try {
    const result = await homeTopicsApi.setTopicSchedule(item.id, {
      scheduledPublishAt: new Date(`${scheduleInput.value.replace(" ", "T")}+08:00`).toISOString(),
      expectedVersion: item.version
    }, createOperationId());
    patchTopic(result);
    scheduleDialogOpen.value = false;
    ElMessage.success("已预约定时发布");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "预约定时发布失败");
  } finally {
    scheduleBusyId.value = null;
  }
}

async function cancelSchedule(item: AdminHomeTopicItem) {
  try {
    await ElMessageBox.confirm(`取消“${item.title}”的定时发布？`, "取消预约", {
      confirmButtonText: "确认取消",
      cancelButtonText: "返回",
      type: "warning"
    });
  } catch {
    return;
  }
  scheduleBusyId.value = item.id;
  try {
    const result = await homeTopicsApi.setTopicSchedule(item.id, {
      scheduledPublishAt: null,
      expectedVersion: item.version
    }, createOperationId());
    patchTopic(result);
    ElMessage.success("已取消定时发布");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "取消预约失败");
  } finally {
    scheduleBusyId.value = null;
  }
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

function openBatchImport() {
  importJson.value = "";
  previewSource.value = "";
  importBatch.value = null;
  importPreview.value = null;
  importResult.value = null;
  importDialogOpen.value = true;
}

async function previewBatchImport() {
  const source = importJson.value;
  importResult.value = null;
  importBatch.value = null;
  importPreview.value = null;
  try {
    const parsed = JSON.parse(source) as HomeTopicBatchImportInput;
    const result = await homeTopicsApi.previewBatchImport(parsed);
    importBatch.value = parsed;
    importPreview.value = result;
    previewSource.value = source;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "JSON 格式或周刊数据不正确");
  }
}

async function commitBatchImport() {
  const batch = importBatch.value;
  if (!batch || !importPreview.value || previewSource.value !== importJson.value || importableCount.value < 1 || importBusy.value) return;
  importBusy.value = true;
  try {
    const result = await homeTopicsApi.importBatch(batch, createOperationId());
    importResult.value = result;
    const imported = result.issues.filter(item => item.status === "IMPORTED").length;
    ElMessage.success(`已导入 ${imported} 期草稿`);
    await loadPage();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "导入周刊失败");
  } finally {
    importBusy.value = false;
  }
}

function batchIssue(issueIndex: number) {
  return importBatch.value?.issues[issueIndex - 1] ?? null;
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
        <div class="section-panel__actions">
          <el-button :icon="Upload" @click="openBatchImport">导入 JSON</el-button>
          <el-button type="primary" :icon="Plus" @click="openCreate">新建专题</el-button>
        </div>
      </div>

      <el-dialog v-model="importDialogOpen" title="导入共享周刊 JSON" width="820px" destroy-on-close>
        <p class="import-help">粘贴 Codex 生成的 schemaVersion 2 JSON。预览会检查统计快照、日期、每日菜单、菜谱当前公开状态和固定版本；导入仅创建草稿，不会预约或上架。</p>
        <el-input v-model="importJson" type="textarea" :rows="14" placeholder="粘贴完整 JSON 批次" spellcheck="false" />
        <div class="import-actions">
          <el-button :disabled="!importJson.trim() || importBusy" @click="previewBatchImport">校验并预览</el-button>
          <span v-if="importPreview">可导入 {{ importableCount }} / {{ importPreview.issues.length }} 期</span>
        </div>
        <el-table v-if="importPreview" :data="importPreview.issues" size="small" class="import-preview-table">
          <el-table-column type="expand">
            <template #default="scope">
              <div v-if="batchIssue(scope.row.issueIndex)" class="import-issue-detail">
                <p><strong>主题理由：</strong>{{ batchIssue(scope.row.issueIndex)?.themeRationale }}</p>
                <p><strong>计划发布时间：</strong>{{ formatDateTime(scope.row.plannedPublishAt) }}（上海时间）</p>
                <div v-for="day in batchIssue(scope.row.issueIndex)?.days" :key="day.weekday" class="import-day-detail">
                  <strong>{{ weekdayLabel(day.weekday) }}</strong>
                  <span v-for="item in day.items" :key="`${item.recipeId}-${item.sortOrder}`">菜谱 {{ item.recipeId }}：{{ item.recommendNote || "无推荐理由" }}</span>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="issueIndex" label="#" width="55" />
          <el-table-column prop="title" label="标题" min-width="150" />
          <el-table-column prop="themeRationale" label="主题理由" min-width="220" show-overflow-tooltip />
          <el-table-column label="周期" min-width="180">
            <template #default="scope">{{ scope.row.periodStartDate }} ～ {{ scope.row.periodEndDate }}</template>
          </el-table-column>
          <el-table-column label="菜数" prop="recipeCount" width="70" />
          <el-table-column label="校验" width="90">
            <template #default="scope"><el-tag :type="scope.row.valid ? 'success' : 'danger'">{{ scope.row.valid ? "可导入" : "有问题" }}</el-tag></template>
          </el-table-column>
          <el-table-column label="问题" min-width="240">
            <template #default="scope">{{ scope.row.errors.join("；") || "—" }}</template>
          </el-table-column>
        </el-table>
        <el-alert v-if="importResult" class="import-result" type="info" :closable="false" title="导入结果">
          <p v-for="item in importResult.issues" :key="item.issueIndex">第 {{ item.issueIndex }} 期：{{ item.status === "IMPORTED" ? `已创建草稿（${item.topic?.periodStartDate}，ID ${item.topic?.id}）` : item.errors.join("；") }}</p>
        </el-alert>
        <template #footer>
          <el-button @click="importDialogOpen = false">关闭</el-button>
          <el-button type="primary" :disabled="importableCount < 1" :loading="importBusy" @click="commitBatchImport">导入 {{ importableCount }} 期为草稿</el-button>
        </template>
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
              第 {{ item.issueNo }} 期 · {{ item.periodStartDate }} ～ {{ item.periodEndDate }} · {{ item.items.length }} 道可公开菜
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
              v-if="item.status === 'DRAFT' && !item.scheduledPublishAt"
              type="primary"
              plain
              :loading="scheduleBusyId === item.id"
              @click="openSchedule(item)"
            >定时发布</el-button>
            <el-button
              v-if="item.status === 'DRAFT' && item.scheduledPublishAt"
              type="warning"
              plain
              :loading="scheduleBusyId === item.id"
              @click="cancelSchedule(item)"
            >取消预约</el-button>
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

      <el-dialog v-model="scheduleDialogOpen" title="定时发布" width="420px">
        <p class="schedule-help">专题将在所选北京时间自动发布。</p>
        <el-date-picker
          v-model="scheduleInput"
          :disabled="scheduleBusyId !== null"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="选择发布时间"
          style="width: 100%"
        />
        <template #footer>
          <el-button :disabled="scheduleBusyId !== null" @click="scheduleDialogOpen = false">取消</el-button>
          <el-button type="primary" :loading="scheduleBusyId !== null" @click="saveSchedule">确认预约</el-button>
        </template>
      </el-dialog>
    </section>
  </section>
</template>

<style scoped lang="scss">
.section-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
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

.import-help {
  margin: 0 0 12px;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.6;
}

.import-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  color: #6b7280;
  font-size: 13px;
}

.import-preview-table {
  margin-top: 14px;
}

.import-issue-detail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 12px 12px;
  color: #4b5563;
  font-size: 13px;
  line-height: 1.6;
}

.import-issue-detail p {
  margin: 0;
}

.import-day-detail {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 8px;
}

.import-day-detail span {
  color: #6b7280;
}

.import-result {
  margin-top: 14px;
}

.import-result p {
  margin: 4px 0;
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
  aspect-ratio: 4 / 3;
  height: auto;
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
    height: auto;
  }

  .topic-row__actions {
    justify-content: flex-start;
  }
}
</style>
