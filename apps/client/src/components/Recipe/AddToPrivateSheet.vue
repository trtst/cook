<template>
  <SheetShell
    :visible="visible"
    :title="isSaved ? '已收藏到私房菜' : '收藏到私房菜'"
    :subtitle="isSaved ? '移除后，这道灵感菜谱会从你的私房菜收藏中消失。' : '收藏后可在私房菜的“收藏的灵感”中查看，原整理者署名和固定版本会保留。'"
    @close="emit('close')"
  >
    <view class="save-note">
      <text class="save-note__title">只保存灵感菜谱的固定版本</text>
      <text class="save-note__text">收藏不会创建个人菜谱副本。需要修改时，可从灵感详情单独改编并发布。</text>
    </view>

    <template #footer>
      <view class="sheet-actions">
        <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="submitting" @click="emit('close')">取消</button>
        <button
          class="sheet-actions__button sheet-actions__button--confirm"
          :class="{ 'sheet-actions__button--disabled': submitting }"
          :disabled="submitting || (isSaved && !saveId)"
          @click="submit"
        >{{ submitting ? '处理中…' : isSaved ? '移除收藏' : '收藏到私房菜' }}</button>
      </view>
    </template>
  </SheetShell>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { UnauthorizedError, type UUID } from "@/apis/http";
import { recipeApi, type SavedInspirationMutationResult } from "@/apis/recipe";
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

watch(() => props.visible, visible => {
  if (visible) submitting.value = false;
});

async function submit() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const result = props.isSaved && props.saveId
      ? await recipeApi.removeSavedInspiration(props.saveId, createOperationId())
      : await recipeApi.saveInspirationToPrivate({
          operationId: createOperationId(),
          sourceRecipeId: props.sourceRecipeId,
          sourceVersionId: props.sourceVersionId
        });
    emit("success", result);
    emit("close");
    await uniPlatform.feedback.toast({ title: result.isSavedToPrivate ? "已收藏到私房菜" : "已从私房菜移除", icon: "success" });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      loginModalStore.open(null, () => void submit());
    } else {
      await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "收藏操作失败", icon: "none" });
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.save-note {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin: 8rpx 0 20rpx;
  padding: 24rpx;
  border-radius: var(--radius-sm);
  background: var(--material-card-bg);
}

.save-note__title {
  color: var(--color-text-primary);
  font-size: 28rpx;
  font-weight: 600;
}

.save-note__text {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.sheet-actions {
  display: flex;
  gap: 20rpx;
}

.sheet-actions__button {
  flex: 1;
  height: 88rpx;
  margin: 0;
  border-radius: 999rpx;
  font-size: 28rpx;
}

.sheet-actions__button::after {
  border: 0;
}

.sheet-actions__button--cancel {
  background: var(--button-secondary-bg);
  color: var(--button-secondary-text);
}

.sheet-actions__button--confirm {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
}

.sheet-actions__button--disabled {
  opacity: 0.55;
}
</style>
