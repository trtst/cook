<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { ingredientApi, type AdminIngredientCategorySummary } from "@/apis/ingredient";
import { recipeApi, type AdminInspirationCategorySummary } from "@/apis/recipe";
import { imageGenerationApi, type ImageGenerationCandidate, type ImageGenerationProviderId, type ImageGenerationSettings, type ImageGenerationSlot, type ImageGenerationTarget, type ImageGenerationType } from "@/apis/image-generation";
import { requestBlob } from "@/apis/http";
import { createOperationId } from "@/utils/operation-id";

const type = ref<ImageGenerationType>("RECIPE");
const categories = ref<Array<AdminIngredientCategorySummary | AdminInspirationCategorySummary>>([]);
const categoryId = ref<number>();
const missingOnly = ref(true);
const rows = ref<ImageGenerationTarget[]>([]);
const selectedIds = ref(new Set<number>());
const targetCache = reactive(new Map<number, ImageGenerationTarget>());
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const settings = ref<ImageGenerationSettings>({ provider: "ARK_SEEDREAM", version: 1, ingredientKeywords: "", recipeCoverKeywords: "", recipeStepKeywords: "", updatedAt: "" });
const selectedProvider = ref<ImageGenerationProviderId>("ARK_SEEDREAM");
const keywordDrafts = reactive({ ingredientKeywords: "", recipeCoverKeywords: "", recipeStepKeywords: "" });
const promptDrafts = reactive<Record<string, string>>({});
const previewUrls = ref(new Map<number, string>());
const loading = ref(false);
const savingSettings = ref(false);
const savingProvider = ref(false);
const batchRunning = ref(false);
const batchLoadingAction = ref<"missing" | "cover" | null>(null);
const batchReplacing = ref(false);
const replacingRecipeIds = reactive(new Set<number>());
const batchProgress = ref("");

const selectedRows = computed(() => [...selectedIds.value].map(id => targetCache.get(id)).filter((row): row is ImageGenerationTarget => Boolean(row)));
const applicableSelectedSlotCount = computed(() => selectedRows.value.reduce((total, row) => total + row.slots.filter(slot => !slot.imageUrl && !slot.candidate).length, 0));
const applicableSelectedCoverCount = computed(() => selectedRows.value.reduce((total, row) => total + row.slots.filter(slot => slot.targetType === "RECIPE_COVER" && !slot.imageUrl && !slot.candidate).length, 0));
const selectedCandidateCount = computed(() => selectedRows.value.reduce((total, row) => total + row.slots.filter(slot => slot.candidate).length, 0));
const selectedVisibleCount = computed(() => rows.value.filter(row => selectedIds.value.has(row.id)).length);
const anyRecipeReplacing = computed(() => replacingRecipeIds.size > 0);
const selectAllVisible = computed({
  get: () => rows.value.length > 0 && selectedVisibleCount.value === rows.value.length,
  set: (value: boolean) => {
    const next = new Set(selectedIds.value);
    rows.value.forEach(row => value ? next.add(row.id) : next.delete(row.id));
    selectedIds.value = next;
  }
});
const hasPartialSelection = computed(() => selectedVisibleCount.value > 0 && selectedVisibleCount.value < rows.value.length);

function slotKey(slot: ImageGenerationSlot) { return `${slot.targetType}:${slot.targetId}:${slot.contentVersionId}:${slot.stepOrder}`; }
function keywordFor(slot: ImageGenerationSlot) {
  if (slot.targetType === "INGREDIENT") return keywordDrafts.ingredientKeywords;
  return slot.targetType === "RECIPE_COVER" ? keywordDrafts.recipeCoverKeywords : keywordDrafts.recipeStepKeywords;
}
function promptFor(slot: ImageGenerationSlot) {
  const key = slotKey(slot);
  return promptDrafts[key] ?? slot.candidate?.prompt ?? [slot.imagePrompt?.trim(), keywordFor(slot).trim()].filter(Boolean).join("，");
}
function displayTitle(row: ImageGenerationTarget) { return row.title || `#${row.id}`; }
function recipeCandidateCount(row: ImageGenerationTarget) { return row.slots.filter(slot => slot.candidate).length; }

async function loadCategories() {
  categories.value = type.value === "INGREDIENT" ? await ingredientApi.listCategories() : await recipeApi.listInspirationCategories();
}

