<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { Upload } from "@element-plus/icons-vue";
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
const visibleRevisionItems = ref<RevisionEntry[]>([]);
const selected = ref<AdminRecipeWikiSummary[]>([]);
const total = ref(0);
const fileInput = ref<HTMLInputElement | null>(null);
const tableRef = ref<{ clearSelection: () => void } | null>(null);
const revisionItems = ref<RevisionEntry[]>([]);
const selectedRevisionItems = ref<RevisionEntry[]>([]);
const availableFields = ref<AdminRecipeWikiReplaceField[]>([]);
const selectedFields = ref<AdminRecipeWikiReplaceField[]>([]);
const revisionPoolLoaded = ref(false);
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
  recipeContent: Record<string, unknown> | null;
  wiki: Record<string, unknown>;
}

type RecipeWikiPageRow =
  | { kind: "revision"; key: string; recipe: RevisionEntry }
  | { kind: "wiki"; key: string; wiki: AdminRecipeWikiSummary };

const replaceFieldOptions: Array<{ value: AdminRecipeWikiReplaceField; label: string }> = [
  { value: "name", label: "菜名" },
  { value: "story", label: "故事" },
  { value: "baseServings", label: "基准份量" },
  { value: "difficulty", label: "难度" },
  { value: "duration", label: "时长" },
  { value: "tips", label: "小贴士" },
  { value: "keywords", label: "关键词" },
  { value: "ingredients", label: "食材" },
  { value: "ingredientRoles", label: "食材角色" },
  { value: "tools", label: "工具" },
  { value: "steps", label: "菜谱步骤" },
  { value: "tags", label: "Wiki 标签" },
  { value: "assistant.steps", label: "助手步骤" }
];

const pageRows = computed<RecipeWikiPageRow[]>(() => {
  const revisions: RecipeWikiPageRow[] = visibleRevisionItems.value
    .map(recipe => ({ kind: "revision", key: `revision-${recipe.recipeId}`, recipe }));
  const wiki: RecipeWikiPageRow[] = rows.value
    .map(item => ({ kind: "wiki", key: `wiki-${item.id}`, wiki: item }));
  return [...revisions, ...wiki];
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
  const available = items.length
    ? replaceFieldOptions.map(option => option.value).filter(field => items.every(item => hasRevisionField(item, field)))
    : [];
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
    const keyword = query.keyword.trim();
    const normalizedKeyword = keyword.toLocaleLowerCase();
    const matchingRevisions = revisionItems.value.filter(item => !keyword
      || item.title.toLocaleLowerCase().includes(normalizedKeyword)
      || String(item.recipeId).includes(normalizedKeyword)
      || String(item.contentVersionId).includes(normalizedKeyword));
    const offset = (query.page - 1) * query.pageSize;
    const pageRevisions = matchingRevisions.slice(offset, offset + query.pageSize);
    const serverOffset = Math.max(0, offset - matchingRevisions.length);
    const serverCount = query.pageSize - pageRevisions.length;
    const excludedIds = revisionItems.value.map(item => item.recipeId).join(",");
    const window = await loadWikiWindow(serverOffset, serverCount, keyword || undefined, excludedIds || undefined);
    const nextTotal = matchingRevisions.length + window.total;
    const lastPage = Math.max(1, Math.ceil(nextTotal / query.pageSize));
    if (query.page > lastPage) {
      query.page = lastPage;
      await loadPage();
      return;
    }
    visibleRevisionItems.value = pageRevisions;
    rows.value = window.items;
    total.value = nextTotal;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载菜谱内容列表失败");
  } finally {
    loading.value = false;
  }
}

async function loadWikiWindow(start: number, count: number, keyword?: string, excludeRecipeIds?: string) {
  const pageSize = count > 0 ? 100 : 1;
  const firstPage = count > 0 ? Math.floor(start / pageSize) + 1 : 1;
  const offsetInFirstPage = count > 0 ? start % pageSize : 0;
  const items: AdminRecipeWikiSummary[] = [];
  let total = 0;
  let page = firstPage;
  let hasNext = true;

  do {
    const result = await recipeApi.listWiki({ page, pageSize, keyword, excludeRecipeIds });
    total = result.total;
    hasNext = result.hasNext;
    const pageItems = page === firstPage ? result.items.slice(offsetInFirstPage) : result.items;
    items.push(...pageItems.slice(0, Math.max(0, count - items.length)));
    page += 1;
  } while (items.length < count && hasNext);

  return { items, total };
}

function search() {
  tableRef.value?.clearSelection();
  selected.value = [];
  selectedRevisionItems.value = [];
  query.page = 1;
  void loadPage();
}

function changePage(page: number) {
  query.page = page;
  void loadPage();
}

