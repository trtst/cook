<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from "vue";
import { Download, Upload } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { recipeApi, type AdminRecipeWikiReplaceField, type AdminRecipeWikiSummary } from "@/apis/recipe";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";
import { formatDateTime } from "@/utils/date";

const loading = ref(false);
const saving = ref(false);
const session = useSessionStore();
const rows = ref<AdminRecipeWikiSummary[]>([]);
const selected = ref<AdminRecipeWikiSummary[]>([]);
const total = ref(0);
const fileInput = ref<HTMLInputElement | null>(null);
const revisionTable = ref<{
  toggleRowSelection: (row: RevisionEntry, selected?: boolean) => void;
  clearSelection: () => void;
} | null>(null);
const revisionItems = ref<RevisionEntry[]>([]);
const selectedRevisionItems = ref<RevisionEntry[]>([]);
const availableFields = ref<AdminRecipeWikiReplaceField[]>([]);
const selectedFields = ref<AdminRecipeWikiReplaceField[]>([]);
const revisionPreviewVisible = ref(false);
const revisionPoolLoaded = ref(false);
const revisionKeyword = ref("");
const query = reactive({ page: 1, pageSize: 20, keyword: "" });

const revisionPoolDatabase = "next-meal-admin-local";
const revisionPoolStore = "recipe-wiki-revision-pools";

interface StoredRevisionPool {
  adminId: number;
  items: RevisionEntry[];
  fields: AdminRecipeWikiReplaceField[];
}

interface RevisionEntry {
  key: string;
  recipeId: number;
  contentVersionId: number;
  title: string;
  schemaVersion: "recipe.import.v1" | "recipe.wiki.v1";
  recipe: Record<string, unknown> | null;
  wiki: Record<string, unknown>;
}

const replaceFieldOptions: Array<{ value: AdminRecipeWikiReplaceField; label: string }> = [
  { value: "name", label: "菜名" },
  { value: "story", label: "故事" },
  { value: "difficulty", label: "难度" },
  { value: "duration", label: "时长" },
  { value: "tips", label: "小贴士" },
  { value: "keywords", label: "关键词" },
  { value: "ingredients", label: "食材" },
  { value: "tools", label: "工具" },
  { value: "steps", label: "菜谱步骤" },
  { value: "tags", label: "Wiki 标签" },
  { value: "assistant.steps", label: "助手步骤" }
];

const visibleRevisionItems = computed(() => {
  const keyword = revisionKeyword.value.trim().toLocaleLowerCase();
  if (!keyword) return revisionItems.value;
  return revisionItems.value.filter(item =>
    item.title.toLocaleLowerCase().includes(keyword)
    || String(item.recipeId).includes(keyword)
    || String(item.contentVersionId).includes(keyword)
  );
});

function openRevisionPoolDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(revisionPoolDatabase, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(revisionPoolStore)) {
        request.result.createObjectStore(revisionPoolStore, { keyPath: "adminId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法打开本地导入池"));
  });
}

async function readRevisionPool(adminId: number): Promise<StoredRevisionPool | null> {
  const database = await openRevisionPoolDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(revisionPoolStore, "readonly");
    const request = transaction.objectStore(revisionPoolStore).get(adminId);
    request.onsuccess = () => resolve((request.result as StoredRevisionPool | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("读取本地导入池失败"));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("读取本地导入池失败"));
    };
  });
}

async function writeRevisionPool(pool: StoredRevisionPool) {
  const database = await openRevisionPoolDatabase();
  return new Promise<void>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      const clone = JSON.parse(JSON.stringify(pool)) as StoredRevisionPool;
      transaction = database.transaction(revisionPoolStore, "readwrite");
      transaction.objectStore(revisionPoolStore).put(clone);
    } catch (error) {
      database.close();
      reject(error instanceof Error ? error : new Error("保存本地导入池失败"));
      return;
    }
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("保存本地导入池失败"));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("保存本地导入池失败"));
    };
  });
}

async function saveRevisionPool(
  items = revisionItems.value,
  fields = selectedFields.value
) {
  const adminId = session.admin?.id;
  if (adminId === undefined || adminId === null) throw new Error("管理员会话已失效，请重新登录");
  await writeRevisionPool({ adminId, items, fields });
}

