<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses"
    title=""
    full-screen
    :page-loading="pageLoading"
    :navbar-transparent="true"
    :navbar-opacity="navOpacity"
    :navbar-placeholder="false"
    :navbar-center-visible="showAnchorTabs"
  >
    <template #navbar-center>
      <view class="detail-nav-tabs">
        <view
          v-for="item in anchorTabs"
          :key="item.value"
          class="detail-nav-tabs__item font-medium"
          :class="{
            'detail-nav-tabs__item--active': activeAnchor === item.value,
            'nav-tab-active-indicator': activeAnchor === item.value
          }"
          @click="scrollToSection(item.value)"
        >
          {{ item.label }}
        </view>
      </view>
    </template>

    <template #global-loading>
      <CookAssistantThinkingLoading :visible="cookAssistantSheetSubmitting" @cancel="cancelCookAssistantUnlock" />
    </template>

    <view class="detail-nav-backdrop" :style="navBackdropStyle" />

    <RecipeDetailSkeleton v-if="!pageLoading && loading" />

    <Empty
      v-else-if="!pageLoading && !loading && !detail"
      :art="detailEmptyArt"
      :title="detailEmptyTitle"
      :description="detailEmptyDescription"
      :clickable="detailEmptyClickable"
      @click="handleDetailEmptyClick"
    />

    <template v-else-if="!pageLoading && detail">
      <view class="detail-page">
        <scroll-view
          id="detail-scroll"
          scroll-y
          scroll-with-animation
          class="detail-scroll"
          :scroll-top="detailScrollTop"
          show-scrollbar="false"
          @scroll="handleDetailScroll"
        >
          <view class="detail-scroll-body">
            <view class="hero" :style="heroStyle">
              <view class="hero__cover">
                <ImageLoader class="hero__image" :src="coverImageUrl" />
              </view>
            </view>

            <view class="content" :class="{ 'content--with-actions': showStickyActions }">
	            <view class="summary-card">
                <view class="summary-card__title-row">
	                <text id="detail-title" class="summary-card__title">{{ detailTitle }}</text>
                  <button v-if="showStickyActions" class="summary-card__share" open-type="share">
                    <view class="cookfont icon-share summary-card__share-icon" />
                  </button>
                </view>
	              <text v-if="detailStory" class="summary-card__story">{{ detailStory }}</text>
                <view v-if="detailContent.keywords.length" class="summary-card__keywords">
                  <text v-for="item in detailContent.keywords" :key="item" class="summary-card__keyword">{{ item }}</text>
                </view>
              <view v-if="detailFactText" class="summary-card__facts">
                <view class="summary-card__fact-row">
                  <view v-if="detailFactText" class="summary-card__fact-block">
                    <text class="summary-card__fact-title">分类</text>
                    <text class="summary-card__fact-text">{{ detailFactText }}</text>
                  </view>
                </view>
              </view>

		              <view class="summary-info">
		                <view v-for="item in infoItems" :key="item.key" class="summary-info__item">
		                  <view class="summary-info__icon" :class="[`summary-info__icon--${item.key}`, item.iconClass]" />
		                  <text class="summary-info__label" :class="{ 'summary-info__label--muted': item.muted }">{{ item.label }}</text>
		                </view>
		              </view>

	            </view>

              <view id="detail-ingredients" class="section" :class="{ 'section--first': !showNutritionSection }">
                <view class="section__head">
                  <view class="section__head-main">
                    <text class="section__label">食材清单</text>
                    <text class="section__caption">{{ ingredientCountText }}</text>
                  </view>
                  <button
                    v-if="showShoppingEntry"
                    class="section__action"
                    @click="addToShoppingList"
                  >
                    <text class="cookfont icon-add-list section__action-icon" />
                    <text>{{ shoppingSubmitting ? "加入中..." : "加入采购清单" }}</text>
                  </button>
                </view>
                <view v-if="detailContent.ingredients.length" class="ingredient-list">
                  <view
                    v-for="row in ingredientDisplay.rows"
                    :key="`${row.item.ingredientId}-${row.item.ingredientName}`"
                    class="ingredient-row"
                    :class="{
                      'ingredient-row--extra': row.extra,
                      'ingredient-row--extra-expanded': ingredientDisplay.expanded && row.extra
                    }"
                  >
                    <text class="ingredient-row__name">{{ row.item.ingredientName }}</text>
                    <text class="ingredient-row__amount">{{ formatAmount(row.item.amount) }}</text>
                  </view>
                  <view
                    v-if="ingredientDisplay.showToggle"
                    class="ingredient-list__toggle"
                    hover-class="ingredient-list__toggle--hover"
                    hover-stay-time="100"
                    @click="toggleIngredientList"
                  >
                    <view class="ingredient-list__toggle-line" />
                    <text class="ingredient-list__toggle-text">{{ ingredientDisplay.toggleText }}</text>
                    <view class="ingredient-list__toggle-line" />
                  </view>
                </view>
                <text v-else class="section__empty">暂未添加食材</text>
              </view>

              <view v-if="showNutritionSection" id="detail-nutrition" class="section">
                <view class="section__head">
                  <view class="section__head-main">
                    <text class="section__label">营养和热量</text>
                    <text class="section__caption">{{ nutritionCaption }}</text>
                  </view>
                  <view v-if="publishedNutrition?.perRecipe" class="nutrition-toggle">
                    <button
                      class="nutrition-toggle__item"
                      :class="{ 'nutrition-toggle__item--active': nutritionView === 'perServing' }"
                      @click="setNutritionView('perServing')"
                    >
                      单份
                    </button>
                    <text class="nutrition-toggle__divider">/</text>
                    <button
                      class="nutrition-toggle__item"
                      :class="{ 'nutrition-toggle__item--active': nutritionView === 'perRecipe' }"
                      @click="setNutritionView('perRecipe')"
                    >
                      整份
                    </button>
                  </view>
                </view>
                <view v-if="visibleNutritionMetrics.length" :key="nutritionMotionKey" class="nutrition-grid">
                  <view class="nutrition-grid__chart">
                    <view
                      v-for="segment in nutritionRingSegments"
                      :key="segment.key"
                      class="nutrition-ring-segment"
                      :class="`nutrition-ring-segment--${segment.key}`"
                      :style="segment.style"
                    >
                      <view class="nutrition-ring-segment__cap nutrition-ring-segment__cap--start" :style="segment.startCapStyle" />
                      <view class="nutrition-ring-segment__cap nutrition-ring-segment__cap--end" :style="segment.endCapStyle" />
                    </view>
                  </view>
                  <view class="nutrition-grid__metrics">
                    <view v-for="metric in visibleNutritionMetrics" :key="metric.key" class="nutrition-metric">
                      <view class="nutrition-metric__main">
                        <view class="nutrition-metric__label-wrap">
                          <view class="nutrition-metric__dot" :class="`nutrition-metric__dot--${metric.key}`" />
                          <text class="nutrition-metric__label">{{ metric.label }}(g)</text>
                        </view>
                        <text
                          class="nutrition-metric__amount"
                          :class="[
                            `nutrition-metric__amount--${metric.key}`,
                            { 'nutrition-metric__amount--empty': !hasNutritionValue(metric.value) }
                          ]"
                        >
                          {{ formatNutritionValue(metric.value, metric.unit) }}
                        </text>
                      </view>
                    </view>
                  </view>
                  <view class="nutrition-grid__summary">
                    <text class="nutrition-grid__calories">{{ currentNutritionCalories }}</text>
                    <text class="nutrition-grid__calories-unit">kcal</text>
                  </view>
                </view>
                <text v-else class="section__empty">暂无营养估算</text>
              </view>

              <view id="detail-steps" class="section">
                <view class="section__head">
                  <view class="section__head-main">
                    <text class="section__label">步骤</text>
                    <text class="section__caption">{{ stepCountText }}</text>
                  </view>
                  <button
                    v-if="showStickyActions"
                    class="section__action"
                    @click="openCookMode"
                  >
                    <text class="cookfont icon-cook section__action-icon" />
                    <text>边看边做</text>
                  </button>
                </view>
                <view v-if="detailSteps.length" class="step-list">
                  <view v-for="(item, index) in detailSteps" :key="index" class="step-card">
                    <text class="step-card__index font-medium">
                      <text class="step-card__index-current font-black">{{ index + 1 }} </text>
                      <text class="step-card__index-total">{{ `/ ${detailSteps.length}` }}</text>
                    </text>
                    <image v-if="item.imageUrl" class="step-card__cover-image" :src="item.imageUrl" mode="widthFix" />
                    <text v-if="hasStepText(item.text)" class="step-card__text">{{ item.text.trim() }}</text>
                  </view>
                </view>
                <text v-else class="section__empty">暂未填写步骤</text>
              </view>

	            <view v-if="detailContent.tips" class="section">
	              <view class="section__head">
	                <text class="section__label">小贴士</text>
	              </view>
	              <text class="tips-text">{{ detailContent.tips }}</text>
	            </view>

              <text v-if="attributionText" class="detail-curated">{{ attributionText }}</text>

              <view v-if="primaryPlanLink" class="section section--plan-links">
                <view class="section__head">
                  <text class="section__label">做饭安排</text>
                  <text
                    class="section__link"
                    hover-class="section__link--hover"
                    hover-stay-time="100"
                    @click="openPlanLinksSheet"
                  >
                    查看全部
                  </text>
                </view>
                <view
                  class="plan-link-entry"
                  hover-class="plan-link-entry--hover"
                  hover-stay-time="100"
                  @click="openPlanLinksSheet"
                >
                  <text class="plan-link-entry__title">{{ primaryPlanText }}</text>
                  <text class="plan-link-entry__count">{{ planLinkCountText }}</text>
                </view>
              </view>

	              <view v-if="showStickyActions" class="detail-inline-actions">
                <template v-if="isExternalDetail">
	                  <button class="detail-inline-actions__item" @click="handleExternalEditAction">
	                    <view class="cookfont detail-inline-actions__icon icon-edit" />
	                    <view class="detail-inline-actions__text">{{ externalEditActionLabel }}</view>
	                  </button>
	                  <button v-if="canAddToPrivate && !detailActionsVisible" class="detail-inline-actions__item" @click="openPrivateSheet">
	                    <view class="cookfont detail-inline-actions__icon icon-collect" />
	                    <view class="detail-inline-actions__text">加到私房菜</view>
	                  </button>
	                  <button v-if="!detailActionsVisible" class="detail-inline-actions__item" @click="handleExternalPrimaryAction">
                    <view class="cookfont detail-inline-actions__icon icon-add-plan" />
                    <view class="detail-inline-actions__text">加入计划</view>
                  </button>
                  <button v-if="canOpenRecipeAssistant && !detailActionsVisible" class="detail-inline-actions__item" @click="openRecipeAssistant">
                    <view class="cookfont detail-inline-actions__icon icon-cook-assistant" />
                    <view class="detail-inline-actions__text">炊火智厨</view>
                  </button>
                  <button v-if="showReportEntry" class="detail-inline-actions__item" @click="openReportSheet">
                    <view class="cookfont detail-inline-actions__icon">&#xe710;</view>
                    <view class="detail-inline-actions__text">举报</view>
                  </button>
                </template>
	              <template v-else-if="isOwnedDetail">
	                <button class="detail-inline-actions__item" @click="handleEditRecipe">
	                      <view class="cookfont detail-inline-actions__icon icon-edit" />
	                      <view class="detail-inline-actions__text">编辑</view>
	                </button>
                  <button
                    v-if="showRecommendEntry"
                    class="detail-inline-actions__item detail-inline-actions__item--recommend"
                    :class="{ 'detail-inline-actions__item--disabled': isRecommendReadonly }"
                    @click="handleRecommendAction"
                  >
                    <view class="cookfont detail-inline-actions__icon icon-self-recommend" />
                    <view class="detail-inline-actions__text">{{ recommendActionLabel }}</view>
                  </button>
	                <button v-if="!detailActionsVisible" class="detail-inline-actions__item" @click="handleAddPlan">
	                      <view class="cookfont detail-inline-actions__icon icon-add-plan" />
	                      <view class="detail-inline-actions__text">添加计划</view>
                </button>
                  <button v-if="canOpenRecipeAssistant && !detailActionsVisible" class="detail-inline-actions__item" @click="openRecipeAssistant">
                    <view class="cookfont detail-inline-actions__icon icon-cook-assistant" />
                    <view class="detail-inline-actions__text">炊火智厨</view>
	                  </button>
	              </template>
	              <template v-else-if="isReadablePrivateDetail">
	                <button v-if="!detailActionsVisible" class="detail-inline-actions__item" @click="handleAddPlan">
	                  <view class="cookfont detail-inline-actions__icon icon-add-plan" />
	                  <view class="detail-inline-actions__text">添加计划</view>
	                </button>
                <button v-if="canOpenRecipeAssistant && !detailActionsVisible" class="detail-inline-actions__item" @click="openRecipeAssistant">
                  <view class="cookfont detail-inline-actions__icon icon-cook-assistant" />
                  <view class="detail-inline-actions__text">炊火智厨</view>
                </button>
	              </template>
	            </view>
            </view>
          </view>
        </scroll-view>
      </view>

      <view
        v-if="showStickyActions"
        class="detail-actions-shell"
        :class="{ 'detail-actions-shell--visible': detailActionsVisible }"
      >
        <view class="detail-actions" :class="{ 'detail-actions--visible': detailActionsVisible }">
          <template v-if="isExternalDetail">
            <button v-if="canAddToPrivate" class="detail-actions__item" @click="openPrivateSheet">
              <view class="cookfont icon-collect detail-actions__icon" />
              <view class="detail-actions__text">加到私房菜</view>
            </button>
            <button class="detail-actions__item" @click="handleExternalPrimaryAction">
              <view class="cookfont icon-add-plan detail-actions__icon" />
              <view class="detail-actions__text">加入计划</view>
            </button>
            <button v-if="canOpenRecipeAssistant" class="detail-actions__item" @click="openRecipeAssistant">
              <view class="cookfont icon-cook-assistant detail-actions__icon" />
              <view class="detail-actions__text">炊火智厨</view>
            </button>
          </template>
	          <template v-else-if="isOwnedDetail">
            <button class="detail-actions__item" @click="handleAddPlan">
              <view class="cookfont icon-add-plan detail-actions__icon" />
              <view class="detail-actions__text">添加计划</view>
            </button>
            <button v-if="canOpenRecipeAssistant" class="detail-actions__item" @click="openRecipeAssistant">
              <view class="cookfont icon-cook-assistant detail-actions__icon" />
              <view class="detail-actions__text">炊火智厨</view>
	            </button>
	          </template>
	          <template v-else-if="isReadablePrivateDetail">
	            <button class="detail-actions__item" @click="handleAddPlan">
	              <view class="cookfont icon-add-plan detail-actions__icon" />
	              <view class="detail-actions__text">添加计划</view>
	            </button>
	            <button v-if="canOpenRecipeAssistant" class="detail-actions__item" @click="openRecipeAssistant">
	              <view class="cookfont icon-cook-assistant detail-actions__icon" />
	              <view class="detail-actions__text">炊火智厨</view>
	            </button>
	          </template>
        </view>
      </view>

      <SheetShell
        :visible="planLinksSheetVisible"
        title="做饭安排"
        :subtitle="planLinksSheetSubtitle"
        @close="closePlanLinksSheet"
      >
        <view class="sheet-section">
          <view v-if="recipePlanLinks.length" class="plan-link-list">
            <view
              v-for="item in recipePlanLinks"
              :key="item.planItemId"
              class="plan-link-row"
              hover-class="plan-link-row--hover"
              hover-stay-time="100"
              @click="openPlanLink(item)"
            >
              <view class="plan-link-row__main">
                <text class="plan-link-row__title">{{ formatRecipePlanLink(item) }}</text>
              </view>
              <view class="plan-link-row__action">
                <text class="plan-link-row__action-text">查看安排</text>
                <text class="cookfont icon-arrow-right plan-link-row__icon" />
              </view>
            </view>
          </view>
          <text v-else class="sheet-section__hint">这道菜还没有安排到任何餐次。</text>
        </view>
      </SheetShell>

      <SheetShell
        v-if="kind === 'my'"
        :visible="recommendSheetVisible"
        title="自荐美食说明"
        subtitle="选择一个建议的系统分类。审核通过后，会收录到灵感里，个人菜谱仍保留在“我的”中。"
        @close="closeRecommendSheet"
      >
        <view class="sheet-section">
          <text class="sheet-section__title">自荐说明</text>
          <view class="sheet-note-list">
            <text class="sheet-note-item">1. 自荐菜谱会进入人工审核，内容完整、步骤清晰、成品质量高的菜谱才会被推荐。</text>
            <text class="sheet-note-item">2. 编辑可能会在不改变原意的前提下，调整标题、分类或部分描述文案。</text>
            <text class="sheet-note-item">3. 提交后如 1 个工作日内未被收录，则默认本次未通过审核，可完善后再次提交。</text>
          </view>
        </view>
        <view v-if="recommendSheetLoading" class="panel-note panel-note--sheet">加载中...</view>
        <view v-else-if="recommendSheetError" class="panel-note panel-note--sheet" @click="loadRecommendCategories(true)">{{ recommendSheetError }}</view>
        <template v-else>
          <view class="sheet-section">
            <text class="sheet-section__title">系统菜谱分类</text>
            <view v-if="recommendCategories.length" class="chip-row">
              <view
                v-for="item in recommendCategories"
                :key="item.id"
                class="chip"
                :class="{ 'chip--active': selectedRecommendCategoryId === item.id }"
                @click="selectedRecommendCategoryId = item.id"
              >
                {{ item.name }}
              </view>
            </view>
            <text v-else class="sheet-section__hint">当前还没有可选的系统菜谱分类。</text>
          </view>
        </template>
          <template #footer>
            <view class="sheet-actions">
              <button class="sheet-actions__button sheet-actions__button--cancel" @click="closeRecommendSheet">取消</button>
              <button
                class="sheet-actions__button sheet-actions__button--confirm"
                @click="handleRecommendRecipe"
              >
                {{ recommendSubmitting ? "提交中..." : "确认" }}
              </button>
            </view>
          </template>
      </SheetShell>

      <AddToPrivateSheet
        v-if="isExternalDetail && externalRecipeRef"
        :visible="privateSheetVisible"
        :source-recipe-id="externalRecipeRef.sourceRecipeId"
        :source-version-id="externalRecipeRef.sourceVersionId"
        @close="closePrivateSheet"
        @success="handlePrivateSuccess"
      />

      <AddToPlanSheet
        :visible="planSheetVisible"
        :recipe-id="planRecipeId || null"
        :source-recipe-id="kind === 'inspiration' ? externalRecipeRef?.sourceRecipeId : null"
        :source-version-id="kind === 'inspiration' ? externalRecipeRef?.sourceVersionId : null"
        :need-add-to-private="kind === 'inspiration' && !Boolean(linkedOwnedRecipeId)"
        @close="closePlanSheet"
        @success="handlePlanSuccess"
      />

      <CookAssistantUnlockSheet
        :visible="cookAssistantSheetVisible"
        :loading="cookAssistantSheetLoading"
        :remaining-count="cookAssistantRemainingCount"
        :can-unlock="cookAssistantCanUnlock"
        :submitting="cookAssistantSheetSubmitting || cookAssistantUnlockPending"
        :error-text="cookAssistantSheetError"
        @close="closeCookAssistantSheet"
        @unlock="unlockRecipeAssistant"
      />

      <ShoppingListPickerSheet
        :visible="shoppingSheetVisible"
        :loading="shoppingListLoading"
        :error-text="shoppingListError"
        :items="shoppingLists"
        :selected-id="selectedShoppingListId"
        :create-name="shoppingCreateName"
        :submitting="shoppingSubmitting"
        @close="closeShoppingSheet"
        @after-close="handleShoppingSheetAfterClose"
        @retry="loadShoppingLists(true)"
        @create="createShoppingList"
        @confirm="confirmAddToShoppingList"
        @update:selected-id="selectedShoppingListId = $event"
        @update:create-name="shoppingCreateName = $event"
      />

      <SheetShell
        v-if="isExternalDetail"
        :visible="reportSheetVisible"
        title="举报菜谱"
        subtitle="如果这份菜谱让你觉得不合适，可以选一个最接近的原因告诉我们；选“其他”时再补充几句说明就可以。"
        @close="closeReportSheet"
      >
          <picker :range="reportReasonOptions" range-key="label" @change="handleReasonChange">
            <view class="report-picker">
              <text class="report-picker__label">举报原因</text>
              <view class="report-picker__value">
                <text
                  class="report-picker__text"
                  :class="{ 'report-picker__text--placeholder': !selectedReportReasonLabel }"
                >
                  {{ selectedReportReasonLabel || "请选择原因" }}
                </text>
                <text class="cookfont icon-arrow-right report-picker__icon" />
              </view>
            </view>
          </picker>

          <textarea
            v-if="needsReportDetail"
            v-model="reportReason"
            class="report-box"
            maxlength="255"
            placeholder="请填写具体说明"
          />
          <button class="danger" @click="handleReport">提交举报</button>
      </SheetShell>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { onHide, onLoad, onShareAppMessage, onUnload } from "@dcloudio/uni-app";
