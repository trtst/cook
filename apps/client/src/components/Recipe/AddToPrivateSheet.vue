<template>
  <SheetShell
    :visible="visible"
    :title="isSaved ? '已添加到私房菜' : '添加到私房菜'"
    :subtitle="isSaved ? '移除后，这道灵感菜谱会从你的私房菜中移除。' : '选择个人分类后添加。灵感固定版本和原作者署名会保留。'"
    @close="closeSheet"
  >
    <view v-if="isSaved" class="save-note">
      <text class="save-note__title">灵感固定版本已在私房菜中</text>
      <text class="save-note__text">添加不会创建个人菜谱副本。</text>
    </view>
    <view v-else-if="loading" class="panel-note">加载个人分类中...</view>
    <view v-else-if="errorText" class="panel-note" @click="loadCategories">{{ errorText }}，点此重试</view>
    <view v-else class="sheet-section">
      <view class="sheet-section__head">
        <text class="sheet-section__title">选择个人分类</text>
        <text class="sheet-section__action" @click="toggleCategoryCreator">{{ showCategoryCreator ? "取消" : "新建分类" }}</text>
      </view>
      <view v-if="showCategoryCreator" class="sheet-creator">
        <input
          v-model="categoryDraftName"
          class="sheet-creator__input"
          maxlength="16"
          placeholder="输入分类名称"
          :disabled="categorySubmitting"
        />
        <button
          class="sheet-creator__button"
          :class="{ 'sheet-creator__button--disabled': categorySubmitting || !categoryDraftName.trim() }"
          @click="createCategory"
        >{{ categorySubmitting ? "创建中..." : "确定" }}</button>
      </view>
      <view v-if="categories.length" class="chip-row">
        <view
          v-for="item in categories"
          :key="item.id"
          class="chip"
          :class="{ 'chip--active': selectedCategoryId === item.id }"
          @click="selectedCategoryId = item.id"
        >{{ item.name }}</view>
      </view>
      <text v-else class="sheet-section__hint">还没有个人分类，请先创建一个。</text>
    </view>

    <template #footer>
      <view class="sheet-actions">
        <button class="sheet-actions__button sheet-actions__button--cancel" :class="{ 'sheet-actions__button--disabled': submitting || categorySubmitting }" @click="closeSheet">取消</button>
        <button
          class="sheet-actions__button sheet-actions__button--confirm"
          :class="{ 'sheet-actions__button--disabled': isDisabled }"
          @click="submit"
        >{{ submitting ? "处理中…" : isSaved ? "从私房菜移除" : "添加到私房菜" }}</button>
      </view>
    </template>
  </SheetShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { UnauthorizedError, type UUID } from "@/apis/http";
import { recipeApi, type RecipeCategorySummary, type SavedInspirationMutationResult } from "@/apis/recipe";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { uniPlatform } from "@/platform/uni";
import { useLoginModalStore } from "@/stores/login-modal";
import { createOperationId } from "@/utils/operation-id";

const props = withDefaults(defineProps<{
  visible: boolean;
  sourceRecipeId: UUID;
  sourceVersionId: UUID;
  isSaved: boolean;
  saveId: UUID | null;
}>(), {
  isSaved: false,
  saveId: null
});

const loginModalStore = useLoginModalStore();
const emit = defineEmits<{
  close: [];
  success: [result: SavedInspirationMutationResult];
}>();

const submitting = ref(false);
const loading = ref(false);
const errorText = ref("");
const categories = ref<RecipeCategorySummary[]>([]);
const selectedCategoryId = ref<UUID | "">("");
const categoryDraftName = ref("");
const showCategoryCreator = ref(false);
const categorySubmitting = ref(false);
const isDisabled = computed(() => submitting.value || categorySubmitting.value || (props.isSaved ? !props.saveId : !selectedCategoryId.value || loading.value || !!errorText.value));

watch(() => props.visible, visible => {
  if (!visible) return;
  submitting.value = false;
  selectedCategoryId.value = "";
  categoryDraftName.value = "";
  showCategoryCreator.value = false;
  errorText.value = "";
  if (!props.isSaved) void loadCategories();
}, { immediate: true });