async function restoreRevisionPool() {
  const adminId = session.admin?.id;
  if (adminId === undefined || adminId === null) return;
  const stored = await readRevisionPool(adminId);
  if (!stored || !Array.isArray(stored.items) || !Array.isArray(stored.fields)) return;
  const items = stored.items.filter(item => isRecord(item)
    && Number.isInteger(item.recipeId)
    && Number.isInteger(item.contentVersionId)
    && typeof item.title === "string"
    && typeof item.key === "string"
    && isRecord(item.wiki)
  ).slice(0, 100);
  const available = replaceFieldOptions.map(option => option.value).filter(field => items.every(item => hasRevisionField(item, field)));
  revisionItems.value = items;
  availableFields.value = available;
  selectedFields.value = stored.fields.filter(field => available.includes(field));
}

const statusText: Record<AdminRecipeWikiSummary["wikiStatus"], string> = {
  MISSING: "未创建",
  PENDING: "待处理",
  GENERATING: "生成中",
  NEEDS_REVIEW: "待补充",
  FAILED: "生成失败"
};

function getStatusText(value: string) {
  return statusText[value as AdminRecipeWikiSummary["wikiStatus"]] ?? value;
}

useAdminHeaderRefresh(() => loadPage());

async function loadPage() {
  loading.value = true;
  try {
    const result = await recipeApi.listWiki({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword.trim() || undefined
    });
    rows.value = result.items;
    total.value = result.total;
    selected.value = selected.value.filter(item => rows.value.some(row => row.id === item.id));
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载 Wiki 补充列表失败");
  } finally {
    loading.value = false;
  }
}

function search() {
  query.page = 1;
  void loadPage();
}

async function persistSelectedFields() {
  try {
    await saveRevisionPool();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存替换字段失败");
  }
}

