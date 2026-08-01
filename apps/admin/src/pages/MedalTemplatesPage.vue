<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { Plus } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  medalApi,
  type AdminMedalTemplateSummary,
  type MedalAwardRule,
  type MedalCategory,
  type MedalTemplateStatus
} from "@/apis/medal";
import type { UUID } from "@/apis/http";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";

type DialogMode = "create" | "edit";

const awardRuleLabelMap: Record<MedalAwardRule, string> = {
  MEAL_COMPLETION: "完成餐次",
  DINING_EVENT_COMPLETION: "完成饭局",
  GROUP_MEAL_COMPLETION: "多人饭局吃成",
  FULL_LOOP_COMPLETION: "完整闭环",
  RECOMMENDATION_ADOPTED_TOTAL: "推荐收录累计"
};

const categoryLabelMap: Record<MedalCategory, string> = {
  MEAL_CHECKIN: "开饭打卡",
  DINING_COLLABORATION: "饭局协作",
  RECOMMENDATION_CONTRIBUTION: "推荐贡献",
  HOLIDAY_LIMITED: "节假日限定"
};

const statusLabelMap: Record<MedalTemplateStatus, string> = {
  DRAFT: "草稿",
  LISTED: "已上架",
  UNLISTED: "已下架",
  ARCHIVED: "已归档"
};

const statusTagTypeMap: Record<MedalTemplateStatus, "" | "success" | "warning" | "info" | "danger"> = {
  DRAFT: "info",
  LISTED: "success",
  UNLISTED: "warning",
  ARCHIVED: "danger"
};

const awardRuleOptions = Object.entries(awardRuleLabelMap).map(([value, label]) => ({
  value: value as MedalAwardRule,
  label
}));

const categoryOptions = Object.entries(categoryLabelMap).map(([value, label]) => ({
  value: value as MedalCategory,
  label
}));

const statusOptions = Object.entries(statusLabelMap).map(([value, label]) => ({
  value: value as MedalTemplateStatus,
  label
}));

const createStatusOptions = statusOptions.filter(item => item.value !== "ARCHIVED");

const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const dialogMode = ref<DialogMode>("create");
const editingRow = ref<AdminMedalTemplateSummary | null>(null);
const items = ref<AdminMedalTemplateSummary[]>([]);
const total = ref(0);

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: "",
  status: "" as MedalTemplateStatus | "",
  category: "" as MedalCategory | ""
});

const form = reactive({
  code: "",
  awardRule: "MEAL_COMPLETION" as MedalAwardRule,
  category: "MEAL_CHECKIN" as MedalCategory,
  name: "",
  description: "",
  condition: "",
  iconKey: "PLAN",
  status: "DRAFT" as "DRAFT" | "LISTED" | "UNLISTED",
  targetCount: 1,
  sortOrder: 0,
  isLimited: false,
  startAt: null as string | null,
  endAt: null as string | null
});
useAdminHeaderRefresh(() => {
  void loadList();
});

const dialogTitle = computed(() => (dialogMode.value === "create" ? "新增勋章模板" : "编辑勋章模板"));

function resetForm() {
  form.code = "";
  form.awardRule = "MEAL_COMPLETION";
  form.category = "MEAL_CHECKIN";
  form.name = "";
  form.description = "";
  form.condition = "";
  form.iconKey = "PLAN";
  form.status = "DRAFT";
  form.targetCount = 1;
  form.sortOrder = 0;
  form.isLimited = false;
  form.startAt = null;
  form.endAt = null;
  editingRow.value = null;
}

function fillForm(row: AdminMedalTemplateSummary) {
  form.code = row.code;
  form.awardRule = row.awardRule;
  form.category = row.category;
  form.name = row.name;
  form.description = row.description;
  form.condition = row.condition;
  form.iconKey = row.iconKey;
  form.status = row.status === "ARCHIVED" ? "UNLISTED" : row.status;
  form.targetCount = row.targetCount;
  form.sortOrder = row.sortOrder;
  form.isLimited = row.isLimited;
  form.startAt = row.startAt;
  form.endAt = row.endAt;
}

async function loadList() {
  loading.value = true;
  try {
    const result = await medalApi.list({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword.trim() || undefined,
      status: query.status || undefined,
      category: query.category || undefined
    });
    items.value = result.items;
    total.value = result.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载勋章模板失败");
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  query.page = 1;
  void loadList();
}

function openCreate() {
  dialogMode.value = "create";
  resetForm();
  dialogVisible.value = true;
}

function openEdit(row: AdminMedalTemplateSummary) {
  dialogMode.value = "edit";
  editingRow.value = row;
  fillForm(row);
  dialogVisible.value = true;
}

function normalizeForm() {
  const name = form.name.trim();
  const description = form.description.trim();
  const condition = form.condition.trim();
  const iconKey = form.iconKey.trim().toUpperCase();
  const code = form.code.trim().toUpperCase();
  if (!name) throw new Error("请输入勋章名称");
  if (!description) throw new Error("请输入勋章简介");
  if (!condition) throw new Error("请输入获取条件");
  if (!iconKey) throw new Error("请输入图标标识");
  if (dialogMode.value === "create" && !code) throw new Error("请输入勋章编码");
  if (form.targetCount < 1) throw new Error("阈值至少为 1");
  if (form.sortOrder < 0) throw new Error("排序不能小于 0");
  return {
    code,
    awardRule: form.awardRule,
    category: form.category,
    name,
    description,
    condition,
    iconKey,
    status: form.status,
    targetCount: form.targetCount,
    sortOrder: form.sortOrder,
    isLimited: form.isLimited,
    startAt: form.isLimited ? form.startAt : null,
    endAt: form.isLimited ? form.endAt : null
  };
}

async function submitForm() {
  if (saving.value) return;
  let payload: ReturnType<typeof normalizeForm>;
  try {
    payload = normalizeForm();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "表单校验失败");
    return;
  }

  saving.value = true;
  try {
    if (dialogMode.value === "create") {
      await medalApi.create({
        operationId: createOperationId(),
        ...payload
      });
      ElMessage.success("勋章模板已创建");
    } else if (editingRow.value) {
      await medalApi.update(editingRow.value.id, {
        operationId: createOperationId(),
        expectedVersion: editingRow.value.version,
        category: payload.category,
        name: payload.name,
        description: payload.description,
        condition: payload.condition,
        iconKey: payload.iconKey,
        targetCount: payload.targetCount,
        sortOrder: payload.sortOrder,
        isLimited: payload.isLimited,
        startAt: payload.startAt,
        endAt: payload.endAt
      });
      ElMessage.success("勋章模板已更新");
    }
    dialogVisible.value = false;
    await loadList();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存勋章模板失败");
  } finally {
    saving.value = false;
  }
}