async function loadSettings() {
  settings.value = await imageGenerationApi.getSettings();
  selectedProvider.value = settings.value.provider;
  keywordDrafts.ingredientKeywords = settings.value.ingredientKeywords;
  keywordDrafts.recipeCoverKeywords = settings.value.recipeCoverKeywords;
  keywordDrafts.recipeStepKeywords = settings.value.recipeStepKeywords;
}

async function loadTargets() {
  loading.value = true;
  try {
    const result = await imageGenerationApi.listTargets({ type: type.value, categoryId: categoryId.value, missingOnly: missingOnly.value, page: page.value, pageSize });
    rows.value = result.items;
    total.value = result.total;
    const retainedRows = [...selectedIds.value].map(id => targetCache.get(id)).filter((row): row is ImageGenerationTarget => Boolean(row));
    targetCache.clear();
    retainedRows.forEach(row => targetCache.set(row.id, row));
    result.items.forEach(row => targetCache.set(row.id, row));
    Object.keys(promptDrafts).forEach(key => { if (!result.items.some(row => row.slots.some(slot => slotKey(slot) === key))) delete promptDrafts[key]; });
    await refreshCandidatePreviews();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "读取生图列表失败");
  } finally { loading.value = false; }
}

function setSelected(id: number, checked: boolean) {
  const next = new Set(selectedIds.value);
  if (checked) next.add(id); else next.delete(id);
  selectedIds.value = next;
}
function onSelectionChange(id: number, value: unknown) { setSelected(id, value === true); }
function onPromptChange(slot: ImageGenerationSlot, value: string) { promptDrafts[slotKey(slot)] = value; }

async function loadCandidatePreview(candidate: ImageGenerationCandidate) {
  const blob = await requestBlob(`/admin/recipe-images/temp/${encodeURIComponent(candidate.tempKey)}`);
  return URL.createObjectURL(blob);
}

function releasePreview(candidateId: number) {
  const oldUrl = previewUrls.value.get(candidateId);
  if (oldUrl) URL.revokeObjectURL(oldUrl);
  previewUrls.value.delete(candidateId);
}

async function refreshCandidatePreviews() {
  const candidates = rows.value.flatMap(row => row.slots.map(slot => slot.candidate).filter((item): item is ImageGenerationCandidate => Boolean(item)));
  const candidateIds = new Set(candidates.map(item => item.id));
  [...previewUrls.value.keys()].forEach(id => { if (!candidateIds.has(id)) releasePreview(id); });
  await Promise.all(candidates.map(async candidate => {
    if (previewUrls.value.has(candidate.id)) return;
    try { previewUrls.value.set(candidate.id, await loadCandidatePreview(candidate)); } catch { /* 临时资源失效时交由下一次刷新或重新生成处理 */ }
  }));
}

async function saveKeywords() {
  savingSettings.value = true;
  try {
    settings.value = await imageGenerationApi.saveSettings({ operationId: createOperationId(), provider: settings.value.provider, version: settings.value.version, ...keywordDrafts });
    selectedProvider.value = settings.value.provider;
    keywordDrafts.ingredientKeywords = settings.value.ingredientKeywords;
    keywordDrafts.recipeCoverKeywords = settings.value.recipeCoverKeywords;
    keywordDrafts.recipeStepKeywords = settings.value.recipeStepKeywords;
    ElMessage.success("共享生图设置已保存");
    Object.keys(promptDrafts).forEach(key => delete promptDrafts[key]);
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : "保存关键词失败"); }
  finally { savingSettings.value = false; }
}

async function saveProviderDefault(provider: ImageGenerationProviderId) {
  if (provider === settings.value.provider) return;
  savingProvider.value = true;
  try {
    settings.value = await imageGenerationApi.saveSettings({
      operationId: createOperationId(),
      provider,
      version: settings.value.version,
      ingredientKeywords: settings.value.ingredientKeywords,
      recipeCoverKeywords: settings.value.recipeCoverKeywords,
      recipeStepKeywords: settings.value.recipeStepKeywords
    });
    selectedProvider.value = settings.value.provider;
    ElMessage.success(`共享默认生图服务已切换为${provider === "ARK_SEEDREAM" ? "Ark Seedream" : "智能绘图通用 3.0"}`);
  } catch (error) {
    selectedProvider.value = settings.value.provider;
    ElMessage.error(error instanceof Error ? error.message : "切换共享生图服务失败");
  } finally { savingProvider.value = false; }
}

