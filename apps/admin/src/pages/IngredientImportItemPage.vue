<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ArrowLeft, Delete, Plus } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import {
  ingredientApi,
  type AdminIngredientCategorySummary,
  type AdminUnitSummary,
  type IngredientImportBody,
  type IngredientImportItemDetail,
  type IngredientImportMatchType
} from "@/apis/ingredient";
import type { UUID } from "@/apis/http";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";
import { formatDateTime } from "@/utils/date";
import { formatStatusText } from "@/utils/status";

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const importing = ref(false);
const detail = ref<IngredientImportItemDetail | null>(null);
const categories = ref<AdminIngredientCategorySummary[]>([]);
const units = ref<AdminUnitSummary[]>([]);
const requestId = ref(0);
const form = reactive<IngredientImportBody>(emptyBody());

const itemId = computed<UUID | null>(() => {
  const value = Number(Array.isArray(route.params.itemId) ? route.params.itemId[0] : route.params.itemId);
  return Number.isInteger(value) && value > 0 ? value : null;
});
const readOnly = computed(() => detail.value?.status === "IMPORTED");
const canImport = computed(() => detail.value?.status === "READY" && detail.value.errorItems.length === 0);
const nutritionEnabled = computed({
  get: () => form.nutrition !== null,
  set: (value: boolean) => {
    form.nutrition = value ? form.nutrition ?? emptyNutrition() : null;
  }
});
const categoryOptions = computed(() => categories.value.filter(item => item.isSelectable));
const proteinOptions = [
  { label: "不标注", value: null },
  { label: "猪肉", value: "PORK" },
  { label: "鸡肉", value: "CHICKEN" },
  { label: "牛肉", value: "BEEF" },
  { label: "羊肉", value: "LAMB" },
  { label: "鸭肉", value: "DUCK" },
  { label: "海鲜", value: "SEAFOOD" },
  { label: "鸡蛋", value: "EGG" },
  { label: "豆腐", value: "TOFU" },
  { label: "无主蛋白", value: "NONE" }
] as const;
const matchTypeOptions: Array<{ label: string; value: IngredientImportMatchType }> = [
  { label: "精确名称", value: "EXACT_NAME" },
  { label: "别名", value: "ALIAS" },
  { label: "代表性匹配", value: "REPRESENTATIVE" },
  { label: "精简代表性匹配", value: "LEAN_REPRESENTATIVE" },
  { label: "人工确认", value: "MANUAL" },
  { label: "需要复核", value: "REVIEW_NEEDED" }
];

useAdminHeaderRefresh(() => {
  void loadPage();
});

function emptyNutrition() {
  return {
    sourceVersion: "",
    foodCode: "",
    foodName: "",
    matchType: "MANUAL" as IngredientImportMatchType,
    confidence: 0,
    conversions: [] as Array<{ unitName: string; gramsPerUnit: number }>
  };
}

function emptyBody(): IngredientImportBody {
  return {
    name: "",
    aliases: [],
    categoryCode: null,
    defaultUnitName: null,
    proteinType: null,
    isStaple: false,
    isSpicyIngredient: false,
    imageUrl: null,
    nutrition: null
  };
}

function copyBody(body: IngredientImportBody) {
  Object.assign(form, {
    ...body,
    aliases: [...body.aliases],
    nutrition: body.nutrition
      ? { ...body.nutrition, conversions: body.nutrition.conversions.map(item => ({ ...item })) }
      : null
  });
}

async function loadPage() {
  const currentRequestId = ++requestId.value;
  if (!itemId.value) {
    ElMessage.error("导入条目 ID 缺失");
    return;
  }
  loading.value = true;
  try {
    const [nextDetail, categoryList, unitList] = await Promise.all([
      ingredientApi.getImportItemDetail(itemId.value),
      ingredientApi.listCategories(),
      ingredientApi.listUnits()
    ]);
    if (currentRequestId !== requestId.value) return;
    detail.value = nextDetail;
    categories.value = categoryList;
    units.value = unitList;
    copyBody(nextDetail.ingredientBody);
  } catch (error) {
    if (currentRequestId === requestId.value) ElMessage.error(error instanceof Error ? error.message : "加载食材导入条目失败");
  } finally {
    if (currentRequestId === requestId.value) loading.value = false;
  }
}

