<template>
  <SheetShell
    :visible="visible"
    title="加入计划"
    subtitle="选择日期和餐次，把选中的菜加入计划。"
    @close="emit('close')"
  >
    <view v-if="loading" class="panel-note">加载中...</view>
    <view v-else-if="errorText" class="panel-note" @click="reload">{{ errorText }}</view>
    <template v-else>
      <view class="sheet-section">
        <MealMonthCalendar
          :selected-date="selectedDate"
          :month-date="monthDate"
          :marks="planMarks"
          :min-date="today"
          @select="selectedDate = $event"
          @month-change="handleMonthChange"
        />
      </view>

      <view class="sheet-section">
        <view class="sheet-section__head">
          <text class="sheet-section__title">安排到哪餐</text>
          <text class="plan-section__date">{{ planDateText }} · {{ mealSlotText }}</text>
        </view>
        <view class="meal-slot-row">
          <view
            v-for="item in mealSlotItems"
            :key="item.value"
            class="meal-slot"
            :class="[
              `meal-slot--${resolveMealSlotTone(item.value)}`,
              mealSlot === item.value ? 'meal-slot--active' : '',
              item.expired ? 'meal-slot--disabled' : ''
            ]"
            @click="selectMealSlot(item.value)"
          >
            {{ item.label }}
          </view>
        </view>
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
          :class="{ 'sheet-actions__button--disabled': submitting || loading || !canSubmit }"
          @click="submit"
        >
          {{ submitting ? "加入中..." : "确认加入" }}
        </button>
      </view>
    </template>
  </SheetShell>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { UnauthorizedError, type UUID } from "@/apis/http";
import { mealApi, type CreateMealPlanRequest } from "@/apis/meal";
import { recipeApi } from "@/apis/recipe";
import MealMonthCalendar from "@/components/MealMonthCalendar.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { uniPlatform } from "@/platform/uni";
import { useLoginModalStore } from "@/stores/login-modal";
import { createOperationId } from "@/utils/operation-id";
import {
  appendMealSlotToMark,
  createEmptyMealCalendarMark,
  isMealSlotExpired,
  MEAL_SLOT_OPTIONS,
  resolveMealSlotTone,
  type MealCalendarMark,
  type MealSlot
} from "@/utils/meal-slot";
import { formatDateOnly, parseDateOnly, todayText } from "@/utils/date";

interface AddToPlanRecipeItem {
  recipeId: UUID;
  recipeVersionId?: UUID;
  slotType?: "MEAT" | "VEGETABLE" | "SOUP" | "STAPLE" | "BREAKFAST_STAPLE" | "BREAKFAST_PROTEIN" | "BREAKFAST_SIDE" | null;
  sortOrder?: number;
  purchaseState?: "READY" | "PENDING";
}

const props = defineProps<{
  visible: boolean;
  items: AddToPlanRecipeItem[];
  initialMealSlot?: MealSlot;
  successToastPlacement?: "top" | "bottom";
  successToastBottomOffset?: number;
}>();

const loginModalStore = useLoginModalStore();

const emit = defineEmits<{
  close: [];
  success: [payload: { planItemId: UUID; planDate: string; mealSlot: MealSlot }];
}>();

const today = todayText();
const mealSlots = MEAL_SLOT_OPTIONS;
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const selectedDate = ref(today);
const monthDate = ref(buildMonthAnchor(today));
const mealSlot = ref<MealSlot>("DINNER");
const planMarks = ref<Record<string, MealCalendarMark>>({});
const nowMs = ref(Date.now());
let planMarksSeq = 0;
let nowTimer: ReturnType<typeof setInterval> | null = null;

const mealSlotItems = computed(() => {
  const now = new Date(nowMs.value);
  return mealSlots.map(item => ({
    ...item,
    expired: isMealSlotExpired(selectedDate.value, item.value, now)
  }));
});
const canSubmit = computed(() => {
  return props.items.length > 0 && !mealSlotItems.value.find(item => item.value === mealSlot.value)?.expired;
});
const planDateText = computed(() => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(selectedDate.value);
  return match ? `${Number(match[2])}月${Number(match[3])}日` : selectedDate.value;
});
const mealSlotText = computed(() => mealSlots.find(item => item.value === mealSlot.value)?.label || "晚餐");

