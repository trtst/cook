<template>
  <Layout title="下一餐计划">
    <Login v-if="!sessionStore.isLoggedIn" title="登录后安排下一餐" description="从个人菜谱创建餐次，再发起饭局。" />

    <template v-else>
      <view class="section">
        <text class="section__title">创建计划餐次</text>
        <input v-model="planDate" class="input" placeholder="日期，例如 2026-07-23" />

        <view class="chip-row">
          <view
            v-for="item in mealSlots"
            :key="item.value"
            class="chip"
            :class="{ 'chip--active': mealSlot === item.value }"
            @click="mealSlot = item.value"
          >
            {{ item.label }}
          </view>
        </view>

        <text class="section__hint">选择我的菜谱</text>
        <view v-if="recipes.length" class="recipe-row">
          <view
            v-for="item in recipes"
            :key="item.id"
            class="recipe-chip"
            :class="{ 'recipe-chip--active': selectedRecipeId === item.id }"
            @click="selectedRecipeId = item.id"
          >
            {{ item.title }}
          </view>
        </view>
        <Empty v-else title="还没有个人菜谱" description="先去菜谱页创建或导入一份。" />

        <button class="primary" :disabled="submitting || !selectedRecipeId" @click="createPlan">保存餐次</button>
      </view>

      <view v-if="errorText" class="notice" @click="loadPage">{{ errorText }}</view>
      <view v-if="loading" class="notice">加载中...</view>

      <view v-for="item in plans" :key="item.id" class="section">
        <text class="section__title">{{ item.planDate }} · {{ slotText(item.mealSlot) }}</text>
        <text class="section__hint">{{ item.title }}</text>

        <template v-if="item.hasDiningEvent && item.diningEventId">
          <button class="secondary" @click="loadEvent(item.id, item.diningEventId)">查看饭局</button>
        </template>
        <template v-else>
          <input v-model="eventTime" class="input" placeholder="饭局时间，例如 2026-07-23T19:00:00.000Z" />
          <input v-model="eventLocation" class="input" placeholder="地点，例如 家里" />
          <button class="secondary" :disabled="submitting" @click="createEvent(item.id)">发起饭局</button>
        </template>

        <view v-if="eventMap[item.id]" class="event-box">
          <text class="event-box__title">饭局：{{ eventMap[item.id].title }}</text>
          <text class="event-box__meta">{{ eventMap[item.id].scheduledAt }}</text>
          <text class="event-box__meta">{{ eventMap[item.id].location || "未填写地点" }}</text>
          <button
            v-if="diningGroupStore.currentDiningGroupId"
            class="secondary"
            :disabled="submitting"
            @click="inviteGroup(item.id, eventMap[item.id].id)"
          >
            邀请当前饭搭子
          </button>
          <text v-if="eventMap[item.id].shareTokenPath" class="event-box__meta">{{ eventMap[item.id].shareTokenPath }}</text>

          <view v-if="eventMap[item.id].participants.length" class="participant-list">
            <view v-for="participant in eventMap[item.id].participants" :key="participant.id" class="participant-row">
              <text>{{ participant.guestName || `UID ${participant.userUid ?? "--"}` }}</text>
              <text>{{ participant.bringRecipeTitle || participant.status }}</text>
            </view>
          </view>
        </view>
      </view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import { recipeApi, type MyRecipeSummary } from "@/apis/recipe";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import { mealApi, type DiningEventSummary, type MealPlanSummary } from "../apis/meal";
import { uniPlatform } from "@/platform/uni";
import { useDiningGroupStore } from "@/stores/dining-group";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";

const sessionStore = useSessionStore();
const diningGroupStore = useDiningGroupStore();
const recipes = ref<MyRecipeSummary[]>([]);
const plans = ref<MealPlanSummary[]>([]);
const eventMap = ref<Record<string, DiningEventSummary>>({});
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const selectedRecipeId = ref("");
const planDate = ref("2026-07-23");
const mealSlot = ref<"BREAKFAST" | "LUNCH" | "DINNER">("DINNER");
const eventTime = ref("2026-07-23T19:00:00.000Z");
const eventLocation = ref("家里");