function goBack() {
  if (detail.value) void router.push(`/ingredients/imports/${detail.value.jobId}`);
  else void router.push("/ingredients/imports");
}

function addAlias() {
  form.aliases.push("");
}

function removeAlias(index: number) {
  form.aliases.splice(index, 1);
}

function addConversion() {
  if (!form.nutrition) form.nutrition = emptyNutrition();
  form.nutrition.conversions.push({ unitName: "", gramsPerUnit: 0 });
}

function removeConversion(index: number) {
  form.nutrition?.conversions.splice(index, 1);
}

async function saveItem() {
  if (!detail.value || !itemId.value || readOnly.value) return;
  saving.value = true;
  try {
    detail.value = await ingredientApi.updateImportItem(itemId.value, {
      operationId: createOperationId(),
      expectedVersion: detail.value.version,
      ingredientBody: {
        ...form,
        aliases: form.aliases.map(item => item.trim()).filter(Boolean),
        nutrition: form.nutrition
          ? { ...form.nutrition, conversions: form.nutrition.conversions.map(item => ({ unitName: item.unitName.trim(), gramsPerUnit: item.gramsPerUnit })) }
          : null
      }
    });
    copyBody(detail.value.ingredientBody);
    ElMessage.success("导入条目已保存");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存导入条目失败");
  } finally {
    saving.value = false;
  }
}

async function importItem() {
  if (!detail.value || !itemId.value || !canImport.value) return;
  importing.value = true;
  try {
    detail.value = await ingredientApi.importItem(itemId.value, { operationId: createOperationId(), expectedVersion: detail.value.version });
    copyBody(detail.value.ingredientBody);
    ElMessage.success(detail.value.match.kind === "MATCHED" ? "食材已关联并导入" : "食材已创建并进入待审核");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "导入食材失败");
  } finally {
    importing.value = false;
  }
}

watch(() => route.params.itemId, () => {
  detail.value = null;
  void loadPage();
});