function changePageSize(pageSize: number) {
  query.pageSize = pageSize;
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
  const files = Array.from(input.files ?? []);
  input.value = "";
  if (!files.length) return;
  if (files.some(file => file.size > 10 * 1024 * 1024)) {
    ElMessage.error("单个修订文件不能超过 10 MB");
    return;
  }
  try {
    const imported = await Promise.all(files.map(async file => {
      try {
        return readRevisionEntries(JSON.parse(await file.text()) as unknown);
      } catch (error) {
        throw new Error(`${file.name}：${error instanceof Error ? error.message : "文件格式错误"}`);
      }
    }));
    const entries = imported.flat();
    if (!entries.length) throw new Error("文件中没有可修订的菜谱条目");
    if (entries.length > 100) throw new Error("一次最多处理 100 道菜谱");
    if (new Set(entries.map(item => item.recipeId)).size !== entries.length) throw new Error("所选文件中存在重复的 recipeId");
    const existingIds = new Set(revisionItems.value.map(item => item.recipeId));
    const appendedEntries = entries.filter(item => !existingIds.has(item.recipeId));
    const duplicateCount = entries.length - appendedEntries.length;
    if (!appendedEntries.length) {
      ElMessage.warning("所选文件中的菜谱已全部在当前列表中");
      return;
    }
    if (revisionItems.value.length + appendedEntries.length > 100) {
      ElMessage.warning("当前修订列表最多保留 100 条，请先替换或移除部分条目");
      return;
    }
    const isFirstImport = revisionItems.value.length === 0;
    const nextItems = [...revisionItems.value, ...appendedEntries];
    const supported = nextItems.length
      ? replaceFieldOptions.map(option => option.value).filter(field => nextItems.every(item => hasRevisionField(item, field)))
      : [];
    const nextFields = isFirstImport
      ? [...supported]
      : selectedFields.value.filter(field => supported.includes(field));
    await saveRevisionPool(nextItems, nextFields);
    revisionItems.value = nextItems;
    availableFields.value = supported;
    selectedFields.value = nextFields;
    query.page = 1;
    await loadPage();
    ElMessage.success(`已加入当前列表 ${appendedEntries.length} 条修订菜谱${duplicateCount ? `，跳过已有 ${duplicateCount} 条` : ""}`);
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
    const wiki = isRecord(source.wiki) ? source.wiki : {};
    if (!isRecord(recipe)) throw new Error(`第 ${index + 1} 条缺少 recipe 对象`);
    const recipeId = recipe.recipeId;
    const contentVersionId = recipe.contentVersionId;
    if (!Number.isInteger(recipeId) || !Number.isInteger(contentVersionId)) throw new Error(`第 ${index + 1} 条 recipeId 或 contentVersionId 无效`);
    const content = isRecord(recipe.content) ? recipe.content : null;
    const recipeContent = isRecord(source.recipeContent) ? source.recipeContent : content;
    const title = typeof recipeContent?.name === "string" ? recipeContent.name : `菜谱 ${recipeId}`;
    return {
      key: `${recipeId}-${contentVersionId}`,
      recipeId: Number(recipeId),
      contentVersionId: Number(contentVersionId),
      title,
      schemaVersion: fullRecipe ? "recipe.import.v1" : "recipe.wiki.v1",
      recipe: fullRecipe ? recipe : null,
      recipeContent,
      wiki
    };
  });
}

function hasRevisionField(item: RevisionEntry, field: AdminRecipeWikiReplaceField) {
  if (field === "tags") return Array.isArray(item.wiki.tags);
  if (field === "assistant.steps") return isRecord(item.wiki.assistant) && Array.isArray(item.wiki.assistant.steps);
  const content = item.recipeContent;
  if (field === "ingredientRoles" && content) {
    if (Array.isArray(content.ingredientRoles)) return true;
    const ingredients = content.ingredients;
    return Array.isArray(ingredients) && ingredients.length > 0 && ingredients.every(ingredient =>
      isRecord(ingredient) && ["MAIN", "ACCOMPANIMENT", "SEASONING"].includes(String(ingredient.recipeRole))
    );
  }
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
  const includesRecipeContent = selectedFields.value.some(field => field !== "tags" && field !== "assistant.steps");
  return {
    schemaVersion: "recipe.wiki.batch.v1",
    recipes: items.map(item => ({
      recipeId: item.recipeId,
      contentVersionId: item.contentVersionId,
      ...(includesRecipeContent && item.recipeContent ? { recipeContent: item.recipeContent } : {}),
      ...(Object.keys(item.wiki).length ? { wiki: item.wiki } : {})
    }))
  };
}

