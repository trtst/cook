<template>
  <page-meta :page-style="pageStyle" />
  <Layout :title="pageTitle">
    <Login v-if="!sessionStore.isLoggedIn" :title="loginTitle" description="冰箱条目只归你本人所有。" />

    <template v-else>
      <view v-if="errorText" class="notice" @click="loadContext">{{ errorText }}</view>
      <view v-if="loading" class="notice">加载中...</view>

      <view v-else class="section">
        <template v-if="isEditMode">
          <view class="readonly-card">
            <text class="readonly-card__label">食材名称</text>
            <text class="readonly-card__value">{{ name || "未命名食材" }}</text>
          </view>
          <view class="readonly-card">
            <text class="readonly-card__label">系统食材绑定</text>
            <text class="readonly-card__value">{{ selectedIngredientName || "未绑定，不支持在这里改绑" }}</text>
          </view>
          <text class="hint">编辑库存时只允许修改库存、到期时间和备注。</text>
        </template>

        <template v-else>
          <text class="section__title">新增食材</text>
          <input v-model="name" class="input" placeholder="名称，例如 鸡蛋" />

          <view class="search-box">
            <input
              v-model="ingredientKeyword"
              class="input input--compact"
              placeholder="可选：搜索并绑定系统食材"
              @confirm="searchIngredients"
            />
            <button class="secondary search-box__button" :disabled="ingredientLoading" @click="searchIngredients">
              {{ ingredientLoading ? "搜索中" : "搜索食材" }}
            </button>
          </view>

          <view v-if="ingredientOptions.length" class="ingredient-list">
            <view
              v-for="item in ingredientOptions"
              :key="item.id"
              class="ingredient-item"
              :class="{ 'ingredient-item--active': selectedIngredientId === item.id }"
              @click="selectIngredient(item)"
            >
              <text class="ingredient-item__title">{{ item.name }}</text>
              <text class="ingredient-item__meta">{{ ingredientMeta(item) }}</text>
            </view>
          </view>

          <view class="readonly-card">
            <text class="readonly-card__label">已绑定食材</text>
            <text class="readonly-card__value">{{ selectedIngredientName || "未绑定，当前仅按名称记录" }}</text>
          </view>
        </template>

        <view class="field-block">
          <text class="field-block__title">库存</text>
          <input v-model="quantityText" class="input" placeholder="展示数量，例如 半包 / 6 个" />
          <input
            v-model="exactQuantity"
            class="input"
            :disabled="!canEditExact"
            :placeholder="canEditExact ? '精确数量，例如 2.5' : '当前条目未绑定系统食材，不能补精确数量'"
          />
          <picker mode="selector" :range="unitNames" :value="selectedUnitIndex" @change="handleUnitChange">
            <view class="picker" :class="{ 'picker--disabled': !canEditExact }">
              {{ selectedUnitName || (canEditExact ? "选择单位（用于自动算库存）" : "当前不可修改精确单位") }}
            </view>
          </picker>
        </view>

        <view class="field-block">
          <text class="field-block__title">到期时间</text>
          <view class="quick-days">
            <text class="day-chip" @click="setExpireDays(3)">3 天</text>
            <text class="day-chip" @click="setExpireDays(7)">7 天</text>
            <text class="day-chip" @click="setExpireDays(30)">30 天</text>
            <text class="day-chip day-chip--ghost" @click="clearExpireDate">清空</text>
          </view>
          <picker mode="date" :value="expireDate" @change="handleExpireChange">
            <view class="picker">{{ expireDate || "选择到期日期" }}</view>
          </picker>
        </view>

        <view class="field-block">
          <text class="field-block__title">备注</text>
          <input v-model="note" class="input" placeholder="例如 先吃这个 / 已开封" />
          <view class="quick-days">
            <text v-for="preset in notePresets" :key="preset" class="day-chip day-chip--ghost" @click="applyNotePreset(preset)">{{ preset }}</text>
          </view>
        </view>

        <button class="primary" :disabled="submitting || submitDisabled" @click="saveItem">
          {{ submitting ? "保存中" : isEditMode ? "保存修改" : "保存食材" }}
        </button>
      </view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import type { UUID } from "@/apis/http";
import { recipeApi, type IngredientSummary, type UnitSummary } from "@/apis/recipe";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import Login from "@/components/Login/Login.vue";
import { fridgeApi } from "../apis/fridge";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";

