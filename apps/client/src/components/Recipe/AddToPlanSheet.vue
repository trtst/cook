<template>
  <SheetShell
    :visible="visible"
    title="加入计划"
    :subtitle="needAddToPrivate ? '加入计划会同步保存到私房菜；先选择或创建一个个人分类。' : '选择日期和餐次，这道私房菜会固定到计划中，之后可以按计划准备食材和做饭。'"
    @close="emit('close')"
  >
    <view v-if="loading" class="panel-note">加载中...</view>
    <view v-else-if="errorText" class="panel-note" @click="reload">{{ errorText }}</view>
    <template v-else>
      <view v-if="needAddToPrivate" class="sheet-section sheet-section--category">
        <view class="sheet-section__head">
          <view class="sheet-section__meta">
            <text class="sheet-section__title">私房菜分类</text>
            <text class="sheet-section__tag">必选</text>
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
            @click="selectedCategoryId = item.id"
          >
            {{ item.name }}
          </view>
        </view>
        <text v-if="!categories.length" class="sheet-section__hint">还没有个人分类，请先创建一个。</text>
      </view>

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
        <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="submitting" @click="emit('close')">取消</button>
        <button
          class="sheet-actions__button sheet-actions__button--confirm"
          :disabled="submitting || loading || !canSubmit"
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
import type { UUID } from "@/apis/http";
import { mealApi } from "@/apis/meal";
import { recipeApi, type RecipeCategorySummary } from "@/apis/recipe";
import MealMonthCalendar from "@/components/MealMonthCalendar.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { uniPlatform } from "@/platform/uni";
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

const props = defineProps<{
  visible: boolean;
  recipeId?: UUID | null;
  sourceRecipeId?: UUID | null;
  sourceVersionId?: UUID | null;
  needAddToPrivate: boolean;
}>();

const emit = defineEmits<{
  close: [];
  success: [payload: { recipeId: UUID; addedToPrivate: boolean; planItemId: UUID; planDate: string; mealSlot: MealSlot }];
}>();

const today = todayText();
const mealSlots = MEAL_SLOT_OPTIONS;
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const categories = ref<RecipeCategorySummary[]>([]);
const selectedCategoryId = ref<UUID | "">("");
const categoryDraftName = ref("");
const showCategoryCreator = ref(false);
const categorySubmitting = ref(false);
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
  if (props.needAddToPrivate && !selectedCategoryId.value) return false;
  return !mealSlotItems.value.find(item => item.value === mealSlot.value)?.expired;
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
  () => props.needAddToPrivate,
  needAddToPrivate => {
    if (props.visible && needAddToPrivate) {
      void loadCategories();
    }
  }
);

watch(
  () => [selectedDate.value, nowMs.value] as const,
  () => {
    ensureMealSlotAvailable();
  },
  { immediate: true }
);

function resetSelection() {
  selectedCategoryId.value = "";
  categoryDraftName.value = "";
  showCategoryCreator.value = false;
  categorySubmitting.value = false;
  nowMs.value = Date.now();
  selectedDate.value = today;
  monthDate.value = buildMonthAnchor(today);
  mealSlot.value = resolveNextMealSlot(today);
  errorText.value = "";
}

async function loadOptions() {
  loading.value = true;
  errorText.value = "";
  try {
    if (props.needAddToPrivate) {
      await loadCategories();
    } else {
      categories.value = [];
    }
    await loadPlanMarks(monthDate.value);
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "加入计划信息加载失败";
  } finally {
    loading.value = false;
  }
}

async function loadCategories() {
  categories.value = await recipeApi.listCategories();
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

function toggleCategoryCreator() {
  showCategoryCreator.value = !showCategoryCreator.value;
  if (!showCategoryCreator.value) categoryDraftName.value = "";
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
    categoryDraftName.value = "";
    showCategoryCreator.value = false;
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "创建分类失败", icon: "none" });
  } finally {
    categorySubmitting.value = false;
  }
}

function handleMonthChange(nextMonth: string) {
  monthDate.value = buildMonthAnchor(nextMonth);
  if (buildMonthAnchor(selectedDate.value) !== monthDate.value) {
    selectedDate.value = monthDate.value < buildMonthAnchor(today) ? today : monthDate.value;
  }
  void loadPlanMarks(monthDate.value).catch(error => {
    errorText.value = error instanceof Error ? error.message : "计划信息加载失败";
  });
}

async function submit() {
  if (!canSubmit.value || submitting.value) return;
  submitting.value = true;
  let addedToPrivate = false;
  try {
    if (isMealSlotExpired(selectedDate.value, mealSlot.value, new Date(nowMs.value))) {
      throw new Error("当前时间已经不能安排这餐了");
    }
    let recipeId = props.recipeId ?? null;
    let recipeVersionId: UUID | null = null;
    if (props.needAddToPrivate) {
      if (!selectedCategoryId.value) {
        throw new Error("请选择私房菜分类");
      }
      if (!props.sourceRecipeId || !props.sourceVersionId) {
        throw new Error("当前灵感菜谱信息不完整");
      }
      const result = await recipeApi.createMyRecipeFromInspiration({
        operationId: createOperationId(),
        sourceRecipeId: props.sourceRecipeId,
        sourceVersionId: props.sourceVersionId,
        categoryId: selectedCategoryId.value
      });
      recipeId = result.recipe.id;
      recipeVersionId = result.recipe.contentVersionId;
      addedToPrivate = true;
    } else if (recipeId) {
      const recipe = await recipeApi.getMyRecipe(recipeId);
      recipeVersionId = recipe.contentVersionId;
    }
    if (!recipeId || !recipeVersionId) throw new Error("当前菜谱暂不可加入计划");

    const plan = await mealApi.addPlanItem({
      operationId: createOperationId(),
      planDate: selectedDate.value,
      mealSlot: mealSlot.value,
      recipeId,
      recipeVersionId,
      slotType: null,
      purchaseState: "READY"
    });
    emit("success", {
      recipeId,
      addedToPrivate,
      planItemId: plan.id,
      planDate: plan.planDate,
      mealSlot: plan.mealSlot
    });
    emit("close");
    await uniPlatform.feedback.toast({ title: addedToPrivate ? "已保存到私房菜并加入计划" : "已加入计划", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({
      title: addedToPrivate ? "私房菜已保存，请重试加入计划" : error instanceof Error ? error.message : "加入计划失败",
      icon: "none"
    });
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

.sheet-section--category {
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
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
}

.sheet-section__tag,
.sheet-section__hint {
  color: var(--color-text-tertiary);
  font-size: 22rpx;
}

.sheet-section__action {
  color: var(--color-support-action);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
}

.sheet-section__hint {
  line-height: 1.6;
}

.plan-section__date {
  color: var(--color-text-secondary);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.chip-row,
.meal-slot-row {
  display: flex;
  gap: 16rpx;
}

.chip-row {
  flex-wrap: wrap;
}

.chip,
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

.chip--active {
  background: var(--color-tag-primary-bg);
  box-shadow: inset 0 0 0 1rpx var(--color-border-active);
  color: var(--color-tag-primary-text);
  font-weight: var(--font-weight-semibold);
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
  height: 84rpx;
  padding: 0 28rpx;
  border: 0;
  border-radius: var(--radius-xs);
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 84rpx;
}

.sheet-creator__button::after {
  border: 0;
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