function buildRevisionFile(items: RevisionEntry[]) {
  return new File([JSON.stringify(buildRevisionDocument(items))], "recipe-wiki-revision.json", { type: "application/json" });
}

function handlePageSelection(value: RecipeWikiPageRow[]) {
  const pageKeys = new Set(pageRows.value.map(item => item.key));
  const wikiSelection = new Map(
    selected.value
      .filter(item => !pageKeys.has(`wiki-${item.id}`))
      .map(item => [`wiki-${item.id}`, item])
  );
  const revisionSelection = new Map(
    selectedRevisionItems.value
      .filter(item => !pageKeys.has(`revision-${item.recipeId}`))
      .map(item => [`revision-${item.recipeId}`, item])
  );
  value.forEach(item => {
    if (item.kind === "wiki") wikiSelection.set(item.key, item.wiki);
    else revisionSelection.set(item.key, item.recipe);
  });
  selected.value = [...wikiSelection.values()];
  selectedRevisionItems.value = [...revisionSelection.values()];
}

function canSelectRow(row: RecipeWikiPageRow) {
  return row.kind !== "wiki"
    || selected.value.some(item => item.id === row.wiki.id)
    || selected.value.length < 100;
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
  try {
    const batches = [items.filter(item => item.recipe), items.filter(item => !item.recipe)].filter(batch => batch.length > 0);
    for (const batch of batches) {
      const result = await recipeApi.importWiki(buildRevisionFile(batch), createOperationId(), selectedFields.value);
      resultItems.push(...result.items);
      replacedCount += result.replacedCount;
      const succeededIds = new Set(result.items.filter(item => item.status === "REPLACED").map(item => item.recipeId));
      const nextItems = revisionItems.value.filter(item => !succeededIds.has(item.recipeId));
      await saveRevisionPool(nextItems, selectedFields.value);
      revisionItems.value = nextItems;
      selectedRevisionItems.value = selectedRevisionItems.value.filter(item => !succeededIds.has(item.recipeId));
    }
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
    ElMessage.error(replacedCount ? `部分条目已替换；后续批次失败：${message}` : message);
  } finally {
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
    await loadPage();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "移除修订菜谱失败");
  }
}

async function deleteSelectedRevisions() {
  if (!selectedRevisionItems.value.length) {
    ElMessage.warning("请先选择要删除的导入条目");
    return;
  }
  try {
    await ElMessageBox.confirm(`从当前列表中移除选中的 ${selectedRevisionItems.value.length} 条修订菜谱？不会修改正式菜谱。`, "批量移除修订项", {
      type: "warning", confirmButtonText: "移除选中项", cancelButtonText: "取消"
    });
    const keys = new Set(selectedRevisionItems.value.map(item => item.key));
    const nextItems = revisionItems.value.filter(item => !keys.has(item.key));
    const supported = nextItems.length
      ? replaceFieldOptions.map(option => option.value).filter(field => nextItems.every(item => hasRevisionField(item, field)))
      : [];
    const nextFields = nextItems.length ? selectedFields.value.filter(field => supported.includes(field)) : [];
    await saveRevisionPool(nextItems, nextFields);
    revisionItems.value = nextItems;
    selectedRevisionItems.value = [];
    availableFields.value = supported;
    selectedFields.value = nextFields;
    await loadPage();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "批量移除修订项失败");
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
  if (selected.value.length > 100) {
    ElMessage.warning("一次最多移出 100 项，请减少选择");
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
    tableRef.value?.clearSelection();
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

function ownerText(row: AdminRecipeWikiSummary) {
  if (row.sourceType === "PUBLIC_CONTENT_POOL") return "公共内容池";
  return row.ownerNickname ? `${row.ownerNickname}（UID ${row.ownerUid}）` : `UID ${row.ownerUid}`;
}

onMounted(() => {
  void (async () => {
    try {
      await restoreRevisionPool();
    } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "恢复本地修订列表失败");
    } finally {
      revisionPoolLoaded.value = true;
    }
    await loadPage();
  })();
});
</script>