async function generateSlot(slot: ImageGenerationSlot, notify = true, failures?: string[]) {
  const reportFailure = (message: string) => {
    if (notify) ElMessage.error(message);
    else failures?.push(`${slot.label}：${message}`);
    return false;
  };
  const prompt = promptFor(slot).trim();
  if (!prompt) return reportFailure("请先填写当前图片的关键词");
  try {
    const candidate = await imageGenerationApi.generate({ targetType: slot.targetType, targetId: slot.targetId, ...(slot.contentVersionId > 0 ? { contentVersionId: slot.contentVersionId } : {}), ...(slot.stepOrder > 0 ? { stepOrder: slot.stepOrder } : {}), prompt, operationId: createOperationId() });
    const url = await loadCandidatePreview(candidate);
    const existingId = slot.candidate?.id;
    if (existingId) releasePreview(existingId);
    previewUrls.value.set(candidate.id, url);
    slot.candidate = candidate;
    if (notify) ElMessage.success(`${slot.label}候选图已生成`);
    return true;
  } catch (error) { return reportFailure(error instanceof Error ? error.message : "生成失败"); }
}

async function generateSelected() {
  if (!selectedRows.value.length) { ElMessage.warning("请先选择食材或菜谱"); return; }
  const slots = selectedRows.value.flatMap(row => row.slots.filter(slot => !slot.imageUrl && !slot.candidate));
  if (!slots.length) { ElMessage.info("所选内容没有缺图位置"); return; }
  if (batchReplacing.value || anyRecipeReplacing.value) return;
  batchRunning.value = true;
  batchLoadingAction.value = "missing";
  let completed = 0;
  const failures: string[] = [];
  try {
    const batchSize = 3;
    for (let offset = 0; offset < slots.length; offset += batchSize) {
      const batch = slots.slice(offset, offset + batchSize);
      batchProgress.value = `${offset + 1}-${offset + batch.length}/${slots.length}`;
      const results = await Promise.all(batch.map(slot => generateSlot(slot, false, failures)));
      completed += results.filter(Boolean).length;
    }
    await loadTargets();
    if (failures.length) ElMessage.error(`生成 ${completed}/${slots.length} 张候选图；失败 ${failures.length} 张。${failures[0]}`);
    else ElMessage.success(`成功生成 ${completed}/${slots.length} 张候选图`);
  } finally { batchRunning.value = false; batchLoadingAction.value = null; batchProgress.value = ""; }
}

async function generateSelectedCovers() {
  if (type.value !== "RECIPE" || !selectedRows.value.length) { ElMessage.warning("请先选择菜谱"); return; }
  const slots = selectedRows.value.flatMap(row => row.slots.filter(slot => slot.targetType === "RECIPE_COVER" && !slot.imageUrl && !slot.candidate));
  if (!slots.length) { ElMessage.info("所选菜谱没有待生成的封面图"); return; }
  if (batchReplacing.value || anyRecipeReplacing.value) return;
  batchRunning.value = true;
  batchLoadingAction.value = "cover";
  let completed = 0;
  const failures: string[] = [];
  try {
    const batchSize = 3;
    for (let offset = 0; offset < slots.length; offset += batchSize) {
      const batch = slots.slice(offset, offset + batchSize);
      batchProgress.value = `${offset + 1}-${offset + batch.length}/${slots.length}`;
      const results = await Promise.all(batch.map(slot => generateSlot(slot, false, failures)));
      completed += results.filter(Boolean).length;
    }
    await loadTargets();
    if (failures.length) ElMessage.error(`封面候选图生成 ${completed}/${slots.length} 张；失败 ${failures.length} 张。${failures[0]}`);
    else ElMessage.success(`成功生成 ${completed}/${slots.length} 张封面候选图`);
  } finally { batchRunning.value = false; batchLoadingAction.value = null; batchProgress.value = ""; }
}

async function applyCandidates(candidates: ImageGenerationCandidate[], targetLabel: string) {
  const uniqueCandidates = [...new Map(candidates.map(candidate => [candidate.id, candidate])).values()];
  let appliedCount = 0;
  const failures: string[] = [];
  for (const candidate of uniqueCandidates) {
    try {
      await imageGenerationApi.applyCandidate(candidate.id, { operationId: createOperationId() });
      appliedCount += 1;
      releasePreview(candidate.id);
      targetCache.forEach(row => row.slots.forEach(slot => {
        if (slot.candidate?.id === candidate.id) slot.candidate = null;
      }));
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "回填失败");
    }
  }
  await loadTargets();
  if (failures.length) {
    ElMessage.warning(`${targetLabel}：已替换 ${appliedCount}/${uniqueCandidates.length} 张，${failures.length} 张失败：${failures[0]}`);
  } else {
    ElMessage.success(`${targetLabel}：已替换 ${appliedCount} 张图片`);
  }
}

