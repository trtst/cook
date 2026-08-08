<template>
  <SheetShell :visible="visible" :title="title" :subtitle="subtitle" @close="emit('close')">
    <view v-if="loading" class="panel-note panel-note--sheet">加载中...</view>
    <view v-else-if="errorText" class="panel-note panel-note--sheet" @click="loadOptions(true)">{{ errorText }}</view>
    <template v-else>
      <view class="sheet-section">
        <view class="sheet-section__head">
          <view class="sheet-section__meta">
            <text class="sheet-section__title">个人分类</text>
            <text class="sheet-section__tag">最多4字</text>
          </view>
          <view class="sheet-section__action" @click="toggleCategoryCreator">
            {{ showCategoryCreator ? "取消" : "创建" }}
          </view>
        </view>
        <view v-if="showCategoryCreator" class="sheet-creator">
          <input
            v-model="categoryDraftName"
            class="sheet-creator__input"
            maxlength="4"
            placeholder="输入分类名称"
            :disabled="categorySubmitting"
          />
          <button
            class="sheet-creator__button"
            :disabled="categorySubmitting || !categoryDraftName.trim()"
            @click="createCategory"
          >
            {{ categorySubmitting ? "创建中" : "确定" }}
          </button>
        </view>
        <view v-if="categories.length" class="chip-row">
          <view
            v-for="item in categories"
            :key="item.id"
            class="chip"
            :class="{ 'chip--active': selectedCategoryId === item.id }"
            @click="toggleCategory(item.id)"
          >
            {{ item.name }}
          </view>
        </view>
        <text v-else class="sheet-section__hint">{{ categoryHint }}</text>
      </view>

      <view v-if="showSceneSection" class="sheet-section">
        <view class="sheet-section__head">
          <view class="sheet-section__meta">
            <text class="sheet-section__title">合集</text>
            <text class="sheet-section__tag">最多6字</text>
          </view>
          <view class="sheet-section__action" @click="toggleSceneCreator">
            {{ showSceneCreator ? "取消" : "创建" }}
          </view>
        </view>
        <view v-if="showSceneCreator" class="sheet-creator">
          <input
            v-model="sceneDraftName"
            class="sheet-creator__input"
            maxlength="6"
            placeholder="输入合集名称"
            :disabled="sceneSubmitting"
          />
          <button
            class="sheet-creator__button"
            :disabled="sceneSubmitting || !sceneDraftName.trim()"
            @click="createScene"
          >
            {{ sceneSubmitting ? "创建中" : "确定" }}
          </button>
        </view>
        <view v-if="scenes.length" class="chip-row">
          <view
            v-for="item in scenes"
            :key="item.id"
            class="chip"
            :class="{ 'chip--active': selectedSceneIds.includes(item.id) }"
            @click="toggleScene(item.id)"
          >
            {{ item.name }}
          </view>
        </view>
        <text v-else class="sheet-section__hint">{{ sceneHint }}</text>
      </view>
    </template>

    <template #footer>
      <view class="sheet-actions">
        <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="submitting" @click="emit('close')">取消</button>
        <button
          class="sheet-actions__button sheet-actions__button--confirm"
          :disabled="submitting || !canSubmit"
          @click="confirm"
        >
          {{ submitting ? "处理中..." : "确定" }}
        </button>
      </view>
    </template>
  </SheetShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { UUID } from "@/apis/http";
import { recipeApi, type RecipeCategorySummary, type RecipeSceneSummary } from "@/apis/recipe";
import { markRecipeHomeDirty } from "@/pages/recipe/utils/recipe-view-sync";
import { uniPlatform } from "@/platform/uni";
import { createOperationId } from "@/utils/operation-id";
import SheetShell from "@/components/Sheet/SheetShell.vue";

const props = withDefaults(
  defineProps<{
    visible: boolean;
    title: string;
    subtitle: string;
    categoryHint: string;
    sceneHint?: string;
    showSceneSection?: boolean;
    requireCategory?: boolean;
    initialSceneIds?: UUID[];
    submitting?: boolean;
  }>(),
  {
    sceneHint: "还没有合集，可先只选个人分类。",
    showSceneSection: false,
    requireCategory: false,
    initialSceneIds: () => [],
    submitting: false
  }
);

const emit = defineEmits<{
  close: [];
  confirm: [payload: { categoryId: UUID | ""; sceneIds: UUID[] }];
}>();

const loading = ref(false);
const errorText = ref("");
const categories = ref<RecipeCategorySummary[]>([]);
const scenes = ref<RecipeSceneSummary[]>([]);
const selectedCategoryId = ref<UUID | "">("");
const selectedSceneIds = ref<UUID[]>([]);
const showCategoryCreator = ref(false);
const showSceneCreator = ref(false);
const categoryDraftName = ref("");
const sceneDraftName = ref("");
const categorySubmitting = ref(false);
const sceneSubmitting = ref(false);

const canSubmit = computed(() => {
  if (props.requireCategory) return Boolean(selectedCategoryId.value);
  return Boolean(selectedCategoryId.value || selectedSceneIds.value.length);
});

watch(
  () => props.visible,
  visible => {
    if (visible) {
      resetSelection();
      resetCreatorState();
      void loadOptions(true);
      return;
    }
    resetCreatorState();
    errorText.value = "";
  },
  { immediate: true }
);