function openFilePicker() {
  fileInput.value?.click();
}

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.error("修订文件不能超过 10 MB");
    return;
  }
  try {
    const document = JSON.parse(await file.text()) as unknown;
    const entries = readRevisionEntries(document);
    if (!entries.length) throw new Error("文件中没有可修订的菜谱条目");
    if (entries.length > 100) throw new Error("一次最多处理 100 道菜谱");
    if (new Set(entries.map(item => item.recipeId)).size !== entries.length) throw new Error("文件中存在重复的 recipeId");
    const existingIds = new Set(revisionItems.value.map(item => item.recipeId));
    const appendedEntries = entries.filter(item => !existingIds.has(item.recipeId));
    const duplicateCount = entries.length - appendedEntries.length;
    if (!appendedEntries.length) {
      ElMessage.warning("文件中的菜谱 ID 已全部存在于导入池，未重复添加");
      revisionPreviewVisible.value = revisionItems.value.length > 0;
      return;
    }
    if (revisionItems.value.length + appendedEntries.length > 100) {
      ElMessage.warning("导入池最多保留 100 条，请先替换或删除部分条目");
      return;
    }
    const isFirstImport = revisionItems.value.length === 0;
    const nextItems = [...revisionItems.value, ...appendedEntries];
    const supported = replaceFieldOptions.map(option => option.value).filter(field => nextItems.every(item => hasRevisionField(item, field)));
    const nextFields = isFirstImport
      ? [...supported]
      : selectedFields.value.filter(field => supported.includes(field));
    await saveRevisionPool(nextItems, nextFields);
    revisionItems.value = nextItems;
    availableFields.value = supported;
    selectedFields.value = nextFields;
    revisionKeyword.value = "";
    revisionPreviewVisible.value = true;
    await nextTick();
    appendedEntries.forEach(item => revisionTable.value?.toggleRowSelection(item, true));
    ElMessage.success(`已加入导入池 ${appendedEntries.length} 条${duplicateCount ? `，跳过重复菜谱 ${duplicateCount} 条` : ""}`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "导入修订文件失败");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRevisionEntries(document: unknown): RevisionEntry[] {
  if (!isRecord(document)) throw new Error("JSON 根必须是对象");
  const schemaVersion = document.schemaVersion;
  const sourceItems = schemaVersion === "recipe.import.batch.v1" || schemaVersion === "recipe.wiki.batch.v1"
    ? Array.isArray(document.recipes) ? document.recipes : []
    : schemaVersion === "recipe.import.v1" || schemaVersion === "recipe.wiki.v1"
      ? [document]
      : null;
  if (!sourceItems) throw new Error("文件格式不支持，请使用菜谱导出的修订文件或 Wiki 文件");
  return sourceItems.map((source, index) => {
    if (!isRecord(source)) throw new Error(`第 ${index + 1} 条数据格式错误`);
    const fullRecipe = schemaVersion === "recipe.import.v1" || schemaVersion === "recipe.import.batch.v1";
    const recipe = fullRecipe ? source.recipe : source;
    const wiki = source.wiki;
    if (!isRecord(recipe) || !isRecord(wiki)) throw new Error(`第 ${index + 1} 条缺少 recipe 或 wiki 对象`);
    const recipeId = recipe.recipeId;
    const contentVersionId = recipe.contentVersionId;
    if (!Number.isInteger(recipeId) || !Number.isInteger(contentVersionId)) throw new Error(`第 ${index + 1} 条 recipeId 或 contentVersionId 无效`);
    const content = isRecord(recipe.content) ? recipe.content : null;
    const title = typeof content?.name === "string" ? content.name : `菜谱 ${recipeId}`;
    return {
      key: `${recipeId}-${index}`,
      recipeId: Number(recipeId),
      contentVersionId: Number(contentVersionId),
      title,
      schemaVersion: fullRecipe ? "recipe.import.v1" : "recipe.wiki.v1",
      recipe: fullRecipe ? recipe : null,
      wiki
    };
  });
}

function hasRevisionField(item: RevisionEntry, field: AdminRecipeWikiReplaceField) {
  if (field === "tags") return Array.isArray(item.wiki.tags);
  if (field === "assistant.steps") return isRecord(item.wiki.assistant) && Array.isArray(item.wiki.assistant.steps);
  const content = item.recipe && isRecord(item.recipe.content) ? item.recipe.content : null;
  return Boolean(content && Object.prototype.hasOwnProperty.call(content, field));
}

function buildRevisionDocument(items: RevisionEntry[]) {
  if (items.every(item => item.recipe)) {
    return {
      schemaVersion: "recipe.import.batch.v1",
      recipes: items.map(item => ({ recipe: item.recipe, wiki: item.wiki }))
    };
  }
  if (items.some(item => item.recipe)) throw new Error("完整菜谱文件和 Wiki-only 文件不能混合批量替换");
  return {
    schemaVersion: "recipe.wiki.batch.v1",
    recipes: items.map(item => ({ recipeId: item.recipeId, contentVersionId: item.contentVersionId, wiki: item.wiki }))
  };
}

function buildRevisionFile(items: RevisionEntry[]) {
  return new File([JSON.stringify(buildRevisionDocument(items))], "recipe-wiki-revision.json", { type: "application/json" });
}

function handleRevisionSelection(value: RevisionEntry[]) {
  selectedRevisionItems.value = value;
}

async function replaceRevisionItems(items: RevisionEntry[]) {
  if (!items.length) {
    ElMessage.warning("请先选择要替换的导入条目");
    return;
  }
  if (!selectedFields.value.length) {
    ElMessage.warning("请至少勾选一个替换字段");
    return;
  }
  saving.value = true;
  const resultItems: Array<{ recipeId: number; status: "REPLACED" | "REJECTED"; message: string | null }> = [];
  let replacedCount = 0;
  let poolSaveFailed = false;
  try {
    const batches = [items.filter(item => item.recipe), items.filter(item => !item.recipe)].filter(batch => batch.length > 0);
    for (const batch of batches) {
      const result = await recipeApi.importWiki(buildRevisionFile(batch), createOperationId(), selectedFields.value);
      resultItems.push(...result.items);
      replacedCount += result.replacedCount;
      const succeededIds = new Set(result.items.filter(item => item.status === "REPLACED").map(item => item.recipeId));
      const nextItems = revisionItems.value.filter(item => !succeededIds.has(item.recipeId));
      try {
        await saveRevisionPool(nextItems, selectedFields.value);
      } catch (error) {
        poolSaveFailed = true;
        throw error;
      }
      revisionItems.value = nextItems;
      selectedRevisionItems.value = selectedRevisionItems.value.filter(item => !succeededIds.has(item.recipeId));
    }
    revisionTable.value?.clearSelection();
    selectedRevisionItems.value = [];
    const rejected = resultItems.filter(item => item.status === "REJECTED");
    if (rejected.length) {
      const details = rejected.slice(0, 10).map(item => `菜谱 ${item.recipeId}：${item.message || "未替换"}`).join("\n");
      await ElMessageBox.alert(
        `成功替换 ${replacedCount} 条，${rejected.length} 条未替换。\n\n${details}`,
        "修订结果",
        { confirmButtonText: "知道了", customClass: "recipe-wiki-import-result" }
      );
    } else {
      ElMessage.success(`已替换 ${replacedCount} 条菜谱内容`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "替换菜谱内容失败";
    if (poolSaveFailed && replacedCount) {
      ElMessage.error(`服务端已替换 ${replacedCount} 条，但本地导入池保存失败：${message}。成功项仍留在池中，请修复后重新替换或删除`);
    } else {
      ElMessage.error(replacedCount ? `部分条目已替换；后续批次失败：${message}` : message);
    }
  } finally {
    revisionTable.value?.clearSelection();
    selectedRevisionItems.value = [];
    if (replacedCount) await loadPage();
    saving.value = false;
  }
}

async function replaceOneRevision(row: RevisionEntry) {
  await replaceRevisionItems([row]);
}

async function deleteOneRevision(row: RevisionEntry) {
  const nextItems = revisionItems.value.filter(item => item.key !== row.key);
  const supported = replaceFieldOptions.map(option => option.value).filter(field => nextItems.every(item => hasRevisionField(item, field)));
  const nextFields = nextItems.length ? selectedFields.value.filter(field => supported.includes(field)) : [];
  try {
    await saveRevisionPool(nextItems, nextFields);
    revisionItems.value = nextItems;
    selectedRevisionItems.value = selectedRevisionItems.value.filter(item => item.key !== row.key);
    availableFields.value = supported;
    selectedFields.value = nextFields;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "删除导入池条目失败");
  }
}

async function deleteSelectedRevisions() {
  if (!selectedRevisionItems.value.length) {
    ElMessage.warning("请先选择要删除的导入条目");
    return;
  }
  try {
    await ElMessageBox.confirm(`从本次修订文件中移除选中的 ${selectedRevisionItems.value.length} 条？不会删除线上菜谱。`, "批量删除导入项", {
      type: "warning", confirmButtonText: "移除选中项", cancelButtonText: "取消"
    });
    const keys = new Set(selectedRevisionItems.value.map(item => item.key));
    const nextItems = revisionItems.value.filter(item => !keys.has(item.key));
    const supported = replaceFieldOptions.map(option => option.value).filter(field => nextItems.every(item => hasRevisionField(item, field)));
    const nextFields = nextItems.length ? selectedFields.value.filter(field => supported.includes(field)) : [];
    await saveRevisionPool(nextItems, nextFields);
    revisionItems.value = nextItems;
    selectedRevisionItems.value = [];
    availableFields.value = supported;
    selectedFields.value = nextFields;
    revisionTable.value?.clearSelection();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "移除导入条目失败");
  }
}

function downloadJson(fileName: string, body: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function exportOne(row: AdminRecipeWikiSummary) {
  try {
    const document = await recipeApi.exportWiki(row.id);
    downloadJson(`${row.title}-${row.id}-wiki.json`, document);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "导出 Wiki 失败");
  }
}

async function reject(row: AdminRecipeWikiSummary) {
  try {
    const { value } = await ElMessageBox.prompt("请输入拒绝原因", "拒绝 Wiki 生成", {
      inputValue: "菜谱内容不够完整，请重新编辑后再申请",
      confirmButtonText: "确认拒绝",
      cancelButtonText: "取消"
    });
    await recipeApi.rejectWiki(row.id, value.trim(), createOperationId());
    ElMessage.success("已拒绝 Wiki 申请");
    await loadPage();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "拒绝 Wiki 失败");
  }
}

