<script setup lang="ts">
import { computed, ref } from "vue";
import { Download, Upload } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { systemDataApi, type SystemDataPreview } from "@/apis/system-data";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";

const exporting = ref(false);
const previewing = ref(false);
const importing = ref(false);
const preview = ref<SystemDataPreview | null>(null);
const selectedFile = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const sectionLabels: Record<string, string> = {
  inspirationCategories: "菜谱分类",
  recipeContentVersions: "菜谱正文版本",
  recipes: "系统菜谱",
  recipeAssistants: "菜谱助手内容",
  recipeNutritionSnapshots: "菜谱营养结果",
  recipeVersionTags: "菜谱标签",
  ingredientCategories: "食材分类",
  units: "系统单位",
  ingredients: "系统食材",
  nutrientFoods: "食材营养表",
  ingredientNutrientMappings: "食材营养关联",
  ingredientUnitConversions: "食材单位换算"
};

const previewRows = computed(() =>
  Object.entries(preview.value?.counts ?? {}).map(([key, count]) => ({
    key,
    label: sectionLabels[key] ?? key,
    ...count
  }))
);

function environmentName(value: "TEST" | "ONLINE") {
  return value === "TEST" ? "测试环境" : "线上环境";
}

useAdminHeaderRefresh(() => {
  preview.value = null;
  selectedFile.value = null;
});

function downloadJson(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function exportPackage() {
  exporting.value = true;
  try {
    const document = await systemDataApi.exportPackage();
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(`cook-system-data-${date}.json`, document);
    ElMessage.success("系统数据包已导出");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "导出失败");
  } finally {
    exporting.value = false;
  }
}

function chooseFile() {
  fileInput.value?.click();
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  input.value = "";
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".json")) {
    ElMessage.warning("请选择 JSON 数据包");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.warning("数据包不能超过 10 MB");
    return;
  }

  selectedFile.value = file;
  previewing.value = true;
  preview.value = null;
  try {
    preview.value = await systemDataApi.preview(file);
  } catch (error) {
    selectedFile.value = null;
    ElMessage.error(error instanceof Error ? error.message : "数据包校验失败");
  } finally {
    previewing.value = false;
  }
}

async function importPackage() {
  const file = selectedFile.value;
  if (!file || !preview.value) return;
  const updateCount = Object.values(preview.value.counts).reduce((sum, item) => sum + item.existing, 0);
  const newCount = Object.values(preview.value.counts).reduce((sum, item) => sum + item.new, 0);
  try {
    await ElMessageBox.confirm(
      `将新增 ${newCount} 条、覆盖 ${updateCount} 条匹配 ID 的系统数据。数据包缺少的现有记录会保留。私房菜和个人食材不会导入。确认继续吗？`,
      "确认导入系统数据",
      { confirmButtonText: "确认导入", cancelButtonText: "取消", type: "warning" }
    );
  } catch {
    return;
  }

  importing.value = true;
  try {
    const result = await systemDataApi.importPackage(file, createOperationId());
    ElMessage.success(`已导入 ${result.importedCount} 条系统数据`);
    selectedFile.value = null;
    preview.value = null;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "导入失败，数据未写入");
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <section class="system-data-page">
    <el-card shadow="never" class="intro-card">
      <template #header><div class="card-title">系统基础数据同步</div></template>
      <p>通过 JSON 数据包在测试环境和线上环境之间手动同步。首次只允许测试环境同步到线上；完成后只允许线上同步到测试环境。</p>
      <p class="scope-note">只同步系统菜谱、系统食材与其分类、单位和营养资料。私房菜、个人食材、用户账号及其数据不会进入数据包。</p>
      <p class="scope-note">菜谱中的图片地址会随数据导出；图片文件本身不包含在 JSON 包中。</p>
      <div class="actions">
        <el-button type="primary" :loading="exporting" @click="exportPackage">
          <el-icon><Download /></el-icon>
          导出数据包
        </el-button>
        <el-button :loading="previewing" @click="chooseFile">
          <el-icon><Upload /></el-icon>
          选择数据包并校验
        </el-button>
      </div>
      <input ref="fileInput" class="hidden-input" type="file" accept="application/json,.json" @change="handleFileChange" />
    </el-card>

    <el-card v-if="preview" shadow="never" class="preview-card">
      <template #header>
        <div class="preview-heading">
          <span class="card-title">导入预览</span>
          <span class="file-name">{{ selectedFile?.name }}</span>
        </div>
      </template>
      <el-alert :title="`数据包格式：${preview.schemaVersion}；目标：${environmentName(preview.targetEnvironment)}`" type="info" :closable="false" />
      <el-alert v-if="preview.conflicts.length" class="conflict-alert" title="发现 ID 冲突，不能安全导入" type="error" :closable="false">
        <ul>
          <li v-for="conflict in preview.conflicts" :key="conflict">{{ conflict }}</li>
        </ul>
      </el-alert>
      <el-table :data="previewRows" class="preview-table">
        <el-table-column prop="label" label="数据类型" min-width="180" />
        <el-table-column prop="total" label="数据包记录" width="130" />
        <el-table-column prop="new" label="新增" width="100" />
        <el-table-column prop="existing" label="匹配并覆盖" width="120" />
      </el-table>
      <div class="preview-footer">
        <span>导入采用事务写入；任一数据冲突都会整体回滚。未包含的目标记录保留。</span>
        <el-button type="danger" :loading="importing" :disabled="preview.conflicts.length > 0" @click="importPackage">确认导入</el-button>
      </div>
    </el-card>
  </section>
</template>

<style scoped>
.system-data-page {
  display: grid;
  gap: 16px;
}

.card-title {
  color: #1f2937;
  font-size: 16px;
  font-weight: 650;
}

.intro-card p {
  margin: 0 0 10px;
  color: #606266;
  line-height: 1.65;
}

.intro-card .scope-note {
  color: #909399;
  font-size: 13px;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}

.hidden-input {
  display: none;
}

.preview-heading,
.preview-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.file-name {
  color: #909399;
  font-size: 13px;
}

.preview-table {
  margin: 16px 0;
}

.conflict-alert {
  margin-top: 12px;
}

.conflict-alert ul {
  margin: 4px 0 0;
  padding-left: 20px;
}

.preview-footer {
  color: #909399;
  font-size: 13px;
}
</style>
