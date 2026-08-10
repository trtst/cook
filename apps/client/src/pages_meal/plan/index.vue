<template>
  <page-meta :page-style="pageStyle" />
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
        <view class="section__heading">
          <text class="section__title">{{ item.planDate }} · {{ slotText(item.mealSlot) }}</text>
          <text class="section__status" :class="{ 'section__status--done': item.status === 'COMPLETED' }">
            {{ item.status === "COMPLETED" ? "已完成用餐" : "待开饭" }}
          </text>
        </view>
        <text class="section__hint">{{ item.title }}</text>
        <text v-if="item.menuItems.length > 1" class="section__meta">
          {{ item.menuItems.map(menuItem => menuItem.title).join(" · ") }}
        </text>
        <text v-if="item.completedAt" class="section__meta">完成时间：{{ formatDateTimeMinute(item.completedAt, "--") }}</text>

        <template v-if="item.hasDiningEvent && item.diningEventId">
          <button class="secondary" @click="loadEvent(item.id, item.diningEventId)">查看饭局</button>
        </template>
        <template v-else-if="item.status !== 'COMPLETED'">
          <input v-model="eventTime" class="input" placeholder="饭局时间，例如 2026-07-23T19:00:00.000Z" />
          <input v-model="eventLocation" class="input" placeholder="地点，例如 家里" />
          <button class="secondary" :disabled="submitting" @click="createEvent(item.id)">发起饭局</button>
        </template>
        <text v-else class="section__meta">已完成用餐的餐次不能再发起饭局。</text>

        <view v-if="eventMap[item.id]" class="event-box">
          <text class="event-box__title">饭局：{{ eventMap[item.id].title }}</text>
          <text class="event-box__meta">{{ formatDateTimeMinute(eventMap[item.id].scheduledAt, "--") }}</text>
          <text class="event-box__meta">{{ eventMap[item.id].location || "未填写地点" }}</text>
          <text class="event-box__meta">
            {{ eventMap[item.id].status === "COMPLETED" ? "饭局已完成" : "饭局进行中" }}
          </text>
          <text v-if="eventMap[item.id].completedAt" class="event-box__meta">
            完成时间：{{ formatDateTimeMinute(eventMap[item.id].completedAt, "--") }}
          </text>
          <button
            v-if="diningGroupStore.currentDiningGroupId"
            class="secondary"
            :disabled="submitting"
            @click="inviteGroup(item.id, eventMap[item.id].id)"
          >
            邀请当前饭搭子
          </button>
          <button
            v-if="eventMap[item.id].status !== 'COMPLETED'"
            class="secondary"
            :disabled="submitting"
            @click="completeEvent(item.id, eventMap[item.id].id)"
          >
            完成饭局
          </button>
          <button
            v-if="eventMap[item.id].completedAt"
            class="secondary"
            :disabled="submitting"
            @click="openMemory(eventMap[item.id].id)"
          >
            查看饭搭子卡
          </button>
          <text v-if="eventMap[item.id].shareTokenPath" class="event-box__meta">分享预览：{{ eventMap[item.id].shareTokenPath }}</text>

          <view v-if="eventMap[item.id].menuItems.length" class="menu-list">
            <text class="menu-list__title">我来做</text>
            <view v-for="menuItem in eventMap[item.id].menuItems" :key="menuItem.id" class="menu-row">
              <view class="menu-row__main">
                <text class="menu-row__name">{{ menuItem.title }}</text>
                <text class="menu-row__meta">
                  {{ resolveCookMeta(menuItem.cookName, menuItem.cookUserUid) }}
                </text>
              </view>
              <button
                v-if="canShowCookAction(eventMap[item.id], menuItem.cookUserUid)"
                class="secondary menu-row__action"
                :disabled="submitting || isCookPending(menuItem.id)"
                @click="toggleCookClaim(item.id, eventMap[item.id], menuItem)"
              >
                {{ isCookPending(menuItem.id) ? "提交中" : resolveCookActionText(menuItem.cookUserUid) }}
              </button>
            </view>
          </view>

          <view v-if="eventMap[item.id].participants.length" class="participant-list">
            <view v-for="participant in eventMap[item.id].participants" :key="participant.id" class="participant-row">
              <text>{{ participant.guestName || `UID ${participant.userUid ?? "--"}` }}</text>
              <text>{{ participant.bringRecipeTitle || participant.status }}</text>
            </view>
          </view>
        </view>

        <button
          v-if="item.status !== 'COMPLETED'"
          class="primary section__complete"
          :disabled="submitting"
          @click="completePlan(item.id)"
        >
          完成用餐
        </button>
      </view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { ref, watch } from "vue";
import { ApiClientError, type UUID } from "@/apis/http";
import { mealApi, type DiningEventSummary, type MealPlanSummary } from "../apis/meal";
import { recipeApi, type MyRecipeSummary } from "@/apis/recipe";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import Login from "@/components/Login/Login.vue";
import { uniPlatform } from "@/platform/uni";
import { useDiningGroupStore } from "@/stores/dining-group";
import { useSessionStore } from "@/stores/session";
import { formatDateTimeMinute } from "../utils/date";
import { createOperationId } from "@/utils/operation-id";

const pageStyle = usePageScrollStyle();

const sessionStore = useSessionStore();
const diningGroupStore = useDiningGroupStore();
const recipes = ref<MyRecipeSummary[]>([]);
const plans = ref<MealPlanSummary[]>([]);
const eventMap = ref<Record<string, DiningEventSummary>>({});
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const selectedRecipeId = ref<UUID | "">("");
const planDate = ref("2026-07-23");
const mealSlot = ref<"BREAKFAST" | "LUNCH" | "DINNER">("DINNER");
const eventTime = ref("2026-07-23T19:00:00.000Z");
const eventLocation = ref("家里");
const cookOperationMap = ref<Record<string, string>>({});

