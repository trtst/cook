<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Delete, Picture, Refresh, Upload } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { publicConfigApi } from "@/apis/public-config";
import { createOperationId } from "@/utils/operation-id";

const loading = ref(false);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const imageUrl = ref("");
const imageVersion = ref(0);

const previewUrl = computed(() => (imageUrl.value ? `${imageUrl.value}${imageUrl.value.includes("?") ? "&" : "?"}t=${imageVersion.value}` : ""));

async function loadConfig() {
  loading.value = true;
  try {
    const result = await publicConfigApi.getConfig();
    imageUrl.value = result.login.imageUrl || "";
    imageVersion.value = Date.now();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载公共配置失败");
  } finally {
    loading.value = false;
  }
}

function chooseFile() {
  if (uploading.value) return;
  fileInput.value?.click();
}

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = "";
  if (!file) return;

  uploading.value = true;
  try {
    const result = await publicConfigApi.uploadLoginImage(file, createOperationId());
    imageUrl.value = result.login.imageUrl || "";
    imageVersion.value = Date.now();
    ElMessage.success("登录图已更新");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "上传失败");
  } finally {
    uploading.value = false;
  }
}

async function clearImage() {
  try {
    await ElMessageBox.confirm("清空后客户端会回退到项目内默认登录图。", "确认清空", {
      type: "warning",
      confirmButtonText: "清空",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }

  uploading.value = true;
  try {
    const result = await publicConfigApi.clearLoginImage(createOperationId());
    imageUrl.value = result.login.imageUrl || "";
    imageVersion.value = Date.now();
    ElMessage.success("已恢复默认图");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "清空失败");
  } finally {
    uploading.value = false;
  }
}

onMounted(() => {
  void loadConfig();
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel">
      <el-button type="primary" :icon="Upload" :loading="uploading" @click="chooseFile">上传 / 替换登录图</el-button>
      <el-button :icon="Refresh" :loading="loading" @click="loadConfig">刷新</el-button>
      <el-button :icon="Delete" :disabled="!imageUrl || uploading" @click="clearImage">清空恢复默认</el-button>
      <input ref="fileInput" class="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" @change="handleFileChange" />
    </div>

    <div class="table-panel config-panel" v-loading="loading">
      <div class="config-panel__header">
        <div>
          <h3>登录弹窗图片</h3>
          <p>客户端启动会读取公共配置；若后台未配置或图片失效，则回退项目内默认登录图。</p>
        </div>
      </div>

      <div v-if="previewUrl" class="config-preview">
        <img :src="previewUrl" alt="登录弹窗预览图" class="config-preview__image" />
      </div>

      <el-empty v-else :image-size="120" description="当前未配置登录图，客户端会使用默认图">
        <template #image>
          <el-icon size="72"><Picture /></el-icon>
        </template>
      </el-empty>
    </div>
  </section>
</template>

<style scoped>
.config-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.config-panel__header h3 {
  margin: 0 0 8px;
  color: #1f2937;
  font-size: 20px;
}

.config-panel__header p {
  margin: 0;
  color: #6b7280;
  line-height: 1.6;
}

.config-preview {
  max-width: 360px;
  padding: 20px;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  background: linear-gradient(180deg, #fff9f4, #f7faf8);
}

.config-preview__image {
  display: block;
  width: 100%;
  border-radius: 24px;
  object-fit: cover;
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.12);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