async function loadCategories() {
  loading.value = true;
  errorText.value = "";
  try {
    categories.value = await recipeApi.listCategories();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      loginModalStore.open(null, () => void loadCategories());
    } else {
      errorText.value = error instanceof Error ? error.message : "个人分类加载失败";
    }
  } finally {
    loading.value = false;
  }
}

function toggleCategoryCreator() {
  showCategoryCreator.value = !showCategoryCreator.value;
  if (!showCategoryCreator.value) categoryDraftName.value = "";
}

function closeSheet() {
  if (submitting.value || categorySubmitting.value) return;
  emit("close");
}

async function createCategory() {
  const name = categoryDraftName.value.trim();
  if (!name || categorySubmitting.value) return;
  if (name.length > 16) {
    await uniPlatform.feedback.toast({ title: "分类最多16个字", icon: "none" });
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
    if (error instanceof UnauthorizedError) loginModalStore.open();
    else await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "创建分类失败", icon: "none" });
  } finally {
    categorySubmitting.value = false;
  }
}

async function submit() {
  if (isDisabled.value) return;
  submitting.value = true;
  try {
    const result = props.isSaved && props.saveId
      ? await recipeApi.removeSavedInspiration(props.saveId, createOperationId())
      : await recipeApi.saveInspirationToPrivate({
          operationId: createOperationId(),
          sourceRecipeId: props.sourceRecipeId,
          sourceVersionId: props.sourceVersionId,
          categoryId: selectedCategoryId.value as UUID
        });
    emit("success", result);
    emit("close");
    await uniPlatform.feedback.toast({ title: result.isSavedToPrivate ? "已添加到私房菜" : "已从私房菜移除", icon: "success" });
  } catch (error) {
    if (error instanceof UnauthorizedError) loginModalStore.open(null, () => void submit());
    else await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "操作失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.sheet-section { display: flex; flex-direction: column; gap: 16rpx; }
.sheet-section__head { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; }
.sheet-section__title { color: var(--color-text-primary); font-size: 30rpx; font-weight: 600; }
.sheet-section__action { color: var(--color-support-action); font-size: 24rpx; font-weight: 600; }
.sheet-section__hint { color: var(--color-text-secondary); font-size: 24rpx; }
.sheet-creator { display: flex; gap: 16rpx; }
.sheet-creator__input { flex: 1; height: 72rpx; padding: 0 20rpx; border-radius: var(--radius-sm); background: var(--material-card-bg); }
.sheet-creator__button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 112rpx;
  height: 72rpx;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  font-size: 24rpx;
  line-height: 1;
  text-align: center;
}
.sheet-creator__button::after { border: 0; }
.sheet-creator__button--disabled { opacity: 0.55; }
.chip-row { display: flex; flex-wrap: wrap; gap: 16rpx; }
.chip { display: flex; align-items: center; min-height: 70rpx; padding: 0 24rpx; border-radius: var(--radius-pill); background: var(--material-card-bg); color: var(--color-text-secondary); font-size: 24rpx; }
.chip--active { background: var(--button-primary-bg); color: var(--button-primary-text); }
.save-note { display: flex; flex-direction: column; gap: 12rpx; margin: 8rpx 0 20rpx; padding: 24rpx; border-radius: var(--radius-sm); background: var(--material-card-bg); }
.save-note__title { color: var(--color-text-primary); font-size: 28rpx; font-weight: 600; }
.save-note__text { color: var(--color-text-secondary); font-size: 24rpx; line-height: 1.6; }
.panel-note { padding: 24rpx 0; color: var(--color-text-secondary); font-size: 24rpx; }
.sheet-actions { display: flex; align-items: center; gap: 20rpx; }
.sheet-actions__button {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 999rpx;
  font-size: 28rpx;
  line-height: 1;
  text-align: center;
}
.sheet-actions__button::after { border: 0; }
.sheet-actions__button--cancel { background: var(--button-secondary-bg); color: var(--button-secondary-text); }
.sheet-actions__button--confirm { background: var(--button-primary-bg); color: var(--button-primary-text); }
.sheet-actions__button--disabled { opacity: 0.55; }
</style>