const mealSlots = [
  { value: "BREAKFAST" as const, label: "早餐" },
  { value: "LUNCH" as const, label: "午餐" },
  { value: "DINNER" as const, label: "晚餐" }
];

onLoad((query) => {
  const nextRecipeId = parseQueryId(query?.recipeId);
  if (nextRecipeId) {
    selectedRecipeId.value = nextRecipeId;
  }
});

onShow(() => {
  if (!sessionStore.isLoggedIn) return;
  void loadPage();
});

watch(
  () => sessionStore.isLoggedIn,
  isLoggedIn => {
    if (!isLoggedIn) {
      clearPageState();
    }
  }
);

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
      recipeIds: [selectedRecipeId.value]
    });
    await uniPlatform.feedback.toast({ title: "餐次已保存", icon: "success" });
    await loadPage();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "保存失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function createEvent(planItemId: UUID) {
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

async function loadEvent(planItemId: UUID, eventId: UUID) {
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

async function inviteGroup(planItemId: UUID, eventId: UUID) {
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

async function completeEvent(planItemId: UUID, eventId: UUID) {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const result = await mealApi.completeDiningEvent(eventId, createOperationId());
    eventMap.value = { ...eventMap.value, [planItemId]: result };
    await uniPlatform.feedback.toast({ title: "饭局已完成", icon: "success" });
    await loadPage();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "完成失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function toggleCookClaim(
  planItemId: UUID,
  event: DiningEventSummary,
  menuItem: DiningEventSummary["menuItems"][number]
) {
  if (submitting.value) return;

  const action = menuItem.cookUserUid === sessionStore.uid ? "RELEASE" : "CLAIM";
  cookOperationMap.value = {
    ...cookOperationMap.value,
    [String(menuItem.id)]: cookOperationMap.value[String(menuItem.id)] || createOperationId()
  };

  submitting.value = true;
  try {
    const result = await mealApi.claimCook(event.id, {
      operationId: cookOperationMap.value[String(menuItem.id)],
      expectedVersion: menuItem.version,
      menuItemId: menuItem.id,
      action
    });
    eventMap.value = { ...eventMap.value, [String(planItemId)]: result };
    await uniPlatform.feedback.toast({ title: action === "CLAIM" ? "已认领这道菜" : "已取消认领", icon: "success" });
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 409) {
      await loadEvent(planItemId, event.id);
      await uniPlatform.feedback.toast({ title: "掌勺状态已更新，已为你刷新", icon: "none" });
    } else {
      await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "操作失败", icon: "none" });
    }
  } finally {
    submitting.value = false;
    cookOperationMap.value = Object.fromEntries(
      Object.entries(cookOperationMap.value).filter(([key]) => key !== String(menuItem.id))
    );
  }
}

async function completePlan(planItemId: UUID) {
  if (submitting.value) return;
  submitting.value = true;
  try {
    await mealApi.completePlan(planItemId, createOperationId());
    await uniPlatform.feedback.toast({ title: "已完成用餐", icon: "success" });
    await loadPage();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "完成失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

function slotText(slot: "BREAKFAST" | "LUNCH" | "DINNER") {
  if (slot === "BREAKFAST") return "早餐";
  if (slot === "LUNCH") return "午餐";
  return "晚餐";
}

function resolveCookMeta(cookName: string | null, cookUserUid: number | null) {
  if (cookUserUid === sessionStore.uid) return "我来做";
  if (cookName) return `${cookName} 已认领`;
  if (cookUserUid) return `UID ${cookUserUid} 已认领`;
  return "待认领";
}

function canShowCookAction(event: DiningEventSummary, cookUserUid: number | null) {
  if (event.status === "COMPLETED") return false;
  return cookUserUid === null || cookUserUid === sessionStore.uid;
}

function resolveCookActionText(cookUserUid: number | null) {
  return cookUserUid === sessionStore.uid ? "取消认领" : "我来做";
}

function isCookPending(menuItemId: UUID) {
  return Boolean(cookOperationMap.value[String(menuItemId)]);
}

function openMemory(eventId: UUID) {
  void uniPlatform.navigation.navigateTo(`/pages_share/memory/index?eventId=${encodeURIComponent(String(eventId))}`);
}

function parseQueryId(value: unknown): UUID | "" {
  const raw = Array.isArray(value) ? value[0] : value;
  const decoded = typeof raw === "string" ? Number(decodeURIComponent(raw)) : Number(raw);
  return Number.isInteger(decoded) && decoded > 0 ? decoded : "";
}

function clearPageState() {
  recipes.value = [];
  plans.value = [];
  eventMap.value = {};
  errorText.value = "";
  cookOperationMap.value = {};
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
.section__meta,
.event-box__title,
.event-box__meta {
  display: block;
}

.section__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.section__title,
.event-box__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.section__status {
  flex-shrink: 0;
  padding: 8rpx 16rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.section__status--done {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.section__meta,
.event-box__meta,
.section__hint {
  margin-top: var(--space-xs);
}

.section__complete {
  margin-top: var(--space-sm);
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
  border-radius: var(--radius-pill);
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

.menu-list {
  margin-top: var(--space-sm);
  padding-top: var(--space-sm);
  border-top: 1rpx solid var(--color-border-light);
}

.menu-list__title,
.menu-row__name,
.menu-row__meta {
  display: block;
}

.menu-list__title {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.menu-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
  padding: 16rpx 18rpx;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.menu-row__main {
  min-width: 0;
}

.menu-row__name {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.menu-row__meta {
  margin-top: 6rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.menu-row__action {
  flex-shrink: 0;
  margin-top: 0;
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
