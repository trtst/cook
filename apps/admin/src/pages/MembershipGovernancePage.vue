<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { Plus, Refresh } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  membershipCodeApi,
  type AdminGenerateMembershipCodesResult,
  type AdminMembershipCodeBatchItem,
  type AdminMembershipCodeGenerationItem,
  type AdminMembershipCodeItem,
  type AdminMembershipSkuItem,
  type MembershipCodeStatus,
  type MembershipSkuCode
} from "@/apis/membership-code";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";

type MembershipPageMode = "skus" | "batches" | "generations" | "codes" | "redemptions";
type BatchStatusFilter = "" | "true" | "false";

const route = useRoute();
const pageLoading = ref(false);
const skuLoading = ref(false);
const batchLoading = ref(false);
const batchOptionLoading = ref(false);
const codeLoading = ref(false);
const generationLoading = ref(false);
const redemptionLoading = ref(false);
const skuStatusSavingId = ref<number | null>(null);
const batchSaving = ref(false);
const batchStatusSavingId = ref<number | null>(null);
const generateSaving = ref(false);
const disableSavingId = ref<number | null>(null);
const batchDialogVisible = ref(false);
const generateDialogVisible = ref(false);
const exportDialogVisible = ref(false);
const skus = ref<AdminMembershipSkuItem[]>([]);
const batches = ref<AdminMembershipCodeBatchItem[]>([]);
const batchOptions = ref<AdminMembershipCodeBatchItem[]>([]);
const codes = ref<AdminMembershipCodeItem[]>([]);
const generations = ref<AdminMembershipCodeGenerationItem[]>([]);
const redemptions = ref<AdminMembershipCodeItem[]>([]);
const batchTotal = ref(0);
const codeTotal = ref(0);
const generationTotal = ref(0);
const redemptionTotal = ref(0);
const generatedResult = ref<AdminGenerateMembershipCodesResult | null>(null);
const selectedBatch = ref<AdminMembershipCodeBatchItem | null>(null);

const batchQuery = reactive({
  page: 1,
  pageSize: 20,
  keyword: "",
  skuCode: "" as MembershipSkuCode | "",
  redeemEnabled: "" as BatchStatusFilter
});
const codeQuery = reactive({
  page: 1,
  pageSize: 20,
  batchId: "" as number | "",
  status: "" as MembershipCodeStatus | "",
  code: ""
});
const generationQuery = reactive({
  page: 1,
  pageSize: 20,
  batchId: "" as number | "",
  skuCode: "" as MembershipSkuCode | ""
});
const redemptionQuery = reactive({
  page: 1,
  pageSize: 20,
  batchId: "" as number | "",
  skuCode: "" as MembershipSkuCode | "",
  uid: "" as number | "",
  code: "",
  redeemedFrom: null as Date | null,
  redeemedTo: null as Date | null
});

const batchForm = reactive({
  skuCode: "PLUS_30D" as MembershipSkuCode,
  name: "",
  redeemEnabled: false,
  startsAt: null as Date | null,
  endsAt: null as Date | null
});
const generateForm = reactive({
  quantity: 50
});

const skuLabelMap: Record<MembershipSkuCode, string> = {
  PLUS_30D: "Plus 月卡",
  PRO_30D: "Pro 月卡",
  PRO_TRIAL_1D: "Pro 体验 1 天",
  PRO_TRIAL_3D: "Pro 体验 3 天",
  PRO_TRIAL_7D: "Pro 体验 7 天"
};
const codeStatusLabelMap: Record<MembershipCodeStatus, string> = {
  ACTIVE: "未使用",
  REDEEMED: "已使用",
  DISABLED: "已停用"
};
const windowStateLabelMap: Record<AdminMembershipCodeBatchItem["windowState"], string> = {
  NO_LIMIT: "长期开放",
  PENDING: "未到时间",
  ACTIVE: "时间窗内",
  EXPIRED: "已过期"
};

