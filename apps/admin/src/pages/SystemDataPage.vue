<script setup lang="ts">
import { computed, ref } from "vue";
import { Download, Upload } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { systemDataApi, systemDataCategories, type SystemDataCategory, type SystemDataPreview } from "@/apis/system-data";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";

const exporting = ref(false);
const previewing = ref(false);
const importing = ref(false);
const preview = ref<SystemDataPreview | null>(null);
const selectedFile = ref<File | null>(null);
const selectedCategories = ref<SystemDataCategory[]>([
  "users", "medals", "recipeCategories", "recipes", "ingredientCategories", "systemIngredients", "articles", "articleChannels"
]);
const fileInput = ref<HTMLInputElement | null>(null);

const sectionLabels: Record<string, string> = {
  users: "用户及个人数据",
  medals: "勋章",
  recipeCategories: "菜谱分类",
  recipes: "菜谱",
  ingredientCategories: "食材分类",
  systemIngredients: "系统食材",
  nutrientFoods: "食材营养表",
  units: "单位",
  articles: "文章",
  articleChannels: "文章栏目"
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

function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function exportPackage() {
  if (!selectedCategories.value.length) {
    ElMessage.warning("请至少选择一个数据类别");
    return;
  }
  exporting.value = true;
  try {
    const blob = await systemDataApi.exportPackage(selectedCategories.value);
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(`cook-data-snapshot-${date}.zip`, blob);
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
  if (!file.name.toLowerCase().endsWith(".zip")) {
    ElMessage.warning("请选择 ZIP 快照包");
    return;
  }
  if (file.size > 200 * 1024 * 1024) {
    ElMessage.warning("快照包不能超过 200 MB");
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
  const removeCount = Object.values(preview.value.counts).reduce((sum, item) => sum + item.removed, 0);
  try {
    await ElMessageBox.confirm(
      `将新增 ${newCount} 条、覆盖 ${updateCount} 条，并清理本地多出的 ${removeCount} 条所选类别记录；未选类别保持不变。确认导入快照吗？`,
      "确认替换所选数据",
      { confirmButtonText: "确认导入", cancelButtonText: "取消", type: "warning" }
    );
  } catch {
    return;
  }

  importing.value = true;
  try {
    const result = await systemDataApi.importPackage(file, preview.value.previewFingerprint, createOperationId());
    ElMessage.success(`已导入 ${result.importedCount} 条，清理 ${result.removedCount} 条本地记录`);
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
      <template #header><div class="card-title">数据快照同步</div></template>
      <p>选择要导出的类别，生成某一时间点的线上快照，再导入本地测试环境。首次只允许测试环境同步到线上；完成后只允许线上同步到测试环境。</p>
      <p class="scope-note">导入会替换快照所选类别并清理本地多出的对应记录；未选类别保持不变。用户快照保留手机号和业务数据，不复制线上密码、微信身份、会话、提醒任务或分享凭据；测试环境已有本地分享记录保留。</p>
      <p class="scope-note">用户快照包含快照账号自己的个人食材和单位；目标环境独有账号及其个人数据会受到保护。若用户快照可能清理本地独有账号，预览会阻止导入；要同步其他类别，请取消勾选“用户及个人数据”后重新导出。</p>
      <p class="scope-note">菜谱与文章所引用的图片文件会随快照复制到目标环境。低频更新的营养表和单位可按需选择。</p>
      <div class="category-selection">
        <div class="category-heading">导出类别</div>
        <el-checkbox-group v-model="selectedCategories" class="category-grid">
          <el-checkbox v-for="category in systemDataCategories" :key="category.key" :value="category.key">
            <span>{{ category.label }}</span>
            <small>{{ category.description }}</small>
          </el-checkbox>
        </el-checkbox-group>
      </div>
      <div class="actions">
        <el-button type="primary" :loading="exporting" :disabled="!selectedCategories.length" @click="exportPackage">
          <el-icon><Download /></el-icon>
          导出快照包
        </el-button>
        <el-button :loading="previewing" @click="chooseFile">
          <el-icon><Upload /></el-icon>
          选择快照包并校验
        </el-button>
      </div>
      <input ref="fileInput" class="hidden-input" type="file" accept=".zip,application/zip" @change="handleFileChange" />
    </el-card>

    <el-card v-if="preview" shadow="never" class="preview-card">
      <template #header>
        <div class="preview-heading">
          <span class="card-title">导入预览</span>
          <span class="file-name">{{ selectedFile?.name }}</span>
        </div>
      </template>
      <el-alert :title="`快照格式：${preview.schemaVersion}；目标：${environmentName(preview.targetEnvironment)}；图片文件 ${preview.assetCount} 个`" type="info" :closable="false" />
      <el-alert v-if="preview.missingDependencies.length" class="conflict-alert" title="缺少必要的数据类别或目标依赖" type="warning" :closable="false">
        <ul>
          <li v-for="item in preview.missingDependencies" :key="`${item.category}:${item.label}`">
            {{ item.label }}：缺少 {{ item.count }} 条<span v-if="item.category === 'unknown'">（测试环境需先存在该依赖，或取消涉及它的类别）</span><span v-else>（{{ sectionLabels[item.category] ?? item.category }}；补选该类别后重新导出）</span>
          </li>
        </ul>
      </el-alert>
      <el-alert v-if="preview.conflicts.length" class="conflict-alert" title="存在阻断项，不能安全导入" type="error" :closable="false">
        <ul>
          <li v-for="conflict in preview.conflicts" :key="conflict">{{ conflict }}</li>
        </ul>
      </el-alert>
      <el-table :data="previewRows" class="preview-table">
        <el-table-column prop="label" label="数据类型" min-width="180" />
        <el-table-column prop="total" label="快照记录" width="110" />
        <el-table-column prop="new" label="新增" width="100" />
        <el-table-column prop="existing" label="覆盖" width="90" />
        <el-table-column prop="removed" label="清理本地" width="100" />
      </el-table>
      <div class="preview-footer">
        <span>导入采用事务写入；任一数据冲突都会整体回滚。未选类别保持不变。</span>
        <el-button type="danger" :loading="importing" :disabled="preview.conflicts.length > 0 || preview.missingDependencies.length > 0" @click="importPackage">确认替换</el-button>
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

.category-selection {
  margin-top: 18px;
  padding: 14px 16px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
}

.category-heading {
  margin-bottom: 10px;
  color: #303133;
  font-size: 14px;
  font-weight: 600;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(240px, 1fr));
  gap: 8px 16px;
}

.category-grid :deep(.el-checkbox) {
  height: auto;
  min-height: 32px;
  margin-right: 0;
}

.category-grid :deep(.el-checkbox__label) {
  display: inline-grid;
  gap: 2px;
  white-space: normal;
}

.category-grid small {
  color: #909399;
  font-size: 12px;
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
