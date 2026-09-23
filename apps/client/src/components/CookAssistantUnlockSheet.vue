<template>
  <SheetShell
    :visible="visible"
    title="炊火智厨"
    :mask-closable="!submitting"
    @close="handleClose"
  >
    <view class="cook-assistant-unlock-sheet">
      <view class="cook-assistant-unlock-sheet__usage">
        <text class="cook-assistant-unlock-sheet__usage-label">当前可用次数</text>
        <text class="cook-assistant-unlock-sheet__usage-value">
          {{ loading ? "读取中..." : remainingCount + " 次" }}
        </text>
      </view>
      <text class="cook-assistant-unlock-sheet__description">
        {{ descriptionText }}
      </text>
      <text v-if="requestAt" class="cook-assistant-unlock-sheet__request-time">申请时间：{{ formatDateTime(requestAt) }}</text>
      <text v-if="rejectionReason" class="cook-assistant-unlock-sheet__error">{{ rejectionReason }}</text>
      <text v-if="errorText" class="cook-assistant-unlock-sheet__error">{{ errorText }}</text>
    </view>

    <template #footer>
      <view class="cook-assistant-unlock-sheet__actions">
        <button
          class="cook-assistant-unlock-sheet__button cook-assistant-unlock-sheet__button--cancel"
          :class="{ 'cook-assistant-unlock-sheet__button--disabled': submitting }"
          @click="handleClose"
        >
          取消
        </button>
        <button
          class="cook-assistant-unlock-sheet__button cook-assistant-unlock-sheet__button--confirm"
          :class="{ 'cook-assistant-unlock-sheet__button--disabled': submitting || loading || !canUnlock }"
          @click="handleUnlock"
        >
          {{ submitting ? "申请中..." : actionText }}
        </button>
      </view>
    </template>
  </SheetShell>
</template>

<script setup lang="ts">
import { computed } from "vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";

const props = defineProps<{
  visible: boolean;
  loading: boolean;
  remainingCount: number;
  canUnlock: boolean;
  submitting: boolean;
  errorText: string;
  wikiStatus?: "MISSING" | "PENDING" | "GENERATING" | "NEEDS_REVIEW" | "READY" | "FAILED" | "REJECTED";
  requestAt?: string | null;
  rejectionReason?: string | null;
}>();

const emit = defineEmits<{
  close: [];
  unlock: [];
}>();

function handleClose() {
  if (props.submitting) return;
  emit("close");
}

function handleUnlock() {
  if (props.submitting || props.loading || !props.canUnlock) return;
  emit("unlock");
}

const descriptionText = computed(() => {
  if (!props.wikiStatus) return "AI 智能分析当前菜谱，拆解烹饪步骤与操作要点，让你边看边做更轻松。";
  if (props.wikiStatus === "READY") return "Wiki 已准备好，解锁后即可打开炊火智厨。";
  if (props.wikiStatus === "PENDING" || props.wikiStatus === "GENERATING" || props.wikiStatus === "NEEDS_REVIEW") {
    return "Wiki 正在制作中，完成后会通知你。申请本身不再重复扣次。";
  }
  if (props.wikiStatus === "REJECTED") return "当前菜谱不满足生成条件，请重新编辑菜谱后再申请。";
  return "当前还没有可用 Wiki，申请后由后台补充烹饪步骤与操作要点。";
});

const actionText = computed(() => {
  if (!props.wikiStatus) return "立即解锁";
  if (props.wikiStatus === "READY") return "立即解锁";
  if (props.wikiStatus === "PENDING" || props.wikiStatus === "GENERATING" || props.wikiStatus === "NEEDS_REVIEW") return "已申请";
  if (props.wikiStatus === "REJECTED") return "请先编辑菜谱";
  return "申请 Wiki";
});

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
</script>

<style scoped lang="scss">
.cook-assistant-unlock-sheet {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.cook-assistant-unlock-sheet__usage {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 24rpx;
  border-radius: var(--radius-lg);
  background: var(--color-surface-muted);
}

.cook-assistant-unlock-sheet__usage-label,
.cook-assistant-unlock-sheet__description,
.cook-assistant-unlock-sheet__error {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.cook-assistant-unlock-sheet__usage-value {
  flex: 0 0 auto;
  color: var(--color-support-action);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-heavy);
}

.cook-assistant-unlock-sheet__description,
.cook-assistant-unlock-sheet__error {
  display: block;
}

.cook-assistant-unlock-sheet__error {
  color: var(--color-state-danger-text);
}

.cook-assistant-unlock-sheet__actions {
  display: flex;
  gap: 18rpx;
}

.cook-assistant-unlock-sheet__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 90rpx;
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  text-align: center;
}

.cook-assistant-unlock-sheet__button::after {
  border: 0;
}

.cook-assistant-unlock-sheet__button--cancel {
  background: var(--button-secondary-bg);
  color: var(--button-secondary-text);
  -webkit-backdrop-filter: var(--button-secondary-filter);
  backdrop-filter: var(--button-secondary-filter);
}

.cook-assistant-unlock-sheet__button--confirm {
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}

.cook-assistant-unlock-sheet__button--disabled {
  opacity: 0.46;
}
</style>