import { ApiClientError, UnauthorizedError, type UUID } from "@/apis/http";
import {
  recipeApi,
  type InspirationCategorySummary,
  type InspirationRecipeDetail,
  type RecipeDetail,
  type RecipePlanLinkSummary,
  type RecipeAmountSnapshot,
  type RecipeContentSnapshot,
  type RecipeNutritionSummary,
  type RecipeRecommendationSummary
} from "@/apis/recipe";
import { shoppingApi } from "@/apis/shopping";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import ImageLoader from "@/components/ImageLoader.vue";
import RecipeDetailSkeleton from "./RecipeDetailSkeleton.vue";
import AddToPrivateSheet from "@/components/Recipe/AddToPrivateSheet.vue";
import AddToPlanSheet from "@/components/Recipe/AddToPlanSheet.vue";
import CookAssistantUnlockSheet from "@/components/CookAssistantUnlockSheet.vue";
import CookAssistantThinkingLoading from "@/components/CookAssistantThinkingLoading.vue";
import ShoppingListPickerSheet from "@/components/Shopping/ShoppingListPickerSheet.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { usePageScrollLock } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { markRecipeHomeDirty, markRecipeManageDirty } from "@/pages/recipe/utils/recipe-view-sync";
import { uniPlatform } from "@/platform/uni";
import { useLoginModalStore } from "@/stores/login-modal";
import { useRecipePreviewStore, type RecipePreviewAmount, type RecipePreviewDetail } from "../stores/recipe-preview";
import { useSessionStore } from "@/stores/session";
import { userApi, type CookAssistantUsageResponse } from "@/apis/user";
import { createOperationId } from "@/utils/operation-id";
import { getCookAssistantLoadingDuration, waitForCookAssistantLoading } from "@/utils/cook-assistant-loading";
import { formatMealSlot, isMealSlotExpired } from "@/utils/meal-slot";
import { difficultyText as recipeDifficultyText, durationText as recipeDurationText } from "@/utils/recipe-meta";
import { buildDefaultShoppingListName } from "../utils/shopping";
import { buildIngredientDisplay } from "./ingredient-display";
import emptyStateIllustration from "@/assets/empty.png";