const pageMode = computed<MembershipPageMode>(() => {
  const mode = route.meta.membershipPage;
  if (mode === "batches" || mode === "generations" || mode === "codes" || mode === "redemptions") {
    return mode;
  }
  return "skus";
});
const pageNote = computed(() => {
  if (pageMode.value === "skus") {
    return "固定 SKU 由服务端自动同步；这里只控制当前是否允许用户核销该 SKU。";
  }
  if (pageMode.value === "batches") {
    return "批次负责控制时间窗、上架状态与本批兑换码生成入口。";
  }
  if (pageMode.value === "generations") {
    return "每次批量生码都会留下生成记录；明文兑换码仍只在生成当次返回。";
  }
  if (pageMode.value === "redemptions") {
    return "这里只查看已核销兑换码，不再混入未使用或已停用单码。";
  }
  return "兑换码列表只展示掩码；明文码不会在后台长期保留。";
});
const batchFilterOptions = computed(() =>
  batchOptions.value.map(item => ({
    label: `${item.name} · ${skuLabelMap[item.sku.code]}`,
    value: item.id
  }))
);

useAdminHeaderRefresh(() => {
  void loadCurrentPage();
});

function resetBatchForm() {
  batchForm.skuCode = "PLUS_30D";
  batchForm.name = "";
  batchForm.redeemEnabled = false;
  batchForm.startsAt = null;
  batchForm.endsAt = null;
}

function resetGenerateForm() {
  generateForm.quantity = 50;
  selectedBatch.value = null;
}

function getSkuLabel(code: MembershipSkuCode) {
  return skuLabelMap[code];
}

function formatTime(value: string | null) {
  if (!value) return "-";
  return value.replace("T", " ").replace(/\.\d{3}Z$/, "Z");
}

function formatCodeStatus(status: MembershipCodeStatus) {
  return codeStatusLabelMap[status];
}

function formatWindowState(row: AdminMembershipCodeBatchItem) {
  const parts = [windowStateLabelMap[row.windowState]];
  if (row.startsAt || row.endsAt) {
    parts.push(`${formatTime(row.startsAt)} ~ ${formatTime(row.endsAt)}`);
  }
  return parts.join(" · ");
}

function formatSkuSwitchText(row: AdminMembershipSkuItem) {
  return row.redeemEnabled ? "关闭核销" : "开启核销";
}

function formatBatchSwitchText(row: AdminMembershipCodeBatchItem) {
  return row.redeemEnabled ? "下架" : "上架";
}

async function loadSkus() {
  skuLoading.value = true;
  try {
    const result = await membershipCodeApi.listSkus();
    skus.value = result.items;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载固定 SKU 失败");
  } finally {
    skuLoading.value = false;
  }
}

async function loadBatchOptions() {
  batchOptionLoading.value = true;
  try {
    const result = await membershipCodeApi.listBatches({
      page: 1,
      pageSize: 100
    });
    batchOptions.value = result.items;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载批次筛选项失败");
  } finally {
    batchOptionLoading.value = false;
  }
}

async function loadBatches() {
  batchLoading.value = true;
  try {
    const result = await membershipCodeApi.listBatches({
      page: batchQuery.page,
      pageSize: batchQuery.pageSize,
      keyword: batchQuery.keyword.trim() || undefined,
      skuCode: batchQuery.skuCode || undefined,
      redeemEnabled:
        batchQuery.redeemEnabled === ""
          ? undefined
          : batchQuery.redeemEnabled === "true"
    });
    batches.value = result.items;
    batchTotal.value = result.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载兑换码批次失败");
  } finally {
    batchLoading.value = false;
  }
}

async function loadCodes() {
  codeLoading.value = true;
  try {
    const result = await membershipCodeApi.listCodes({
      page: codeQuery.page,
      pageSize: codeQuery.pageSize,
      batchId: codeQuery.batchId || undefined,
      status: codeQuery.status || undefined,
      code: codeQuery.code.trim() || undefined
    });
    codes.value = result.items;
    codeTotal.value = result.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载兑换码列表失败");
  } finally {
    codeLoading.value = false;
  }
}

async function loadGenerations() {
  generationLoading.value = true;
  try {
    const result = await membershipCodeApi.listGenerations({
      page: generationQuery.page,
      pageSize: generationQuery.pageSize,
      batchId: generationQuery.batchId || undefined,
      skuCode: generationQuery.skuCode || undefined
    });
    generations.value = result.items;
    generationTotal.value = result.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载创建记录失败");
  } finally {
    generationLoading.value = false;
  }
}

