<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Delete, Picture } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import { adminAppConfig } from "@/apis/config";
import { tableTopicsApi, type AdminTableTopicItem, type AdminTableTopicsResponse, type CreateTableTopicRequest, type TableTopicStatus, type TableTopicTargetType } from "@/apis/table-topics";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";

type TopicForm = {
  title: string;
  summary: string;
  activityAt: string;
  targetType: TableTopicTargetType;
  targetValue: string;
  version: number;
  status: TableTopicStatus;
};

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const saving = ref(false);
const statusSaving = ref(false);
const imageSaving = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const topics = ref<AdminTableTopicItem[]>([]);
const topicId = ref<number | null>(null);
const form = ref<TopicForm>(emptyForm());
const coverImageUrl = ref("");
const apiOrigin = resolveApiOrigin();
const isEditing = computed(() => topicId.value !== null);
const currentTopic = computed(() => topics.value.find(item => item.id === topicId.value) ?? null);

useAdminHeaderRefresh(() => {
  void loadPage();
});

function emptyForm(): TopicForm {
  return {
    title: "",
    summary: "",
    activityAt: "",
    targetType: "PAGE",
    targetValue: "",
    version: 1,
    status: "UNLISTED"
  };
}

function resolveApiOrigin() {
  try {
    return new URL(adminAppConfig.apiBaseUrl).origin;
  } catch {
    return window.location.origin;
  }
}

function normalizeDateInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = `${date.getFullYear()}`;
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function toIsoDateTime(value: string) {
  return new Date(value).toISOString();
}