type DetailKind = "my" | "inspiration";
type DetailMode = "published" | "preview";
type CookAssistantUnlockState = "locked" | "unlocking" | "unlocked";
type AnchorKey = "ingredients" | "nutrition" | "steps";
type PublishedDetail = RecipeDetail | InspirationRecipeDetail;
type DetailContent = RecipeContentSnapshot | RecipePreviewDetail["content"];
type DetailIngredient = DetailContent["ingredients"][number];

interface InfoItem {
  key: "time" | "difficulty" | "ingredients";
  label: string;
  iconClass?: string;
  muted?: boolean;
}

interface ReportReasonOption {
  value: "AD" | "FALSE" | "INFRINGEMENT" | "ILLEGAL" | "OTHER";
  label: string;
}

interface NutritionMetricCard {
  key: "protein" | "fat" | "carbohydrate";
  label: string;
  unit: string;
  value: number | null;
}

interface NutritionRingSegment {
  key: NutritionMetricCard["key"];
  style: Record<string, string>;
  startCapStyle: Record<string, string>;
  endCapStyle: Record<string, string>;
}

function isSeedCoverUrl(value: string) {
  return value.startsWith("https://example.com/recipe/") || value.startsWith("http://example.com/recipe/");
}

function resolveCoverImageUrl(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed || isSeedCoverUrl(trimmed)) {
    return "";
  }
  return trimmed;
}

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const DETAIL_ACTIONS_SHOW_OFFSET = 24;
const reportReasonOptions: ReportReasonOption[] = [
  { value: "AD", label: "广告营销" },
  { value: "FALSE", label: "内容不实" },
  { value: "INFRINGEMENT", label: "侵犯权益" },
  { value: "ILLEGAL", label: "违法违规" },
  { value: "OTHER", label: "其他" }
];

const sessionStore = useSessionStore();
const loginModalStore = useLoginModalStore();
const recipePreviewStore = useRecipePreviewStore();
const { navBarTotalHeight } = useSystemInfo();
const NAV_FADE_RANGE = 132;
const INGREDIENT_TOGGLE_MEASURE_DELAY = 300;
const recipeId = ref<UUID | "">("");
const kind = ref<DetailKind>("my");
const mode = ref<DetailMode>("published");
const detail = ref<PublishedDetail | RecipePreviewDetail | null>(null);
const pageLoading = ref(true);
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const reportReason = ref("");
const reportSheetVisible = ref(false);
const cookAssistantSheetVisible = ref(false);
const cookAssistantSheetLoading = ref(false);
const cookAssistantSheetSubmitting = ref(false);
const cookAssistantSheetError = ref("");
const cookAssistantUnlockState = ref<CookAssistantUnlockState>("locked");
let cookAssistantUnlockRequestId = 0;
const cookAssistantUnlockPending = ref(false);
const cookAssistantUsage = ref<CookAssistantUsageResponse | null>(null);
const privateSheetVisible = ref(false);
const planSheetVisible = ref(false);
const planLinksSheetVisible = ref(false);
const recommendSheetVisible = ref(false);
const selectedReportReason = ref<ReportReasonOption["value"] | "">("");
const recommendSheetLoading = ref(false);
const recommendSubmitting = ref(false);
const recommendSheetError = ref("");
const shoppingSubmitting = ref(false);
const shoppingSheetVisible = ref(false);
const shoppingListLoading = ref(false);
const shoppingListError = ref("");
const shoppingLists = ref<import("@/apis/shopping").ShoppingListSummary[]>([]);
const selectedShoppingListId = ref<UUID | "">("");
const shoppingCreateName = ref("");
const nutritionView = ref<"perServing" | "perRecipe">("perServing");
const ingredientExpanded = ref(false);
const recommendCategories = ref<InspirationCategorySummary[]>([]);
const selectedRecommendCategoryId = ref<UUID | "">("");
const navOpacity = ref(0);
const scrollTop = ref(0);
const detailScrollTop = ref(0);
const titleThreshold = ref(Number.POSITIVE_INFINITY);
const ingredientTop = ref(0);
const nutritionTop = ref(Number.POSITIVE_INFINITY);
const stepTop = ref(Number.POSITIVE_INFINITY);
const { setLocked: setPageLocked } = usePageScrollLock(Symbol("recipe-detail-report-sheet"));

const detailEmptyTitle = computed(() => {
	if (mode.value === "preview") return "预览已失效";
	if (errorText.value) return "菜谱加载失败";
	return "未找到菜谱";
});
const detailEmptyDescription = computed(() => {
	if (mode.value === "preview") return "请返回编辑页重新打开预览。";
	if (errorText.value) return "请点击重试，或稍后再试。";
	return "可能已被删除、下架，或当前访问路径不正确。";
});
const detailEmptyClickable = computed(() => Boolean(errorText.value));
const detailEmptyArt = emptyStateIllustration;

let measureTimer: ReturnType<typeof setTimeout> | null = null;

const previewDetail = computed(() => {
  if (mode.value !== "preview" || !detail.value) return null;
  return detail.value as RecipePreviewDetail;
});

const publishedDetail = computed(() => {
  if (mode.value !== "published" || !detail.value) return null;
  return detail.value as PublishedDetail;
});

const inspirationDetail = computed(() => {
	if (mode.value !== "published" || kind.value !== "inspiration" || !detail.value) return null;
	return detail.value as InspirationRecipeDetail;
});
const myDetail = computed(() => {
	if (mode.value !== "published" || kind.value !== "my" || !detail.value) return null;
	return detail.value as RecipeDetail;
});

const myPersonal = computed(() => myDetail.value?.personal ?? null);

const detailTitle = computed(() => detail.value?.title || "");
const coverImageUrl = computed(() =>
  resolveCoverImageUrl(previewDetail.value?.coverImageUrl || publishedDetail.value?.coverImageUrl || "")
);
const publishedNutrition = computed<RecipeNutritionSummary | null>(() => publishedDetail.value?.nutrition ?? null);
const navTopOffset = computed(() => `${navBarTotalHeight.value}px`);
const heroStyle = computed(() => ({
  "--hero-header-offset": navTopOffset.value
}));
const navBackdropStyle = computed(() => ({
  height: navTopOffset.value,
  opacity: navOpacity.value
}));

const detailContent = computed<DetailContent>(() => {
  if (!detail.value) {
    return {
      story: null,
      baseServings: null,
      difficulty: null,
      duration: null,
      tips: null,
      keywords: [],
      ingredients: [],
      steps: []
    };
  }
  return detail.value.content;
});

const detailCategoryName = computed(() => {
  if (!detail.value) return "";
  if (previewDetail.value) {
    return previewDetail.value.categoryName || "";
  }
	if (inspirationDetail.value?.category?.name) return inspirationDetail.value.category.name;
	if (myDetail.value?.personal?.category?.name) return myDetail.value.personal.category.name;
	return myDetail.value?.inspirationCategory?.name || "";
});

const detailStory = computed(() => detailContent.value.story?.trim() || "");
const currentRecommendation = computed(() => myPersonal.value?.recommendation ?? null);
const externalDetail = computed(() => inspirationDetail.value);
const linkedOwnedRecipeId = computed(() => inspirationDetail.value?.ownedRecipeId || "");
const externalRecipeRef = computed(() => {
  if (inspirationDetail.value) {
    return {
      sourceRecipeId: inspirationDetail.value.id,
      sourceVersionId: inspirationDetail.value.contentVersionId
    };
  }
  return null;
});
const attributionName = computed(() => {
	return (kind.value === "my" ? myPersonal.value?.owner : inspirationDetail.value?.owner)?.nickname?.trim() || "";
});
const attributionText = computed(() => {
  const name = attributionName.value;
  if (!name) return "";
  return `由${name}整理`;
});
const canOpenRecommendSheet = computed(() => {
	const status = currentRecommendation.value?.status;
	return !status || status === "REJECTED" || status === "WITHDRAWN";
});
const detailSteps = computed(() => detailContent.value.steps.filter(item => Boolean(item.imageUrl || hasStepText(item.text))));
const isOwnedDetail = computed(() => mode.value === "published" && kind.value === "my" && Boolean(myPersonal.value));
const isReadablePrivateDetail = computed(() => mode.value === "published" && kind.value === "my" && Boolean(myDetail.value));
const isExternalDetail = computed(() => mode.value === "published" && Boolean(externalDetail.value));
const canOpenRecipeAssistant = computed(() => Boolean(publishedDetail.value?.assistantAvailable && publishedDetail.value.contentVersionId));
const cookAssistantRemainingCount = computed(() => cookAssistantUsage.value?.remainingCount ?? 0);
const cookAssistantCanUnlock = computed(() => Boolean(cookAssistantUsage.value?.activityEnabled && cookAssistantRemainingCount.value > 0));
const canRecommendRecipe = computed(() => Boolean(myPersonal.value?.canRecommend));
const planRecipeId = computed<UUID | "">(() => {
  if (kind.value === "my" && myDetail.value) return recipeId.value;
  return linkedOwnedRecipeId.value || "";
});
const canAddToPrivate = computed(() => isExternalDetail.value && !linkedOwnedRecipeId.value);
const showReportEntry = computed(() => isExternalDetail.value && sessionStore.isLoggedIn);
const selectedReportReasonLabel = computed(
  () => reportReasonOptions.find(item => item.value === selectedReportReason.value)?.label || ""
);
const needsReportDetail = computed(() => selectedReportReason.value === "OTHER");
const canSubmitReport = computed(() => {
  if (!selectedReportReason.value) return false;
  if (!needsReportDetail.value) return true;
  return Boolean(reportReason.value.trim());
});
const recommendActionLabel = computed(() => {
	const status = currentRecommendation.value?.status;
	if (status === "PENDING") return "审核中";
	if (status === "ADOPTED") return "已收录";
	if (status === "REJECTED") return "再次自荐";
	if (status === "WITHDRAWN") return "再次自荐";
	return "自荐美食";
});
const isRecommendReadonly = computed(() => {
  const status = currentRecommendation.value?.status;
  return status === "PENDING" || status === "ADOPTED";
});
const externalEditActionLabel = computed(() => (linkedOwnedRecipeId.value && kind.value === "inspiration" ? "编辑" : "改编"));
const showRecommendEntry = computed(() => isOwnedDetail.value && (canRecommendRecipe.value || Boolean(currentRecommendation.value)));
const showStickyActions = computed(
  () => mode.value === "published" && (isExternalDetail.value || isReadablePrivateDetail.value)
);
const detailActionsVisible = computed(
  () =>
    showStickyActions.value &&
    scrollTop.value > DETAIL_ACTIONS_SHOW_OFFSET &&
		!reportSheetVisible.value &&
		!recommendSheetVisible.value &&
		!privateSheetVisible.value &&
    !planLinksSheetVisible.value
);
const showShoppingEntry = computed(() => mode.value === "published" && detailContent.value.ingredients.length > 0);
const detailFactText = computed(() => {
  const parts: string[] = [];
  if (detailCategoryName.value) {
    parts.push(detailCategoryName.value);
  }
  return parts.join("  ·  ");
});