async function loadRedemptions() {
  redemptionLoading.value = true;
  try {
    const result = await membershipCodeApi.listRedemptions({
      page: redemptionQuery.page,
      pageSize: redemptionQuery.pageSize,
      batchId: redemptionQuery.batchId || undefined,
      skuCode: redemptionQuery.skuCode || undefined,
      uid: redemptionQuery.uid || undefined,
      code: redemptionQuery.code.trim() || undefined,
      redeemedFrom: redemptionQuery.redeemedFrom ? redemptionQuery.redeemedFrom.toISOString() : undefined,
      redeemedTo: redemptionQuery.redeemedTo ? redemptionQuery.redeemedTo.toISOString() : undefined
    });
    redemptions.value = result.items;
    redemptionTotal.value = result.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载核销记录失败");
  } finally {
    redemptionLoading.value = false;
  }
}

async function loadCurrentPage() {
  pageLoading.value = true;
  try {
    if (pageMode.value === "skus") {
      await loadSkus();
      return;
    }

    if (pageMode.value === "batches") {
      await Promise.all([loadSkus(), loadBatches()]);
      return;
    }

    if (pageMode.value === "generations") {
      await Promise.all([loadSkus(), loadBatchOptions(), loadGenerations()]);
      return;
    }

    if (pageMode.value === "redemptions") {
      await Promise.all([loadSkus(), loadBatchOptions(), loadRedemptions()]);
      return;
    }

    await Promise.all([loadSkus(), loadBatchOptions(), loadCodes()]);
  } finally {
    pageLoading.value = false;
  }
}

function openBatchDialog() {
  resetBatchForm();
  batchDialogVisible.value = true;
}

async function submitBatch() {
  const name = batchForm.name.trim();
  if (!name) {
    ElMessage.error("请输入批次名称");
    return;
  }
  if (batchForm.startsAt && batchForm.endsAt && batchForm.startsAt >= batchForm.endsAt) {
    ElMessage.error("结束时间必须晚于开始时间");
    return;
  }

  batchSaving.value = true;
  try {
    await membershipCodeApi.createBatch({
      operationId: createOperationId(),
      skuCode: batchForm.skuCode,
      name,
      redeemEnabled: batchForm.redeemEnabled,
      startsAt: batchForm.startsAt ? batchForm.startsAt.toISOString() : null,
      endsAt: batchForm.endsAt ? batchForm.endsAt.toISOString() : null
    });
    batchDialogVisible.value = false;
    resetBatchForm();
    batchQuery.page = 1;
    await Promise.all([loadBatches(), loadBatchOptions()]);
    ElMessage.success("兑换码批次已创建");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "创建兑换码批次失败");
  } finally {
    batchSaving.value = false;
  }
}

async function toggleSkuStatus(row: AdminMembershipSkuItem) {
  try {
    await ElMessageBox.confirm(
      row.redeemEnabled ? "关闭后，该 SKU 下的兑换码会统一兑换失败。" : "开启后，该 SKU 下满足批次规则的兑换码才允许核销。",
      formatSkuSwitchText(row),
      {
        type: "warning",
        confirmButtonText: formatSkuSwitchText(row),
        cancelButtonText: "取消"
      }
    );
  } catch {
    return;
  }

  skuStatusSavingId.value = row.id;
  try {
    await membershipCodeApi.setSkuStatus(row.id, {
      operationId: createOperationId(),
      redeemEnabled: !row.redeemEnabled,
      expectedVersion: row.version
    });
    await loadSkus();
    ElMessage.success(`SKU 已${row.redeemEnabled ? "关闭" : "开启"}`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "切换 SKU 状态失败");
  } finally {
    skuStatusSavingId.value = null;
  }
}

async function toggleBatchStatus(row: AdminMembershipCodeBatchItem) {
  try {
    await ElMessageBox.confirm(
      row.redeemEnabled ? "下架后，该批次兑换码会统一兑换失败。" : "上架后，满足时间窗的兑换码即可核销。",
      `${formatBatchSwitchText(row)}批次`,
      {
        type: "warning",
        confirmButtonText: formatBatchSwitchText(row),
        cancelButtonText: "取消"
      }
    );
  } catch {
    return;
  }

  batchStatusSavingId.value = row.id;
  try {
    await membershipCodeApi.setBatchStatus(row.id, {
      operationId: createOperationId(),
      redeemEnabled: !row.redeemEnabled,
      expectedVersion: row.version
    });
    await Promise.all([loadBatches(), loadBatchOptions()]);
    ElMessage.success(`批次已${row.redeemEnabled ? "下架" : "上架"}`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "切换批次状态失败");
  } finally {
    batchStatusSavingId.value = null;
  }
}

