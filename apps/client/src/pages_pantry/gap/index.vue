<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="现在缺什么" full-screen :navbar-placeholder="false" navbar-transparent>
    <view class="gap-nav-backdrop" :style="navBackdropStyle" />
    <view class="gap-scroll-wrap">
      <RecipeSearchLoading
        :pull-distance="pullDistance"
        :refreshing="refreshing"
        :show-success="showSuccess"
        :refresher-text="refresherText"
        :threshold="refresherThreshold"
      />
      <scroll-view
        class="gap-scroll"
        scroll-y
        refresher-enabled
        refresher-default-style="none"
        :show-scrollbar="false"
        :refresher-threshold="refresherThreshold"
        :refresher-triggered="refresherTriggered"
        @scroll="handleGapScroll"
        @refresherpulling="onRefresherPulling"
        @refresherrefresh="handleRefresherRefresh"
        @refresherrestore="onRefresherRestore"
        @refresherabort="onRefresherRestore"
      >
        <view class="gap-page">
          <view class="gap-hero" :style="heroStyle">
            <text class="gap-hero__eyebrow">近期缺口</text>
            <text class="gap-hero__title">{{ summaryTitle }}</text>
            <text class="gap-hero__description">{{ summaryDescription }}</text>
          </view>

          <view class="gap-content">
            <Login v-if="!sessionStore.isLoggedIn" title="登录后看现在缺什么" description="缺口只按你自己的冰箱和待处理饭局来判断。" />

            <template v-else>
              <view v-if="errorText" class="notice" @click="loadPage">
                <text class="notice__text">{{ errorText }}</text>
                <text class="notice__action">重新加载</text>
              </view>

              <text class="gap-intro">缺口页只聚焦从今天起未来 7 天的做饭安排；购物清单继续负责真正的采购维护。</text>

              <view class="target-card" hover-class="target-card--hover" hover-stay-time="100" @click="openTargetSheet()">
                <view class="target-card__main">
                  <text class="target-card__eyebrow">当前采购清单</text>
                  <text class="target-card__title">{{ selectedList ? selectedList.name : "先选一张清单" }}</text>
                  <text class="target-card__meta">{{ selectedListMeta }}</text>
                </view>
                <text class="target-card__action">{{ selectedList ? "切换" : "选择" }}</text>
              </view>

              <view v-if="showLoadingNotice" class="notice">
                <text class="notice__text">正在按时间层级整理待处理饭局的缺口...</text>
              </view>

              <template v-else-if="visibleSections.length">
                <view v-for="section in visibleSections" :key="section.window" class="gap-section">
                  <view class="gap-section__head">
                    <view class="gap-section__head-main">
                      <text class="gap-section__title">{{ section.title }}</text>
                      <text class="gap-section__description">{{ section.description }}</text>
                    </view>
                    <view v-if="section.window === 'LATER'" class="gap-section__toggle" @click.stop="laterExpanded = !laterExpanded">
                      {{ laterExpanded ? "收起" : "展开" }}
                    </view>
                  </view>

                  <view v-if="section.window !== 'LATER' || laterExpanded" class="gap-list">
                    <view v-for="item in section.items" :key="`${section.window}-${item.key}`" class="gap-card">
                      <view class="gap-card__head">
                        <view class="gap-card__head-main">
                          <text class="gap-card__title">{{ item.name }}</text>
                          <text class="gap-card__meta">{{ item.quantityText || "未填数量" }}</text>
                          <text class="gap-card__hint">涉及 {{ item.eventCount }} 场饭局 · {{ item.sourceCount }} 道菜</text>
                        </view>
                        <button
                          class="gap-card__action"
                          :class="{ 'gap-card__action--disabled': submittingGapKey === section.window + ':' + item.key }"
                          :disabled="submittingGapKey === section.window + ':' + item.key"
                          @click.stop="addGapItem(section.window, item)"
                        >
                          {{ submittingGapKey === section.window + ':' + item.key ? "加入中..." : "加入清单" }}
                        </button>
                      </view>

                      <view class="gap-card__events">
                        <view v-for="event in item.events" :key="`${item.key}-${event.eventId}`" class="gap-event">
                          <view class="gap-event__head">
                            <text class="gap-event__title">{{ event.title }}</text>
                            <text class="gap-event__time">{{ formatEventTime(event.scheduledAt) }}</text>
                          </view>
                          <text v-if="event.recipeTitles.length" class="gap-event__recipes">{{ event.recipeTitles.join(" · ") }}</text>
                        </view>
                      </view>
                    </view>
                  </view>
                </view>
              </template>

              <view v-else class="gap-section">
                <text class="gap-section__title">当前缺口</text>
                <Empty title="暂时没有待补食材" description="这几顿饭暂时没有明显缺口；如果已有待买项，直接去购物清单处理就行。" />
              </view>
            </template>
          </view>
        </view>
      </scroll-view>
    </view>

    <button v-if="sessionStore.isLoggedIn" class="shopping-fab" @click="goShoppingList">购物清单</button>

    <SheetShell
      :visible="targetSheetVisible"
      title="加入购物清单"
      :subtitle="sheetSubtitle"
      @close="closeTargetSheet"
      @after-close="resetTargetSheet"
    >
      <view v-if="pendingGapItem" class="sheet-meta">
        <text class="sheet-meta__title">{{ pendingGapItem.name }}</text>
        <text class="sheet-meta__text">{{ pendingGapItem.sectionTitle }}</text>
      </view>

      <view class="sheet-section">
        <view class="sheet-section__head">
          <text class="sheet-section__title">目标清单</text>
          <text class="sheet-section__action" @click="toggleCreateMode">{{ shoppingCreateMode ? "取消创建" : "创建清单" }}</text>
        </view>

        <view v-if="shoppingCreateMode" class="sheet-create-row">
          <input
            v-model="newListName"
            class="sheet-input sheet-input--grow"
            maxlength="20"
            placeholder="输入新清单名"
          />
          <view
            class="sheet-create-button"
            :class="{ 'sheet-create-button--disabled': shoppingCreateDisabled }"
            @click="createShoppingList"
          >
            {{ shoppingCreatingList ? "创建中..." : "创建" }}
          </view>
        </view>

        <view v-if="activeLists.length" class="sheet-option-list">
          <view
            v-for="list in activeLists"
            :key="list.id"
            class="sheet-option"
            :class="{ 'sheet-option--active': !shoppingCreateMode && selectedListId === list.id }"
            @click="selectActiveList(list.id)"
          >
            <view class="sheet-option__main">
              <text class="sheet-option__title">{{ list.name }}</text>
              <text class="sheet-option__meta">剩余 {{ Math.max(list.progressTotalCount - list.progressDoneCount, 0) }} 项待处理</text>
            </view>
          </view>
        </view>
      </view>

      <template #footer>
        <view class="sheet-actions">
          <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="shoppingSubmitting" @click="closeTargetSheet">取消</button>
          <button class="sheet-actions__button sheet-actions__button--confirm" :disabled="sheetSubmitDisabled" @click="submitTargetSheet">
            {{ shoppingSubmitting ? "加入中..." : pendingGapItem ? "加入清单" : "完成" }}
          </button>
        </view>
      </template>
    </SheetShell>
  </Layout>