const pageStyle = usePageScrollStyle();

const notePresets = ["先吃这个", "已开封", "只剩一点", "今晚要用", "早餐要用", "冷冻保存", "冷藏保存", "临期先用"];

const sessionStore = useSessionStore();
const loading = ref(false);
const submitting = ref(false);
const ingredientLoading = ref(false);
const errorText = ref("");
const unitOptions = ref<UnitSummary[]>([]);
const ingredientOptions = ref<IngredientSummary[]>([]);
const itemId = ref<UUID | "">("");
const name = ref("");
const ingredientKeyword = ref("");
const selectedIngredientId = ref<UUID | "">("");
const selectedIngredientName = ref("");
const quantityText = ref("");
const exactQuantity = ref("");
const selectedUnitId = ref<UUID | "">("");
const expireDate = ref("");
const note = ref("");

const isEditMode = computed(() => Boolean(itemId.value));
const pageTitle = computed(() => (isEditMode.value ? "编辑库存" : "新增食材"));
const loginTitle = computed(() => (isEditMode.value ? "登录后编辑库存" : "登录后新增食材"));
const submitDisabled = computed(() => (!isEditMode.value ? !name.value.trim() : false));
const canEditExact = computed(() => Boolean(selectedIngredientId.value));
const selectedUnitIndex = computed(() => {
  if (!selectedUnitId.value) return 0;
  const index = unitOptions.value.findIndex(item => item.id === selectedUnitId.value);
  return index >= 0 ? index : 0;
});
const selectedUnitName = computed(() => unitOptions.value.find(item => item.id === selectedUnitId.value)?.name || "");
const unitNames = computed(() => unitOptions.value.map(item => item.name));

onLoad(options => {
  if (typeof options?.itemId === "string" && options.itemId) {
    const parsed = Number(options.itemId);
    itemId.value = Number.isInteger(parsed) && parsed > 0 ? parsed : "";
    return;
  }
  itemId.value = "";
});

onShow(() => {
  if (!sessionStore.isLoggedIn) return;
  void loadContext();
});

async function loadContext() {
  if (!sessionStore.isLoggedIn || loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    await Promise.all([loadUnits(), isEditMode.value ? loadItem() : Promise.resolve()]);
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : isEditMode.value ? "库存条目加载失败" : "食材编辑页加载失败";
  } finally {
    loading.value = false;
  }
}

async function loadUnits() {
  if (unitOptions.value.length) return;
  const result = await recipeApi.listUnits({ page: 1, pageSize: 100, source: "SYSTEM" });
  unitOptions.value = result.items;
}

async function loadItem() {
  if (!itemId.value) return;
  const result = await fridgeApi.list(1, 100);
  const current = result.items.find(item => item.id === itemId.value);
  if (!current) {
    throw new Error("库存条目不存在");
  }
  name.value = current.name;
  ingredientKeyword.value = current.name;
  selectedIngredientId.value = current.ingredientId || "";
  selectedIngredientName.value = current.ingredientId ? current.name : "";
  quantityText.value = current.quantityText ?? "";
  exactQuantity.value = current.exactQuantity ?? "";
  selectedUnitId.value = current.exactUnitId || "";
  expireDate.value = current.expireAt ? current.expireAt.slice(0, 10) : "";
  note.value = current.note ?? "";
}

async function searchIngredients() {
  ingredientLoading.value = true;
  try {
    const result = await recipeApi.listIngredients({
      page: 1,
      pageSize: 20,
      keyword: ingredientKeyword.value.trim() || undefined,
      source: "ALL"
    });
    ingredientOptions.value = result.items;
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "食材搜索失败", icon: "none" });
  } finally {
    ingredientLoading.value = false;
  }
}

function ingredientMeta(item: IngredientSummary) {
  return `${item.source === "PERSONAL" ? "个人食材" : "系统食材"} · 默认 ${item.defaultUnit.name}`;
}

function selectIngredient(item: IngredientSummary) {
  if (selectedIngredientId.value === item.id) {
    selectedIngredientId.value = "";
    selectedIngredientName.value = "";
    return;
  }
  selectedIngredientId.value = item.id;
  selectedIngredientName.value = item.name;
  name.value = item.name;
  if (!selectedUnitId.value) {
    selectedUnitId.value = item.defaultUnit.id;
  }
}

