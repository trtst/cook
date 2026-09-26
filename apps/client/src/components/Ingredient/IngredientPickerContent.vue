<template>
  <view class="ingredient-picker-content">
    <text class="ingredient-picker__hint">{{ hintText }}</text>
    <view class="sheet-search">
      <RecipeSearchBar
        :model-value="keyword"
        class="sheet-search__bar"
        placeholder="搜索食材名称"
        @update:model-value="emit('update:keyword', $event)"
        @confirm="emit('search')"
        @clear="emit('clear-search')"
      />
    </view>
    <view v-if="errorText" class="ingredient-picker__error">{{ errorText }}</view>

    <view v-if="!searchMode" class="ingredient-filter">
      <view class="ingredient-filter__chip" :class="{ 'ingredient-filter__chip--active': allActive }" @click="emit('clear-category')">
        全部食材
      </view>
      <view class="ingredient-filter__right">
        <view
          class="ingredient-filter__action"
          :class="{ 'ingredient-filter__action--hidden': !showPersonalActions }"
          @click="emit('create')"
        >
          添加食材
        </view>
        <view
          class="ingredient-filter__chip"
          :class="{ 'ingredient-filter__chip--active': sourceFilter === 'PERSONAL' }"
          @click="emit('change-source', 'PERSONAL')"
        >
          我的食材
          <text class="cookfont icon-filter ingredient-filter__icon" />
        </view>
      </view>
    </view>

    <view class="ingredient-stage">
      <view v-if="searchMode" class="ingredient-stage__pane">
        <view v-if="searchLoading && !searchItems.length" class="ingredient-picker__empty ingredient-picker__empty--create">
          <text class="ingredient-picker__empty-text">加载中...</text>
        </view>
        <view v-else-if="searchItems.length" class="ingredient-search">
          <text class="ingredient-search__count">搜索结果 {{ searchItems.length }} 条</text>
          <scroll-view class="ingredient-search__scroll" scroll-y lower-threshold="240" @scrolltolower="emit('load-more')">
            <view class="ingredient-grid ingredient-grid--search">
              <view
                v-for="item in searchItems"
                :key="item.id"
                class="ingredient-choice"
                :class="{
                  'ingredient-choice--active': selectedIds.includes(item.id),
                  'ingredient-choice--disabled': existingIds.includes(item.id)
                }"
                @click="emit('toggle', item.id)"
              >
                <view class="ingredient-choice__head">
                  <text class="ingredient-choice__name">{{ item.name }}</text>
                </view>
                <text v-if="existingIds.includes(item.id)" class="cookfont icon-done ingredient-choice__existing-icon" />
                <slot name="item-actions" :item="item" />
              </view>
            </view>
          <text v-if="footerText" class="ingredient-search__footer">{{ footerText }}</text>
          </scroll-view>
        </view>
      <view v-else class="ingredient-picker__empty ingredient-picker__empty--create">
          <text class="ingredient-picker__empty-text">没有搜索到“{{ keyword.trim() }}”</text>
          <button v-if="showSearchCreate" class="ingredient-picker__create" @click="emit('create')">创建 {{ keyword.trim() }}</button>
        </view>
        <view class="ingredient-picker__footer">
          <scroll-view scroll-x class="ingredient-selected" show-scrollbar="false">
            <view class="ingredient-selected__track">
              <view v-for="item in selectedItems" :key="item.id" class="ingredient-selected__chip">
                <text class="ingredient-selected__name">{{ item.name }}</text>
                <text class="cookfont icon-close ingredient-selected__remove" @click.stop="emit('remove', item.id)" />
              </view>
            </view>
          </scroll-view>
          <button class="sheet-cancel" @click="emit('clear-search')">取消</button>
          <button
            class="sheet-confirm"
            :class="{ 'sheet-confirm--disabled': confirmDisabled }"
            :disabled="confirmDisabled"
            @click="emit('confirm')"
          >
            {{ confirmText }}
          </button>
        </view>
      </view>

      <view v-else class="ingredient-stage__pane">
        <view class="ingredient-picker" :class="{ 'ingredient-picker--constrained': Boolean(pickerHeight) }" :style="pickerHeight ? { height: pickerHeight } : undefined">
          <scroll-view
            v-if="pickerHeight"
            class="ingredient-picker__side ingredient-picker__side--scroll"
            scroll-y
            :style="{ height: '100%' }"
          >
            <view class="ingredient-picker__side-list">
              <view
                v-for="item in categories"
                :key="item.id"
                class="ingredient-category"
                :class="{ 'ingredient-category--active': categoryId === item.id }"
                @click="emit('change-category', item.id)"
              >
                {{ item.name }}
              </view>
            </view>
          </scroll-view>
          <view v-else class="ingredient-picker__side">
            <view
              v-for="item in categories"
              :key="item.id"
              class="ingredient-category"
              :class="{ 'ingredient-category--active': categoryId === item.id }"
              @click="emit('change-category', item.id)"
            >
              {{ item.name }}
            </view>
          </view>
          <view class="ingredient-picker__main" :style="mainStyle">
            <view v-if="loading && !categoryItems.length" class="ingredient-picker__empty">
              <text class="ingredient-picker__empty-text">加载中...</text>
            </view>
            <scroll-view
              v-else-if="categoryItems.length"
              class="ingredient-picker__scroll"
              scroll-y
              show-scrollbar="false"
              lower-threshold="240"
              @scrolltolower="emit('load-more')"
            >
              <view class="ingredient-grid">
                <view
                  v-for="item in categoryItems"
                  :key="item.id"
                  class="ingredient-choice"
                  :class="{
                    'ingredient-choice--active': selectedIds.includes(item.id),
                    'ingredient-choice--disabled': existingIds.includes(item.id)
                  }"
                  @click="emit('toggle', item.id)"
                >
                  <view class="ingredient-choice__head">
                    <text class="ingredient-choice__name">{{ item.name }}</text>
                  </view>
                  <text v-if="existingIds.includes(item.id)" class="cookfont icon-done ingredient-choice__existing-icon" />
                  <slot name="item-actions" :item="item" />
                </view>
              </view>
              <text v-if="footerText" class="ingredient-search__footer">{{ footerText }}</text>
            </scroll-view>
            <view v-else class="ingredient-picker__empty">
              <text class="ingredient-picker__empty-text">{{ emptyText }}</text>
              <button v-if="showEmptyCreate" class="ingredient-picker__create" @click="emit('create')">创建个人食材</button>
            </view>
          </view>
        </view>

        <view class="ingredient-picker__footer">
          <scroll-view scroll-x class="ingredient-selected" show-scrollbar="false">
            <view class="ingredient-selected__track">
              <view v-for="item in selectedItems" :key="item.id" class="ingredient-selected__chip">
                <text class="ingredient-selected__name">{{ item.name }}</text>
                <text class="cookfont icon-close ingredient-selected__remove" @click.stop="emit('remove', item.id)" />
              </view>
            </view>
          </scroll-view>
          <button v-if="searchMode" class="sheet-cancel" @click="emit('clear-search')">取消</button>
          <button
            class="sheet-confirm"
            :class="{ 'sheet-confirm--disabled': confirmDisabled }"
            :disabled="confirmDisabled"
            @click="emit('confirm')"
          >
            {{ confirmText }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import RecipeSearchBar from "@/components/Recipe/RecipeSearchBar.vue";
import type { IngredientCategorySummary, IngredientSummary } from "@/apis/recipe";
import type { UUID } from "@/apis/http";

defineProps<{
  hintText: string;
  keyword: string;
  searchMode: boolean;
  searchLoading: boolean;
  searchItems: IngredientSummary[];
  loading: boolean;
  categoryItems: IngredientSummary[];
  categories: IngredientCategorySummary[];
  categoryId: UUID | "";
  allActive: boolean;
  sourceFilter: "ALL" | "PERSONAL";
  showPersonalActions: boolean;
  selectedIds: UUID[];
  selectedItems: IngredientSummary[];
  existingIds: UUID[];
  footerText: string;
  errorText: string;
  emptyText: string;
  showEmptyCreate: boolean;
  showSearchCreate: boolean;
  confirmDisabled: boolean;
  confirmText: string;
  pickerHeight?: string;
  mainStyle?: Record<string, string>;
}>();

const emit = defineEmits<{
  (event: "update:keyword", value: string): void;
  (event: "search"): void;
  (event: "clear-search"): void;
  (event: "clear-category"): void;
  (event: "change-source", source: "PERSONAL"): void;
  (event: "change-category", categoryId: UUID): void;
  (event: "load-more"): void;
  (event: "toggle", ingredientId: UUID): void;
  (event: "remove", ingredientId: UUID): void;
  (event: "create"): void;
  (event: "confirm"): void;
}>();
</script>

<style scoped lang="scss">
.sheet-search { display: flex; align-items: center; gap: 18rpx; margin-top: 18rpx; padding: 0 var(--space-page); }
.sheet-search__bar { flex: 1; min-width: 0; }
.ingredient-picker__hint { display: block; margin-top: 18rpx; padding: 0 var(--space-page); color: var(--color-text-secondary); font-size: 22rpx; line-height: 1.6; }
.ingredient-picker__error { padding: 10rpx var(--space-page); color: var(--color-state-danger-text); font-size: 22rpx; }
.ingredient-filter { display: flex; align-items: center; justify-content: space-between; gap: 14rpx; margin-top: 18rpx; padding: 0 var(--space-page); }
.ingredient-filter__right { display: flex; align-items: center; justify-content: flex-end; gap: 14rpx; margin-left: auto; }
.ingredient-filter__chip { display: inline-flex; align-items: center; gap: 8rpx; min-width: 160rpx; padding: 18rpx 20rpx; border-radius: var(--radius-xs); background: transparent; color: var(--color-text-secondary); font-size: 24rpx; line-height: 1; }
.ingredient-filter__chip--active { background: var(--color-tag-primary-bg); color: var(--color-tag-primary-text); }
.ingredient-filter__icon { color: currentColor; font-size: 24rpx; line-height: 1; }
.ingredient-filter__action { padding: 18rpx 20rpx; color: var(--color-support-action); font-size: 24rpx; line-height: 1; }
.ingredient-filter__action--hidden { visibility: hidden; pointer-events: none; }
.ingredient-stage { margin-top: 20rpx; }
.ingredient-stage__pane { display: flex; flex-direction: column; justify-content: space-between; width: 100%; flex: 1 1 auto; min-width: 0; padding: 0 var(--space-page); box-sizing: border-box; }
.ingredient-picker { display: flex; align-items: flex-start; gap: 18rpx; }
.ingredient-picker--constrained { align-items: stretch; }
.ingredient-picker__side { display: flex; flex-direction: column; gap: 20rpx; width: 160rpx; }
.ingredient-picker__side--scroll { display: block; flex: 0 0 160rpx; overflow: hidden; }
.ingredient-picker__side-list { display: flex; flex-direction: column; gap: 20rpx; }
.ingredient-category { padding: 18rpx 20rpx; border-radius: var(--radius-xs); background: var(--color-surface); color: var(--color-text-secondary); font-size: 24rpx; line-height: 1; }
.ingredient-category--active { border-color: transparent; background: var(--color-tag-primary-bg); color: var(--color-tag-primary-text); }
.ingredient-picker__main { flex: 1; min-width: 0; min-height: 0; overflow: hidden; }
.ingredient-picker__scroll, .ingredient-search__scroll { height: 100%; }
.ingredient-search { display: flex; flex-direction: column; height: 320px; min-height: 0; }
.ingredient-search__scroll { flex: 1; min-height: 0; }
.ingredient-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14rpx; }
.ingredient-grid--search { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.ingredient-search__count { display: block; margin-bottom: 18rpx; color: var(--color-text-secondary); font-size: 24rpx; }
.ingredient-search__footer { display: block; padding: 20rpx 0 8rpx; color: var(--color-text-tertiary); font-size: 22rpx; line-height: 1.4; text-align: center; }
.ingredient-choice { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 10rpx; padding: 18rpx 0; border-radius: var(--radius-xs); background: var(--color-surface); }
.ingredient-choice--active { background: var(--color-tag-primary-bg); box-shadow: inset 0 0 0 1rpx var(--color-border-active); }
.ingredient-choice--disabled { opacity: 0.5; }
.ingredient-choice__head { display: flex; align-items: center; gap: 10rpx; }
.ingredient-choice__name { color: var(--color-text-secondary); font-size: 24rpx; font-weight: var(--font-weight-semibold); line-height: 1; word-break: break-all; }
.ingredient-choice__existing-icon { position: absolute; bottom: -10rpx; left: 50%; color: var(--color-tag-primary-text); font-size: 32rpx; line-height: 1; transform: translateX(-50%); }
.ingredient-picker__empty-text { color: var(--color-text-secondary); font-size: 22rpx; line-height: 1.5; }
.ingredient-picker__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18rpx; height: 100%; text-align: center; }
.ingredient-picker__empty--create { min-height: 620rpx; }
.ingredient-picker__create { min-width: 220rpx; height: 60rpx; padding: 0 28rpx; border-radius: var(--radius-xs); background: var(--color-tag-primary-bg); color: var(--color-tag-primary-text); font-size: 24rpx; font-weight: var(--font-weight-semibold); line-height: 60rpx; }
.ingredient-picker__footer { display: flex; align-items: center; gap: 16rpx; margin-top: 22rpx; }
.ingredient-selected { flex: 1; min-width: 0; white-space: nowrap; }
.ingredient-selected__track { display: inline-flex; align-items: center; gap: 12rpx; min-width: 100%; }
.ingredient-selected__chip { display: inline-flex; align-items: center; flex: 0 0 auto; gap: 10rpx; padding: 8rpx 16rpx; border-radius: var(--radius-pill); background: var(--color-tag-primary-bg); color: var(--color-tag-primary-text); }
.ingredient-selected__name { max-width: 180rpx; overflow: hidden; font-size: 22rpx; text-overflow: ellipsis; }
.ingredient-selected__remove { font-size: 20rpx; }
.sheet-cancel, .sheet-confirm { display: flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 156rpx; height: 76rpx; border: 0; border-radius: var(--radius-pill); font-size: 26rpx; font-weight: var(--font-weight-semibold); }
.sheet-cancel { background: var(--color-surface-soft-muted); color: var(--color-text-secondary); }
.sheet-confirm { background: var(--button-primary-bg); box-shadow: var(--button-primary-shadow); color: var(--button-primary-text); }
.sheet-confirm--disabled { opacity: 0.48; }
.sheet-cancel::after, .sheet-confirm::after, .ingredient-picker__create::after { display: none; }
</style>