watch(
  () => props.visible,
  visible => {
    syncNowTimer(visible);
    if (!visible) return;
    nowMs.value = Date.now();
    resetSelection();
    void loadOptions();
  },
  { immediate: true }
);

watch(
  () => [selectedDate.value, nowMs.value] as const,
  () => {
    ensureMealSlotAvailable();
  },
  { immediate: true }
);

function resetSelection() {
  nowMs.value = Date.now();
  selectedDate.value = today;
  monthDate.value = buildMonthAnchor(today);
  mealSlot.value = props.initialMealSlot ?? resolveNextMealSlot(today);
  errorText.value = "";
}

async function loadOptions() {
  loading.value = true;
  errorText.value = "";
  try {
    await loadPlanMarks(monthDate.value);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      errorText.value = "";
      loginModalStore.open(null, () => void loadOptions());
    } else {
      errorText.value = error instanceof Error ? error.message : "加入计划信息加载失败";
    }
  } finally {
    loading.value = false;
  }
}

async function loadPlanMarks(nextMonth = monthDate.value) {
  const requestSeq = ++planMarksSeq;
  try {
    const monthStart = parseDateOnly(nextMonth);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 12, 0, 0, 0);
    const plans = await mealApi.listAllPlans({
      from: formatDateOnly(monthStart),
      to: formatDateOnly(monthEnd)
    });
    if (requestSeq !== planMarksSeq) return;
    const marks: Record<string, MealCalendarMark> = {};
    for (const plan of plans) {
      const current = marks[plan.planDate] ?? createEmptyMealCalendarMark();
      appendMealSlotToMark(current, plan.mealSlot);
      marks[plan.planDate] = current;
    }
    planMarks.value = marks;
  } catch (error) {
    if (requestSeq !== planMarksSeq) return;
    planMarks.value = {};
    throw error;
  }
}

function reload() {
  void loadOptions();
}

function syncNowTimer(visible: boolean) {
  if (nowTimer) {
    clearInterval(nowTimer);
    nowTimer = null;
  }
  if (!visible) return;
  nowTimer = setInterval(() => {
    nowMs.value = Date.now();
  }, 30_000);
}

function resolveNextMealSlot(dateText: string) {
  const now = new Date(nowMs.value);
  return mealSlots.find(item => !isMealSlotExpired(dateText, item.value, now))?.value ?? "LATE_NIGHT";
}

function ensureMealSlotAvailable() {
  const now = new Date(nowMs.value);
  if (!isMealSlotExpired(selectedDate.value, mealSlot.value, now)) return;
  mealSlot.value = resolveNextMealSlot(selectedDate.value);
}

function selectMealSlot(value: MealSlot) {
  const now = new Date(nowMs.value);
  if (isMealSlotExpired(selectedDate.value, value, now)) return;
  mealSlot.value = value;
}

function handleClose() {
  if (submitting.value) return;
  emit("close");
}

function handleMonthChange(nextMonth: string) {
  monthDate.value = buildMonthAnchor(nextMonth);
  if (buildMonthAnchor(selectedDate.value) !== monthDate.value) {
    selectedDate.value = monthDate.value < buildMonthAnchor(today) ? today : monthDate.value;
  }
  void loadPlanMarks(monthDate.value).catch(error => {
    if (error instanceof UnauthorizedError) {
      errorText.value = "";
      loginModalStore.open(null, () => void loadOptions());
    } else {
      errorText.value = error instanceof Error ? error.message : "计划信息加载失败";
    }
  });
}