const ingredientCountText = computed(() => `${detailContent.value.ingredients.length}项食材`);
const ingredientDisplay = computed(() =>
  buildIngredientDisplay<DetailIngredient>(detailContent.value.ingredients, ingredientExpanded.value)
);
const stepCountText = computed(() => `${detailSteps.value.length}个步骤`);
const detailDifficultyText = computed(() => {
  const serverText =
    mode.value === "published" && detail.value && "difficultyText" in detail.value ? detail.value.difficultyText : null;
  return serverText || recipeDifficultyText(detailContent.value.difficulty);
});
const detailDurationText = computed(() => {
  const serverText =
    mode.value === "published" && detail.value && "durationText" in detail.value ? detail.value.durationText : null;
  return serverText || recipeDurationText(detailContent.value.duration);
});
const recipePlanLinks = computed<RecipePlanLinkSummary[]>(() => {
	const links = kind.value === "my" ? myPersonal.value?.planLinks : inspirationDetail.value?.planLinks;
	if (mode.value !== "published" || !links?.length) return [];
	const now = new Date();
	return sortRecipePlanLinks(
		links.filter(
      item => item.status !== "COMPLETED" && !isMealSlotExpired(item.planDate, item.mealSlot, now)
    )
  );
});
const primaryPlanLink = computed(() => recipePlanLinks.value[0] ?? null);
const primaryPlanText = computed(() => (primaryPlanLink.value ? formatRecipePlanLink(primaryPlanLink.value) : ""));
const planLinkCountText = computed(() => `共 ${recipePlanLinks.value.length} 个安排`);
const planLinksSheetSubtitle = computed(() => {
  if (!recipePlanLinks.value.length) return "这道菜还没有安排到任何餐次。";
  if (recipePlanLinks.value.length === 1) return "这道菜当前安排在以下餐次。";
  return `这道菜当前安排在 ${recipePlanLinks.value.length} 个餐次里。`;
});
const nutritionCaption = computed(() =>
  nutritionView.value === "perRecipe" ? "整份营养为估算值，仅供参考" : "单份营养为估算值，仅供参考"
);
const nutritionMotionTick = ref(0);
const currentNutritionMetrics = computed(() => {
  if (!publishedNutrition.value) return null;
  const preferred =
    nutritionView.value === "perRecipe"
      ? publishedNutrition.value.perRecipe
      : publishedNutrition.value.perServing;
  if (preferred) return preferred;
  return nutritionView.value === "perRecipe"
    ? publishedNutrition.value.perServing
    : publishedNutrition.value.perRecipe;
});
const visibleNutritionMetrics = computed<NutritionMetricCard[]>(() => {
  return currentNutritionMetrics.value ? buildNutritionMetrics(currentNutritionMetrics.value) : [];
});
const currentNutritionCalories = computed(() => formatNutritionNumber(currentNutritionMetrics.value?.calories ?? null));
const nutritionMotionKey = computed(() => `${nutritionView.value}-${nutritionMotionTick.value}`);
const nutritionRingSegments = computed<NutritionRingSegment[]>(() => buildNutritionRingSegments(visibleNutritionMetrics.value));
const showNutritionSection = computed(() => visibleNutritionMetrics.value.length > 0);
const anchorTabs = computed(() => {
  const tabs: Array<{ value: AnchorKey; label: string }> = [{ value: "ingredients", label: "食材" }];
  if (showNutritionSection.value) {
    tabs.push({ value: "nutrition", label: "营养" });
  }
  tabs.push({ value: "steps", label: "步骤" });
  return tabs;
});

const infoItems = computed<InfoItem[]>(() => [
  {
    key: "time",
    label: detailDurationText.value || "未设时长",
    iconClass: "cookfont icon-clock",
    muted: !detailDurationText.value
  },
  {
    key: "difficulty",
    label: detailDifficultyText.value || "未设难度",
    iconClass: "cookfont icon-difficulty",
    muted: !detailDifficultyText.value
  },
  {
    key: "ingredients",
    label: ingredientCountText.value,
    iconClass: "cookfont icon-dining-event"
  }
]);

const showAnchorTabs = computed(() => scrollTop.value >= titleThreshold.value);

const activeAnchor = computed<AnchorKey>(() => {
  const currentLine = scrollTop.value + navBarTotalHeight.value + 36;
  if (currentLine >= stepTop.value) return "steps";
  if (showNutritionSection.value && currentLine >= nutritionTop.value) return "nutrition";
  return "ingredients";
});

function parseQueryId(value: unknown): UUID | "" {
  const raw = Array.isArray(value) ? value[0] : value;
  const decoded = typeof raw === "string" ? Number(decodeURIComponent(raw)) : Number(raw);
  return Number.isInteger(decoded) && decoded > 0 ? decoded : "";
}

function hasStepText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

watch([reportSheetVisible, recommendSheetVisible, privateSheetVisible, planSheetVisible, planLinksSheetVisible], ([reportVisible, recommendVisible, privateVisible, planVisible, linksVisible]) => {
	setPageLocked(reportVisible || recommendVisible || privateVisible || planVisible || linksVisible);
}, { immediate: true });

watch(
  publishedNutrition,
  nutrition => {
    if (!nutrition?.perRecipe) {
      nutritionView.value = "perServing";
      return;
    }
    nutritionView.value = nutrition.perServing ? "perServing" : "perRecipe";
  },
  { immediate: true }
);

watch(
  () => detailContent.value.ingredients,
  () => {
    ingredientExpanded.value = false;
  }
);

onLoad((query) => {
  const rawKind = Array.isArray(query?.kind) ? query.kind[0] : query?.kind;
  const rawMode = Array.isArray(query?.mode) ? query.mode[0] : query?.mode;
  recipeId.value = parseQueryId(query?.recipeId);
	kind.value = rawKind === "my" ? "my" : "inspiration";
  mode.value = rawMode === "preview" ? "preview" : "published";

	if (mode.value === "preview") {
		detail.value = recipePreviewStore.detail ? { ...recipePreviewStore.detail } : null;
		scheduleMeasure();
		pageLoading.value = false;
		return;
	}

	void preparePublishedDetail();
});

async function preparePublishedDetail() {
	if (!recipeId.value) {
		pageLoading.value = false;
		return;
	}
	loading.value = true;
	pageLoading.value = false;
	await nextTick();
	void loadDetail(true);
}

function handleDetailScroll(event: { detail?: { scrollTop?: number } }) {
  const nextScrollTop = event.detail?.scrollTop ?? 0;
  scrollTop.value = nextScrollTop;
  navOpacity.value = Math.max(0, Math.min(1, nextScrollTop / NAV_FADE_RANGE));
}

onHide(() => {
  if (mode.value === "preview") {
    recipePreviewStore.clearPreview();
  }
});

onUnload(() => {
  clearMeasureTimer();
	if (mode.value === "preview") {
		recipePreviewStore.clearPreview();
	}
});

onShareAppMessage(() => ({
  title: detailTitle.value || "菜谱分享",
  path: recipeId.value
    ? `/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(recipeId.value))}&kind=${kind.value}&mode=${mode.value}`
    : "/pages/recipe/index",
  imageUrl: coverImageUrl.value || undefined
}));

async function loadDetail(initialLoading = false) {
	if (!recipeId.value || (!initialLoading && loading.value) || mode.value !== "published") return;
	if (!initialLoading) loading.value = true;
  errorText.value = "";
		try {
			detail.value = kind.value === "inspiration"
				? await recipeApi.getInspirationRecipe(recipeId.value)
				: await recipeApi.getRecipeDetail(recipeId.value);
			if (sessionStore.isLoggedIn && (kind.value === "inspiration" || Boolean(myPersonal.value))) {
				void recipeApi.recordRecipeView(recipeId.value, createOperationId()).catch(() => undefined);
			}
	    scheduleMeasure();
	} catch (error) {
		if (error instanceof UnauthorizedError) {
			errorText.value = "菜谱加载失败";
			await uniPlatform.feedback.toast({ title: "菜谱加载失败，请稍后再试", icon: "none" });
		} else {
			errorText.value = "菜谱加载失败";
			await uniPlatform.feedback.toast({
				title: getRequestErrorText(error, "菜谱加载失败"),
				icon: "none"
			});
		}
	  } finally {
    loading.value = false;
  }
}

function getRequestErrorText(error: unknown, fallback: string) {
	if (error instanceof UnauthorizedError) return "登录状态已失效，请重新登录";
	if (error instanceof ApiClientError && error.message) return error.message;
	if (error instanceof Error && error.message) return error.message;
	return fallback;
}

function handleDetailEmptyClick() {
	if (errorText.value) {
		void loadDetail();
	}
}

function scheduleMeasure(delay = 80) {
  clearMeasureTimer();
  measureTimer = setTimeout(() => {
    void updateAnchorMetrics();
  }, delay);
}

function clearMeasureTimer() {
  if (!measureTimer) return;
  clearTimeout(measureTimer);
  measureTimer = null;
}

function toggleIngredientList() {
  ingredientExpanded.value = !ingredientExpanded.value;
  scheduleMeasure(INGREDIENT_TOGGLE_MEASURE_DELAY);
}

function setDetailScrollTop(nextScrollTop: number) {
  const target = Math.max(0, nextScrollTop);
  // `scroll-view` 只有在绑定值变化时才会重新触发滚动命令。
  detailScrollTop.value = target === detailScrollTop.value ? target + 0.1 : target;
}

async function updateAnchorMetrics() {
  await nextTick();
  const [scrollRect, titleRect, ingredientRect, nutritionRect, stepRect] = await Promise.all([
    uniPlatform.system.measure("#detail-scroll"),
    uniPlatform.system.measure("#detail-title"),
    uniPlatform.system.measure("#detail-ingredients"),
    uniPlatform.system.measure("#detail-nutrition"),
    uniPlatform.system.measure("#detail-steps")
  ]);

  if (!scrollRect) return;
  const currentScrollTop = scrollTop.value;

  if (titleRect) {
    titleThreshold.value = Math.max(0, titleRect.bottom - scrollRect.top + currentScrollTop - navBarTotalHeight.value - 16);
  }
  if (ingredientRect) {
    ingredientTop.value = Math.max(0, ingredientRect.top - scrollRect.top + currentScrollTop - 20);
  }
  if (nutritionRect) {
    nutritionTop.value = Math.max(0, nutritionRect.top - scrollRect.top + currentScrollTop - 20);
  } else {
    nutritionTop.value = Number.POSITIVE_INFINITY;
  }
  if (stepRect) {
    stepTop.value = Math.max(0, stepRect.top - scrollRect.top + currentScrollTop - 20);
  }
}