onMounted(() => {
  void loadPage();
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel page-toolbar">
      <el-button text :icon="ArrowLeft" @click="goBack">返回导入任务</el-button>
      <div class="toolbar-spacer" />
      <el-tag v-if="detail" :type="detail.status === 'IMPORTED' ? 'success' : detail.status === 'FAILED' ? 'danger' : 'warning'">{{ formatStatusText(detail.status) }}</el-tag>
      <el-button v-if="detail && !readOnly" :loading="saving" @click="saveItem">保存修正</el-button>
      <el-button v-if="detail && !readOnly" type="primary" :disabled="!canImport" :loading="importing" @click="importItem">确认导入</el-button>
    </div>

    <div v-loading="loading" class="content-grid" v-if="detail">
      <div class="form-panel">
        <div class="panel-heading"><div><h2>{{ detail.title }}</h2><p>{{ detail.sourcePath }} · 更新于 {{ formatDateTime(detail.updatedAt) }}</p></div></div>
        <el-alert v-if="detail.errorItems.length" type="error" :closable="false" title="请先修正以下错误">
          <div v-for="(issue, index) in detail.errorItems" :key="`${issue.field}-${index}`">{{ issue.field || "整条数据" }}：{{ issue.message }}</div>
        </el-alert>
        <el-alert v-if="detail.warnItems.length" class="notice" type="warning" :closable="false" title="导入提醒">
          <div v-for="(issue, index) in detail.warnItems" :key="`${issue.field}-${index}`">{{ issue.field || "整条数据" }}：{{ issue.message }}</div>
        </el-alert>

        <el-form label-position="top" :disabled="readOnly">
          <el-form-item label="正式名称"><el-input v-model="form.name" /></el-form-item>
          <el-form-item label="别名"><div class="inline-list"><div v-for="(_, index) in form.aliases" :key="index" class="inline-row"><el-input v-model="form.aliases[index]" placeholder="如：马铃薯" /><el-button text type="danger" :icon="Delete" @click="removeAlias(index)" /></div><el-button text type="primary" :icon="Plus" @click="addAlias">添加别名</el-button></div></el-form-item>
          <div class="two-columns">
            <el-form-item label="分类"><el-select v-model="form.categoryCode" clearable><el-option v-for="item in categoryOptions" :key="item.code" :label="`${item.name}（${item.code}）`" :value="item.code" /></el-select></el-form-item>
            <el-form-item label="默认单位"><el-select v-model="form.defaultUnitName" clearable><el-option v-for="item in units" :key="item.id" :label="item.name" :value="item.name" /></el-select></el-form-item>
          </div>
          <div class="two-columns">
            <el-form-item label="主蛋白类型"><el-select v-model="form.proteinType" clearable><el-option v-for="item in proteinOptions" :key="item.label" :label="item.label" :value="item.value" /></el-select></el-form-item>
            <div class="switch-row"><el-checkbox v-model="form.isStaple">主食</el-checkbox><el-checkbox v-model="form.isSpicyIngredient">辣味食材</el-checkbox></div>
          </div>
          <el-form-item label="图片地址"><el-input v-model="form.imageUrl" placeholder="导入内容暂存，确认后不自动固化系统图片" /></el-form-item>
        </el-form>
      </div>

      <div class="side-stack">
        <div class="form-panel match-panel">
          <div class="panel-heading"><h3>系统匹配</h3></div>
          <template v-if="detail.match.kind === 'MATCHED'"><el-tag type="success">{{ detail.match.matchType === 'ALIAS' ? '命中别名' : '命中正式名称' }}</el-tag><strong>{{ detail.match.ingredientName }}</strong><span class="table-hint">食材 ID：{{ detail.match.ingredientId }} · {{ formatStatusText(detail.match.ingredientStatus || '') }}</span></template>
          <template v-else-if="detail.match.kind === 'CREATE'"><el-tag type="warning">未匹配</el-tag><span class="table-hint">确认后创建为待审核食材，不会覆盖现有食材。</span></template>
          <template v-else><el-tag type="danger">匹配冲突</el-tag><span class="table-hint">候选食材：{{ detail.match.ingredientIds.join("、") }}</span></template>
        </div>

        <div class="form-panel">
          <div class="panel-heading"><div><h3>营养绑定</h3><p>通过 sourceVersion + foodCode 关联营养食品</p></div><el-switch v-model="nutritionEnabled" /></div>
          <el-form v-if="form.nutrition" label-position="top" :disabled="readOnly">
            <el-form-item label="来源版本"><el-input v-model="form.nutrition.sourceVersion" /></el-form-item>
            <div class="two-columns"><el-form-item label="食品编码"><el-input v-model="form.nutrition.foodCode" /></el-form-item><el-form-item label="食品名称"><el-input v-model="form.nutrition.foodName" /></el-form-item></div>
            <div class="two-columns"><el-form-item label="匹配类型"><el-select v-model="form.nutrition.matchType"><el-option v-for="item in matchTypeOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item><el-form-item label="可信度"><el-input-number v-model="form.nutrition.confidence" :min="0" :max="1" :step="0.01" /></el-form-item></div>
            <el-form-item label="单位克重"><div class="inline-list"><div v-for="(conversion, index) in form.nutrition.conversions" :key="index" class="inline-row"><el-select v-model="conversion.unitName" placeholder="单位"><el-option v-for="unit in units" :key="unit.id" :label="unit.name" :value="unit.name" /></el-select><el-input-number v-model="conversion.gramsPerUnit" :min="0.01" :step="1" /><el-button text type="danger" :icon="Delete" @click="removeConversion(index)" /></div><el-button text type="primary" :icon="Plus" @click="addConversion">添加换算</el-button></div></el-form-item>
          </el-form>
          <el-empty v-else description="未提供营养绑定" :image-size="70" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.content-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(360px, .75fr); gap: 16px; align-items: start; }
.side-stack { display: grid; gap: 16px; }
.form-panel { padding: 20px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 8px 24px rgba(15, 23, 42, .04); }
.panel-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 18px; }
.panel-heading h2, .panel-heading h3 { margin: 0; color: #111827; }
.panel-heading p, .panel-heading > div > p { margin: 6px 0 0; color: #6b7280; font-size: 13px; }
.two-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.inline-list { display: grid; gap: 8px; width: 100%; }
.inline-row { display: flex; gap: 8px; align-items: center; }
.inline-row .el-input, .inline-row .el-select { flex: 1; }
.switch-row { display: flex; gap: 16px; align-items: center; padding-top: 30px; }
.match-panel { display: grid; gap: 10px; }
.notice { margin-top: 12px; }
@media (max-width: 1000px) { .content-grid { grid-template-columns: 1fr; } }
</style>
