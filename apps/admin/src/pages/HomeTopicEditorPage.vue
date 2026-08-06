<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, ArrowRight, Delete, Picture, Search } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  homeTopicsApi,
  type AdminHomeTopicItem,
  type AdminHomeTopicsResponse,
  type CreateHomeTopicRequest,
  type HomeTopicRecipeItem,
  type HomeTopicStatus,
  type HomeTopicType,
  type HomeTopicTypeOption
} from "@/apis/home-topics";
import { adminAppConfig } from "@/apis/config";
import RecipePreviewDrawer from "@/components/RecipePreviewDrawer.vue";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";

type TopicForm = {
  id: number | null;
  version: number;
  title: string;
  subTitle: string;
  recType: HomeTopicType;
  status: HomeTopicStatus;
  issueNo: number;
  description: string;
  coverImageUrl: string;
  items: HomeTopicRecipeItem[];
};

const loading = ref(true);
const saveBusy = ref(false);
const imageBusy = ref(false);
const searchBusy = ref(false);
const searchReady = ref(false);
const statusBusy = ref(false);
const previewVisible = ref(false);
const previewRecipeId = ref<number | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const searchKey = ref("");
const topics = ref<AdminHomeTopicItem[]>([]);
const recTypes = ref<HomeTopicTypeOption[]>([]);
const searchItems = ref<HomeTopicRecipeItem[]>([]);
const form = ref<TopicForm | null>(null);
const route = useRoute();
const router = useRouter();
const apiOrigin = resolveApiOrigin();

const canSave = computed(() => Boolean(form.value) && !saveBusy.value && !imageBusy.value);
const isCreateMode = computed(() => !form.value?.id);
const editorIssueText = computed(() => (form.value ? `第 ${form.value.issueNo} 期` : ""));
const editorRecTypeLabel = computed(() => {
  const current = form.value;
  if (!current) return "";
  return recTypes.value.find(item => item.value === current.recType)?.label || current.recType;
});

useAdminHeaderRefresh(() => {
  void loadPage();
});

watch(
  () => route.query.topicId,
  () => {
    if (topics.value.length) {
      syncFormFromRoute();
    }
  }
);

function resolveApiOrigin() {
  try {
    return new URL(adminAppConfig.apiBaseUrl).origin;
  } catch {
    return window.location.origin;
  }
}

