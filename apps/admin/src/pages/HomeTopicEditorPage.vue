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
  type HomeTopicMenuCheckResponse,
  type HomeTopicStatus,
  type HomeTopicWeekday,
  homeTopicWeekdays
} from "@/apis/home-topics";
import { adminAppConfig } from "@/apis/config";
import RecipePreviewDrawer from "@/components/RecipePreviewDrawer.vue";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";
import { difficultyText, durationText } from "@/utils/recipe-meta";
import { formatDateTime } from "@/utils/date";
import { createHomeTopicCover } from "@/utils/home-topic-cover";
type TopicForm = {
  id: number | null;
  version: number;
  title: string;
  subTitle: string;
  status: HomeTopicStatus;
  issueNo: number;
  periodStartDate: string;
  periodEndDate: string;
  scheduledPublishAt: string | null;
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
const selectedWeekday = ref<HomeTopicWeekday>("SUNDAY");
const scheduleInput = ref("");
const scheduleDialogOpen = ref(false);
const previewVisible = ref(false);
const previewRecipeId = ref<number | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const searchKey = ref("");
const topics = ref<AdminHomeTopicItem[]>([]);
const menuCheck = ref<HomeTopicMenuCheckResponse | null>(null);
const menuCheckLoading = ref(false);
const searchItems = ref<HomeTopicRecipeItem[]>([]);
const form = ref<TopicForm | null>(null);
const route = useRoute();
const router = useRouter();
const apiOrigin = resolveApiOrigin();

const canSave = computed(() => Boolean(form.value) && !saveBusy.value && !imageBusy.value);
const isCreateMode = computed(() => !form.value?.id);
const editorIssueText = computed(() => (form.value ? `第 ${form.value.issueNo} 期` : ""));
const groupedItems = computed(() => {
  const current = form.value;
  const startDay = current?.periodStartDate ? new Date(`${current.periodStartDate}T00:00:00.000Z`).getUTCDay() : 0;
  const orderedDays = startDay === 1 ? [...homeTopicWeekdays.slice(1), homeTopicWeekdays[0]!] : homeTopicWeekdays;
  return orderedDays.map(day => ({
    ...day,
    items: (form.value?.items ?? []).filter(item => item.weekday === day.value).sort((left, right) => left.sort - right.sort)
  }));
});
const menuCheckStale = computed(() => Boolean(menuCheck.value && form.value?.id && (menuCheck.value.topicId !== form.value.id || menuCheck.value.topicVersion !== form.value.version)));

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

function toForm(item: AdminHomeTopicItem): TopicForm {
  return {
    id: item.id,
    version: item.version,
    title: item.title,
    subTitle: item.subTitle || "",
    status: item.status,
    issueNo: item.issueNo,
    periodStartDate: item.periodStartDate,
    periodEndDate: item.periodEndDate,
    scheduledPublishAt: item.scheduledPublishAt,
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
    status: "DRAFT",
    issueNo: nextIssueNo(),
    periodStartDate: "",
    periodEndDate: "",
    scheduledPublishAt: null,
    description: "",
    coverImageUrl: "",
    items: []
  };
}

function disablePeriodDate(date: Date) {
  if (date.getDay() === 0) return false;
  if (date.getDay() !== 1 || !form.value?.id) return true;
  const savedPeriod = topics.value.find(item => item.id === form.value?.id)?.periodStartDate;
  return savedPeriod !== `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

function updatePeriodEnd(value: string | null) {
  const current = form.value;
  if (!current) return;
  if (!value) {
    current.periodEndDate = "";
    return;
  }
  const start = new Date(`${value}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() + 6);
  current.periodEndDate = start.toISOString().slice(0, 10);
}