function openGenerateDialog(row: AdminMembershipCodeBatchItem) {
  resetGenerateForm();
  selectedBatch.value = row;
  generateDialogVisible.value = true;
}

async function submitGenerate() {
  if (!selectedBatch.value) return;
  generateSaving.value = true;
  try {
    const result = await membershipCodeApi.generateCodes(selectedBatch.value.id, {
      operationId: createOperationId(),
      quantity: generateForm.quantity
    });
    generatedResult.value = result;
    generateDialogVisible.value = false;
    exportDialogVisible.value = true;
    await Promise.all([loadBatches(), loadBatchOptions()]);
    ElMessage.success(`已生成 ${result.generatedCount} 个兑换码`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "生成兑换码失败");
  } finally {
    generateSaving.value = false;
  }
}

async function disableCode(row: AdminMembershipCodeItem) {
  try {
    await ElMessageBox.confirm("停用后，该兑换码即使未被用户使用，也会统一兑换失败。", "停用兑换码", {
      type: "warning",
      confirmButtonText: "停用",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }

  disableSavingId.value = row.id;
  try {
    await membershipCodeApi.disableCode(row.id, createOperationId());
    await loadCodes();
    ElMessage.success("兑换码已停用");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "停用兑换码失败");
  } finally {
    disableSavingId.value = null;
  }
}

function buildExportText(result: AdminGenerateMembershipCodesResult) {
  return result.codes.map(item => item.code).join("\n");
}

async function copyGeneratedCodes() {
  if (!generatedResult.value) return;
  try {
    await navigator.clipboard.writeText(buildExportText(generatedResult.value));
    ElMessage.success("兑换码已复制");
  } catch {
    ElMessage.error("当前浏览器不支持直接复制，请改用下载");
  }
}

function downloadGeneratedCodes() {
  if (!generatedResult.value) return;
  const result = generatedResult.value;
  const lines = ["code,mask", ...result.codes.map(item => `${item.code},${item.codeMask}`)];
  const blob = new Blob([`\ufeff${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${result.batch.name}-${result.batch.sku.code}-${result.generatedCount}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

watch(pageMode, () => {
  void loadCurrentPage();
});

onMounted(() => {
  void loadCurrentPage();
});
</script>

<template>
  <section class="page-stack membership-page" v-loading="pageLoading">
    <div class="toolbar-panel page-toolbar">
      <el-button v-if="pageMode === 'batches'" type="primary" :icon="Plus" @click="openBatchDialog">新建批次</el-button>
      <el-button :icon="Refresh" @click="loadCurrentPage">刷新</el-button>
      <div class="toolbar-spacer" />
      <span class="page-note">{{ pageNote }}</span>
    </div>

    <div v-if="pageMode === 'skus'" class="table-panel" v-loading="skuLoading">
      <div class="panel-heading">
        <h2>固定 SKU</h2>
      </div>
      <el-table :data="skus" row-key="id">
        <el-table-column label="SKU" min-width="180">
          <template #default="{ row }">{{ getSkuLabel(row.code) }}</template>
        </el-table-column>
        <el-table-column prop="code" label="编码" min-width="140" />
        <el-table-column label="档位" width="120">
          <template #default="{ row }">{{ row.tier }}</template>
        </el-table-column>
        <el-table-column label="类型" width="120">
          <template #default="{ row }">{{ row.kind === "FORMAL" ? "正式会员" : "体验会员" }}</template>
        </el-table-column>
        <el-table-column label="时长" width="100">
          <template #default="{ row }">{{ row.durationDays }} 天</template>
        </el-table-column>
        <el-table-column label="可核销" width="100">
          <template #default="{ row }">{{ row.redeemEnabled ? "是" : "否" }}</template>
        </el-table-column>
        <el-table-column label="版本" width="80">
          <template #default="{ row }">{{ row.version }}</template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="170">
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" :loading="skuStatusSavingId === row.id" @click="toggleSkuStatus(row)">
              {{ formatSkuSwitchText(row) }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-else-if="pageMode === 'batches'" class="table-panel">
      <div class="membership-panel__header">
        <div>
          <h2>兑换码批次</h2>
          <p>只有已上架且处于时间窗内的批次，用户端才允许核销。</p>
        </div>
      </div>

      <div class="toolbar-panel page-toolbar membership-filter">
        <el-input v-model="batchQuery.keyword" class="toolbar-search" placeholder="搜索批次名 / SKU 编码" clearable @keyup.enter="loadBatches" />
        <el-select v-model="batchQuery.skuCode" class="toolbar-select" placeholder="全部 SKU" clearable>
          <el-option v-for="item in skus" :key="item.id" :label="getSkuLabel(item.code)" :value="item.code" />
        </el-select>
        <el-select v-model="batchQuery.redeemEnabled" class="toolbar-select" placeholder="上下架状态" clearable>
          <el-option label="已上架" value="true" />
          <el-option label="已下架" value="false" />
        </el-select>
        <el-button type="primary" @click="batchQuery.page = 1; loadBatches()">查询</el-button>
      </div>

      <el-table v-loading="batchLoading" :data="batches" row-key="id">
        <el-table-column prop="name" label="批次名称" min-width="180" />
        <el-table-column label="SKU" min-width="160">
          <template #default="{ row }">{{ getSkuLabel(row.sku.code) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ row.redeemEnabled ? "已上架" : "已下架" }}</template>
        </el-table-column>
        <el-table-column label="时间窗" min-width="220">
          <template #default="{ row }">{{ formatWindowState(row) }}</template>
        </el-table-column>
        <el-table-column label="数量" min-width="240">
          <template #default="{ row }">
            <div class="batch-counts">
              <span>总 {{ row.codeCount }}</span>
              <span>未用 {{ row.activeCodeCount }}</span>
              <span>已用 {{ row.redeemedCodeCount }}</span>
              <span>停用 {{ row.disabledCodeCount }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" :loading="batchStatusSavingId === row.id" @click="toggleBatchStatus(row)">
                {{ formatBatchSwitchText(row) }}
              </el-button>
              <el-button size="small" type="primary" @click="openGenerateDialog(row)">批量生码</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="batchQuery.page"
          v-model:page-size="batchQuery.pageSize"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[20, 50, 100]"
          :total="batchTotal"
          @change="loadBatches"
        />
      </div>
    </div>

    <div v-else-if="pageMode === 'generations'" class="table-panel">
      <div class="membership-panel__header">
        <div>
          <h2>创建记录</h2>
          <p>每次批量生码都会留下操作人与数量记录，用于后续追溯。</p>
        </div>
      </div>

      <div class="toolbar-panel page-toolbar membership-filter">
        <el-select v-model="generationQuery.batchId" class="toolbar-select toolbar-select--wide" :loading="batchOptionLoading" placeholder="全部批次" clearable>
          <el-option v-for="item in batchFilterOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="generationQuery.skuCode" class="toolbar-select" placeholder="全部 SKU" clearable>
          <el-option v-for="item in skus" :key="item.id" :label="getSkuLabel(item.code)" :value="item.code" />
        </el-select>
        <el-button type="primary" @click="generationQuery.page = 1; loadGenerations()">查询</el-button>
      </div>

      <el-table v-loading="generationLoading" :data="generations" row-key="id">
        <el-table-column prop="batchName" label="批次" min-width="180" />
        <el-table-column label="SKU" min-width="160">
          <template #default="{ row }">{{ getSkuLabel(row.skuCode) }}</template>
        </el-table-column>
        <el-table-column label="数量" width="100">
          <template #default="{ row }">{{ row.generatedCount }}</template>
        </el-table-column>
        <el-table-column label="创建人" min-width="180">
          <template #default="{ row }">
            <span v-if="row.generatedBy">{{ row.generatedBy.displayName }} · {{ row.generatedBy.username }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="180">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="导出时间" min-width="180">
          <template #default="{ row }">{{ formatTime(row.exportedAt) }}</template>
        </el-table-column>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="generationQuery.page"
          v-model:page-size="generationQuery.pageSize"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[20, 50, 100]"
          :total="generationTotal"
          @change="loadGenerations"
        />
      </div>
    </div>

    <div v-else-if="pageMode === 'codes'" class="table-panel">
      <div class="membership-panel__header">
        <div>
          <h2>兑换码列表</h2>
          <p>后台只显示掩码；明文兑换码只会在生成当次导出，不会在列表中长期保留。</p>
        </div>
      </div>

      <div class="toolbar-panel page-toolbar membership-filter">
        <el-select v-model="codeQuery.batchId" class="toolbar-select toolbar-select--wide" :loading="batchOptionLoading" placeholder="全部批次" clearable>
          <el-option v-for="item in batchFilterOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="codeQuery.status" class="toolbar-select" placeholder="兑换码状态" clearable>
          <el-option label="未使用" value="ACTIVE" />
          <el-option label="已使用" value="REDEEMED" />
          <el-option label="已停用" value="DISABLED" />
        </el-select>
        <el-input v-model="codeQuery.code" class="toolbar-search" placeholder="按完整兑换码或掩码查询" clearable @keyup.enter="codeQuery.page = 1; loadCodes()" />
        <el-button type="primary" @click="codeQuery.page = 1; loadCodes()">查询</el-button>
      </div>

      <el-table v-loading="codeLoading" :data="codes" row-key="id">
        <el-table-column prop="codeMask" label="掩码" min-width="150" />
        <el-table-column prop="batchName" label="批次" min-width="170" />
        <el-table-column label="SKU" min-width="140">
          <template #default="{ row }">{{ getSkuLabel(row.skuCode) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ formatCodeStatus(row.status) }}</template>
        </el-table-column>
        <el-table-column label="使用人" min-width="150">
          <template #default="{ row }">
            <span v-if="row.redeemedBy">{{ row.redeemedBy.uid }}{{ row.redeemedBy.nickname ? ` · ${row.redeemedBy.nickname}` : "" }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="使用时间" min-width="170">
          <template #default="{ row }">{{ formatTime(row.redeemedAt) }}</template>
        </el-table-column>
        <el-table-column label="生成时间" min-width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'ACTIVE'"
              size="small"
              :loading="disableSavingId === row.id"
              @click="disableCode(row)"
            >
              停用
            </el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="codeQuery.page"
          v-model:page-size="codeQuery.pageSize"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[20, 50, 100]"
          :total="codeTotal"
          @change="loadCodes"
        />
      </div>
    </div>

    <div v-else class="table-panel">
      <div class="membership-panel__header">
        <div>
          <h2>核销记录</h2>
          <p>按真实核销事实查看当前已使用兑换码，不再混排未使用与停用单码。</p>
        </div>
      </div>

      <div class="toolbar-panel page-toolbar membership-filter membership-filter--wrap">
        <el-select v-model="redemptionQuery.batchId" class="toolbar-select toolbar-select--wide" :loading="batchOptionLoading" placeholder="全部批次" clearable>
          <el-option v-for="item in batchFilterOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="redemptionQuery.skuCode" class="toolbar-select" placeholder="全部 SKU" clearable>
          <el-option v-for="item in skus" :key="item.id" :label="getSkuLabel(item.code)" :value="item.code" />
        </el-select>
        <el-input v-model="redemptionQuery.uid" class="toolbar-search toolbar-search--narrow" placeholder="按 UID 查询" clearable />
        <el-input v-model="redemptionQuery.code" class="toolbar-search" placeholder="按完整兑换码或掩码查询" clearable />
        <el-date-picker v-model="redemptionQuery.redeemedFrom" type="datetime" placeholder="核销开始时间" class="toolbar-select toolbar-select--wide" />
        <el-date-picker v-model="redemptionQuery.redeemedTo" type="datetime" placeholder="核销结束时间" class="toolbar-select toolbar-select--wide" />
        <el-button type="primary" @click="redemptionQuery.page = 1; loadRedemptions()">查询</el-button>
      </div>

      <el-table v-loading="redemptionLoading" :data="redemptions" row-key="id">
        <el-table-column prop="codeMask" label="掩码" min-width="150" />
        <el-table-column prop="batchName" label="批次" min-width="170" />
        <el-table-column label="SKU" min-width="140">
          <template #default="{ row }">{{ getSkuLabel(row.skuCode) }}</template>
        </el-table-column>
        <el-table-column label="使用人" min-width="150">
          <template #default="{ row }">
            <span v-if="row.redeemedBy">{{ row.redeemedBy.uid }}{{ row.redeemedBy.nickname ? ` · ${row.redeemedBy.nickname}` : "" }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="核销时间" min-width="170">
          <template #default="{ row }">{{ formatTime(row.redeemedAt) }}</template>
        </el-table-column>
        <el-table-column label="生成时间" min-width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="redemptionQuery.page"
          v-model:page-size="redemptionQuery.pageSize"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[20, 50, 100]"
          :total="redemptionTotal"
          @change="loadRedemptions"
        />
      </div>
    </div>

    <el-dialog v-model="batchDialogVisible" title="新建兑换码批次" width="520px" @closed="resetBatchForm">
      <el-form label-position="top">
        <el-form-item label="SKU">
          <el-select v-model="batchForm.skuCode" style="width: 100%">
            <el-option v-for="item in skus" :key="item.id" :label="getSkuLabel(item.code)" :value="item.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="批次名称">
          <el-input v-model="batchForm.name" maxlength="64" placeholder="例如：首发体验 1 天·第一批" />
        </el-form-item>
        <el-form-item label="立即上架">
          <el-switch v-model="batchForm.redeemEnabled" />
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker v-model="batchForm.startsAt" type="datetime" placeholder="不限制开始时间" style="width: 100%" />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker v-model="batchForm.endsAt" type="datetime" placeholder="不限制结束时间" style="width: 100%" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="batchDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchSaving" @click="submitBatch">确定创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="generateDialogVisible" title="批量生成兑换码" width="460px" @closed="resetGenerateForm">
      <template v-if="selectedBatch">
        <p class="dialog-note">{{ selectedBatch.name }} · {{ getSkuLabel(selectedBatch.sku.code) }}</p>
        <el-form label-position="top">
          <el-form-item label="生成数量">
            <el-input-number v-model="generateForm.quantity" :min="1" :max="1000" style="width: 100%" />
          </el-form-item>
        </el-form>
        <p class="dialog-note">明文码只会在本次生成后显示和导出一次，请及时保存。</p>
      </template>

      <template #footer>
        <el-button @click="generateDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="generateSaving" @click="submitGenerate">生成并导出</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="exportDialogVisible" title="生成结果" width="720px">
      <template v-if="generatedResult">
        <div class="export-toolbar">
          <div>
            <strong>{{ generatedResult.batch.name }}</strong>
            <p class="page-note">已生成 {{ generatedResult.generatedCount }} 个兑换码，导出时间 {{ formatTime(generatedResult.exportedAt) }}</p>
          </div>
          <div class="table-actions">
            <el-button @click="copyGeneratedCodes">复制纯文本</el-button>
            <el-button type="primary" @click="downloadGeneratedCodes">下载 CSV</el-button>
          </div>
        </div>

        <div class="export-panel">
          <div v-for="item in generatedResult.codes" :key="item.code" class="export-code-row">
            <span class="mono-text">{{ item.code }}</span>
            <span class="page-note">{{ item.codeMask }}</span>
          </div>
        </div>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.membership-page {
  gap: 20px;
}

.membership-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
}

.membership-panel__header h2 {
  margin: 0 0 6px;
  font-size: 16px;
}

.membership-panel__header p,
.dialog-note {
  margin: 0;
  color: #78716c;
  line-height: 1.6;
}

.membership-filter {
  margin-bottom: 16px;
}

.membership-filter--wrap {
  flex-wrap: wrap;
}

.toolbar-select--wide {
  width: 280px;
}

.toolbar-search--narrow {
  width: 180px;
}

.batch-counts,
.table-actions,
.export-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
}

.batch-counts {
  flex-wrap: wrap;
  color: #57534e;
  font-size: 13px;
}

.table-actions {
  flex-wrap: wrap;
}

.export-toolbar {
  justify-content: space-between;
  margin-bottom: 16px;
}

.export-panel {
  display: grid;
  max-height: 420px;
  gap: 10px;
  padding: 16px;
  overflow: auto;
  background: #faf8f4;
  border: 1px solid #ece7df;
  border-radius: 6px;
}

.export-code-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px dashed #e7dfd2;
}

.export-code-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.mono-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
}
</style>