function parseTopicId(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  const topicId = Number(raw);
  return Number.isInteger(topicId) && topicId > 0 ? topicId : null;
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

function toForm(item: AdminHomeTopicItem): TopicForm {
  return {
    id: item.id,
    version: item.version,
    title: item.title,
    subTitle: item.subTitle || "",
    recType: item.recType,
    status: item.status,
    issueNo: item.issueNo,
    description: item.description,
    coverImageUrl: item.coverImageUrl || "",
    items: item.items.map(recipe => ({ ...recipe }))
  };
}

function createForm(): TopicForm {
  return {
    id: null,
    version: 1,
    title: "",
    subTitle: "",
    recType: recTypes.value[0]?.value ?? "WEEKEND_GATHERING",
    status: "UNLISTED",
    issueNo: nextIssueNo(),
    description: "",
    coverImageUrl: "",
    items: []
  };
}

function nextIssueNo() {
  return topics.value.reduce((max, item) => Math.max(max, item.issueNo), 0) + 1;
}

function findTopic(topicId: number) {
  return topics.value.find(item => item.id === topicId) ?? null;
}

function syncFormFromRoute() {
  const topicId = parseTopicId(route.query.topicId);
  if (!topicId) {
    form.value = createForm();
    searchReady.value = false;
    searchItems.value = [];
    closeRecipePreview();
    return;
  }

  const current = findTopic(topicId);
  if (!current) {
    ElMessage.warning("专题不存在，已返回列表");
    backToList();
    return;
  }

  form.value = toForm(current);
  searchReady.value = false;
  searchItems.value = [];
  closeRecipePreview();
}

function assignResponse(result: AdminHomeTopicsResponse) {
  topics.value = sortTopics(result.topics);
  recTypes.value = result.recTypes;
  syncFormFromRoute();
}

function patchTopic(item: AdminHomeTopicItem) {
  const nextTopics = topics.value.filter(entry => entry.id !== item.id);
  nextTopics.push(item);
  topics.value = sortTopics(nextTopics);
}

function getCoverUrl(item: { coverImageUrl: string; version: number }) {
  const raw = item.coverImageUrl.trim();
  if (!raw) return "";
  const baseUrl = raw.startsWith("/") ? new URL(raw, apiOrigin).toString() : raw;
  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}t=${item.version}`;
}

function formatDuration(value: HomeTopicRecipeItem["duration"]) {
  if (value === "WITHIN_15") return "15 分钟内";
  if (value === "BETWEEN_15_30") return "15~30 分钟";
  if (value === "BETWEEN_30_60") return "30~60 分钟";
  if (value === "OVER_60") return "1 小时以上";
  return "时长待补";
}

function formatDifficulty(value: HomeTopicRecipeItem["difficulty"]) {
  if (value === "BEGINNER") return "新手友好";
  if (value === "EASY") return "轻松上手";
  if (value === "SKILLED") return "需要经验";
  if (value === "CHALLENGING") return "进阶挑战";
  return "难度待补";
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

function backToList() {
  void router.push("/operations/weekly-topic");
}

function validateForm() {
  const current = form.value;
  if (!current) throw new Error("专题数据未就绪");
  if (!current.title.trim()) throw new Error("专题标题不能为空");
  if (current.title.trim().length > 20) throw new Error("专题标题最多 20 个字");
  if (current.subTitle.trim().length > 40) throw new Error("专题副标题最多 40 个字");
  if (!current.description.trim()) throw new Error("专题描述不能为空");
  if (current.description.trim().length > 120) throw new Error("专题描述最多 120 个字");
  if (current.issueNo < 1) throw new Error("期数至少从 1 开始");
  if (current.items.length < 3) throw new Error("本期推荐至少选择 3 道菜");
}

function saveBody(): CreateHomeTopicRequest {
  const current = form.value as TopicForm;
  return {
    title: current.title.trim(),
    subTitle: current.subTitle.trim() || null,
    recType: current.recType,
    issueNo: current.issueNo,
    description: current.description.trim(),
    recipeIds: current.items.map(item => item.id)
  };
}

async function saveTopic() {
  try {
    validateForm();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "表单校验失败");
    return;
  }

  const current = form.value as TopicForm;
  const body = saveBody();
  saveBusy.value = true;
  try {
    const result =
      current.id === null
        ? await homeTopicsApi.createTopic(body, createOperationId())
        : await homeTopicsApi.updateTopic(current.id, { ...body, expectedVersion: current.version }, createOperationId());

    topics.value = sortTopics(result.topics);
    const nextId =
      current.id ??
      result.topics.find(item => item.issueNo === body.issueNo && item.title === body.title)?.id ??
      null;

    if (nextId) {
      const nextTopic = findTopic(nextId);
      if (nextTopic) {
        form.value = toForm(nextTopic);
      }
      if (current.id === null) {
        await router.replace({
          path: "/operations/weekly-topic/editor",
          query: { topicId: String(nextId) }
        });
      }
    }

    ElMessage.success(current.id === null ? "专题已创建，默认先保持未上架" : "专题已保存");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存本周灵感失败");
  } finally {
    saveBusy.value = false;
  }
}

async function toggleTopicStatus() {
  const current = form.value;
  if (!current?.id) return;

  const nextStatus: HomeTopicStatus = current.status === "LISTED" ? "UNLISTED" : "LISTED";
  if (nextStatus === "UNLISTED") {
    try {
      await ElMessageBox.confirm(`下架后，前台“本周灵感”与往期列表都不会再显示《${current.title || `第 ${current.issueNo} 期`}》。`, "确认下架", {
        type: "warning",
        confirmButtonText: "下架",
        cancelButtonText: "取消"
      });
    } catch {
      return;
    }
  }

  statusBusy.value = true;
  try {
    const result = await homeTopicsApi.setTopicStatus(
      current.id,
      {
        status: nextStatus,
        expectedVersion: current.version
      },
      createOperationId()
    );
    patchTopic(result);
    current.status = result.status;
    current.version = result.version;
    ElMessage.success(result.status === "LISTED" ? "专题已上架" : "专题已下架");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "切换专题状态失败");
  } finally {
    statusBusy.value = false;
  }
}

async function searchRecipes() {
  searchBusy.value = true;
  try {
    const result = await homeTopicsApi.searchRecipes(searchKey.value.trim() || undefined);
    searchItems.value = result.items;
    searchReady.value = true;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "搜索菜谱失败");
  } finally {
    searchBusy.value = false;
  }
}

function openRecipePreview(recipeId: number) {
  previewRecipeId.value = recipeId;
  previewVisible.value = true;
}

function closeRecipePreview() {
  previewVisible.value = false;
  previewRecipeId.value = null;
}

function clearSearch() {
  searchKey.value = "";
  searchReady.value = false;
  searchItems.value = [];
}

function addRecipe(item: HomeTopicRecipeItem) {
  const current = form.value;
  if (!current) return;
  if (current.items.some(entry => entry.id === item.id)) {
    ElMessage.warning("这道菜已经在本期推荐里了");
    return;
  }
  current.items.push({
    ...item,
    sort: current.items.length + 1
  });
}

function syncSort(items: HomeTopicRecipeItem[]) {
  items.forEach((item, index) => {
    item.sort = index + 1;
  });
}

function removeRecipe(recipeId: number) {
  const current = form.value;
  if (!current) return;
  current.items = current.items.filter(item => item.id !== recipeId);
  syncSort(current.items);
}

function moveRecipe(index: number, offset: number) {
  const current = form.value;
  if (!current) return;
  const nextIndex = index + offset;
  if (nextIndex < 0 || nextIndex >= current.items.length) return;
  const items = [...current.items];
  const [item] = items.splice(index, 1);
  items.splice(nextIndex, 0, item);
  syncSort(items);
  current.items = items;
}

function openImagePicker() {
  if (imageBusy.value) return;
  if (!form.value?.id) {
    ElMessage.warning("请先保存专题，再上传封面图");
    return;
  }
  fileInput.value?.click();
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || !form.value?.id) return;

  imageBusy.value = true;
  try {
    const result = await homeTopicsApi.uploadTopicImage(form.value.id, file, createOperationId(), form.value.version);
    patchTopic(result);
    form.value.coverImageUrl = result.coverImageUrl || "";
    form.value.version = result.version;
    form.value.status = result.status;
    ElMessage.success("专题封面已更新");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "上传封面失败");
  } finally {
    imageBusy.value = false;
  }
}

async function clearImage() {
  if (!form.value?.id) return;
  try {
    await ElMessageBox.confirm("清空后，专题头图会回退到默认背景。", "确认清空", {
      type: "warning",
      confirmButtonText: "清空",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }

  imageBusy.value = true;
  try {
    const result = await homeTopicsApi.clearTopicImage(form.value.id, createOperationId(), form.value.version);
    patchTopic(result);
    form.value.coverImageUrl = result.coverImageUrl || "";
    form.value.version = result.version;
    form.value.status = result.status;
    ElMessage.success("专题封面已清空");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "清空封面失败");
  } finally {
    imageBusy.value = false;
  }
}

onMounted(() => {
  void loadPage();
});
</script>

<template>
  <section class="page-stack">
    <input ref="fileInput" class="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" @change="handleFileChange" />

    <section v-loading="loading" class="section-panel">
      <div class="section-panel__header">
        <div>
          <h3>{{ isCreateMode ? "新建专题" : "编辑专题" }}</h3>
          <p class="section-panel__hint">
            {{ isCreateMode ? "创建页和列表页已经拆开。新专题默认未上架，保存后再决定是否上架。" : "当前是独立编辑页。列表、上架状态和编辑内容分开管理。" }}
          </p>
        </div>
        <div class="header-actions">
          <el-button @click="backToList">返回列表</el-button>
          <el-button v-if="form?.id" :loading="statusBusy" @click="toggleTopicStatus">
            {{ topicActionText(form.status) }}
          </el-button>
          <el-button type="primary" :loading="saveBusy" :disabled="!canSave" @click="saveTopic">保存专题</el-button>
        </div>
      </div>

      <section v-if="form" class="surface-panel editor-main">
        <div class="topic-hero" :style="{ backgroundImage: getCoverUrl(form) ? `url(${getCoverUrl(form)})` : '' }">
          <div class="topic-hero__mask" />
          <div class="topic-hero__body">
            <button class="topic-cover" type="button" @click="openImagePicker">
              <img v-if="getCoverUrl(form)" :src="getCoverUrl(form)" alt="专题封面" class="topic-cover__image" />
              <span v-else class="topic-cover__empty">
                <el-icon size="24"><Picture /></el-icon>
                <span>{{ imageBusy ? "上传中..." : "上传封面" }}</span>
              </span>
            </button>

            <div class="topic-hero__main">
              <div class="topic-hero__meta">
                <span class="topic-hero__chip">{{ editorIssueText }}</span>
                <span class="topic-hero__chip topic-hero__chip--plain">{{ editorRecTypeLabel }}</span>
                <span class="topic-hero__chip" :class="{ 'topic-hero__chip--listed': form.status === 'LISTED' }">
                  {{ topicStatusText(form.status) }}
                </span>
              </div>
              <h4>{{ form.title || "未填写专题标题" }}</h4>
              <p>{{ form.description || "这里展示专题寄语和本期推荐方向。" }}</p>
              <div class="topic-hero__actions">
                <span v-if="form.id" class="topic-hero__version">版本 {{ form.version }}</span>
                <el-button v-if="form.coverImageUrl.trim()" text :icon="Delete" :disabled="imageBusy" @click="clearImage">删除封面</el-button>
              </div>
            </div>
          </div>
        </div>

        <div class="topic-editor__stack">
          <el-form label-position="top" class="topic-form">
            <div class="topic-form__row topic-form__row--half">
              <el-form-item label="专题标题">
                <el-input v-model="form.title" maxlength="20" show-word-limit />
              </el-form-item>
              <el-form-item label="专题副标题">
                <el-input v-model="form.subTitle" maxlength="40" show-word-limit />
              </el-form-item>
            </div>

            <div class="topic-form__row topic-form__row--half">
              <el-form-item label="推荐类别">
                <el-select v-model="form.recType">
                  <el-option v-for="item in recTypes" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>
              </el-form-item>
              <el-form-item label="期数">
                <el-input-number v-model="form.issueNo" :min="1" :step="1" controls-position="right" />
              </el-form-item>
            </div>

            <el-form-item label="专题寄语">
              <el-input v-model="form.description" type="textarea" :rows="4" maxlength="120" show-word-limit />
            </el-form-item>
          </el-form>

          <section class="recipe-panel">
            <div class="recipe-search">
              <div class="recipe-search__head">
                <div>
                  <h6>添加菜谱</h6>
                  <p>支持按菜名、食材、风格或菜谱 ID 搜索。没有搜索前，不展示候选列表。</p>
                </div>
              </div>

              <div class="recipe-search__row">
                <el-input
                  v-model="searchKey"
                  clearable
                  placeholder="输入菜名、食材、风格或菜谱 ID"
                  @clear="clearSearch"
                  @keyup.enter="searchRecipes"
                />
                <el-button :icon="Search" :loading="searchBusy" @click="searchRecipes">搜索</el-button>
              </div>

              <div v-if="searchReady" class="search-list">
                <article v-for="item in searchItems" :key="item.id" class="search-card search-card--clickable" @click="openRecipePreview(item.id)">
                  <img v-if="item.coverImageUrl" :src="item.coverImageUrl" alt="" class="search-card__cover" />
                  <div v-else class="search-card__cover search-card__cover--empty">封面</div>
                  <div class="search-card__main">
                    <span class="search-card__title">{{ item.title }}</span>
                    <p>ID {{ item.id }} · {{ item.category.name }}</p>
                    <p>{{ formatDifficulty(item.difficulty) }} · {{ formatDuration(item.duration) }}</p>
                  </div>
                  <el-button
                    plain
                    size="small"
                    :disabled="form.items.some(entry => entry.id === item.id)"
                    @click.stop="addRecipe(item)"
                  >
                    加入
                  </el-button>
                </article>

                <div v-if="!searchBusy && !searchItems.length" class="search-list__empty">还没有匹配的灵感菜谱，换个关键词试试。</div>
              </div>
            </div>

            <div class="recipe-panel__header">
              <div>
                <h6>本期推荐</h6>
                <p>每行展示 5 道已选菜谱。当前顺序就是前台展示顺序，后续可继续扩成拖拽排序。</p>
              </div>
              <span>{{ form.items.length }} 道</span>
            </div>

            <div v-if="form.items.length" class="picked-strip">
              <article
                v-for="(item, index) in form.items"
                :key="item.id"
                class="picked-tile picked-tile--clickable"
                @click="openRecipePreview(item.id)"
              >
                <div class="picked-tile__media">
                  <img v-if="item.coverImageUrl" :src="item.coverImageUrl" alt="" class="picked-tile__cover" />
                  <div v-else class="picked-tile__cover picked-tile__cover--empty">封面</div>
                  <span class="picked-tile__order">0{{ item.sort }}</span>
                  <el-button circle class="picked-tile__delete" :icon="Delete" @click.stop="removeRecipe(item.id)" />
                </div>
                <div class="picked-tile__body">
                  <span class="picked-tile__title">{{ item.title }}</span>
                  <div class="picked-tile__sort">
                    <el-button circle size="small" :icon="ArrowLeft" :disabled="index === 0" @click.stop="moveRecipe(index, -1)" />
                    <el-button
                      circle
                      size="small"
                      :icon="ArrowRight"
                      :disabled="index === form.items.length - 1"
                      @click.stop="moveRecipe(index, 1)"
                    />
                  </div>
                </div>
              </article>
            </div>

            <div v-else class="picked-empty">先从上方搜索结果里挑菜放进本期推荐。</div>
          </section>
        </div>
      </section>
    </section>

    <RecipePreviewDrawer :visible="previewVisible" :recipe-id="previewRecipeId" @close="closeRecipePreview" />
  </section>
</template>

<style scoped lang="scss">
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

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

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.surface-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px;
  border: 1px solid #eef2f7;
  border-radius: 24px;
  background: linear-gradient(180deg, #ffffff, #fbfdff);
}

.editor-main {
  gap: 20px;
}

.topic-hero {
  position: relative;
  overflow: hidden;
  border-radius: 22px;
  background: linear-gradient(135deg, #f4ead7 0%, #f7faf6 56%, #edf6ff 100%);
  background-size: cover;
  background-position: center;
}

.topic-hero__mask {
  position: absolute;
  inset: 0;
  background: rgba(255, 252, 246, 0.82);
  backdrop-filter: blur(18px);
}

.topic-hero__body {
  position: relative;
  display: grid;
  grid-template-columns: 168px minmax(0, 1fr);
  gap: 20px;
  padding: 22px;
}

.topic-cover {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 224px;
  border: 1px dashed rgba(47, 111, 78, 0.28);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
  overflow: hidden;
}

.topic-cover__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.topic-cover__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #6b7280;
}

.topic-hero__main {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.topic-hero__meta,
.topic-hero__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.topic-hero__chip {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(47, 111, 78, 0.12);
  color: #2f6f4e;
  font-size: 12px;
  font-weight: 600;
}

.topic-hero__chip--plain {
  background: rgba(255, 255, 255, 0.72);
  color: #374151;
}

.topic-hero__chip--listed {
  background: rgba(47, 111, 78, 0.18);
}

.topic-hero h4 {
  margin: 0;
  color: #111827;
  font-size: 28px;
  line-height: 1.2;
}

.topic-hero p {
  margin: 0;
  color: #4b5563;
  line-height: 1.7;
}

.topic-hero__version {
  color: #6b7280;
  font-size: 13px;
}

.topic-editor__stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.topic-form,
.recipe-panel {
  padding: 20px;
  border: 1px solid #eef2f7;
  border-radius: 18px;
  background: #fff;
}

.topic-form__row {
  display: grid;
  gap: 16px;
}

.topic-form__row--half {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.recipe-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.recipe-panel__header,
.recipe-search__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.recipe-panel__header h6,
.recipe-search__head h6 {
  margin: 0;
  color: #111827;
  font-size: 15px;
}

.recipe-panel__header p,
.recipe-search__head p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.6;
}

.picked-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.picked-tile {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff, #fbfdfc);
}

.picked-tile--clickable,
.search-card--clickable {
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.picked-tile--clickable:hover,
.search-card--clickable:hover {
  border-color: #cddfd4;
  box-shadow: 0 10px 22px rgba(47, 111, 78, 0.08);
  transform: translateY(-1px);
}

.picked-tile__media {
  position: relative;
}

.picked-tile__cover {
  display: block;
  width: 100%;
  height: 164px;
  border-radius: 14px;
  object-fit: cover;
  background: #f3f4f6;
}

.picked-tile__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 13px;
}

.picked-tile__order {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.72);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.picked-tile__delete {
  position: absolute;
  top: 8px;
  right: 8px;
  border: none;
  box-shadow: 0 6px 20px rgba(17, 24, 39, 0.14);
}

.picked-tile__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.picked-tile__title {
  color: #111827;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
}

.picked-tile__sort {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.picked-empty,
.search-list__empty {
  padding: 14px 16px;
  border-radius: 16px;
  background: #f9fafb;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.6;
}

.recipe-search {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.recipe-search__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
}

.search-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-card {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
}

.search-card__cover {
  width: 96px;
  height: 96px;
  border-radius: 14px;
  object-fit: cover;
  background: #f3f4f6;
}

.search-card__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 12px;
}

.search-card__main {
  min-width: 0;
}

.search-card__title {
  display: block;
  margin-bottom: 6px;
  color: #111827;
  font-size: 14px;
  font-weight: 600;
}

.search-card__main p {
  margin: 0;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.7;
}

@media (max-width: 960px) {
  .section-panel__header,
  .topic-hero__body,
  .topic-form__row--half,
  .recipe-search__row,
  .search-card {
    grid-template-columns: minmax(0, 1fr);
  }

  .picked-strip {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .topic-cover {
    min-height: 220px;
  }

  .search-card__cover {
    width: 100%;
    height: 180px;
  }
}

@media (max-width: 720px) {
  .picked-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