const mealSlots = [
  { value: "BREAKFAST" as const, label: "早餐" },
  { value: "LUNCH" as const, label: "午餐" },
  { value: "DINNER" as const, label: "晚餐" }
];

onShow(() => {
  if (!sessionStore.isLoggedIn) return;
  void loadPage();
});

async function loadPage() {
  if (!sessionStore.isLoggedIn || loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    const [recipeResult, planResult] = await Promise.all([
      recipeApi.listMyRecipes({ page: 1, pageSize: 20 }),
      mealApi.listPlans({ page: 1, pageSize: 50 })
    ]);
    recipes.value = recipeResult.items;
    plans.value = planResult.items;
    if (!recipes.value.some(item => item.id === selectedRecipeId.value)) {
      selectedRecipeId.value = recipes.value[0]?.id ?? "";
    }
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "页面加载失败";
  } finally {
    loading.value = false;
  }
}

async function createPlan() {
  if (!selectedRecipeId.value || submitting.value) return;
  submitting.value = true;
  try {
    await mealApi.createPlan({
      operationId: createOperationId(),
      planDate: planDate.value,
      mealSlot: mealSlot.value,
      recipeId: selectedRecipeId.value
    });
    await uniPlatform.feedback.toast({ title: "餐次已保存", icon: "success" });
    await loadPage();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "保存失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function createEvent(planItemId: string) {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const result = await mealApi.createDiningEvent(planItemId, {
      operationId: createOperationId(),
      scheduledAt: eventTime.value,
      location: eventLocation.value
    });
    eventMap.value = { ...eventMap.value, [planItemId]: result };
    await uniPlatform.feedback.toast({ title: "饭局已创建", icon: "success" });
    await loadPage();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "创建失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function loadEvent(planItemId: string, eventId: string) {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const result = await mealApi.getDiningEvent(eventId);
    eventMap.value = { ...eventMap.value, [planItemId]: result };
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "饭局加载失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function inviteGroup(planItemId: string, eventId: string) {
  if (!diningGroupStore.currentDiningGroupId || submitting.value) return;
  submitting.value = true;
  try {
    const result = await mealApi.inviteDiningGroup(eventId, diningGroupStore.currentDiningGroupId, createOperationId());
    eventMap.value = { ...eventMap.value, [planItemId]: result };
    await uniPlatform.feedback.toast({ title: "已发送邀请", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "邀请失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

function slotText(slot: "BREAKFAST" | "LUNCH" | "DINNER") {
  if (slot === "BREAKFAST") return "早餐";
  if (slot === "LUNCH") return "午餐";
  return "晚餐";
}
</script>

<style scoped lang="scss">
.section,
.notice {
  padding: var(--space-md);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.section + .section {
  margin-top: var(--space-md);
}

.section__title,
.section__hint,
.event-box__title,
.event-box__meta {
  display: block;
}

.section__title,
.event-box__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.section__hint,
.event-box__meta {
  margin-top: 6rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.input {
  width: 100%;
  margin-top: var(--space-sm);
  padding: 20rpx 24rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  box-sizing: border-box;
}

.chip-row,
.recipe-row,
.participant-row {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.chip-row,
.recipe-row {
  margin-top: var(--space-sm);
}

.chip,
.recipe-chip {
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
}

.chip--active,
.recipe-chip--active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.primary,
.secondary {
  margin-top: var(--space-sm);
  border-radius: var(--radius-md);
}

.primary {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.event-box {
  margin-top: var(--space-sm);
  padding: var(--space-md);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.participant-list {
  margin-top: var(--space-sm);
}

.participant-row {
  justify-content: space-between;
  padding: 10rpx 0;
  border-bottom: 1rpx solid var(--color-border-light);
}
</style>