<template>
  <section class="page-stack">
    <header class="wiki-page-heading"><h1>菜谱内容修订</h1></header>
    <div class="toolbar-panel page-toolbar">
      <el-input v-model="query.keyword" class="toolbar-search" placeholder="搜索菜谱名称或 ID" clearable @keyup.enter="search" @clear="search" />
      <el-button type="primary" @click="search">搜索</el-button>
      <el-button type="danger" :disabled="!revisionPoolLoaded || !selected.length" @click="dismissSelected">移出待补充（{{ selected.length }}/100）</el-button>
      <el-button :disabled="!selectedRevisionItems.length" @click="deleteSelectedRevisions">移除选中修订</el-button>
      <el-button type="primary" :disabled="!selectedRevisionItems.length || !selectedFields.length" :loading="saving" @click="replaceRevisionItems(selectedRevisionItems)">
        批量替换（{{ selectedRevisionItems.length }}）
      </el-button>
      <el-button type="primary" :icon="Upload" :disabled="!revisionPoolLoaded || saving" @click="openFilePicker">导入修订文件</el-button>
      <input ref="fileInput" class="hidden-file-input" type="file" accept="application/json,.json" multiple @change="importFile" />
    </div>

    <div class="revision-fields-panel">
      <strong>替换字段</strong>
      <el-checkbox-group v-model="selectedFields" class="revision-field-list" @change="persistSelectedFields">
        <el-checkbox v-for="option in replaceFieldOptions" :key="option.value" :value="option.value" :disabled="!availableFields.includes(option.value)">
          {{ option.label }}
        </el-checkbox>
      </el-checkbox-group>
    </div>

    <div v-if="!revisionPoolLoaded" v-loading="true" class="table-panel" />

    <div v-else v-loading="loading" class="table-panel">
      <el-table ref="tableRef" :data="pageRows" row-key="key" reserve-selection @selection-change="handlePageSelection">
        <el-table-column type="selection" width="48" :selectable="canSelectRow" />
        <el-table-column label="菜谱" min-width="200">
          <template #default="{ row }">
            <div>{{ row.kind === 'revision' ? row.recipe.title : row.wiki.title }}</div>
            <small>菜谱 ID {{ row.kind === 'revision' ? row.recipe.recipeId : row.wiki.id }}</small>
          </template>
        </el-table-column>
        <el-table-column label="来源" min-width="180">
          <template #default="{ row }">
            <template v-if="row.kind === 'revision'"><el-tag type="success">修订文件</el-tag></template>
            <template v-else>
              <el-tag v-if="row.wiki.sourceType === 'PUBLIC_CONTENT_POOL'" type="warning">公共内容池</el-tag>
              <span v-else>{{ ownerText(row.wiki) }}</span>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="Wiki 状态" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.kind === 'revision'" type="info">待替换</el-tag>
            <template v-else>
              <el-tag :type="row.wiki.hasPendingRequest ? 'danger' : 'info'">{{ getStatusText(row.wiki.wikiStatus) }}</el-tag>
              <span v-if="row.wiki.hasPendingRequest" class="request-mark">有申请</span>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="最近申请" min-width="190">
          <template #default="{ row }">
            <template v-if="row.kind === 'wiki'">
              <div>{{ row.wiki.latestRequestAt ? formatDateTime(row.wiki.latestRequestAt) : "暂无" }}</div>
              <small v-if="row.wiki.latestRequestUserUid">UID {{ row.wiki.latestRequestUserUid }}{{ row.wiki.latestRequestUserNickname ? ` · ${row.wiki.latestRequestUserNickname}` : "" }}</small>
            </template>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="370" fixed="right">
          <template #default="{ row }">
            <template v-if="row.kind === 'revision'">
              <el-button link type="primary" :disabled="!selectedFields.length" :loading="saving" @click="replaceOneRevision(row.recipe)">替换</el-button>
              <el-button link type="danger" @click="deleteOneRevision(row.recipe)">移除</el-button>
            </template>
            <template v-else>
              <el-button v-if="row.wiki.hasImportWiki" link type="success" @click="quickFill(row.wiki)">从导入数据修订</el-button>
              <el-button link type="danger" @click="reject(row.wiki)">拒绝</el-button>
              <el-button link type="danger" @click="dismiss(row.wiki)">移除</el-button>
            </template>
          </template>
        </el-table-column>
        <template #empty><el-empty description="当前列表为空；可导入修订文件或查看待处理 Wiki" /></template>
      </el-table>
      <div class="table-footer">
        <span>待处理 Wiki {{ total }} 条 · 当前列表修订 {{ revisionItems.length }} 条</span>
        <el-pagination
          :current-page="query.page"
          :page-size="query.pageSize"
          layout="total, sizes, prev, pager, next"
          :total="total"
          :page-sizes="[20, 50, 100]"
          @current-change="changePage"
          @size-change="changePageSize"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.hidden-file-input { display: none; }
.wiki-page-heading h1 { margin: 0; font-size: 22px; color: #292524; }
.page-toolbar { flex-wrap: wrap; gap: 12px; }
.toolbar-search { width: 240px; }
.revision-fields-panel { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; color: #57534e; font-size: 13px; }
.revision-field-list { display: flex; flex-wrap: wrap; gap: 0 12px; }
.revision-field-list :deep(.el-checkbox) { margin-right: 0; }
.request-mark { display: block; margin-top: 4px; color: #b45309; font-size: 12px; }
.table-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 16px; }
</style>