async function replaceSelectedCandidates() {
  if (type.value !== "RECIPE" || !selectedCandidateCount.value || batchRunning.value || batchReplacing.value || anyRecipeReplacing.value) return;
  const candidates = selectedRows.value.flatMap(row => row.slots.flatMap(slot => slot.candidate ? [slot.candidate] : []));
  batchReplacing.value = true;
  try {
    await ElMessageBox.confirm(`将回填所选菜谱中的 ${candidates.length} 张候选图。`, "一键替换所选", { type: "warning", confirmButtonText: "确认替换" });
    await applyCandidates(candidates, "所选菜谱");
  } catch (error) {
    if (error !== "cancel" && error !== "close") ElMessage.error(error instanceof Error ? error.message : "批量替换失败");
  } finally { batchReplacing.value = false; }
}

async function replaceRecipeCandidates(row: ImageGenerationTarget) {
  if (type.value !== "RECIPE" || replacingRecipeIds.has(row.id) || batchRunning.value || batchReplacing.value) return;
  const candidates = row.slots.flatMap(slot => slot.candidate ? [slot.candidate] : []);
  if (!candidates.length) return;
  replacingRecipeIds.add(row.id);
  try {
    await ElMessageBox.confirm(`将回填“${displayTitle(row)}”的 ${candidates.length} 张候选图。`, "一键替换菜谱图片", { type: "warning", confirmButtonText: "确认替换" });
    await applyCandidates(candidates, displayTitle(row));
  } catch (error) {
    if (error !== "cancel" && error !== "close") ElMessage.error(error instanceof Error ? error.message : "菜谱图片替换失败");
  } finally { replacingRecipeIds.delete(row.id); }
}

async function applyCandidate(slot: ImageGenerationSlot, row: ImageGenerationTarget) {
  if (!slot.candidate) return;
  try {
    await ElMessageBox.confirm(`确认将候选图替换到“${displayTitle(row)} · ${slot.label}”吗？`, "替换图片", { type: "warning", confirmButtonText: "确认替换" });
    await imageGenerationApi.applyCandidate(slot.candidate.id, { operationId: createOperationId(), ...(type.value === "INGREDIENT" && row.version ? { expectedVersion: row.version } : {}) });
    releasePreview(slot.candidate.id);
    await loadTargets();
    ElMessage.success("图片已替换");
  } catch (error) { if (error !== "cancel" && error !== "close") ElMessage.error(error instanceof Error ? error.message : "回填失败"); }
}

async function deleteCandidate(slot: ImageGenerationSlot) {
  if (!slot.candidate) return;
  try {
    await imageGenerationApi.deleteCandidate(slot.candidate.id, createOperationId());
    releasePreview(slot.candidate.id);
    slot.candidate = null;
    ElMessage.success("候选图已删除");
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : "删除候选图失败"); }
}

watch(type, async () => {
  categoryId.value = undefined;
  selectedIds.value = new Set();
  targetCache.clear();
  page.value = 1;
  Object.keys(promptDrafts).forEach(key => delete promptDrafts[key]);
  await Promise.all([loadCategories(), loadSettings()]);
  await loadTargets();
});
watch([categoryId, missingOnly], () => {
  selectedIds.value = new Set();
  targetCache.clear();
  if (page.value !== 1) page.value = 1;
  else void loadTargets();
});
watch(page, () => void loadTargets());
onMounted(async () => { await Promise.all([loadCategories(), loadSettings()]); await loadTargets(); });
onBeforeUnmount(() => { [...previewUrls.value.keys()].forEach(releasePreview); });
</script>