function scrollToSection(section: AnchorKey) {
  const top =
    section === "steps"
      ? stepTop.value
      : section === "nutrition"
        ? nutritionTop.value
        : ingredientTop.value;
  setDetailScrollTop(top - navBarTotalHeight.value - 18);
}

function setNutritionView(view: "perServing" | "perRecipe") {
  if (view === "perRecipe" && !publishedNutrition.value?.perRecipe) return;
  if (nutritionView.value === view) return;
  nutritionView.value = view;
  nutritionMotionTick.value += 1;
}

function openLogin(afterLogin?: () => void) {
	loginModalStore.open(null, afterLogin);
}

function openLoginForUnauthorized(afterLogin?: () => void) {
	openLogin(afterLogin);
}

function openReportSheet() {
  if (!showReportEntry.value) return;
  reportSheetVisible.value = true;
}

function closeReportSheet() {
  reportSheetVisible.value = false;
}

function handleReasonChange(event: { detail?: { value?: number | string } }) {
  const raw = event.detail?.value;
  const index = typeof raw === "string" ? Number(raw) : Number(raw ?? NaN);
  if (!Number.isInteger(index) || index < 0) return;
  const option = reportReasonOptions[index];
  if (!option) return;
  selectedReportReason.value = option.value;
  if (option.value !== "OTHER") {
    reportReason.value = "";
  }
}

function buildReportPayload() {
  if (!selectedReportReasonLabel.value) return "";
  if (!needsReportDetail.value) return selectedReportReasonLabel.value;
  return reportReason.value.trim() ? `${selectedReportReasonLabel.value}：${reportReason.value.trim()}` : "";
}

function handleExternalPrimaryAction() {
	openPlanSheet();
}

function openPrivateSheet() {
  if (!canAddToPrivate.value || !externalRecipeRef.value) return;
  if (!sessionStore.isLoggedIn) {
    openLogin(() => {
      openPrivateSheet();
    });
    return;
  }
  privateSheetVisible.value = true;
}

function closePrivateSheet() {
  privateSheetVisible.value = false;
}

async function loadRecommendCategories(force = false) {
	if (recommendSheetLoading.value && !force) return;
	recommendSheetLoading.value = true;
	recommendSheetError.value = "";
	try {
		recommendCategories.value = await recipeApi.listInspirationCategories();
		if (selectedRecommendCategoryId.value && !recommendCategories.value.some(item => item.id === selectedRecommendCategoryId.value)) {
			selectedRecommendCategoryId.value = "";
		}
		if (!selectedRecommendCategoryId.value) {
			selectedRecommendCategoryId.value =
				currentRecommendation.value?.suggestedCategory.id ||
				recommendCategories.value[0]?.id ||
				"";
		}
	} catch (error) {
		if (error instanceof UnauthorizedError) {
			recommendSheetError.value = "";
			openLoginForUnauthorized(() => void loadRecommendCategories(true));
		} else {
			recommendSheetError.value = error instanceof Error ? error.message : "分类加载失败";
		}
	} finally {
		recommendSheetLoading.value = false;
	}
}

function syncMyRecommendation(next: RecipeRecommendationSummary | null) {
	if (!myDetail.value || !myPersonal.value) return;
	detail.value = {
		...myDetail.value,
		personal: {
			...myPersonal.value,
			recommendation: next
		}
	};
}

function openRecommendSheet() {
	if (!myDetail.value || !canOpenRecommendSheet.value) return;
	selectedRecommendCategoryId.value = currentRecommendation.value?.suggestedCategory.id || "";
	recommendSheetVisible.value = true;
	void loadRecommendCategories(true);
}

function closeRecommendSheet() {
	recommendSheetVisible.value = false;
}

async function handleRecommendAction() {
  if (!showRecommendEntry.value) return;
  const status = currentRecommendation.value?.status;
  if (status === "PENDING") {
    await uniPlatform.feedback.toast({ title: "已在审核中", icon: "none" });
    return;
  }
  if (status === "ADOPTED") {
    await uniPlatform.feedback.toast({ title: "已收录到灵感", icon: "none" });
    return;
  }
  openRecommendSheet();
}

function openPlanSheet() {
  if (!planRecipeId.value && !(kind.value === "inspiration" && externalRecipeRef.value)) return;
  if (!sessionStore.isLoggedIn) {
    openLogin(() => {
      openPlanSheet();
    });
    return;
  }
  planSheetVisible.value = true;
}

function handlePlanSuccess(payload: {
  recipeId: UUID;
  addedToPrivate: boolean;
  planItemId: UUID;
  planDate: string;
  mealSlot: "BREAKFAST" | "LUNCH" | "AFTERNOON_TEA" | "DINNER" | "LATE_NIGHT";
}) {
  const nextLink: RecipePlanLinkSummary = {
    planItemId: payload.planItemId,
    planDate: payload.planDate,
    mealSlot: payload.mealSlot,
    menuLocked: false,
    status: "PLANNED",
    hasDiningEvent: false
  };
  syncDetailPlanLinks(nextLink);
  if (kind.value !== "inspiration" || !payload.addedToPrivate || !inspirationDetail.value) return;
  detail.value = {
    ...inspirationDetail.value,
    ownedRecipeId: payload.recipeId,
    planLinks: mergeRecipePlanLinks(inspirationDetail.value.planLinks, nextLink)
  };
  markRecipeHomeDirty(["my"]);
  markRecipeManageDirty(["recipes"]);
}

function openPlanLink(link: RecipePlanLinkSummary | null | undefined) {
  if (!link) return;
  planLinksSheetVisible.value = false;
  void uniPlatform.navigation.navigateTo(
    `/pages_meal/detail/index?planItemId=${encodeURIComponent(String(link.planItemId))}&planDate=${encodeURIComponent(link.planDate)}`
  );
}

function openPlanLinksSheet() {
  if (!recipePlanLinks.value.length) return;
  planLinksSheetVisible.value = true;
}

function closePlanLinksSheet() {
  planLinksSheetVisible.value = false;
}

function handlePrivateSuccess(recipeId: UUID) {
  if (!inspirationDetail.value) return;
  inspirationDetail.value.ownedRecipeId = recipeId;
  markRecipeHomeDirty(["my"]);
  markRecipeManageDirty(["recipes"]);
}

function closePlanSheet() {
  planSheetVisible.value = false;
}

function closeShoppingSheet() {
  shoppingSheetVisible.value = false;
}

function handleShoppingSheetAfterClose() {
  shoppingListError.value = "";
  shoppingCreateName.value = "";
}

async function loadShoppingLists(force = false) {
  if (shoppingListLoading.value && !force) return;
  shoppingListLoading.value = true;
  shoppingListError.value = "";
  try {
    const result = await shoppingApi.listLists("ACTIVE");
    shoppingLists.value = result.items;
    if (selectedShoppingListId.value && !shoppingLists.value.some(item => item.id === selectedShoppingListId.value)) {
      selectedShoppingListId.value = "";
    }
    if (!selectedShoppingListId.value) {
      selectedShoppingListId.value = shoppingLists.value[0]?.id || "";
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      shoppingSheetVisible.value = false;
      shoppingListError.value = "";
      openLoginForUnauthorized(() => void openShoppingSheet());
    } else {
      shoppingListError.value = error instanceof Error ? error.message : "清单加载失败";
    }
  } finally {
    shoppingListLoading.value = false;
  }
}

function resolveShoppingSource() {
	if (!publishedDetail.value) return null;
  return {
    recipeId: publishedDetail.value.id,
    sourceVersionId: publishedDetail.value.contentVersionId
  };
}

async function handleRecommendRecipe() {
	if (!recipeId.value || !selectedRecommendCategoryId.value || recommendSubmitting.value) return;
	recommendSubmitting.value = true;
	try {
		const result = await recipeApi.recommendRecipe(recipeId.value, {
			operationId: createOperationId(),
			inspirationCategoryId: selectedRecommendCategoryId.value
		});
		syncMyRecommendation(result);
		closeRecommendSheet();
		await uniPlatform.feedback.toast({ title: "已提交自荐", icon: "success" });
	} catch (error) {
		if (error instanceof UnauthorizedError) {
			openLoginForUnauthorized();
		} else {
			await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "提交失败", icon: "none" });
		}
	} finally {
		recommendSubmitting.value = false;
	}
}

function buildDraftSeedContent() {
  if (!externalDetail.value || !externalRecipeRef.value) return null;
  const contentSnapshot = externalDetail.value.content;
  const slotSeed = Date.now();
  const content = {
    name: detailTitle.value || contentSnapshot.name || "未命名菜谱",
    story: contentSnapshot.story,
    categoryId: null,
    inspirationCategoryId: externalDetail.value.category.id,
    sceneIds: [],
    originVersionId: externalRecipeRef.value.sourceVersionId,
    originCoverImageUrl: coverImageUrl.value || null,
    coverUploadId: null,
    coverImageUrl: coverImageUrl.value || null,
    baseServings: contentSnapshot.baseServings ?? null,
    difficulty: contentSnapshot.difficulty,
    duration: contentSnapshot.duration,
    tips: contentSnapshot.tips,
    ingredients: contentSnapshot.ingredients.map(item => ({
      ingredientId: item.ingredientId,
      name: item.ingredientName,
      quantity: item.amount.kind === "EXACT" ? item.amount.quantity : "",
      unitId: item.amount.kind === "EXACT" ? item.amount.unitId : null,
      fuzzyText: item.amount.kind === "FUZZY" ? item.amount.text : null,
      categoryId: item.categoryId,
      defaultUnitId: item.amount.kind === "EXACT" ? item.amount.unitId : null,
      source: item.source
    })),
    steps: contentSnapshot.steps.map((item, index) => ({
      slotKey: `detail-${slotSeed}-${index + 1}`,
      text: item.text,
      uploadId: null,
      imageUrl: item.imageUrl ?? null
    }))
  };
  return content;
}

async function handleAdaptRecipe() {
  if (!showStickyActions.value || !isExternalDetail.value) return;
  if (!sessionStore.isLoggedIn) {
    openLogin(() => {
      void handleAdaptRecipe();
    });
    return;
  }
  const content = buildDraftSeedContent();
  if (!content) return;
  recipePreviewStore.setDraftSeed({ content });
  void uniPlatform.navigation.navigateTo("/pages_recipe/edit/index");
}

function handleExternalEditAction() {
  if (linkedOwnedRecipeId.value && kind.value === "inspiration") {
    void uniPlatform.navigation.navigateTo(`/pages_recipe/edit/index?recipeId=${encodeURIComponent(String(linkedOwnedRecipeId.value))}`);
    return;
  }
  void handleAdaptRecipe();
}

function openCookMode() {
  if (!showStickyActions.value || !recipeId.value || mode.value !== "published") return;
  if (!sessionStore.isLoggedIn) {
    openLogin(() => {
      openCookMode();
    });
    return;
  }
  void uniPlatform.navigation.navigateTo(
    `/pages_meal/cook-mode/index?source=recipe&recipeId=${encodeURIComponent(String(recipeId.value))}&kind=${encodeURIComponent(kind.value)}&flow=original`
  );
}