async function dismiss(row: AdminRecipeWikiSummary) {
  try {
    await ElMessageBox.confirm(
      `从待补充列表移除“${row.title}”？菜谱正文和当前 Wiki 数据会保留；该版本的待处理申请会被拒绝并释放预扣次数。`,
      "删除 Wiki 补充项",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" }
    );
    const result = await recipeApi.dismissWiki(row.id, row.contentVersionId, createOperationId());
    ElMessage.success(result.dismissedRequestCount ? `已删除，处理 ${result.dismissedRequestCount} 条申请` : "已从待补充列表移除");
    await loadPage();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "删除 Wiki 补充项失败");
  }
}

async function dismissSelected() {
  if (!selected.value.length) {
    ElMessage.warning("请先选择要删除的 Wiki 补充项");
    return;
  }
  const items = selected.value.map(row => ({ recipeId: row.id, expectedContentVersionId: row.contentVersionId }));
  try {
    await ElMessageBox.confirm(
      `从待补充列表移除选中的 ${items.length} 项？菜谱正文和当前 Wiki 数据会保留；对应的待处理申请会被拒绝并释放预扣次数。`,
      "批量删除 Wiki 补充项",
      { type: "warning", confirmButtonText: "删除选中项", cancelButtonText: "取消" }
    );
    const result = await recipeApi.dismissWikiBatch(items, createOperationId());
    ElMessage.success(`已移除 ${result.dismissedCount} 项，处理 ${result.dismissedRequestCount} 条申请`);
    selected.value = [];
    await loadPage();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "批量删除 Wiki 补充项失败");
  }
}