<template>
  <section class="image-generation-page">
    <header class="page-heading">
      <div><h1>图片生成</h1><p>按食材或菜谱查看图片位置，生成候选图后确认替换。</p></div>
      <el-tag type="warning" effect="plain">临时工作台</el-tag>
    </header>

    <el-card shadow="never" class="toolbar-card">
      <div class="toolbar-row">
        <el-radio-group v-model="type" aria-label="生图类型">
          <el-radio-button value="RECIPE">食谱</el-radio-button>
          <el-radio-button value="INGREDIENT">食材</el-radio-button>
        </el-radio-group>
        <el-select v-model="categoryId" clearable placeholder="全部分类" class="category-select">
          <el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <el-checkbox v-model="missingOnly">仅显示缺图片</el-checkbox>
        <span class="provider-label">共享生图服务</span>
        <el-select v-model="selectedProvider" class="provider-select" :loading="savingProvider" :disabled="savingProvider || savingSettings || batchRunning || batchReplacing || anyRecipeReplacing" @change="saveProviderDefault">
          <el-option label="Ark Seedream" value="ARK_SEEDREAM" />
          <el-option label="智能绘图通用 3.0" value="VOLCENGINE_CV" />
        </el-select>
        <span class="toolbar-spacer" />
        <el-button v-if="type === 'RECIPE'" type="success" plain :loading="batchLoadingAction === 'cover'" :disabled="batchRunning || batchReplacing || anyRecipeReplacing || !selectedRows.length || !applicableSelectedCoverCount" @click="generateSelectedCovers">
          生成所选封面图 ({{ applicableSelectedCoverCount }})
        </el-button>
        <el-button type="primary" :loading="batchLoadingAction === 'missing'" :disabled="batchRunning || batchReplacing || anyRecipeReplacing || !selectedRows.length" @click="generateSelected">
          生成所选缺图 ({{ applicableSelectedSlotCount }})
        </el-button>
        <el-button v-if="type === 'RECIPE'" type="success" plain :loading="batchReplacing" :disabled="batchReplacing || batchRunning || anyRecipeReplacing || !selectedCandidateCount" @click="replaceSelectedCandidates">
          一键替换所选 ({{ selectedCandidateCount }})
        </el-button>
      </div>
      <div v-if="type === 'INGREDIENT'" class="keywords-row">
        <div class="keywords-label"><strong>食材通用关键词</strong><span>保存后用于之后生成的食材图片。</span></div>
        <el-input v-model="keywordDrafts.ingredientKeywords" type="textarea" :rows="2" maxlength="1000" show-word-limit placeholder="输入食材图片通用的画面要求" />
        <el-button :loading="savingSettings" :disabled="savingProvider" @click="saveKeywords">保存共享设置</el-button>
      </div>
      <div v-else class="keywords-row recipe-keywords-row">
        <div class="keyword-field">
          <div class="keywords-label"><strong>封面通用关键词</strong><span>用于食谱封面图片。</span></div>
          <el-input v-model="keywordDrafts.recipeCoverKeywords" type="textarea" :rows="2" maxlength="1000" show-word-limit placeholder="输入食谱封面图通用的画面要求" />
        </div>
        <div class="keyword-field">
          <div class="keywords-label"><strong>步骤通用关键词</strong><span>普通步骤图和 Wiki 步骤图共用。</span></div>
          <el-input v-model="keywordDrafts.recipeStepKeywords" type="textarea" :rows="2" maxlength="1000" show-word-limit placeholder="输入食谱步骤图通用的画面要求" />
        </div>
        <el-button :loading="savingSettings" :disabled="savingProvider" @click="saveKeywords">保存共享设置</el-button>
      </div>
      <div class="filter-row"><el-checkbox v-model="selectAllVisible" :indeterminate="hasPartialSelection">选择当前页</el-checkbox><span>已选 {{ selectedRows.length }} 项</span><span v-if="batchProgress" class="progress-text">正在生成 {{ batchProgress }}</span></div>
    </el-card>

    <div v-loading="loading" class="target-list">
      <el-empty v-if="!loading && rows.length === 0" description="没有符合条件的内容" />
      <el-card v-for="row in rows" :key="row.id" shadow="never" class="target-card">
        <template #header>
          <div class="target-heading">
            <el-checkbox :model-value="selectedIds.has(row.id)" @change="onSelectionChange(row.id, $event)" />
            <strong>{{ displayTitle(row) }}</strong>
            <el-tag size="small" effect="plain">{{ row.categoryName }}</el-tag>
            <el-tag v-if="row.missingCount" size="small" type="warning">缺 {{ row.missingCount }} 张</el-tag>
            <span class="target-id">ID {{ row.id }}</span>
            <el-button v-if="type === 'RECIPE' && recipeCandidateCount(row)" size="small" type="success" plain :loading="replacingRecipeIds.has(row.id)" :disabled="batchRunning || batchReplacing || replacingRecipeIds.has(row.id)" @click="replaceRecipeCandidates(row)">
              一键替换 ({{ recipeCandidateCount(row) }})
            </el-button>
          </div>
        </template>
        <div class="slot-grid">
          <article v-for="slot in row.slots" :key="slotKey(slot)" class="slot-card">
            <div class="slot-label">{{ slot.label }}</div>
            <div class="image-pair">
              <div class="image-preview"><img v-if="slot.imageUrl" :src="slot.imageUrl" alt="当前图片"><div v-else class="image-empty">暂无图片</div><span>当前</span></div>
              <div class="image-preview"><img v-if="slot.candidate && previewUrls.get(slot.candidate.id)" :src="previewUrls.get(slot.candidate.id)" alt="生图候选"><div v-else class="image-empty">暂无候选</div><span>候选预览</span></div>
            </div>
            <el-input :model-value="promptFor(slot)" type="textarea" :rows="2" maxlength="1000" placeholder="当前图片关键词，可修改" @update:model-value="onPromptChange(slot, $event)" />
            <div class="slot-actions">
              <el-button size="small" type="primary" :loading="batchRunning" :disabled="batchReplacing || replacingRecipeIds.has(row.id)" @click="generateSlot(slot)">{{ slot.candidate ? "重新生成" : "生成" }}</el-button>
              <el-button v-if="slot.candidate" size="small" type="success" :disabled="batchRunning || batchReplacing || replacingRecipeIds.has(row.id)" @click="applyCandidate(slot, row)">替换图片</el-button>
              <el-button v-if="slot.candidate" size="small" type="danger" plain :disabled="batchRunning || batchReplacing || replacingRecipeIds.has(row.id)" @click="deleteCandidate(slot)">删除候选</el-button>
            </div>
          </article>
        </div>
      </el-card>
    </div>
    <el-pagination v-if="total > pageSize" v-model:current-page="page" :page-size="pageSize" :total="total" layout="total, prev, pager, next" />
  </section>