function openRecipeCookMode(recipeVersionId: UUID) {
  void uniPlatform.navigation.navigateTo(
    `/pages_meal/cook-mode/index?source=recipe&recipeId=${encodeURIComponent(String(recipeId.value))}&kind=${encodeURIComponent(kind.value)}&flow=assistant&recipeVersionId=${encodeURIComponent(String(recipeVersionId))}`
  );
}

async function openRecipeAssistant() {
	const recipeVersionId = publishedDetail.value?.contentVersionId;
	if (!showStickyActions.value || !recipeVersionId || !canOpenRecipeAssistant.value) return;
	if (!sessionStore.isLoggedIn) {
		openLogin(() => {
			void openRecipeAssistant();
		});
		return;
	}

  cookAssistantSheetLoading.value = true;
  cookAssistantSheetError.value = "";
  try {
    const assistant = await recipeApi.getRecipeVersionCookAssistant(recipeVersionId);
    cookAssistantUnlockState.value = assistant.unlocked ? "unlocked" : "locked";
    if (assistant.unlocked && assistant.assistant?.steps.length) {
      cookAssistantSheetVisible.value = false;
      openRecipeCookMode(recipeVersionId);
      return;
    }
    if (assistant.unlocked) {
		cookAssistantSheetVisible.value = true;
      cookAssistantSheetError.value = "炊火智厨暂时没有可执行步骤，请稍后重试";
      return;
    }
		cookAssistantSheetVisible.value = true;
    cookAssistantUsage.value = await userApi.getCookAssistantUsage();
    if (!cookAssistantUsage.value.activityEnabled) {
      cookAssistantSheetError.value = "当前暂未开放解锁";
    } else if (cookAssistantUsage.value.remainingCount <= 0) {
      cookAssistantSheetError.value = "今日可用次数已用完";
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      cookAssistantSheetVisible.value = false;
      cookAssistantSheetError.value = "";
      openLoginForUnauthorized(() => void openRecipeAssistant());
    } else {
		cookAssistantSheetVisible.value = true;
      cookAssistantSheetError.value = error instanceof Error ? error.message : "暂时无法读取炊火智厨状态，请稍后重试";
    }
  } finally {
    cookAssistantSheetLoading.value = false;
  }
}

function closeCookAssistantSheet() {
  if (cookAssistantSheetSubmitting.value) return;
  cookAssistantSheetVisible.value = false;
}

function cancelCookAssistantUnlock() {
  if (!cookAssistantSheetSubmitting.value) return;
  cookAssistantUnlockRequestId += 1;
  cookAssistantSheetSubmitting.value = false;
  cookAssistantUnlockState.value = "locked";
  cookAssistantSheetError.value = "";
  cookAssistantSheetVisible.value = true;
}

async function unlockRecipeAssistant() {
  const recipeVersionId = publishedDetail.value?.contentVersionId;
  if (
    !showStickyActions.value ||
    !recipeVersionId ||
    cookAssistantSheetLoading.value ||
    cookAssistantSheetSubmitting.value ||
    cookAssistantUnlockPending.value
  ) return;
  if (!cookAssistantCanUnlock.value) {
    cookAssistantSheetError.value = cookAssistantUsage.value?.activityEnabled === false ? "当前暂未开放解锁" : "今日可用次数已用完";
    return;
  }

  cookAssistantSheetVisible.value = false;
  cookAssistantSheetSubmitting.value = true;
  cookAssistantSheetError.value = "";
  cookAssistantUnlockState.value = "unlocking";
  const requestId = ++cookAssistantUnlockRequestId;
  cookAssistantUnlockPending.value = true;
  const unlockStartedAt = Date.now();
  const unlockDurationMs = getCookAssistantLoadingDuration();
  try {
    const result = await recipeApi.unlockRecipeVersionCookAssistant(recipeVersionId, {
      operationId: createOperationId()
    });
    if (requestId !== cookAssistantUnlockRequestId) return;
    cookAssistantUsage.value = await userApi.getCookAssistantUsage().catch(() => cookAssistantUsage.value);
    if (result.unlocked && result.assistant?.steps.length) {
      await waitForCookAssistantLoading(unlockStartedAt, unlockDurationMs);
      if (requestId !== cookAssistantUnlockRequestId) return;
      cookAssistantUnlockState.value = "unlocked";
      cookAssistantSheetVisible.value = false;
      openRecipeCookMode(recipeVersionId);
      return;
    }
    cookAssistantUnlockState.value = result.unlocked ? "unlocked" : "locked";
    cookAssistantSheetVisible.value = true;
    cookAssistantSheetError.value = "炊火智厨暂时没有可执行步骤，请稍后重试";
  } catch (error) {
    if (requestId !== cookAssistantUnlockRequestId) return;
    cookAssistantUnlockState.value = "locked";
    if (error instanceof UnauthorizedError) {
      cookAssistantSheetVisible.value = false;
      cookAssistantSheetError.value = "";
      openLoginForUnauthorized(() => void openRecipeAssistant());
    } else {
      cookAssistantSheetVisible.value = true;
      cookAssistantSheetError.value = error instanceof Error ? error.message : "解锁失败，请稍后重试";
    }
  } finally {
    cookAssistantUnlockPending.value = false;
    if (requestId === cookAssistantUnlockRequestId) {
      cookAssistantSheetSubmitting.value = false;
    }
  }
}

function handleEditRecipe() {
  if (!showStickyActions.value || !isOwnedDetail.value || !recipeId.value) return;
  void uniPlatform.navigation.navigateTo(`/pages_recipe/edit/index?recipeId=${encodeURIComponent(String(recipeId.value))}`);
}

function handleAddPlan() {
  if (!showStickyActions.value || !planRecipeId.value) return;
  openPlanSheet();
}

async function openShoppingSheet() {
  await loadShoppingLists(true);
  if (!shoppingCreateName.value.trim()) {
    shoppingCreateName.value = buildDefaultShoppingListName();
  }
  shoppingSheetVisible.value = true;
}

async function createShoppingList() {
  if (shoppingSubmitting.value) return;
  shoppingSubmitting.value = true;
  try {
    const created = await shoppingApi.createList({
      operationId: createOperationId(),
      name: shoppingCreateName.value.trim() || null
    });
    shoppingLists.value = [
      created,
      ...shoppingLists.value.filter(item => item.id !== created.id)
    ];
    selectedShoppingListId.value = created.id;
    shoppingCreateName.value = buildDefaultShoppingListName();
    await uniPlatform.feedback.toast({ title: "已新建清单", icon: "success" });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      openLoginForUnauthorized();
    } else {
      await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "创建失败", icon: "none" });
    }
  } finally {
    shoppingSubmitting.value = false;
  }
}

async function confirmAddToShoppingList() {
  const source = resolveShoppingSource();
  if (!source || !selectedShoppingListId.value || shoppingSubmitting.value) return;
  shoppingSubmitting.value = true;
  try {
    await shoppingApi.addRecipeToList(selectedShoppingListId.value, {
      operationId: createOperationId(),
      recipeId: source.recipeId,
      sourceVersionId: source.sourceVersionId
    });
    closeShoppingSheet();
    await uniPlatform.feedback.toast({ title: "已加入采购清单", icon: "success" });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      openLoginForUnauthorized();
    } else {
      await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "添加失败", icon: "none" });
    }
  } finally {
    shoppingSubmitting.value = false;
  }
}

async function addToShoppingList() {
  if (!showShoppingEntry.value || shoppingSubmitting.value) return;
  if (!sessionStore.isLoggedIn) {
    openLogin(() => {
      void addToShoppingList();
    });
    return;
  }
  if (!resolveShoppingSource()) {
    await uniPlatform.feedback.toast({ title: "当前菜谱暂不支持加入采购清单", icon: "none" });
    return;
  }
  await openShoppingSheet();
}

async function handleReport() {
  const reasonText = buildReportPayload();
  const targetRecipeId = recipeId.value;
  if (!targetRecipeId || mode.value !== "published" || submitting.value || !reasonText) return;
  submitting.value = true;
  try {
    await recipeApi.reportRecipe(targetRecipeId, createOperationId(), reasonText);
    selectedReportReason.value = "";
    reportReason.value = "";
    closeReportSheet();
    await uniPlatform.feedback.toast({ title: "举报已提交", icon: "success" });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      openLoginForUnauthorized();
    } else {
      await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "举报失败", icon: "none" });
    }
  } finally {
    submitting.value = false;
  }
}

function formatAmount(amount: RecipeAmountSnapshot | RecipePreviewAmount) {
  if (amount.kind === "FUZZY") {
    return amount.text || "未填用量";
  }
  const quantity = amount.quantity || "";
  const unitName = amount.unitName || "";
  return `${quantity}${unitName}`.trim() || "未填用量";
}

function buildNutritionMetrics(metrics: NonNullable<RecipeNutritionSummary["perServing"]>): NutritionMetricCard[] {
  return [
    { key: "fat", label: "脂肪", unit: "g", value: metrics.fat },
    { key: "protein", label: "蛋白质", unit: "g", value: metrics.protein },
    { key: "carbohydrate", label: "碳水化合物", unit: "g", value: metrics.carbohydrate }
  ];
}

function buildNutritionRingSegments(metrics: NutritionMetricCard[]): NutritionRingSegment[] {
  const displayOrder: Array<NutritionMetricCard["key"]> = ["carbohydrate", "protein", "fat"];
  const ordered = displayOrder
    .map(key => metrics.find(metric => metric.key === key) || null)
    .filter((metric): metric is NutritionMetricCard => Boolean(metric));
  const resolved = ordered.map(metric => ({
    key: metric.key,
    value: hasNutritionValue(metric.value) && metric.value > 0 ? metric.value : 0
  }));
  const total = resolved.reduce((sum, metric) => sum + metric.value, 0);
  if (total <= 0) return ordered.map(metric => buildNutritionRingSegment(metric.key, 0, 84));

  const gapDeg = 18;
  const totalGap = resolved.length * gapDeg;
  const availableDeg = Math.max(360 - totalGap, 180);
  let startDeg = -126;

  return resolved.map(metric => {
    const rawSweep = total > 0 ? (metric.value / total) * availableDeg : 0;
    const sweepDeg = Math.max(rawSweep, 46);
    const segment = buildNutritionRingSegment(metric.key, startDeg, sweepDeg);
    startDeg += sweepDeg + gapDeg;
    return segment;
  });
}

function buildNutritionRingSegment(key: NutritionMetricCard["key"], startDeg: number, sweepDeg: number): NutritionRingSegment {
  const safeSweep = Math.max(sweepDeg, 24);
  const endDeg = startDeg + safeSweep;
  return {
    key,
    style: {
      "--segment-start": `${startDeg}deg`,
      "--segment-sweep": `${safeSweep}deg`,
      "--segment-color": resolveNutritionColor(key)
    },
    startCapStyle: buildNutritionRingCapStyle(startDeg),
    endCapStyle: buildNutritionRingCapStyle(endDeg)
  };
}