async function quickFill(row: AdminRecipeWikiSummary) {
  try {
    await ElMessageBox.confirm(
      `将用关联导入记录替换“${row.title}”当前版本的待审核标签和助理步骤，保留已确认及自动推导标签，不修改菜谱正文和封面。`,
      "快速补充 Wiki",
      { type: "warning", confirmButtonText: "补充 Wiki", cancelButtonText: "取消" }
    );
    await recipeApi.quickFillWikiFromImport(row.id, row.contentVersionId, createOperationId());
    ElMessage.success("已从菜谱导入记录补充 Wiki");
    await loadPage();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "快速补充 Wiki 失败");
  }
}

function handleSelectionChange(value: AdminRecipeWikiSummary[]) {
  selected.value = value;
}

function ownerText(row: AdminRecipeWikiSummary) {
  if (row.sourceType === "PUBLIC_CONTENT_POOL") return "公共内容池";
  return row.ownerNickname ? `${row.ownerNickname}（UID ${row.ownerUid}）` : `UID ${row.ownerUid}`;
}

onMounted(() => {
  void (async () => {
    try {
      await restoreRevisionPool();
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : "恢复本地导入池失败");
    } finally {
      revisionPoolLoaded.value = true;
    }
    await loadPage();
  })();
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel page-toolbar">
      <el-input v-model="query.keyword" class="toolbar-search" placeholder="搜索菜谱名称或 ID" clearable @keyup.enter="search" @clear="search" />
      <el-button type="primary" @click="search">搜索</el-button>
      <el-button type="danger" :disabled="!revisionPoolLoaded || !selected.length" @click="dismissSelected">批量删除</el-button>
      <el-button type="primary" :icon="Upload" :disabled="!revisionPoolLoaded" :loading="saving" @click="openFilePicker">导入修订文件</el-button>
      <el-button v-if="revisionItems.length" type="primary" plain @click="revisionPreviewVisible = true">查看修订预览（{{ revisionItems.length }}）</el-button>
      <input ref="fileInput" class="hidden-file-input" type="file" accept="application/json,.json" @change="importFile" />
    </div>

    <div v-if="!revisionPoolLoaded" v-loading="true" class="table-panel" />

    <div v-else v-loading="loading" class="table-panel">
      <el-table :data="rows" row-key="id" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="48" />
        <el-table-column prop="title" label="菜谱" min-width="180" />
        <el-table-column label="来源" min-width="180">
          <template #default="{ row }">
            <el-tag v-if="row.sourceType === 'PUBLIC_CONTENT_POOL'" type="warning">公共内容池</el-tag>
            <span v-else>{{ ownerText(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="Wiki 状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.hasPendingRequest ? 'danger' : 'info'">{{ getStatusText(row.wikiStatus) }}</el-tag>
            <span v-if="row.hasPendingRequest" class="request-mark">有申请</span>
          </template>
        </el-table-column>
        <el-table-column label="最近申请" min-width="190">
          <template #default="{ row }">
            <div>{{ row.latestRequestAt ? formatDateTime(row.latestRequestAt) : "暂无" }}</div>
            <small v-if="row.latestRequestUserUid">UID {{ row.latestRequestUserUid }}{{ row.latestRequestUserNickname ? ` · ${row.latestRequestUserNickname}` : "" }}</small>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="370" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.hasImportWiki" link type="success" @click="quickFill(row)">从导入数据补充</el-button>
            <el-button link type="primary" :icon="Download" @click="exportOne(row)">导出</el-button>
            <el-button link type="danger" @click="reject(row)">拒绝</el-button>
            <el-button link type="danger" @click="dismiss(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无待补充 Wiki 的 ACTIVE 菜谱" /></template>
      </el-table>
      <div class="table-footer">
        <span>共 {{ total }} 条</span>
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          layout="total, sizes, prev, pager, next"
          :total="total"
          :page-sizes="[20, 50, 100]"
          @current-change="loadPage"
          @size-change="search"
        />
      </div>
    </div>

    <el-drawer v-model="revisionPreviewVisible" title="修订文件预览" size="78%">
      <div class="revision-fields-panel">
        <span>替换字段</span>
        <el-checkbox-group v-model="selectedFields" class="revision-field-list" @change="persistSelectedFields">
          <el-checkbox v-for="option in replaceFieldOptions" :key="option.value" :value="option.value" :disabled="!availableFields.includes(option.value)">
            {{ option.label }}
          </el-checkbox>
        </el-checkbox-group>
      </div>
      <div class="revision-toolbar">
        <el-input v-model="revisionKeyword" class="toolbar-search" placeholder="搜索导入项名称或 ID" clearable />
        <el-button type="danger" :disabled="!selectedRevisionItems.length" @click="deleteSelectedRevisions">移除选中项</el-button>
        <el-button type="primary" :disabled="!selectedRevisionItems.length || !selectedFields.length" :loading="saving" @click="replaceRevisionItems(selectedRevisionItems)">批量替换</el-button>
      </div>
      <el-table ref="revisionTable" :data="visibleRevisionItems" row-key="key" :reserve-selection="true" @selection-change="handleRevisionSelection">
        <el-table-column type="selection" width="48" />
        <el-table-column prop="recipeId" label="菜谱 ID" width="120" />
        <el-table-column prop="contentVersionId" label="正文版本 ID" width="140" />
        <el-table-column prop="title" label="菜谱" min-width="180" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" :disabled="!selectedFields.length" :loading="saving" @click="replaceOneRevision(row)">替换</el-button>
            <el-button link type="danger" @click="deleteOneRevision(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty description="导入池为空，请导入修订文件" /></template>
      </el-table>
    </el-drawer>
  </section>
</template>

<style scoped>
.hidden-file-input { display: none; }
.page-toolbar { flex-wrap: wrap; gap: 12px; }
.toolbar-search { width: 240px; }
.revision-fields-panel { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 12px; margin-bottom: 16px; color: #57534e; font-size: 13px; }
.revision-field-list { display: flex; flex-wrap: wrap; gap: 0 12px; }
.revision-field-list :deep(.el-checkbox) { margin-right: 0; }
.revision-toolbar { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.request-mark { display: block; margin-top: 4px; color: #b45309; font-size: 12px; }
.table-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 16px; }
</style>