function getPreviewUrl(item: { coverImageUrl: string | null; version: number }) {
  const raw = item.coverImageUrl?.trim() || "";
  if (!raw) return "";
  const baseUrl = raw.startsWith("/") ? new URL(raw, apiOrigin).toString() : raw;
  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}t=${item.version}`;
}

function mapForm(item: AdminTableTopicItem): TopicForm {
  return {
    title: item.title,
    summary: item.summary,
    activityAt: normalizeDateInput(item.activityAt),
    targetType: item.targetType,
    targetValue: item.targetValue || "",
    version: item.version,
    status: item.status
  };
}

function assignResponse(result: AdminTableTopicsResponse) {
  topics.value = result.topics;
  if (!topicId.value) return;
  const current = result.topics.find(item => item.id === topicId.value);
  if (!current) {
    topicId.value = null;
    form.value = emptyForm();
    coverImageUrl.value = "";
    return;
  }
  form.value = mapForm(current);
  coverImageUrl.value = getPreviewUrl(current);
}

function patchTopic(item: AdminTableTopicItem) {
  const nextTopics = topics.value.filter(entry => entry.id !== item.id);
  nextTopics.push(item);
  topics.value = nextTopics;
  if (topicId.value === item.id) {
    form.value = mapForm(item);
    coverImageUrl.value = getPreviewUrl(item);
  }
}

async function loadPage() {
  loading.value = true;
  try {
    topicId.value = typeof route.query.topicId === "string" ? Number(route.query.topicId) || null : null;
    const result = await tableTopicsApi.getTopics();
    assignResponse(result);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载餐桌话题失败");
  } finally {
    loading.value = false;
  }
}

function validateForm() {
  const title = form.value.title.trim();
  const summary = form.value.summary.trim();
  const targetValue = form.value.targetValue.trim();

  if (!title) {
    throw new Error("标题不能为空");
  }
  if (!summary) {
    throw new Error("简介不能为空");
  }
  if (!form.value.activityAt) {
    throw new Error("活动时间不能为空");
  }
  if (form.value.targetType === "WEB_VIEW" && !/^https:\/\//iu.test(targetValue)) {
    throw new Error("H5 详情地址必须以 https:// 开头");
  }
  if (form.value.targetType === "PAGE" && targetValue && !targetValue.startsWith("/")) {
    throw new Error("站内页面必须以 / 开头");
  }
}

function saveBody(): CreateTableTopicRequest {
  validateForm();
  return {
    title: form.value.title.trim(),
    summary: form.value.summary.trim(),
    activityAt: toIsoDateTime(form.value.activityAt),
    targetType: form.value.targetType,
    targetValue: form.value.targetValue.trim() || null
  };
}

async function saveTopic() {
  if (saving.value) return;
  saving.value = true;
  try {
    const body = saveBody();
    if (topicId.value) {
      const result = await tableTopicsApi.updateTopic(
        topicId.value,
        {
          ...body,
          expectedVersion: form.value.version
        },
        createOperationId()
      );
      assignResponse(result);
      ElMessage.success("餐桌话题已保存");
      return;
    }

    const result = await tableTopicsApi.createTopic(body, createOperationId());
    assignResponse(result);
    const created = [...result.topics].sort((left, right) => right.id - left.id)[0];
    if (created) {
      topicId.value = created.id;
      form.value = mapForm(created);
      coverImageUrl.value = getPreviewUrl(created);
      void router.replace({
        path: "/operations/table-topic/editor",
        query: { topicId: String(created.id) }
      });
    }
    ElMessage.success("餐桌话题已创建");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存餐桌话题失败");
  } finally {
    saving.value = false;
  }
}

async function toggleStatus() {
  if (!topicId.value || statusSaving.value) return;
  const current = currentTopic.value;
  if (!current) return;
  const nextStatus: TableTopicStatus = current.status === "LISTED" ? "UNLISTED" : "LISTED";
  if (nextStatus === "UNLISTED") {
    try {
      await ElMessageBox.confirm(`下架后，前台餐桌话题列表不会再显示《${current.title}》。`, "确认下架", {
        type: "warning",
        confirmButtonText: "下架",
        cancelButtonText: "取消"
      });
    } catch {
      return;
    }
  }

  statusSaving.value = true;
  try {
    const result = await tableTopicsApi.setTopicStatus(
      current.id,
      {
        status: nextStatus,
        expectedVersion: current.version
      },
      createOperationId()
    );
    patchTopic(result);
    ElMessage.success(result.status === "LISTED" ? "话题已上架" : "话题已下架");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "切换话题状态失败");
  } finally {
    statusSaving.value = false;
  }
}

function chooseImage() {
  if (!topicId.value || imageSaving.value) return;
  fileInput.value?.click();
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  const current = currentTopic.value;
  if (!file || !current) return;

  imageSaving.value = true;
  try {
    const result = await tableTopicsApi.uploadTopicImage(current.id, file, createOperationId(), current.version);
    patchTopic(result);
    ElMessage.success("封面已更新");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "上传封面失败");
  } finally {
    imageSaving.value = false;
  }
}

async function clearImage() {
  const current = currentTopic.value;
  if (!current || imageSaving.value || !current.coverImageUrl) return;
  try {
    await ElMessageBox.confirm(`清空后，《${current.title}》将不再显示封面。`, "确认清空", {
      type: "warning",
      confirmButtonText: "清空",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }

  imageSaving.value = true;
  try {
    const result = await tableTopicsApi.clearTopicImage(current.id, createOperationId(), current.version);
    patchTopic(result);
    ElMessage.success("封面已清空");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "清空封面失败");
  } finally {
    imageSaving.value = false;
  }
}

function backToList() {
  void router.push("/operations/table-topic");
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
          <h3>{{ isEditing ? "编辑餐桌话题" : "新建餐桌话题" }}</h3>
          <p class="section-panel__hint">列表页只展示封面、标题、时间和参与数；参与按钮固定放在小程序详情页。</p>
        </div>
        <div class="section-panel__actions">
          <el-button plain @click="backToList">返回列表</el-button>
          <el-button v-if="isEditing" :loading="statusSaving" @click="toggleStatus">
            {{ form.status === "LISTED" ? "下架" : "上架" }}
          </el-button>
          <el-button type="primary" :loading="saving" @click="saveTopic">保存</el-button>
        </div>
      </div>

      <section class="editor-grid">
        <section class="surface-panel">
          <div class="form-grid">
            <label class="field">
              <span class="field__label">标题</span>
              <el-input v-model="form.title" maxlength="30" placeholder="比如：夏日晚饭吃什么" />
            </label>

            <label class="field">
              <span class="field__label">活动时间</span>
              <input v-model="form.activityAt" class="field__native" type="datetime-local" />
            </label>

            <label class="field field--full">
              <span class="field__label">简介</span>
              <el-input v-model="form.summary" type="textarea" :rows="4" maxlength="240" show-word-limit placeholder="详情页顶部简介和列表文案都从这里收。" />
            </label>

            <section class="field field--full">
              <span class="field__label">详情承接</span>
              <el-radio-group v-model="form.targetType">
                <el-radio-button label="PAGE">站内页</el-radio-button>
                <el-radio-button label="WEB_VIEW">H5</el-radio-button>
              </el-radio-group>
              <el-input
                v-model="form.targetValue"
                class="field__target"
                maxlength="512"
                :placeholder="form.targetType === 'WEB_VIEW' ? 'https://example.com/topic' : '/pages_web/content/index?url=...'"
              />
              <p class="field__hint">
                为空时只使用小程序原生详情页；填写后，详情页会额外给出“查看活动详情”入口。
              </p>
            </section>
          </div>
        </section>

        <section class="surface-panel surface-panel--aside">
          <div class="cover-head">
            <div>
              <h4>封面</h4>
              <p>列表卡和详情页头图共用同一张封面。</p>
            </div>
            <div class="cover-actions">
              <el-button :icon="Picture" :disabled="!isEditing" :loading="imageSaving" @click="chooseImage">上传封面</el-button>
              <el-button :icon="Delete" :disabled="!currentTopic?.coverImageUrl" :loading="imageSaving" @click="clearImage">清空</el-button>
            </div>
          </div>
          <input ref="fileInput" class="hidden-input" type="file" accept="image/png,image/jpeg,image/webp" @change="handleFileChange" />

          <div v-if="coverImageUrl" class="cover-preview">
            <img :src="coverImageUrl" alt="话题封面预览" />
          </div>
          <div v-else class="cover-empty">保存并上传后，这里会显示封面预览。</div>

          <div v-if="isEditing && currentTopic" class="topic-meta">
            <span>ID {{ currentTopic.id }}</span>
            <span>{{ currentTopic.participantCount }} 人参与</span>
            <span>{{ form.status === "LISTED" ? "已上架" : "未上架" }}</span>
          </div>
        </section>
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

.section-panel__actions {
  display: flex;
  gap: 10px;
}

.editor-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.9fr);
  gap: 20px;
}

.surface-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px;
  border: 1px solid #eef2f7;
  border-radius: 24px;
  background: linear-gradient(180deg, #ffffff, #fbfdff);
}

.surface-panel--aside {
  gap: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field--full {
  grid-column: 1 / -1;
}

.field__label {
  color: #111827;
  font-size: 14px;
  font-weight: 600;
}

.field__target {
  margin-top: 10px;
}

.field__hint {
  margin: 0;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.6;
}

.field__native {
  width: 100%;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid #dcdfe6;
  border-radius: 12px;
  color: #111827;
  font: inherit;
}

.cover-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.cover-head h4 {
  margin: 0 0 6px;
  color: #111827;
}

.cover-head p {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.6;
}

.cover-actions {
  display: flex;
  gap: 10px;
}

.hidden-input {
  display: none;
}

.cover-preview {
  border-radius: 20px;
  overflow: hidden;
  background: #f3f4f6;
}

.cover-preview img {
  display: block;
  width: 100%;
  height: 240px;
  object-fit: cover;
}

.cover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  border: 1px dashed #d7dee7;
  border-radius: 20px;
  background: #f9fbfd;
  color: #6b7280;
  text-align: center;
}

.topic-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: #6b7280;
  font-size: 13px;
}
</style>