</template>

<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import RecipeSearchLoading from "@/components/Recipe/RecipeSearchLoading.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { useCustomRefresher } from "@/composables/useCustomRefresher";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { formatDateTimeMinute } from "@/utils/date";
import { createOperationId } from "@/utils/operation-id";
import { shoppingApi, type ShoppingGapItem, type ShoppingGapResponse, type ShoppingGapWindow, type ShoppingListSummary } from "../apis/shopping";
import type { UUID } from "@/apis/http";

const pageStyle = usePageScrollStyle();
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();

const GAP_NAV_GAP = 16;
const GAP_NAV_FADE_DISTANCE = 96;

const gapData = ref<ShoppingGapResponse | null>(null);
const activeLists = ref<ShoppingListSummary[]>([]);
const loading = ref(false);
const errorText = ref("");
const gapScrollTop = ref(0);
const laterExpanded = ref(false);
const targetSheetVisible = ref(false);
const shoppingCreateMode = ref(false);
const shoppingCreatingList = ref(false);
const shoppingSubmitting = ref(false);
const selectedListId = ref<UUID | "">("");
const newListName = ref("");
const submittingGapKey = ref("");
const pendingGapItem = ref<{ window: ShoppingGapWindow; key: string; name: string; sectionTitle: string } | null>(null);

const {
  threshold: refresherThreshold,
  pullDistance,
  refreshing,
  showSuccess,
  refresherText,
  refresherTriggered,
  onRefresherPulling,
  onRefresherRefresh,
  onRefreshComplete,
  onRefresherRestore
} = useCustomRefresher({
  text: {
    pulling: "下拉刷新缺口",
    canRelease: ["松手刷新缺口"],
    success: "缺口已刷新"
  }
});

