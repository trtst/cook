<template>
  <SheetShell
    :visible="visible"
    title="加到私房菜"
    subtitle="先选一个个人分类，加到私房菜后就会生成你的私房菜副本。"
    @close="emit('close')"
  >
    <view v-if="loading" class="panel-note">加载中...</view>
    <view v-else-if="errorText" class="panel-note" @click="reload">{{ errorText }}</view>
    <template v-else>
      <view class="sheet-section sheet-section--category">
        <view class="sheet-section__head">
          <view class="sheet-section__meta">
            <text class="sheet-section__title">私房菜分类</text>
            <text class="sheet-section__tag">以后方便查找</text>
          </view>
          <view class="sheet-section__action" @click="toggleCategoryCreator">
            {{ showCategoryCreator ? "取消" : "创建" }}
          </view>
        </view>

        <view v-if="showCategoryCreator" class="sheet-creator">
          <input
            v-model="categoryDraftName"
            class="sheet-creator__input"
            maxlength="8"
            placeholder="输入分类名称"
            :disabled="categorySubmitting"
          />
          <button
            class="sheet-creator__button"
            :class="{ 'sheet-creator__button--disabled': categorySubmitting || !categoryDraftName.trim() }"
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
            @click="selectedCategoryId = item.id"
          >
            {{ item.name }}
          </view>
        </view>
        <text v-else class="sheet-section__hint">还没有个人分类，请先创建一个。</text>
      </view>
    </template>

    <template #footer>
      <view class="sheet-actions">
        <button
          class="sheet-actions__button sheet-actions__button--cancel"
          :class="{ 'sheet-actions__button--disabled': submitting }"
          @click="handleClose"
        >取消</button>
        <button
          class="sheet-actions__button sheet-actions__button--confirm"
          :class="{ 'sheet-actions__button--disabled': submitting || loading || !selectedCategoryId }"
          @click="submit"
        >
          {{ submitting ? "添加中..." : "加到私房菜" }}
        </button>
      </view>
    </template>
  </SheetShell>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { UnauthorizedError, type UUID } from "@/apis/http";
import { recipeApi, type RecipeCategorySummary } from "@/apis/recipe";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { uniPlatform } from "@/platform/uni";
import { useLoginModalStore } from "@/stores/login-modal";
import { createOperationId } from "@/utils/operation-id";

const props = defineProps<{
  visible: boolean;
  sourceRecipeId: UUID;
  sourceVersionId: UUID;
}>();

const loginModalStore = useLoginModalStore();

const emit = defineEmits<{
  close: [];
  success: [recipeId: UUID];
}>();

const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const categories = ref<RecipeCategorySummary[]>([]);
const selectedCategoryId = ref<UUID | "">("");
const categoryDraftName = ref("");
const showCategoryCreator = ref(false);
const categorySubmitting = ref(false);

watch(
  () => props.visible,
  visible => {
    if (!visible) return;
    selectedCategoryId.value = "";
    categoryDraftName.value = "";
    showCategoryCreator.value = false;
    errorText.value = "";
    void loadCategories();
  },
  { immediate: true }
);

async function loadCategories() {
  loading.value = true;
  errorText.value = "";
  try {
    categories.value = await recipeApi.listCategories();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      errorText.value = "";
      loginModalStore.open(null, () => void loadCategories());
    } else {
      errorText.value = error instanceof Error ? error.message : "分类加载失败";
    }
  } finally {
    loading.value = false;
  }
}

function reload() {
  void loadCategories();
}

function toggleCategoryCreator() {
  showCategoryCreator.value = !showCategoryCreator.value;
  if (!showCategoryCreator.value) categoryDraftName.value = "";
}

async function createCategory() {
  const name = categoryDraftName.value.trim();
  if (!name || categorySubmitting.value) return;
  if (name.length > 8) {
    await uniPlatform.feedback.toast({ title: "分类最多8个字", icon: "none" });
    return;
  }
  categorySubmitting.value = true;
  try {
    const created = await recipeApi.createCategory({ operationId: createOperationId(), name });
    categories.value = [...categories.value, created];
    selectedCategoryId.value = created.id;
    categoryDraftName.value = "";
    showCategoryCreator.value = false;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      loginModalStore.open();
    } else {
      await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "创建分类失败", icon: "none" });
    }
  } finally {
    categorySubmitting.value = false;
  }
}

function handleClose() {
  if (submitting.value) return;
  emit("close");
}

async function submit() {
  if (!selectedCategoryId.value || submitting.value) return;
  submitting.value = true;
  try {
    const result = await recipeApi.createMyRecipeFromInspiration({
      operationId: createOperationId(),
      sourceRecipeId: props.sourceRecipeId,
      sourceVersionId: props.sourceVersionId,
      categoryId: selectedCategoryId.value
    });
    emit("success", result.recipe.id);
    emit("close");
    await uniPlatform.feedback.toast({ title: "已加到私房菜", icon: "success" });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      loginModalStore.open();
    } else {
      await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "保存失败", icon: "none" });
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.sheet-section {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.sheet-section--category {
  margin-top: 24rpx;
}

.sheet-section__head,
.sheet-section__meta {
  display: flex;
  align-items: center;
}

.sheet-section__head {
  justify-content: space-between;
  gap: 20rpx;
}

.sheet-section__meta {
  gap: 12rpx;
}

.sheet-section__title {
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: var(--font-weight-semibold);
}

.sheet-section__tag,
.sheet-section__hint {
  color: var(--color-text-tertiary);
  font-size: 22rpx;
}

.sheet-section__hint {
  line-height: 1.6;
}

.sheet-section__action {
  color: var(--color-support-action);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.chip {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 70rpx;
  padding: 0 24rpx;
  border-radius: var(--radius-pill);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.chip--active {
  background: var(--color-tag-primary-bg);
  box-shadow: inset 0 0 0 1rpx var(--color-border-active);
  color: var(--color-tag-primary-text);
  font-weight: var(--font-weight-semibold);
}

.sheet-creator {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.sheet-creator__input {
  flex: 1;
  min-width: 0;
  height: 80rpx;
  line-height: 1;
  padding: 0 24rpx;
  border: 1rpx solid var(--material-input-border);
  border-radius: var(--radius-xs);
  background: var(--material-input-bg);
  box-shadow: var(--material-input-shadow);
  color: var(--color-text);
  font-size: 26rpx;
  -webkit-backdrop-filter: var(--material-input-filter);
  backdrop-filter: var(--material-input-filter);
}

.sheet-creator__button {
  flex: 0 0 auto;
  height: 80rpx;
  padding: 0 28rpx;
  border: 0;
  border-radius: var(--radius-xs);
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 80rpx;
}

.sheet-creator__button--disabled,
.sheet-actions__button--disabled {
  opacity: 0.46;
}

.panel-note {
  padding: 28rpx 24rpx;
  border-radius: 24rpx;
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
  text-align: center;
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.sheet-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 22rpx;
}

.sheet-actions__button {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  height: 90rpx;
  border: 0;
  border-radius: var(--radius-pill);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.sheet-actions__button::after {
  border: 0;
}

.sheet-actions__button--cancel {
  background: var(--button-secondary-bg);
  color: var(--button-secondary-text);
  -webkit-backdrop-filter: var(--button-secondary-filter);
  backdrop-filter: var(--button-secondary-filter);
}

.sheet-actions__button--confirm {
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  -webkit-backdrop-filter: var(--button-primary-filter);
  backdrop-filter: var(--button-primary-filter);
}
</style>