function buildNutritionRingCapStyle(angleDeg: number) {
  return {
    transform: `translate(-50%, -50%) rotate(${angleDeg}deg) translateY(calc(-1 * var(--nutrition-ring-radius)))`
  };
}

function currentDateText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mealSlotRank(slot: RecipePlanLinkSummary["mealSlot"]) {
  if (slot === "BREAKFAST") return 0;
  if (slot === "LUNCH") return 1;
  if (slot === "AFTERNOON_TEA") return 2;
  if (slot === "DINNER") return 3;
  return 4;
}

function sortRecipePlanLinks(links: RecipePlanLinkSummary[]) {
  const today = currentDateText();
  return [...links].sort((left, right) => {
    const leftActive = left.status !== "COMPLETED" && left.planDate >= today;
    const rightActive = right.status !== "COMPLETED" && right.planDate >= today;
    if (leftActive !== rightActive) return leftActive ? -1 : 1;
    if (leftActive) {
      if (left.planDate !== right.planDate) return left.planDate.localeCompare(right.planDate);
      return mealSlotRank(left.mealSlot) - mealSlotRank(right.mealSlot);
    }
    if (left.planDate !== right.planDate) return right.planDate.localeCompare(left.planDate);
    return mealSlotRank(right.mealSlot) - mealSlotRank(left.mealSlot);
  });
}

function mergeRecipePlanLinks(current: RecipePlanLinkSummary[] | null | undefined, next: RecipePlanLinkSummary) {
  const merged = (current ?? []).filter(item => item.planItemId !== next.planItemId);
  merged.unshift(next);
  return sortRecipePlanLinks(merged);
}

function formatRecipePlanLink(link: RecipePlanLinkSummary) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(link.planDate);
  const dateText = match ? `${Number(match[2])}月${Number(match[3])}日` : link.planDate;
  return `${dateText} · ${formatMealSlot(link.mealSlot)}`;
}

function syncDetailPlanLinks(nextLink: RecipePlanLinkSummary) {
  if (!publishedDetail.value) return;
	if (kind.value === "my") {
		if (!myDetail.value || !myPersonal.value) {
			void loadDetail();
			return;
		}
		detail.value = {
			...myDetail.value,
			personal: {
				...myPersonal.value,
				planLinks: mergeRecipePlanLinks(myPersonal.value.planLinks, nextLink)
			}
		};
		return;
	}
	const external = inspirationDetail.value;
	if (!external) return;
	detail.value = {
		...external,
		planLinks: mergeRecipePlanLinks(external.planLinks, nextLink)
	};
}

function hasNutritionValue(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function formatNutritionNumber(value: number | null) {
  if (!hasNutritionValue(value)) return "暂缺";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatNutritionValue(value: number | null, unit: string) {
  if (!hasNutritionValue(value)) return "暂缺";
  return `${formatNutritionNumber(value)}${unit}`;
}

function resolveNutritionColor(key: NutritionMetricCard["key"]) {
  if (key === "fat") return "var(--color-nutrition-fat)";
  if (key === "protein") return "var(--color-nutrition-protein)";
  return "var(--color-nutrition-carbohydrate)";
}

async function automatorApplySession(snapshot: { token: string; uid?: number; expiresAt: string; refreshCheckedAt?: number }) {
  await sessionStore.setSession(snapshot);
  errorText.value = "";
  if (mode.value === "published" && recipeId.value) {
    detail.value = null;
    await loadDetail();
  }
}

function automatorReadState() {
	return {
		isLoggedIn: sessionStore.isLoggedIn,
		pageLoading: pageLoading.value,
		loading: loading.value,
    errorText: errorText.value,
    title: detailTitle.value,
    planLinkCount: recipePlanLinks.value.length,
    primaryPlanText: primaryPlanText.value,
    canOpenRecipeAssistant: canOpenRecipeAssistant.value,
	    canRecommend: myPersonal.value?.canRecommend ?? false,
    showRecommendEntry: showRecommendEntry.value,
    recommendationStatus: currentRecommendation.value?.status ?? null,
    recommendActionLabel: recommendActionLabel.value,
    recommendSheetVisible: recommendSheetVisible.value,
    recommendCategoryCount: recommendCategories.value.length,
    selectedRecommendCategoryId: selectedRecommendCategoryId.value || ""
  };
}

defineExpose({
  automatorApplySession,
  automatorReadState
});

</script>

<style scoped lang="scss">

.detail-nav-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9;
  background: var(--color-page);
  pointer-events: none;
  transition: opacity 160ms ease;
}

.detail-nav-tabs {
  display: flex;
  gap: 40rpx;
  align-items: flex-start;
  width: 100%;
}

.detail-nav-tabs__item {
  position: relative;
  z-index: 0;
  flex: 0 0 auto;
  padding: 8rpx 0 12rpx;
  color: var(--color-text-secondary);
  font-size: 32rpx;
  font-weight: var(--font-weight-bold);
  line-height: 1;
  white-space: nowrap;
}

.detail-nav-tabs__item--active {
  color: var(--color-text);
}

.detail-page {
  background: var(--page-ambient-duo-bg);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.detail-scroll {
  flex: 1;
  height: 100%;
  min-height: 0;
}

.detail-scroll-body {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.hero {
  padding: 0;
}

.hero__cover {
  position: relative;
  overflow: hidden;
  min-height: 0;
  padding-top: 75%;
  border-radius: 0;
  background: var(--color-surface);
  box-shadow: none;
}

.hero__image {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  background: var(--color-surface);
}

.content {
  position: relative;
  flex: 1 1 auto;
  z-index: 1;
  margin-top: -54rpx;
  min-height: 0;
  padding: 32rpx 0 max(48rpx, env(safe-area-inset-bottom));
  background: var(--color-surface);
  border-radius: 36rpx 36rpx 0 0;
}

.content--with-actions {
  padding-bottom: calc(160rpx + env(safe-area-inset-bottom));
}

.summary-card {
  margin: 0 var(--space-page);
}

.summary-card__title,
.summary-card__story {
  display: block;
}

.summary-card__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
}

.summary-card__title {
  flex: 1;
  min-width: 0;
  color: var(--color-text);
  font-size: 50rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.3;
}

.summary-card__share {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
}

.summary-card__share::after {
  border: 0;
}

.summary-card__share {
  padding: 0;
  color: var(--color-text-secondary);
}

.summary-card__share-icon {
  line-height: 1;
}

.summary-card__story {
  margin-top: 18rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  line-height: 1.8;
}

.summary-card__keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 20rpx;
}

.summary-card__keyword {
  padding: 6rpx 14rpx;
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.4;
  border-radius: var(--radius-xs);
  background: var(--color-surface-muted);
}

.summary-card__facts {
  margin-top: 24rpx;
}

.summary-card__fact-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}

.summary-card__fact-block {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.summary-card__fact-title,
.summary-card__fact-text,
.summary-card__recommend-entry {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.summary-card__fact-title {
  color: var(--color-text-tertiary);
}

.summary-card__fact-text {
  color: var(--color-text-secondary);
}

.summary-card__recommend-entry {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 8rpx;
  color: var(--color-text-tertiary);
  opacity: 0.78;
}

.summary-card__recommend-entry-icon {
  color: inherit;
  font-size: 24rpx;
  line-height: 1;
}

.summary-card__recommend-entry--default {
  color: var(--color-text);
  opacity: 1;
}

.summary-card__recommend-entry--retry {
  color: var(--color-text);
  opacity: 0.82;
}

.summary-card__recommend-entry--pending {
  color: var(--color-text-secondary);
  opacity: 0.78;
}

.summary-card__recommend-entry--adopted {
  color: var(--color-text-tertiary);
  opacity: 0.72;
}

.summary-card__recommend-entry--hover {
  opacity: 0.56;
}

.summary-info {
  display: flex;
  gap: 12rpx;
  margin: 30rpx 0;
  padding-bottom: 20rpx;
}

.summary-info__item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  min-width: 0;
  padding: 10rpx 16rpx;
}

.summary-info__icon {
  position: relative;
  width: 42rpx;
  height: 42rpx;
  color: var(--color-text);
}

.summary-info__icon.cookfont {
  display: flex;
  align-items: center;
  justify-content: center;
  width: auto;
  height: auto;
  font-size: 50rpx;
  color: var(--color-text);
}

.summary-info__label {
  color: var(--color-text);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
  text-align: center;
}

.summary-info__label--muted {
  color: var(--color-text-secondary);
}

.nutrition-grid {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 20rpx 0;
  animation: nutrition-fade-in 220ms ease;
}

.nutrition-grid__chart {
  position: relative;
  --nutrition-ring-size: 140rpx;
  --nutrition-ring-thickness: 14rpx;
  --nutrition-ring-radius: calc((var(--nutrition-ring-size) - var(--nutrition-ring-thickness)) / 2);
  flex: 0 0 var(--nutrition-ring-size);
  width: var(--nutrition-ring-size);
  height: var(--nutrition-ring-size);
  border-radius: 50%;
}

.nutrition-ring-segment {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background:
    conic-gradient(
      from var(--segment-start),
      var(--segment-color) 0deg var(--segment-sweep),
      transparent var(--segment-sweep) 360deg
    );
  -webkit-mask: radial-gradient(
    farthest-side,
    transparent calc(100% - var(--nutrition-ring-thickness)),
    var(--color-mask-solid) calc(100% - var(--nutrition-ring-thickness) + 1rpx)
  );
  mask: radial-gradient(
    farthest-side,
    transparent calc(100% - var(--nutrition-ring-thickness)),
    var(--color-mask-solid) calc(100% - var(--nutrition-ring-thickness) + 1rpx)
  );
}

.nutrition-ring-segment__cap {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--nutrition-ring-thickness);
  height: var(--nutrition-ring-thickness);
  border-radius: 50%;
  background: var(--segment-color);
}

.nutrition-grid__metrics {
  flex: 1;
  min-width: 0;
  padding-right: 12rpx;
}

.nutrition-metric + .nutrition-metric {
  margin-top: 14rpx;
}

.nutrition-metric__main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.nutrition-metric__label-wrap {
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
}

.nutrition-metric__dot {
  flex: 0 0 auto;
  width: 10rpx;
  height: 10rpx;
  border-radius: var(--radius-pill);
}

.nutrition-metric__dot--protein {
  background: var(--color-nutrition-protein);
}

.nutrition-metric__dot--fat {
  background: var(--color-nutrition-fat);
}

.nutrition-metric__dot--carbohydrate {
  background: var(--color-nutrition-carbohydrate);
}

.nutrition-metric__label {
  color: var(--color-text-secondary);
  font-size: 26rpx;
  line-height: 1.2;
}

.nutrition-metric__amount {
  flex: 0 0 auto;
  color: var(--color-text-tertiary);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
}

.nutrition-metric__amount--fat {
  color: var(--color-nutrition-fat);
}

.nutrition-metric__amount--protein {
  color: var(--color-nutrition-protein);
}

.nutrition-metric__amount--carbohydrate {
  color: var(--color-nutrition-carbohydrate);
}

.nutrition-metric__amount--empty {
  color: var(--color-text-tertiary);
}

.nutrition-grid__summary {
  position: relative;
  display: flex;
  flex: 0 0 200rpx;
  width: 200rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding-left: 24rpx;
  text-align: center;
}