function toDateTimeInput(value: string | null) {
  if (!value) return "";
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

function openScheduleDialog() {
  const nextTime = form.value?.scheduledPublishAt ?? defaultScheduleInstant(form.value?.periodStartDate);
  scheduleInput.value = toDateTimeInput(nextTime);
  scheduleDialogOpen.value = true;
}

function defaultScheduleInstant(periodStartDate?: string) {
  const date = periodStartDate ? new Date(`${periodStartDate}T00:00:00.000Z`) : new Date(Date.now() + 8 * 60 * 60 * 1000);
  if (date.getUTCDay() === 1) date.setUTCDate(date.getUTCDate() - 1);
  else if (!periodStartDate || date.getUTCDay() !== 0) {
    const daysUntilSunday = date.getUTCDay() === 0 ? 7 : 7 - date.getUTCDay();
    date.setUTCDate(date.getUTCDate() + daysUntilSunday);
  }
  const dateText = date.toISOString().slice(0, 10);
  return new Date(`${dateText}T00:00:00+08:00`).toISOString();
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
    menuCheck.value = null;
    scheduleInput.value = "";
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
  void loadMenuCheck(topicId);
  scheduleInput.value = toDateTimeInput(current.scheduledPublishAt);
  searchReady.value = false;
  searchItems.value = [];
  closeRecipePreview();
}

function assignResponse(result: AdminHomeTopicsResponse) {
  topics.value = sortTopics(result.topics);
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

function topicStatusText(status: HomeTopicStatus) {
  return status === "DRAFT" ? "草稿" : status === "PUBLISHED" ? "已发布" : "已下架";
}

function topicActionText(status: HomeTopicStatus) {
  return status === "PUBLISHED" ? "下架" : status === "UNLISTED" ? "转为草稿" : "立即发布";
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

async function loadMenuCheck(topicId: number) {
  menuCheckLoading.value = true;
  try {
    const result = await homeTopicsApi.getMenuCheck(topicId);
    if (form.value?.id === topicId) menuCheck.value = result;
  } catch (error) {
    if (form.value?.id === topicId) ElMessage.error(error instanceof Error ? error.message : "加载周刊检查失败");
  } finally {
    menuCheckLoading.value = false;
  }
}

function formatMenuDimension(dimension: HomeTopicMenuCheckResponse["weekly"]["facets"]["allIngredients"], total = menuCheck.value?.uniqueRecipeCount ?? 0) {
  const values = dimension.values.slice(0, 6).map(item => `${item.value} ${item.count}`).join("、") || "暂无确认数据";
  return `${values}（覆盖 ${dimension.confirmedCount}/${total}）`;
}

function weekdayText(value: HomeTopicWeekday) {
  return homeTopicWeekdays.find(item => item.value === value)?.label ?? value;
}

function menuCheckDaySummary(day: HomeTopicMenuCheckResponse["days"][number]) {
  return `菜品 ${day.recipeCount} 道；角色 ${formatMenuDimension(day.facets.dishRoles, day.uniqueRecipeCount)}；食材 ${formatMenuDimension(day.facets.primaryIngredients, day.uniqueRecipeCount)}；蛋白 ${formatMenuDimension(day.facets.proteins, day.uniqueRecipeCount)}；做法 ${formatMenuDimension(day.facets.dishStyles, day.uniqueRecipeCount)}；难度/时长 ${formatMenuDimension(day.facets.difficulties, day.uniqueRecipeCount)} / ${formatMenuDimension(day.facets.durations, day.uniqueRecipeCount)}`;
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
  const periodWeekday = current.periodStartDate ? new Date(`${current.periodStartDate}T00:00:00.000Z`).getUTCDay() : 0;
  const savedPeriod = current.id ? topics.value.find(item => item.id === current.id)?.periodStartDate : undefined;
  const unchangedLegacyMonday = periodWeekday === 1 && savedPeriod === current.periodStartDate;
  if (current.periodStartDate && periodWeekday !== 0 && !unchangedLegacyMonday) {
    throw new Error("周刊周期必须从周日开始；已有周一开始的周刊可保留原日期");
  }
}

function saveBody(): CreateHomeTopicRequest {
  const current = form.value as TopicForm;
  return {
    title: current.title.trim(),
    subTitle: current.subTitle.trim() || null,
    issueNo: current.issueNo,
    ...(current.periodStartDate ? { periodStartDate: current.periodStartDate } : {}),
    description: current.description.trim(),
    items: current.items.map(item => ({
      recipeId: item.id,
      weekday: item.weekday ?? "SUNDAY",
      sortOrder: item.sort,
      recommendNote: item.recommendNote?.trim() || null
    }))
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

  const nextStatus: HomeTopicStatus = current.status === "DRAFT" ? "PUBLISHED" : current.status === "PUBLISHED" ? "UNLISTED" : "DRAFT";
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
    ElMessage.success(topicStatusText(result.status));
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
    weekday: selectedWeekday.value,
    sort: current.items.filter(entry => entry.weekday === selectedWeekday.value).length + 1,
    recommendNote: item.recommendNote ?? null
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

function moveRecipeToWeekday(recipeId: number, weekday: HomeTopicWeekday) {
  const current = form.value;
  const item = current?.items.find(entry => entry.id === recipeId);
  if (!current || !item || item.publiclyAvailable === false || item.weekday === weekday) return;
  item.weekday = weekday;
  item.sort = current.items.filter(entry => entry.id !== recipeId && entry.weekday === weekday).length + 1;
}

function moveRecipe(weekday: HomeTopicWeekday, index: number, offset: number) {
  const current = form.value;
  if (!current) return;
  const items = current.items.filter(item => item.weekday === weekday).sort((left, right) => left.sort - right.sort);
  const nextIndex = index + offset;
  if (nextIndex < 0 || nextIndex >= items.length) return;
  const [item] = items.splice(index, 1);
  items.splice(nextIndex, 0, item);
  syncSort(items);
  const orders = new Map(items.map((item, order) => [item.id, order + 1]));
  current.items.forEach(item => { if (orders.has(item.id)) item.sort = orders.get(item.id)!; });
}

async function saveSchedule() {
  const current = form.value;
  if (!current?.id) return;
  if (!scheduleInput.value || new Date(`${scheduleInput.value.replace(" ", "T")}+08:00`).getTime() <= Date.now()) {
    ElMessage.warning("请选择晚于当前时间的发布时间");
    return;
  }
  const scheduledPublishAt = new Date(`${scheduleInput.value.replace(" ", "T")}+08:00`).toISOString();
  statusBusy.value = true;
  try {
    const result = await homeTopicsApi.setTopicSchedule(current.id, { scheduledPublishAt, expectedVersion: current.version }, createOperationId());
    patchTopic(result);
    Object.assign(current, toForm(result));
    scheduleInput.value = toDateTimeInput(result.scheduledPublishAt);
    scheduleDialogOpen.value = false;
    ElMessage.success("预约发布已保存");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存预约失败");
  } finally { statusBusy.value = false; }
}

async function cancelSchedule() {
  const current = form.value;
  if (!current?.id || !current.scheduledPublishAt) return;
  statusBusy.value = true;
  try {
    const result = await homeTopicsApi.setTopicSchedule(current.id, { scheduledPublishAt: null, expectedVersion: current.version }, createOperationId());
    patchTopic(result);
    Object.assign(current, toForm(result));
    scheduleInput.value = "";
    ElMessage.success("已取消定时发布");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "取消预约失败");
  } finally { statusBusy.value = false; }
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

async function generateCover() {
  const current = form.value;
  if (!current?.id) {
    ElMessage.warning("请先保存专题，再生成封面图");
    return;
  }
  if (!current.title.trim()) {
    ElMessage.warning("请先填写本期标题");
    return;
  }
  const savedTopic = findTopic(current.id);
  if (savedTopic && current.periodStartDate !== savedTopic.periodStartDate) {
    ElMessage.warning("请先保存周期，再生成封面图");
    return;
  }
  if (!current.periodStartDate || !current.periodEndDate) {
    ElMessage.warning("请先保存本期周刊周期");
    return;
  }

  imageBusy.value = true;
  try {
    const miniCode = await homeTopicsApi.getTopicMiniCode(current.id);
    const file = await createHomeTopicCover({
      title: current.title,
      subTitle: current.subTitle,
      periodStartDate: current.periodStartDate,
      periodEndDate: current.periodEndDate,
      miniCodeDataUrl: miniCode.miniCodeDataUrl
    });
    const result = await homeTopicsApi.uploadTopicImage(current.id, file, createOperationId(), current.version);
    patchTopic(result);
    current.coverImageUrl = result.coverImageUrl || "";
    current.version = result.version;
    current.status = result.status;
    ElMessage.success("周刊封面已生成并更新");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "生成封面失败");
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
            {{ isCreateMode ? "先保存为草稿，再按周日至周六编排菜单并发布或预约发布。" : "按北京时间自然周维护共享菜单；发布前需覆盖七天。" }}
          </p>
        </div>
        <div class="header-actions">
          <el-button @click="backToList">返回列表</el-button>
          <el-button v-if="form?.id" :loading="statusBusy" @click="toggleTopicStatus">
            {{ topicActionText(form.status) }}
          </el-button>
          <el-button v-if="form?.id && form.status === 'DRAFT'" type="primary" plain :loading="statusBusy" @click="openScheduleDialog">定时发布</el-button>
          <el-button v-if="form?.id && form.status === 'DRAFT' && form.scheduledPublishAt" type="warning" plain :loading="statusBusy" @click="cancelSchedule">取消预约</el-button>
          <el-button type="primary" :loading="saveBusy" :disabled="!canSave" @click="saveTopic">保存专题</el-button>
        </div>
      </div>

      <section v-if="form" class="surface-panel editor-main">
        <div class="topic-hero" :style="{ backgroundImage: getCoverUrl(form) ? `url(${getCoverUrl(form)})` : '' }">
          <div class="topic-hero__mask" />
          <div class="topic-hero__body">
            <div class="topic-cover-tools">
              <button class="topic-cover" type="button" aria-label="点击上传或替换周刊封面" :disabled="imageBusy" @click="openImagePicker">
                <img v-if="getCoverUrl(form)" :src="getCoverUrl(form)" alt="专题封面" class="topic-cover__image" />
                <span v-else class="topic-cover__empty">
                  <el-icon size="24"><Picture /></el-icon>
                  <span>{{ imageBusy ? "处理中..." : "点击上传封面（4:3）" }}</span>
                </span>
              </button>
              <el-button
                class="topic-cover-generate"
                type="primary"
                plain
                :loading="imageBusy"
                :disabled="!form.id || !form.title.trim() || !form.periodStartDate || imageBusy"
                @click="generateCover"
              >
                生成封面图
              </el-button>
            </div>

            <div class="topic-hero__main">
              <div class="topic-hero__meta">
                <span class="topic-hero__chip">{{ editorIssueText }}</span>
                <span class="topic-hero__chip" :class="{ 'topic-hero__chip--listed': form.status === 'PUBLISHED' }">
                  {{ topicStatusText(form.status) }}
                </span>
                <span class="topic-hero__chip topic-hero__chip--plain">周期开始日 {{ form.periodStartDate || "默认下周日" }}</span>
              </div>
              <h4>{{ form.title || "未填写专题标题" }}</h4>
              <p>{{ form.description || "这里展示本期主题和编排方向。" }}</p>
              <div class="topic-hero__actions">
                <span v-if="form.id" class="topic-hero__version">版本 {{ form.version }}</span>
                <el-button v-if="form.coverImageUrl.trim()" text :icon="Delete" :disabled="imageBusy" @click="clearImage">删除封面</el-button>
              </div>
            </div>
          </div>
        </div>

        <section v-if="form.id" v-loading="menuCheckLoading" class="menu-check-panel">
          <div class="menu-check-panel__head">
            <div>
              <h5>本期菜单检查</h5>
              <p>按当前保存版本即时复用缓存；只提示结构与数据覆盖，不判定健康达标，也不改变发布条件。</p>
            </div>
            <span v-if="menuCheck" class="menu-check-panel__meta">
              版本 {{ menuCheck.topicVersion }} · 检查于 {{ formatDateTime(menuCheck.generatedAt) }}
            </span>
            <el-button v-if="menuCheckStale || menuCheck?.stale" text :loading="menuCheckLoading" @click="loadMenuCheck(form.id!)">重新读取当前版本检查</el-button>
          </div>
          <el-alert v-if="menuCheckStale || menuCheck?.stale" title="当前检查结果对应旧版本，请重新读取以更新。" type="warning" :closable="false" />
          <el-empty v-else-if="!menuCheck" description="暂无菜单检查结果" :image-size="44" />
          <template v-else>
            <p class="menu-check-panel__summary">整周 {{ menuCheck.totalRecipeCount }} 道 / 去重 {{ menuCheck.uniqueRecipeCount }} 道</p>
            <p v-if="menuCheck.duplicateRecipeIds.length" class="menu-check-panel__warning">数据完整性异常：重复菜谱 ID {{ menuCheck.duplicateRecipeIds.join("、") }}</p>
            <p v-for="warning in menuCheck.warnings" :key="`${warning.ingredientId}-${warning.fromWeekday}`" class="menu-check-panel__warning">
              连续主要食材提示：{{ weekdayText(warning.fromWeekday) }}、{{ weekdayText(warning.toWeekday) }} 均有 {{ warning.ingredientName }} 主角菜。
            </p>
            <div class="menu-check-panel__weekly">
              <p><strong>整周角色</strong>{{ formatMenuDimension(menuCheck.weekly.facets.dishRoles) }}</p>
              <p><strong>主要食材</strong>{{ formatMenuDimension(menuCheck.weekly.facets.primaryIngredients) }}</p>
              <p><strong>核心食材</strong>{{ formatMenuDimension(menuCheck.weekly.facets.allIngredients) }}</p>
              <p><strong>蛋白</strong>{{ formatMenuDimension(menuCheck.weekly.facets.proteins) }}</p>
              <p><strong>做法</strong>{{ formatMenuDimension(menuCheck.weekly.facets.dishStyles) }}</p>
              <p><strong>难度</strong>{{ formatMenuDimension(menuCheck.weekly.facets.difficulties) }}</p>
              <p><strong>时长</strong>{{ formatMenuDimension(menuCheck.weekly.facets.durations) }}</p>
            </div>
            <ul class="menu-check-panel__days">
              <li v-for="day in menuCheck.days" :key="day.weekday">
                <strong>{{ weekdayText(day.weekday) }} · {{ day.recipeCount }} 道</strong>
                <span>{{ menuCheckDaySummary(day) }}</span>
              </li>
            </ul>
          </template>
        </section>

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

            <el-form-item label="期数">
              <el-input-number v-model="form.issueNo" :min="1" :step="1" controls-position="right" />
            </el-form-item>

            <el-form-item label="周刊周期">
              <el-date-picker
                v-model="form.periodStartDate"
                type="date"
                value-format="YYYY-MM-DD"
                format="YYYY-MM-DD"
                placeholder="选择周期周日（旧周刊可保留周一）"
                :disabled-date="disablePeriodDate"
                @change="updatePeriodEnd"
              />
              <p class="topic-form__hint">新周刊从周日开始，覆盖到周六；旧周一开始的周刊可保留原日期。预约时间只控制发布时间。更改周期后如封面含日期请重新生成。</p>
            </el-form-item>

            <el-form-item label="专题寄语">
              <el-input v-model="form.description" type="textarea" :rows="4" maxlength="120" show-word-limit />
            </el-form-item>
          </el-form>

          <section class="recipe-panel">
            <div class="recipe-search">
              <div class="recipe-search__head">
                <div>
                  <h6>添加菜谱</h6>
                  <p>先选择归属日期，再从搜索结果中加入菜单；同一天内可调整顺序。</p>
                </div>
              </div>

              <div class="weekday-pick">
                <span>加入到</span>
                <el-select v-model="selectedWeekday" style="width: 130px">
                  <el-option v-for="day in homeTopicWeekdays" :key="day.value" :label="day.label" :value="day.value" />
                </el-select>
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
                    <p>{{ item.difficultyText || difficultyText(item.difficulty, "难度待补") }} · {{ item.durationText || durationText(item.duration, "时长待补") }}</p>
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
                <p>每天菜品数量可不同；发布或预约前七天都需至少一道可公开菜谱。</p>
              </div>
              <span>{{ form.items.length }} 道</span>
            </div>

            <div v-if="form.items.length" class="picked-days">
              <section v-for="day in groupedItems" :key="day.value" class="picked-day">
                <h6>{{ day.label }} <span>{{ day.items.length }} 道</span></h6>
                <div v-if="day.items.length" class="picked-strip">
                  <article v-for="(item, index) in day.items" :key="item.id" class="picked-tile picked-tile--clickable" @click="openRecipePreview(item.id)">
                    <div class="picked-tile__media">
                      <img v-if="item.coverImageUrl" :src="item.coverImageUrl" alt="" class="picked-tile__cover" />
                      <div v-else class="picked-tile__cover picked-tile__cover--empty">封面</div>
                      <span class="picked-tile__order">0{{ item.sort }}</span>
                      <el-button circle class="picked-tile__delete" :icon="Delete" :disabled="item.publiclyAvailable === false" @click.stop="removeRecipe(item.id)" />
                    </div>
                    <div class="picked-tile__body">
                      <span class="picked-tile__title">{{ item.title }} <small v-if="item.publiclyAvailable === false" class="unavailable-label">待替换或忽略</small></span>
                      <el-select :model-value="item.weekday" size="small" :disabled="item.publiclyAvailable === false" @change="moveRecipeToWeekday(item.id, $event)">
                        <el-option v-for="option in homeTopicWeekdays" :key="option.value" :label="option.label" :value="option.value" />
                      </el-select>
                      <el-input v-model="item.recommendNote" type="textarea" :rows="3" maxlength="60" resize="none" placeholder="推荐说明（选填）" :disabled="item.publiclyAvailable === false" @click.stop />
                      <div class="picked-tile__sort">
                        <el-button circle size="small" :icon="ArrowLeft" :disabled="item.publiclyAvailable === false || index === 0" @click.stop="moveRecipe(day.value, index, -1)" />
                        <el-button circle size="small" :icon="ArrowRight" :disabled="item.publiclyAvailable === false || index === day.items.length - 1" @click.stop="moveRecipe(day.value, index, 1)" />
                      </div>
                    </div>
                  </article>
                </div>
                <p v-else class="picked-day__empty">当天菜单暂为空</p>
              </section>
            </div>

            <div v-else class="picked-empty">先从上方搜索结果里挑菜放进本期推荐。</div>
          </section>
        </div>
      </section>
    </section>

    <el-dialog v-model="scheduleDialogOpen" title="定时发布" width="420px">
      <p class="schedule-help">专题将在所选北京时间自动发布。</p>
      <el-date-picker
        v-model="scheduleInput"
        :disabled="statusBusy"
        type="datetime"
        value-format="YYYY-MM-DD HH:mm:ss"
        format="YYYY-MM-DD HH:mm:ss"
        placeholder="选择发布时间"
        style="width: 100%"
      />
      <template #footer>
        <el-button :disabled="statusBusy" @click="scheduleDialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="statusBusy" @click="saveSchedule">确认预约</el-button>
      </template>
    </el-dialog>

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

.weekday-pick { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.picked-day h6 span { color: #6b7280; font-size: 12px; }
.picked-days { display: flex; flex-direction: column; gap: 18px; }
.picked-day { padding: 14px; border: 1px solid #edf0f4; border-radius: 16px; }
.picked-day h6 { margin: 0 0 12px; font-size: 15px; }
.picked-day h6 span { margin-left: 8px; font-weight: 400; }
.picked-day__empty { margin: 0; color: #9ca3af; font-size: 13px; }
.unavailable-label { color: #b45309; font-size: 11px; font-weight: 500; }

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
  grid-template-columns: 292px minmax(0, 1fr);
  gap: 20px;
  padding: 22px;
}

.topic-cover-tools {
  display: grid;
  grid-template-columns: 168px minmax(100px, 1fr);
  align-items: center;
  gap: 12px;
}

.topic-cover {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 168px;
  aspect-ratio: 4 / 3;
  height: auto;
  min-height: 0;
  border: 1px dashed rgba(47, 111, 78, 0.28);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
  overflow: hidden;
}

.topic-cover:disabled {
  cursor: wait;
}

.topic-cover-generate {
  min-height: 42px;
  white-space: normal;
  line-height: 1.4;
}

.topic-cover__image {
  position: absolute;
  inset: 0;
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

.menu-check-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px;
  border: 1px solid #e8edf4;
  border-radius: 16px;
  background: #fff;
}

.menu-check-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.menu-check-panel__head h5,
.menu-check-panel__head p,
.menu-check-panel__summary,
.menu-check-panel__warning,
.menu-check-panel__weekly p {
  margin: 0;
}

.menu-check-panel__head h5 {
  color: #111827;
  font-size: 15px;
}

.menu-check-panel__head p,
.menu-check-panel__meta {
  color: #6b7280;
  font-size: 12px;
}

.menu-check-panel__meta {
  flex: 0 0 auto;
}

.menu-check-panel__summary {
  color: #374151;
  font-weight: 600;
}

.menu-check-panel__warning {
  color: #a16207;
  font-size: 13px;
}

.menu-check-panel__weekly {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  color: #4b5563;
  font-size: 12px;
}

.menu-check-panel__weekly strong {
  color: #111827;
  margin-right: 6px;
}

.menu-check-panel__days {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.menu-check-panel__days li {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #6b7280;
  font-size: 12px;
}

.menu-check-panel__days strong {
  color: #374151;
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

.topic-form__hint {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.5;
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
    min-height: 0;
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