function resetSelection() {
  selectedCategoryId.value = "";
  selectedSceneIds.value = [...props.initialSceneIds];
}

function resetCreatorState() {
  showCategoryCreator.value = false;
  showSceneCreator.value = false;
  categoryDraftName.value = "";
  sceneDraftName.value = "";
  categorySubmitting.value = false;
  sceneSubmitting.value = false;
}

async function loadOptions(force = false) {
  if (loading.value && !force) return;
  loading.value = true;
  errorText.value = "";
  try {
    const [categoryList, sceneList] = await Promise.all([recipeApi.listCategories(), recipeApi.listScenes()]);
    categories.value = categoryList;
    scenes.value = sceneList;
    if (selectedCategoryId.value && !categories.value.some(item => item.id === selectedCategoryId.value)) {
      selectedCategoryId.value = "";
    }
    selectedSceneIds.value = selectedSceneIds.value.filter(sceneId => scenes.value.some(item => item.id === sceneId));
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "分类加载失败";
  } finally {
    loading.value = false;
  }
}

function toggleCategoryCreator() {
  showCategoryCreator.value = !showCategoryCreator.value;
  if (!showCategoryCreator.value) {
    categoryDraftName.value = "";
  }
}

function toggleSceneCreator() {
  showSceneCreator.value = !showSceneCreator.value;
  if (!showSceneCreator.value) {
    sceneDraftName.value = "";
  }
}

async function createCategory() {
  const name = categoryDraftName.value.trim();
  if (!name || categorySubmitting.value) return;
  if (name.length > 4) {
    await uniPlatform.feedback.toast({ title: "分类最多4个字", icon: "none" });
    return;
  }
  categorySubmitting.value = true;
  try {
    const created = await recipeApi.createCategory({ operationId: createOperationId(), name });
    categories.value = [...categories.value, created];
    selectedCategoryId.value = created.id;
    markRecipeHomeDirty(["my"]);
    categoryDraftName.value = "";
    showCategoryCreator.value = false;
    await uniPlatform.feedback.toast({ title: "分类已创建", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "创建分类失败", icon: "none" });
  } finally {
    categorySubmitting.value = false;
  }
}

async function createScene() {
  const name = sceneDraftName.value.trim();
  if (!name || sceneSubmitting.value) return;
  if (name.length > 6) {
    await uniPlatform.feedback.toast({ title: "合集最多6个字", icon: "none" });
    return;
  }
  sceneSubmitting.value = true;
  try {
    const created = await recipeApi.createScene({ operationId: createOperationId(), name });
    scenes.value = [...scenes.value, created];
    selectedSceneIds.value = [...selectedSceneIds.value, created.id];
    markRecipeHomeDirty(["collection"]);
    sceneDraftName.value = "";
    showSceneCreator.value = false;
    await uniPlatform.feedback.toast({ title: "合集已创建", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "创建合集失败", icon: "none" });
  } finally {
    sceneSubmitting.value = false;
  }
}

function toggleCategory(categoryId: UUID) {
  selectedCategoryId.value = selectedCategoryId.value === categoryId ? "" : categoryId;
}

function toggleScene(sceneId: UUID) {
  if (selectedSceneIds.value.includes(sceneId)) {
    selectedSceneIds.value = selectedSceneIds.value.filter(item => item !== sceneId);
    return;
  }
  selectedSceneIds.value = [...selectedSceneIds.value, sceneId];
}

function confirm() {
  if (!canSubmit.value || props.submitting) return;
  emit("confirm", {
    categoryId: selectedCategoryId.value,
    sceneIds: [...selectedSceneIds.value]
  });
}
</script>

<style scoped lang="scss">
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.panel-note {
  padding: 28rpx 24rpx;
  border-radius: 24rpx;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
  text-align: center;
}

.panel-note--sheet {
  margin-bottom: 12rpx;
}

.sheet-section {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.sheet-section + .sheet-section {
  margin-top: 24rpx;
}

.sheet-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.sheet-section__meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.sheet-section__title {
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: 700;
}

.sheet-section__tag {
  color: var(--color-text-tertiary);
  font-size: 22rpx;
}

.sheet-section__action {
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: 600;
  white-space: nowrap;
}

.sheet-section__hint {
  color: var(--color-text-secondary);
  font-size: 23rpx;
  line-height: 1.6;
}

.sheet-creator {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.sheet-creator__input {
  flex: 1;
  min-width: 0;
  height: 84rpx;
  padding: 0 24rpx;
  border-radius: 24rpx;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 26rpx;
}

.sheet-creator__button {
  flex: 0 0 auto;
  height: 84rpx;
  padding: 0 28rpx;
  border: none;
  border-radius: 24rpx;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: 700;
  line-height: 84rpx;
}

.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 112rpx;
  min-height: 72rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.4;
}

.chip--active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 700;
}

.sheet-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 22rpx;
}

.sheet-actions__button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 88rpx;
  height: 88rpx;
  border: 0;
  border-radius: var(--radius-pill);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.sheet-actions__button::after {
  border: 0;
}

.sheet-actions__button--confirm {
  background: linear-gradient(
    135deg,
    var(--button-primary-gradient-start) 0%,
    var(--button-primary-gradient-end) 100%
  );
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}

.sheet-actions__button--cancel {
  background: rgba(255, 255, 255, 0.78);
  color: var(--color-text-secondary);
}
</style>