async function changeStatus(row: AdminMedalTemplateSummary, status: MedalTemplateStatus) {
  const actionMap: Record<MedalTemplateStatus, string> = {
    DRAFT: "改回草稿",
    LISTED: "上架",
    UNLISTED: "下架",
    ARCHIVED: "归档"
  };
  try {
    await ElMessageBox.confirm(`确认${actionMap[status]}“${row.name}”？`, "勋章模板状态", {
      type: status === "ARCHIVED" ? "warning" : "info",
      confirmButtonText: "确认",
      cancelButtonText: "取消"
    });
    await medalApi.setStatus(row.id, {
      operationId: createOperationId(),
      expectedVersion: row.version,
      status
    });
    ElMessage.success(`已${actionMap[status]}`);
    await loadList();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "更新勋章状态失败");
  }
}

function formatTime(value: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function awardRuleLabel(rule: MedalAwardRule) {
  return awardRuleLabelMap[rule];
}

function statusTagType(status: MedalTemplateStatus) {
  return statusTagTypeMap[status];
}

function statusLabel(status: MedalTemplateStatus) {
  return statusLabelMap[status];
}

onMounted(() => {
  void loadList();
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel page-toolbar">
      <el-input v-model="query.keyword" class="toolbar-search" placeholder="搜索编码 / 名称 / 简介" clearable @keyup.enter="handleSearch" />
      <el-select v-model="query.category" clearable placeholder="类别" style="width: 160px" @change="handleSearch">
        <el-option v-for="item in categoryOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-select v-model="query.status" clearable placeholder="状态" style="width: 140px" @change="handleSearch">
        <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-button type="primary" :icon="Plus" @click="openCreate">新增勋章</el-button>
    </div>

    <div class="work-panel" v-loading="loading">
      <el-table :data="items" border>
        <el-table-column prop="name" label="勋章" min-width="220">
          <template #default="{ row }">
            <div class="name-cell">
              <strong>{{ row.name }}</strong>
              <div class="name-cell__meta">{{ row.code }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类别" min-width="120">
          <template #default="{ row }">{{ row.categoryName }}</template>
        </el-table-column>
        <el-table-column label="规则" min-width="140">
          <template #default="{ row }">{{ awardRuleLabel(row.awardRule) }}</template>
        </el-table-column>
        <el-table-column prop="targetCount" label="阈值" width="88" />
        <el-table-column prop="sortOrder" label="排序" width="88" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="活动时间" min-width="220">
          <template #default="{ row }">
            <span v-if="row.isLimited">{{ formatTime(row.startAt) }} ~ {{ formatTime(row.endAt) }}</span>
            <span v-else>长期开放</span>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="150">
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="row.status !== 'LISTED'" link type="success" @click="changeStatus(row, 'LISTED')">上架</el-button>
            <el-button v-if="row.status === 'LISTED'" link type="warning" @click="changeStatus(row, 'UNLISTED')">下架</el-button>
            <el-button v-if="row.status !== 'ARCHIVED'" link type="danger" @click="changeStatus(row, 'ARCHIVED')">归档</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          background
          layout="total, prev, pager, next"
          :total="total"
          @current-change="loadList"
        />
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="760px" destroy-on-close>
      <el-form label-width="110px">
        <el-form-item label="勋章编码">
          <el-input v-model="form.code" :disabled="dialogMode === 'edit'" placeholder="如 RECOMMENDATION_AMBASSADOR" />
        </el-form-item>
        <el-form-item label="发放规则">
          <el-select v-model="form.awardRule" :disabled="dialogMode === 'edit'" style="width: 100%">
            <el-option v-for="item in awardRuleOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="勋章类别">
          <el-select v-model="form.category" style="width: 100%">
            <el-option v-for="item in categoryOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="勋章名称">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="勋章简介">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="获取条件">
          <el-input v-model="form.condition" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="图标标识">
          <el-input v-model="form.iconKey" placeholder="如 PLAN / DINING_EVENT / RECOMMEND" />
        </el-form-item>
        <el-form-item label="阈值">
          <el-input-number v-model="form.targetCount" :min="1" :max="9999" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item v-if="dialogMode === 'create'" label="初始状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option v-for="item in createStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="限定勋章">
          <el-switch v-model="form.isLimited" />
        </el-form-item>
        <template v-if="form.isLimited">
          <el-form-item label="开始时间">
            <el-date-picker
              v-model="form.startAt"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss[Z]"
              placeholder="选择开始时间"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="结束时间">
            <el-date-picker
              v-model="form.endAt"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss[Z]"
              placeholder="选择结束时间"
              style="width: 100%"
            />
          </el-form-item>
        </template>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.name-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.name-cell__meta {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.table-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
