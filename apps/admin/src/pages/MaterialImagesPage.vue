<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { CopyDocument, Delete, Picture, Upload } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { materialImagesApi, type AdminMaterialImageItem } from "@/apis/material-images";
import { adminAppConfig } from "@/apis/config";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";

const loading = ref(false);
const uploading = ref(false);
const deletingId = ref<number | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const uploadDialogOpen = ref(false);
const note = ref("");
const selectedFile = ref<File | null>(null);
const previewUrl = ref("");
const items = ref<AdminMaterialImageItem[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const canUpload = computed(() => Boolean(selectedFile.value) && note.value.trim().length > 0 && !uploading.value);

useAdminHeaderRefresh(() => {
  void loadImages();
});

function fileSizeText(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function dateText(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function copyableImageUrl(imageUrl: string) {
  try {
    const url = new URL(imageUrl);
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      const publicPath = `${url.pathname}${url.search}${url.hash}`;
      const publicBaseUrl = adminAppConfig.assetPublicBaseUrl.trim().replace(/\/+$/u, "");
      return publicBaseUrl ? `${publicBaseUrl}${publicPath}` : publicPath;
    }
  } catch {
    return imageUrl;
  }
  return imageUrl;
}

function chooseFile() {
  if (uploading.value) return;
  fileInput.value?.click();
}

function openUploadDialog() {
  if (uploading.value) return;
  uploadDialogOpen.value = true;
}

function clearPreviewUrl() {
  if (!previewUrl.value) return;
  URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = "";
}

function resetUploadForm() {
  selectedFile.value = null;
  note.value = "";
  clearPreviewUrl();
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  clearPreviewUrl();
  selectedFile.value = file;
  if (file) {
    previewUrl.value = URL.createObjectURL(file);
  }
  input.value = "";
}

async function loadImages() {
  loading.value = true;
  try {
    const result = await materialImagesApi.list({ page: page.value, pageSize: pageSize.value });
    items.value = result.items;
    total.value = result.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载图片素材失败");
  } finally {
    loading.value = false;
  }
}

async function uploadImage() {
  const file = selectedFile.value;
  const cleanNote = note.value.trim();
  if (!file || !cleanNote) {
    ElMessage.warning("请先选择图片并填写备注");
    return;
  }

  uploading.value = true;
  try {
    await materialImagesApi.upload(file, cleanNote, createOperationId());
    ElMessage.success("图片素材已上传");
    uploadDialogOpen.value = false;
    resetUploadForm();
    page.value = 1;
    await loadImages();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "上传图片素材失败");
  } finally {
    uploading.value = false;
  }
}

async function copyUrl(item: AdminMaterialImageItem) {
  try {
    await navigator.clipboard.writeText(copyableImageUrl(item.imageUrl));
    ElMessage.success("图片地址已复制");
  } catch {
    ElMessage.error("复制失败，请手动复制图片地址");
  }
}

async function deleteImage(item: AdminMaterialImageItem) {
  try {
    await ElMessageBox.confirm("删除后，已使用该地址的前台页面图片会失效。确认删除这个素材？", "删除图片素材", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }

  deletingId.value = item.id;
  try {
    await materialImagesApi.delete(item.id, createOperationId());
    ElMessage.success("图片素材已删除");
    await loadImages();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "删除图片素材失败");
  } finally {
    deletingId.value = null;
  }
}

function handlePageChange(nextPage: number) {
  page.value = nextPage;
  void loadImages();
}

onMounted(() => {
  void loadImages();
});

onBeforeUnmount(() => {
  clearPreviewUrl();
});
</script>

<template>
  <section class="page-stack">
    <section class="material-page-actions">
      <el-button type="primary" :icon="Upload" @click="openUploadDialog">上传图片</el-button>
    </section>

    <section class="table-panel">
      <el-table v-loading="loading" :data="items" row-key="id">
        <el-table-column label="图片" width="124">
          <template #default="{ row }">
            <div class="material-thumb">
              <img :src="row.imageUrl" :alt="row.note" />
            </div>
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="180" prop="note" />
        <el-table-column label="尺寸" width="120">
          <template #default="{ row }">{{ row.width }}x{{ row.height }}</template>
        </el-table-column>
        <el-table-column label="大小" width="96">
          <template #default="{ row }">{{ fileSizeText(row.sizeBytes) }}</template>
        </el-table-column>
        <el-table-column label="上传人" width="120">
          <template #default="{ row }">{{ row.uploader.displayName }}</template>
        </el-table-column>
        <el-table-column label="上传时间" width="180">
          <template #default="{ row }">{{ dateText(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="144" fixed="right">
          <template #default="{ row }">
            <el-button :icon="CopyDocument" circle @click="copyUrl(row)" />
            <el-button :icon="Delete" circle type="danger" :loading="deletingId === row.id" @click="deleteImage(row)" />
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无图片素材" />
        </template>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          background
          layout="prev, pager, next"
          :page-size="pageSize"
          :current-page="page"
          :total="total"
          @current-change="handlePageChange"
        />
      </div>
    </section>

    <el-dialog v-model="uploadDialogOpen" title="上传图片素材" width="560px" :close-on-click-modal="!uploading" @closed="resetUploadForm">
      <div class="material-dialog">
        <input ref="fileInput" class="material-file-input" type="file" accept="image/png,image/jpeg,image/webp" @change="handleFileChange" />
        <button class="material-dialog-preview" type="button" :disabled="uploading" @click="chooseFile">
          <img v-if="previewUrl" :src="previewUrl" :alt="selectedFile?.name || '图片预览'" />
          <span v-else class="material-dialog-preview__empty">选择图片</span>
        </button>
        <div class="material-dialog__meta">
          <span class="material-dialog__file">{{ selectedFile?.name || "未选择图片" }}</span>
          <el-button :icon="Picture" :disabled="uploading" @click="chooseFile">{{ selectedFile ? "更换图片" : "选择图片" }}</el-button>
        </div>
        <el-input v-model="note" maxlength="120" show-word-limit placeholder="填写备注，例如：首页 header 备用图" />
      </div>
      <template #footer>
        <el-button :disabled="uploading" @click="uploadDialogOpen = false">取消</el-button>
        <el-button type="primary" :disabled="!canUpload" :loading="uploading" @click="uploadImage">上传素材</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.material-page-actions {
  display: flex;
  justify-content: flex-end;
}

.material-thumb {
  width: 88px;
  height: 64px;
  overflow: hidden;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #f5f7fa;
}

.material-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
}

.material-file-input {
  display: none;
}

.material-dialog {
  display: grid;
  gap: 16px;
}

.material-dialog-preview {
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1px dashed #cfd3dc;
  border-radius: 8px;
  background: #f5f7fa;
  color: #606266;
  cursor: pointer;
}

.material-dialog-preview:disabled {
  cursor: not-allowed;
}

.material-dialog-preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #fff;
}

.material-dialog-preview__empty {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.material-dialog__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.material-dialog__file {
  min-width: 0;
  overflow: hidden;
  color: #606266;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