.nutrition-grid__summary::before {
  content: "";
  position: absolute;
  left: 0;
  top: 12rpx;
  bottom: 12rpx;
  width: 2rpx;
  background: var(--color-border);
}

.nutrition-grid__calories {
  color: var(--color-text);
  font-size: 50rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 0.92;
}

.nutrition-grid__calories-unit {
  color: var(--color-text-tertiary);
  font-size: 28rpx;
  line-height: 1;
}

@keyframes nutrition-fade-in {
  from {
    opacity: 0;
    transform: translateY(8rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.nutrition-toggle {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 16rpx;
  margin: 0;
  padding: 0;
}

.nutrition-toggle__item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
}

.nutrition-toggle__item::after {
  border: 0;
}

.nutrition-toggle__divider {
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  line-height: 1;
}

.nutrition-toggle__item--active {
  color: var(--color-support-action);
}

.section {
  padding: var(--space-md) 32rpx;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.section--first {
  margin-top: 8rpx;
}

.section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 24rpx;
}

.section__head-main {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  min-width: 0;
}

.section__label {
  color: var(--color-text);
  font-size: 36rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
}

.section__caption {
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  line-height: 1.2;
}

.section__action {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  flex: 0 0 auto;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-support-action);
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
}

.section__action::after {
  border: 0;
}

.section__action-icon {
  color: inherit;
  font-size: 32rpx;
  line-height: 1;
}

.section__link {
  color: var(--color-support-action);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
  flex: 0 0 auto;
}

.section__link--hover {
  opacity: 0.72;
}

.section__note,
.section__empty,
.tips-text {
  display: block;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.8;
}

.detail-curated {
  display: block;
  margin: 8rpx 32rpx 0;
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  line-height: 1.6;
}

.plan-link-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 14rpx 0 10rpx;
  border-top: 1rpx solid var(--color-border-light);
  border-bottom: 1rpx solid var(--color-border-light);
}

.plan-link-entry--hover {
  opacity: 0.82;
}

.plan-link-entry__title {
  min-width: 0;
  flex: 1;
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.5;
}

.plan-link-entry__count {
  flex: 0 0 auto;
  margin-left: 16rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.3;
}

.ingredient-list {
  overflow: hidden;
}

.ingredient-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  min-height: 86rpx;
  padding: 22rpx 0;
  box-sizing: border-box;
}

.ingredient-row + .ingredient-row {
  border-top: 1rpx solid var(--color-border-light);
}

.ingredient-row--extra {
  overflow: hidden;
  min-height: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  border-top-color: transparent !important;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-16rpx);
  transition:
    min-height 260ms ease,
    max-height 260ms ease,
    padding 260ms ease,
    border-color 180ms ease,
    opacity 180ms ease,
    transform 260ms ease;
}

.ingredient-row--extra-expanded {
  min-height: 86rpx;
  max-height: 160rpx;
  padding-top: 22rpx;
  padding-bottom: 22rpx;
  border-top-color: var(--color-border-light) !important;
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.ingredient-list__toggle {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-height: 60rpx;
}

.ingredient-list__toggle--hover {
  opacity: 0.72;
}

.ingredient-list__toggle-line {
  flex: 1;
  min-width: 0;
  border-top: 2rpx dashed var(--color-divider);
}

.ingredient-list__toggle-text {
  flex: 0 0 auto;
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  line-height: 1.5;
}

.ingredient-row__name,
.ingredient-row__amount {
  color: var(--color-text);
  font-size: 28rpx;
  line-height: 1.5;
}

.ingredient-row__amount {
  color: var(--color-text-secondary);
  text-align: right;
}

.step-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.step-card {
  padding: 6rpx 0 0;
}

.step-card__index,
.step-card__text {
  display: block;
}

.step-card__index {
  color: var(--color-text);
  font-size: 24rpx;
  line-height: 1;
}

.step-card__index-current,
.step-card__index-total {
  display: inline-block;
  font-style: italic;
  vertical-align: baseline;
}

.step-card__index-current {
  font-size: 36rpx;
  padding-right: 10rpx;
  font-weight: var(--font-weight-semibold);
}

.step-card__index-total {
  font-size: 24rpx;
  font-weight: var(--font-weight-medium);
}

.step-card__cover-image {
  display: block;
  width: 100%;
  margin-top: 16rpx;
  border-radius: 20rpx;
  overflow: hidden;
}

.step-card__text {
  margin-top: 16rpx;
  color: var(--color-text);
  font-size: 28rpx;
  line-height: 1.8;
}

.chip-row {
  display: flex;
  gap: var(--space-sm);
}

.chip-row {
  flex-wrap: wrap;
  margin-top: var(--space-sm);
}

.chip {
  padding: 14rpx 24rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.chip--active {
  background: var(--color-tag-primary-bg);
  box-shadow: inset 0 0 0 1rpx var(--color-border-active);
  color: var(--color-tag-primary-text);
}

.panel-note {
  padding: 20rpx 24rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.panel-note--sheet {
  margin-top: 24rpx;
}

.report-box {
  width: 100%;
  min-height: 180rpx;
  margin-top: var(--space-sm);
  padding: 20rpx 24rpx;
  border: 1rpx solid var(--material-input-border);
  border-radius: var(--radius-md);
  background: var(--material-input-bg);
  box-shadow: var(--material-input-shadow);
  -webkit-backdrop-filter: var(--material-input-filter);
  backdrop-filter: var(--material-input-filter);
  box-sizing: border-box;
}

.sheet-section {
  margin-top: 28rpx;
}

.sheet-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 18rpx;
}

.sheet-section__meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
}

.sheet-section__title {
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.4;
}

.sheet-section__tag {
  flex: 0 0 auto;
  color: var(--color-text-tertiary);
  font-size: 22rpx;
  line-height: 1.2;
}

.sheet-section__action {
  flex: 0 0 auto;
  color: var(--color-support-action);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
}

.sheet-section__hint {
  display: block;
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  line-height: 1.6;
}

.sheet-note-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 18rpx;
}

.sheet-note-item {
  display: block;
  color: var(--color-text-secondary);
  font-size: 26rpx;
  line-height: 1.7;
}

.plan-link-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 18rpx;
}

.plan-link-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 22rpx 24rpx;
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.plan-link-row--hover {
  opacity: 0.82;
}

.plan-link-row__main {
  min-width: 0;
  flex: 1;
}

.plan-link-row__title,
.plan-link-row__action,
.plan-link-row__action-text,
.plan-link-row__icon,
.plan-link-row__title {
  display: block;
}

.plan-link-row__title {
  min-width: 0;
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.4;
}

.plan-link-row__action {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10rpx;
}

.plan-link-row__action-text {
  color: var(--color-support-action);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
}

.plan-link-row__icon {
  flex: 0 0 auto;
  color: var(--color-icon-accent);
  font-size: 24rpx;
  line-height: 1;
}

.sheet-creator {
  display: flex;
  gap: 14rpx;
  margin-bottom: 18rpx;
}

.sheet-creator__input {
  flex: 1;
  height: 80rpx;
  line-height: 1;
  padding: 0 22rpx;
  border: 1rpx solid var(--material-input-border);
  border-radius: var(--radius-xs);
  background: var(--material-input-bg);
  box-shadow: var(--material-input-shadow);
  -webkit-backdrop-filter: var(--material-input-filter);
  backdrop-filter: var(--material-input-filter);
  box-sizing: border-box;
  color: var(--color-text);
  font-size: 26rpx;
}

.sheet-creator__button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 132rpx;
  height: 80rpx;
  line-height: 80rpx;
   border-radius: var(--radius-xs);
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.sheet-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 22rpx;
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

.sheet-actions__button--confirm {
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}

.sheet-actions__button--cancel {
  background: var(--color-surface-soft-muted);
  color: var(--color-text-secondary);
}

.detail-actions-shell {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1200;
  height: calc(152rpx + env(safe-area-inset-bottom));
  pointer-events: none;
  opacity: 0;
  transition: opacity 320ms ease;
}

.detail-actions-shell::after {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--color-tabbar-bg);
  -webkit-mask-image: var(--frosted-mask-image);
  mask-image: var(--frosted-mask-image);
  -webkit-backdrop-filter: var(--page-overlay-veil-filter);
  backdrop-filter: var(--page-overlay-veil-filter);
  pointer-events: none;
  content: "";
}

.detail-actions-shell--visible {
  opacity: 1;
}

.detail-actions {
  position: absolute;
  right: 24rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  left: 24rpx;
  z-index: 1;
  display: flex;
  gap: 16rpx;
  padding: 10rpx;
  border-radius: var(--radius-pill);
  background: var(--material-tabbar-bg);
  box-shadow: var(--material-tabbar-shadow);
  overflow: hidden;
  pointer-events: auto;
  -webkit-backdrop-filter: var(--material-tabbar-filter);
  backdrop-filter: var(--material-tabbar-filter);
  transform: translateY(calc(100% + env(safe-area-inset-bottom) + 40rpx));
  transition:
    transform 420ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 320ms ease;
}

.detail-actions--visible {
  transform: translateY(0);
  pointer-events: auto;
}

.detail-actions__item {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  min-height: 88rpx;
  margin: 0;
  padding: 0 20rpx;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
}

.detail-actions__item::after {
  border: 0;
}

.detail-actions__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  line-height: 1;
}

.detail-actions__text {
  display: flex;
  align-items: center;
  color: inherit;
  line-height: 1;
  font-size: 28rpx;
  white-space: nowrap;
}

.detail-actions__item--disabled {
  opacity: 0.52;
}

.detail-inline-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 28rpx;
  margin-top: 28rpx;
  padding: 0 32rpx;
}

.detail-inline-actions__item {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10rpx;
  flex: 0 0 auto;
  min-height: auto;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 26rpx;
  font-weight: var(--font-weight-regular);
  line-height: 1.4;
}

.detail-inline-actions__item::after {
  border: 0;
}

.detail-inline-actions__item--disabled {
  opacity: 0.52;
}

.detail-inline-actions__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30rpx;
  height: 30rpx;
  flex: 0 0 30rpx;
  color: var(--color-text-secondary);
  font-size: 30rpx;
  font-weight: var(--font-weight-regular);
  line-height: 1;
}

.detail-inline-actions__text {
  display: flex;
  align-items: center;
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-regular);
  line-height: 1.4;
  white-space: nowrap;
}

.report-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 24rpx;
  padding: 24rpx 28rpx;
  border: 1rpx solid var(--material-input-border);
  border-radius: var(--radius-md);
  background: var(--material-input-bg);
  box-shadow: var(--material-input-shadow);
  -webkit-backdrop-filter: var(--material-input-filter);
  backdrop-filter: var(--material-input-filter);
}

.report-picker__label {
  color: var(--color-text);
  font-size: 28rpx;
  line-height: 1.4;
}

.report-picker__value {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-width: 0;
}

.report-picker__text {
  color: var(--color-text);
  font-size: 26rpx;
  line-height: 1.4;
  text-align: right;
}

.report-picker__text--placeholder,
.report-picker__icon {
  color: var(--color-text-tertiary);
}

.primary,
.secondary,
.danger {
  border-radius: var(--radius-md);
}

.primary {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
}

.secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.danger {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 90rpx;
  margin-top: var(--space-md);
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}
</style>