function handleUnitChange(event: { detail: { value: string } }) {
  if (!canEditExact.value) return;
  const index = Number(event.detail.value);
  selectedUnitId.value = unitOptions.value[index]?.id || "";
}

function handleExpireChange(event: { detail: { value: string } }) {
  expireDate.value = event.detail.value || "";
}

function setExpireDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  expireDate.value = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

function clearExpireDate() {
  expireDate.value = "";
}

function applyNotePreset(preset: string) {
  const current = note.value.trim();
  if (!current) {
    note.value = preset;
    return;
  }
  if (current.includes(preset)) return;
  note.value = `${current}；${preset}`;
}

function buildCreatePayload() {
  const trimmedExactQuantity = exactQuantity.value.trim();
  if (trimmedExactQuantity && !selectedIngredientId.value) {
    throw new Error("使用精确数量前请先绑定食材");
  }
  if (trimmedExactQuantity && !selectedUnitId.value) {
    throw new Error("使用精确数量前请先选择单位");
  }
  return {
    operationId: createOperationId(),
    name: name.value,
    ingredientId: selectedIngredientId.value || null,
    quantityText: quantityText.value,
    exactQuantity: trimmedExactQuantity || null,
    exactUnitId: trimmedExactQuantity ? selectedUnitId.value || null : null,
    expireAt: expireDate.value || null,
    note: note.value
  };
}

function buildUpdatePayload() {
  const trimmedExactQuantity = exactQuantity.value.trim();
  if (trimmedExactQuantity && !canEditExact.value) {
    throw new Error("当前条目未绑定系统食材，不能补精确数量");
  }
  if (trimmedExactQuantity && !selectedUnitId.value) {
    throw new Error("使用精确数量前请先选择单位");
  }
  return {
    operationId: createOperationId(),
    quantityText: quantityText.value,
    exactQuantity: trimmedExactQuantity || null,
    exactUnitId: trimmedExactQuantity ? selectedUnitId.value || null : null,
    expireAt: expireDate.value || null,
    note: note.value
  };
}

async function saveItem() {
  if (submitting.value || submitDisabled.value) return;
  submitting.value = true;
  try {
    if (isEditMode.value && itemId.value) {
      await fridgeApi.update(itemId.value, buildUpdatePayload());
    } else {
      await fridgeApi.create(buildCreatePayload());
      resetCreateForm();
    }
    await uniPlatform.feedback.toast({ title: "已保存", icon: "success" });
    if (isEditMode.value) {
      void uniPlatform.navigation.navigateBack();
    }
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "保存失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

function resetCreateForm() {
  name.value = "";
  ingredientKeyword.value = "";
  selectedIngredientId.value = "";
  selectedIngredientName.value = "";
  quantityText.value = "";
  exactQuantity.value = "";
  selectedUnitId.value = "";
  expireDate.value = "";
  note.value = "";
  ingredientOptions.value = [];
}
</script>

<style scoped lang="scss">
.section,
.notice,
.readonly-card,
.input,
.picker {
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.notice,
.section {
  padding: var(--space-md);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.section__title,
.field-block__title,
.ingredient-item__title,
.readonly-card__value {
  color: var(--color-text);
}

.section__title,
.field-block__title,
.ingredient-item__title {
  font-weight: var(--font-weight-semibold);
}

.input,
.picker {
  min-height: 88rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
}

.input {
  width: 100%;
}

.input--compact {
  flex: 1;
}

.search-box {
  display: flex;
  gap: var(--space-sm);
}

.search-box__button {
  flex: 0 0 auto;
}

.ingredient-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.ingredient-item,
.readonly-card {
  padding: var(--space-md);
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.ingredient-item--active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.ingredient-item__title,
.ingredient-item__meta,
.readonly-card__label,
.readonly-card__value,
.hint {
  display: block;
}

.ingredient-item__meta,
.readonly-card__label,
.hint {
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.quick-days {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.day-chip {
  padding: 10rpx 20rpx;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: var(--font-size-sm);
}

.day-chip--ghost {
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
}

.picker {
  display: flex;
  align-items: center;
  color: var(--color-text);
}

.picker--disabled {
  color: var(--color-text-tertiary);
}
</style>