const selectedList = computed(() => activeLists.value.find(item => item.id === selectedListId.value) ?? null);
const totalItemCount = computed(() => gapData.value?.totalItemCount ?? 0);
const totalEventCount = computed(() => gapData.value?.totalEventCount ?? 0);
const visibleSections = computed(() => {
  const sections = gapData.value?.sections ?? [];
  return sections.filter(section => section.itemCount > 0);
});
const showLoadingNotice = computed(() => loading.value && !refreshing.value);
const selectedListMeta = computed(() => {
  if (!selectedList.value) {
    return activeLists.value.length ? "先选一张活跃清单，再把缺口快速收进去。" : "还没有活跃清单，先创建一张。";
  }
  const remaining = Math.max(selectedList.value.progressTotalCount - selectedList.value.progressDoneCount, 0);
  return `剩余 ${remaining} 项待处理`;
});
const summaryTitle = computed(() => {
  if (!sessionStore.isLoggedIn) return "先登录，再看现在缺什么";
  if (loading.value) return "正在按时间层级整理缺口";
  if (!totalItemCount.value) return "这几顿暂时不缺食材";
  if (totalItemCount.value <= 2) return `还差 ${totalItemCount.value} 样，先把最近的补上`;
  return `还差 ${totalItemCount.value} 样，先处理眼前几顿`;
});
const summaryDescription = computed(() => {
  if (!sessionStore.isLoggedIn) return "登录后按你自己的冰箱和待处理饭局来判断食材缺口。";
  if (loading.value) return "先按未来 48 小时、3 到 7 天、7 天后，把待处理饭局的食材缺口收口。";
  if (!totalItemCount.value) return "未来 7 天里没有明显缺口；如果已有待买项，直接去购物清单处理就行。";
  return `当前缺口涉及 ${totalEventCount.value} 场饭局；7 天后的安排默认收起，避免干扰最近做饭。`;
});
const sheetSubtitle = computed(() => {
  if (pendingGapItem.value) return `把 ${pendingGapItem.value.name} 收进哪张清单？`;
  return "先选一张当前要维护的购物清单。";
});
const shoppingCreateDisabled = computed(() => shoppingCreatingList.value || !newListName.value.trim());
const sheetSubmitDisabled = computed(() => {
  if (shoppingCreatingList.value || shoppingSubmitting.value) return true;
  if (pendingGapItem.value) return !selectedListId.value;
  return false;
});
const navProgress = computed(() => Math.min(1, Math.max(0, gapScrollTop.value / GAP_NAV_FADE_DISTANCE)));
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: `${navProgress.value}`
}));
const heroStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + GAP_NAV_GAP}px`
}));

onShow(() => {
  if (!sessionStore.isLoggedIn) return;
  void loadPage();
});

async function loadPage() {
  if (loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    const [gapResult, listResult] = await Promise.all([shoppingApi.previewGap(), shoppingApi.listLists("ACTIVE")]);
    gapData.value = gapResult;
    activeLists.value = listResult.items;
    if (!activeLists.value.some(item => item.id === selectedListId.value)) {
      selectedListId.value = activeLists.value[0]?.id || "";
    }
    if (!gapResult.hasLater) {
      laterExpanded.value = false;
    }
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "缺口加载失败";
  } finally {
    loading.value = false;
  }
}

function goShoppingList() {
  void uniPlatform.navigation.navigateTo("/pages_pantry/list/index");
}

function handleGapScroll(event: { detail?: { scrollTop?: number } }) {
  gapScrollTop.value = event.detail?.scrollTop ?? 0;
}

function openTargetSheet(item?: { window: ShoppingGapWindow; key: string; name: string; sectionTitle: string }) {
  pendingGapItem.value = item ?? null;
  shoppingCreateMode.value = !activeLists.value.length;
  if (!selectedListId.value) {
    selectedListId.value = activeLists.value[0]?.id || "";
  }
  targetSheetVisible.value = true;
}

function closeTargetSheet() {
  targetSheetVisible.value = false;
}

function resetTargetSheet() {
  pendingGapItem.value = null;
  shoppingCreateMode.value = false;
  newListName.value = "";
}

function toggleCreateMode() {
  shoppingCreateMode.value = !shoppingCreateMode.value;
  if (!shoppingCreateMode.value && !selectedListId.value) {
    selectedListId.value = activeLists.value[0]?.id || "";
  }
}

function selectActiveList(listId: UUID) {
  shoppingCreateMode.value = false;
  selectedListId.value = listId;
}

async function createShoppingList() {
  if (shoppingCreateDisabled.value) return;
  shoppingCreatingList.value = true;
  try {
    const createdList = await shoppingApi.createList({
      operationId: createOperationId(),
      name: newListName.value.trim()
    });
    activeLists.value = [createdList, ...activeLists.value.filter(item => item.id !== createdList.id)];
    selectedListId.value = createdList.id;
    shoppingCreateMode.value = false;
    newListName.value = "";
    await uniPlatform.feedback.toast({ title: "已创建清单", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "创建清单失败", icon: "none" });
  } finally {
    shoppingCreatingList.value = false;
  }
}

async function submitTargetSheet() {
  if (!pendingGapItem.value) {
    closeTargetSheet();
    return;
  }
  if (!selectedListId.value) {
    await uniPlatform.feedback.toast({ title: "请选择购物清单", icon: "none" });
    return;
  }
  shoppingSubmitting.value = true;
  try {
    await shoppingApi.addGapItemsToList(selectedListId.value, {
      operationId: createOperationId(),
      window: pendingGapItem.value.window,
      gapKeys: [pendingGapItem.value.key]
    });
    await uniPlatform.feedback.toast({ title: "已加入清单", icon: "success" });
    closeTargetSheet();
    pendingGapItem.value = null;
    await loadPage();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "加入清单失败", icon: "none" });
  } finally {
    shoppingSubmitting.value = false;
  }
}

async function addGapItem(window: ShoppingGapWindow, item: ShoppingGapItem) {
  const section = visibleSections.value.find(current => current.window === window);
  if (!section) return;
  if (!selectedListId.value) {
    openTargetSheet({
      window,
      key: item.key,
      name: item.name,
      sectionTitle: section.title
    });
    return;
  }

  const actionKey = `${window}:${item.key}`;
  submittingGapKey.value = actionKey;
  try {
    await shoppingApi.addGapItemsToList(selectedListId.value, {
      operationId: createOperationId(),
      window,
      gapKeys: [item.key]
    });
    await uniPlatform.feedback.toast({ title: "已加入清单", icon: "success" });
    await loadPage();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "加入清单失败", icon: "none" });
  } finally {
    submittingGapKey.value = "";
  }
}

function formatEventTime(value: string) {
  const text = formatDateTimeMinute(value, "");
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(text) ? text.slice(5) : text || value;
}

async function handleRefresherRefresh() {
  const shouldRefresh = onRefresherRefresh();
  if (!shouldRefresh) {
    onRefresherRestore();
    return;
  }

  try {
    await loadPage();
    await onRefreshComplete();
  } finally {
    onRefresherRestore();
  }
}
</script>

<style scoped lang="scss">
.gap-nav-backdrop {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 799;
  overflow: hidden;
  border-bottom: 1rpx solid var(--color-border);
  background: var(--color-tabbar-bg);
  box-shadow: 0 10rpx 24rpx var(--color-surface-mask-weak);
  pointer-events: none;
  -webkit-backdrop-filter: saturate(180%) blur(22rpx);
  backdrop-filter: saturate(180%) blur(22rpx);
  transition: opacity 180ms ease;
}

.gap-scroll-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
}

.gap-scroll {
  height: 100%;
  background: var(--color-page);
}

.gap-page {
  min-height: 100%;
  padding-bottom: calc(180rpx + env(safe-area-inset-bottom));
}

.gap-hero {
  padding: 64rpx var(--space-page) 164rpx;
  background:
    linear-gradient(180deg, var(--color-surface-mask-weak), var(--color-surface-mask-medium)),
    radial-gradient(circle at 18% 26%, rgba(255, 220, 168, 0.46), transparent 30%),
    radial-gradient(circle at 84% 18%, rgba(190, 228, 188, 0.34), transparent 28%),
    linear-gradient(145deg, rgba(255, 246, 230, 0.96), rgba(252, 249, 242, 0.98));
}

.gap-content {
  position: relative;
  z-index: 1;
  margin-top: -96rpx;
  padding: 0 var(--space-page);
}

.gap-hero__eyebrow,
.gap-hero__title,
.gap-hero__description,
.gap-intro,
.gap-section__title,
.gap-section__description,
.gap-card__title,
.gap-card__meta,
.gap-card__hint,
.notice__text,
.notice__action,
.target-card__eyebrow,
.target-card__title,
.target-card__meta,
.target-card__action,
.gap-event__title,
.gap-event__time,
.gap-event__recipes,
.sheet-meta__title,
.sheet-meta__text {
  display: block;
}

.gap-hero__eyebrow {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.gap-hero__title,
.gap-section__title,
.gap-card__title,
.target-card__title {
  color: var(--color-text);
  font-weight: var(--font-weight-heavy);
}

.gap-hero__title {
  margin-top: 10rpx;
  font-size: 42rpx;
  line-height: 1.2;
}

.gap-hero__description,
.gap-intro,
.gap-section__description,
.gap-card__meta,
.gap-card__hint,
.notice__text,
.notice__action,
.target-card__eyebrow,
.target-card__meta,
.gap-event__time,
.gap-event__recipes,
.sheet-meta__text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.gap-hero__description,
.gap-section__description {
  margin-top: 12rpx;
}

.gap-intro,
.notice,
.target-card,
.gap-section {
  margin-top: var(--space-md);
}

.gap-intro {
  color: var(--color-text-secondary);
}

.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 24rpx;
  border-radius: var(--radius-lg);
  background: rgba(255, 243, 219, 0.96);
  color: #8b4d12;
}

.notice__action {
  font-weight: var(--font-weight-heavy);
}

.target-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
  border-radius: var(--radius-lg);
  background: rgba(255, 250, 241, 0.96);
  box-shadow: 0 14rpx 28rpx rgba(120, 86, 33, 0.08);
}

.target-card--hover {
  opacity: 0.92;
}

.target-card__title {
  margin-top: 8rpx;
  font-size: 30rpx;
}

.target-card__meta {
  margin-top: 8rpx;
}

.target-card__action {
  color: #83511b;
  font-weight: var(--font-weight-heavy);
}

.gap-section__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}

.gap-section__head-main {
  flex: 1;
  min-width: 0;
}

.gap-section__title {
  font-size: 34rpx;
  line-height: 1.28;
}

.gap-section__toggle {
  color: #83511b;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.gap-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 20rpx;
}

.gap-card {
  padding: 22rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.gap-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.gap-card__head-main {
  flex: 1;
  min-width: 0;
}

.gap-card__meta {
  margin-top: 8rpx;
}

.gap-card__hint {
  margin-top: 10rpx;
  font-size: var(--font-size-xs);
}

.gap-card__action {
  min-width: 156rpx;
  margin: 0;
  border-radius: var(--radius-pill);
  background: linear-gradient(135deg, #2f6f4e, #4d8f6d);
  color: #fffdf8;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
  line-height: 1;
}

.gap-card__action--disabled {
  opacity: 0.7;
}

.gap-card__events {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 18rpx;
}

.gap-event {
  padding: 16rpx 18rpx;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.74);
}

.gap-event__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.gap-event__title {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.gap-event__recipes {
  margin-top: 8rpx;
}

.sheet-meta {
  padding: 0 0 10rpx;
}

.sheet-meta__title {
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: var(--font-weight-heavy);
}

.sheet-meta__text {
  margin-top: 8rpx;
}

.sheet-section + .sheet-section {
  margin-top: 24rpx;
}

.sheet-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.sheet-section__title,
.sheet-option__title {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-heavy);
}

.sheet-section__action,
.sheet-create-button {
  color: #83511b;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.sheet-create-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 18rpx;
}

.sheet-input {
  width: 100%;
  min-height: 88rpx;
  box-sizing: border-box;
  padding: 0 24rpx;
  border-radius: var(--radius-lg);
  background: var(--color-surface-muted);
  color: var(--color-text);
  font-size: var(--font-size-md);
}

.sheet-input--grow {
  flex: 1;
}

.sheet-create-button {
  min-width: 112rpx;
  text-align: center;
}

.sheet-create-button--disabled {
  opacity: 0.45;
}

.sheet-option-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 18rpx;
}

.sheet-option {
  padding: 22rpx 24rpx;
  border-radius: var(--radius-lg);
  background: var(--color-surface-muted);
}

.sheet-option--active {
  background: rgba(234, 245, 237, 0.96);
  box-shadow: inset 0 0 0 2rpx rgba(47, 111, 78, 0.18);
}

.sheet-option__meta {
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.sheet-actions {
  display: flex;
  gap: 18rpx;
  padding: 8rpx 0 calc(8rpx + env(safe-area-inset-bottom));
}

.sheet-actions__button {
  flex: 1;
  margin: 0;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-heavy);
}

.sheet-actions__button--cancel {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.sheet-actions__button--confirm {
  background: linear-gradient(135deg, #2f6f4e, #4d8f6d);
  color: #fffdf8;
}

.shopping-fab {
  position: fixed;
  right: var(--space-page);
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  z-index: 810;
  min-width: 200rpx;
  margin: 0;
  border-radius: var(--radius-pill);
  background: linear-gradient(135deg, #2f6f4e, #4d8f6d);
  color: #fffdf8;
  box-shadow: 0 18rpx 36rpx rgba(47, 111, 78, 0.26);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}
</style>