</template>

<style scoped>
.image-generation-page{display:flex;flex-direction:column;gap:16px}.page-heading,.toolbar-row,.filter-row,.target-heading,.keywords-row,.slot-actions{display:flex;align-items:center;gap:12px}.page-heading{justify-content:space-between}.page-heading h1{margin:0;font-size:22px}.page-heading p{margin:6px 0 0;color:var(--el-text-color-secondary)}.toolbar-card{position:sticky;top:0;z-index:2}.toolbar-row{flex-wrap:wrap}.toolbar-spacer{flex:1}.category-select{width:190px}.provider-label{font-size:13px;color:var(--el-text-color-secondary)}.provider-select{width:210px}.keywords-row{margin-top:18px;align-items:flex-end}.keywords-label{display:flex;flex-direction:column;gap:5px;min-width:220px}.keywords-label span,.target-id{font-size:12px;color:var(--el-text-color-secondary)}.keywords-row :deep(.el-textarea){flex:1}.recipe-keywords-row{align-items:flex-end}.keyword-field{display:flex;flex:1;min-width:220px;flex-direction:column;gap:7px}.filter-row{margin-top:14px;padding-top:12px;border-top:1px solid var(--el-border-color-lighter);font-size:13px;color:var(--el-text-color-secondary)}.progress-text{margin-left:auto;color:var(--el-color-primary)}.target-list{display:flex;flex-direction:column;gap:12px}.target-heading{min-width:0}.target-heading strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.target-id{margin-left:auto}.target-heading :deep(.el-button){flex-shrink:0}.slot-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px}.slot-card{display:flex;flex-direction:column;gap:10px;padding:12px;border:1px solid var(--el-border-color-lighter);border-radius:8px}.slot-label{font-weight:600}.image-pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}.image-preview{position:relative;display:flex;align-items:center;justify-content:center;min-height:135px;aspect-ratio:4/3;background:var(--el-fill-color-lighter);border-radius:6px;overflow:hidden}.image-preview img{width:100%;height:100%;object-fit:contain}.image-preview>span{position:absolute;left:6px;top:6px;padding:2px 6px;border-radius:4px;background:#0009;color:white;font-size:11px}.image-empty{color:var(--el-text-color-placeholder);font-size:12px}.slot-actions{flex-wrap:wrap}@media(max-width:760px){.toolbar-row{align-items:flex-start}.keywords-row{align-items:stretch;flex-direction:column}.keywords-label{min-width:0}.keyword-field{min-width:0}}
</style>
