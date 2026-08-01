<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { FolderAdd } from "@element-plus/icons-vue";
import { recipeApi, type AdminInspirationCategorySummary, type RecipeImportJobSummary } from "@/apis/recipe";
import type { UUID } from "@/apis/http";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";
import { formatStatusText } from "@/utils/status";

const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const jobs = ref<RecipeImportJobSummary[]>([]);
const total = ref(0);
const categories = ref<AdminInspirationCategorySummary[]>([]);

const query = reactive({
  page: 1,
  pageSize: 20,
  status: "" as "" | RecipeImportJobSummary["status"]
});

const form = reactive({
  inspirationCategoryId: "" as UUID | "",
  file: null as File | null
});

const selectedFileName = computed(() => form.file?.name || "未选择文件");
useAdminHeaderRefresh(() => {
  void loadPage();
});

async function loadCategories() {
  categories.value = await recipeApi.listInspirationCategories();
}

async function loadJobs() {
  loading.value = true;
  try {
    const result = await recipeApi.listImportJobs({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status || undefined
    });
    jobs.value = result.items;
    total.value = result.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载导入任务失败");
  } finally {
    loading.value = false;
  }
}

async function loadPage() {
  try {
    await Promise.all([loadCategories(), loadJobs()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载导入中心失败");
  }
}

function handleStatusChange() {
  query.page = 1;
  void loadJobs();
}

function openDialog() {
  form.inspirationCategoryId = "";
  form.file = null;
  dialogVisible.value = true;
}

function chooseFile() {
  fileInput.value?.click();
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  form.file = input.files?.[0] ?? null;
  input.value = "";
}

async function submitImport() {
  if (!form.file) {
    ElMessage.error("请选择 markdown 或 zip 文件");
    return;
  }
  saving.value = true;
  try {
    const job = await recipeApi.createImportJob({
      operationId: createOperationId(),
      file: form.file,
      inspirationCategoryId: form.inspirationCategoryId || null
    });
    ElMessage.success("导入任务已创建");
    dialogVisible.value = false;
    await router.push(`/recipes/imports/${job.id}`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "创建导入任务失败");
  } finally {
    saving.value = false;
  }
}

function openJob(jobId: UUID) {
  void router.push(`/recipes/imports/${jobId}`);
}

onMounted(() => {
  void loadPage();
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel page-toolbar">
      <el-select v-model="query.status" class="toolbar-select" placeholder="全部状态" @change="handleStatusChange">
        <el-option label="全部状态" value="" />
        <el-option label="处理中" value="RUNNING" />
        <el-option label="待补全 / 可发布" value="READY" />
        <el-option label="已完成" value="COMPLETED" />
        <el-option label="失败" value="FAILED" />
      </el-select>
      <el-button type="primary" :icon="FolderAdd" @click="openDialog">导入 markdown / zip</el-button>
    </div>

    <div v-loading="loading" class="table-panel">
      <el-table :data="jobs">
        <el-table-column prop="sourceName" label="来源文件" min-width="260" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.status === 'FAILED' ? 'danger' : row.status === 'COMPLETED' ? 'success' : 'warning'">
              {{ formatStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="totalCount" label="条目数" width="90" />
        <el-table-column prop="readyCount" label="可发布" width="90" />
        <el-table-column prop="needsFixCount" label="待补全" width="90" />
        <el-table-column prop="failedCount" label="失败" width="80" />
        <el-table-column prop="updatedAt" label="最近更新时间" width="200" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openJob(row.id)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :total="total"
          :current-page="query.page"
          :page-size="query.pageSize"
          @current-change="(value: number) => { query.page = value; loadJobs(); }"
        />
      </div>
    </div>

    <el-dialog v-model="dialogVisible" title="创建导入任务" width="520px">
      <el-form label-position="top">
        <el-form-item label="默认系统菜谱分类">
          <el-select v-model="form.inspirationCategoryId" placeholder="可不选，留待条目页逐条补">
            <el-option label="不预设分类" value="" />
            <el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="导入文件" required>
          <div class="upload-box">
            <div class="upload-box__name">{{ selectedFileName }}</div>
            <div class="upload-box__hint">支持 `.md` 或 `.zip`。zip 内按 markdown 相对路径读取同目录图片。</div>
            <el-button @click="chooseFile">选择文件</el-button>
            <input ref="fileInput" class="hidden-input" type="file" accept=".md,.zip" @change="handleFileChange" />
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitImport">开始导入</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped lang="scss">
.upload-box {
  display: grid;
  gap: 10px;
  padding: 16px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
}

.upload-box__name {
  font-weight: 600;
  color: #111827;
}

.upload-box__hint {
  font-size: 13px;
  color: #6b7280;
}

.hidden-input {
  display: none;
}
</style>