async function submit() {
  if (!canSubmit.value || submitting.value) return;
  submitting.value = true;
  try {
    if (isMealSlotExpired(selectedDate.value, mealSlot.value, new Date(nowMs.value))) {
      throw new Error("当前时间已经不能安排这餐了");
    }
    const plans = await mealApi.listPlans({ from: selectedDate.value, to: selectedDate.value, page: 1, pageSize: 10 });
    const currentPlan = plans.items.find(item => item.mealSlot === mealSlot.value) ?? null;
    const menuByVersion = new Map<UUID, CreateMealPlanRequest["menuItems"][number]>();
    for (const [index, item] of (currentPlan?.menuItems ?? []).entries()) {
      menuByVersion.set(item.recipeVersionId, {
        recipeId: item.recipeId,
        recipeVersionId: item.recipeVersionId,
        slotType: item.slotType,
        sortOrder: index,
        purchaseState: item.purchaseState
      });
    }
    for (const [index, item] of props.items.entries()) {
      const recipeVersionId = item.recipeVersionId ?? (await recipeApi.getMyRecipe(item.recipeId)).contentVersionId;
      if (menuByVersion.has(recipeVersionId)) continue;
      menuByVersion.set(recipeVersionId, {
        recipeId: item.recipeId,
        recipeVersionId,
        slotType: item.slotType ?? null,
        sortOrder: item.sortOrder ?? index,
        purchaseState: item.purchaseState ?? "READY"
      });
    }
    const body: CreateMealPlanRequest = {
      operationId: createOperationId(),
      planDate: selectedDate.value,
      mealSlot: mealSlot.value,
      expectedVersion: currentPlan?.version ?? null,
      menuItems: Array.from(menuByVersion.values()).map((item, sortOrder) => ({ ...item, sortOrder }))
    };
    const plan = await mealApi.createPlan(body);
    emit("success", {
      planItemId: plan.id,
      planDate: plan.planDate,
      mealSlot: plan.mealSlot
    });
    emit("close");
    await uniPlatform.feedback.toast({
      title: "已加入计划",
      icon: "success",
      placement: props.successToastPlacement ?? "top",
      bottomOffset: props.successToastBottomOffset
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      loginModalStore.open();
    } else {
      await uniPlatform.feedback.toast({
        title: error instanceof Error ? error.message : "加入计划失败",
        icon: "none"
      });
    }
  } finally {
    submitting.value = false;
  }
}

function buildMonthAnchor(dateText: string) {
  const date = parseDateOnly(dateText);
  return formatDateOnly(new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0));
}

onUnmounted(() => {
  if (nowTimer) {
    clearInterval(nowTimer);
    nowTimer = null;
  }
});
</script>

<style scoped lang="scss">
.sheet-section {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.sheet-section + .sheet-section {
  margin-top: 28rpx;
}

.sheet-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.sheet-section__title {
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: var(--font-weight-semibold);
}

.plan-section__date {
  color: var(--color-text-secondary);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.meal-slot-row {
  display: flex;
  gap: 16rpx;
}

.meal-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50rpx;
  padding: 0 24rpx;
  border-radius: var(--radius-pill);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.meal-slot {
  flex: 1;
}

.meal-slot--disabled {
  opacity: 0.38;
}

.meal-slot--active {
  font-weight: var(--font-weight-semibold);
}

.meal-slot--active.meal-slot--breakfast {
  background: var(--meal-slot-breakfast-soft);
  color: var(--meal-slot-breakfast);
}

.meal-slot--active.meal-slot--lunch {
  background: var(--meal-slot-lunch-soft);
  color: var(--meal-slot-lunch);
}

.meal-slot--active.meal-slot--afternoon-tea {
  background: var(--meal-slot-afternoon-tea-soft);
  color: var(--meal-slot-afternoon-tea);
}

.meal-slot--active.meal-slot--dinner {
  background: var(--meal-slot-dinner-soft);
  color: var(--meal-slot-dinner);
}

.meal-slot--active.meal-slot--late-night {
  background: var(--meal-slot-late-night-soft);
  color: var(--meal-slot-late-night);
}

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
  align-items: center;
  gap: 16rpx;
}

.sheet-actions__button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
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
