<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="随机一下" full-screen :navbar-placeholder="false" navbar-transparent>
    <view class="random-nav-backdrop" :style="navBackdropStyle" />
    <scroll-view class="random-scroll" scroll-y :show-scrollbar="false" @scroll="handleRandomScroll">
      <view class="random-page">
        <view class="random-hero" :style="heroStyle">
          <text class="random-hero__eyebrow">帮我决定</text>
          <text class="random-hero__title">今晚吃什么，先帮你收一轮</text>
          <text class="random-hero__description">先定几个人、要不要买菜、想省事还是正式一点，再给你 3 套候选。</text>
        </view>

        <view class="random-content">
          <view class="filter-card">
            <view class="filter-group">
              <text class="filter-group__title">几个人吃</text>
              <view class="chip-row">
                <view
                  v-for="item in peopleOptions"
                  :key="item.value"
                  class="option-chip"
                  :class="{ 'option-chip--active': peopleCount === item.value }"
                  hover-class="option-chip--hover"
                  hover-stay-time="100"
                  @click="peopleCount = item.value"
                >
                  <text class="option-chip__text">{{ item.label }}</text>
                </view>
              </view>
            </view>

            <view class="filter-group">
              <text class="filter-group__title">今晚怎么做更合适</text>
              <view class="chip-row">
                <view
                  v-for="item in effortOptions"
                  :key="item.value"
                  class="option-chip"
                  :class="{ 'option-chip--active': effortMode === item.value }"
                  hover-class="option-chip--hover"
                  hover-stay-time="100"
                  @click="effortMode = item.value"
                >
                  <text class="option-chip__text">{{ item.label }}</text>
                </view>
              </view>
            </view>

            <view class="filter-group">
              <text class="filter-group__title">要不要出门补货</text>
              <view class="chip-row">
                <view
                  v-for="item in shopOptions"
                  :key="item.value"
                  class="option-chip"
                  :class="{ 'option-chip--active': shopMode === item.value }"
                  hover-class="option-chip--hover"
                  hover-stay-time="100"
                  @click="shopMode = item.value"
                >
                  <text class="option-chip__text">{{ item.label }}</text>
                </view>
              </view>
            </view>

            <view class="action-row">
              <button class="primary action-row__button" @click="recommendMeals">给我推荐</button>
              <button class="secondary action-row__button" @click="rerollMeals">换一批</button>
            </view>
          </view>

          <view class="result-card">
            <view class="result-card__header">
              <view>
                <text class="result-card__label">今晚建议</text>
                <text class="result-card__title">{{ resultTitle }}</text>
              </view>
              <text class="result-card__badge">{{ peopleLabel }}</text>
            </view>
            <text class="result-card__description">{{ resultDescription }}</text>

            <view class="result-list">
              <view
                v-for="item in resultItems"
                :key="item.id"
                class="meal-card"
                :class="{ 'meal-card--locked': lockedMealId === item.id }"
              >
                <view class="meal-card__main">
                  <view class="meal-card__title-row">
                    <text class="meal-card__title">{{ item.title }}</text>
                    <text class="meal-card__tag">{{ item.styleLabel }}</text>
                  </view>
                  <text class="meal-card__description">{{ item.description }}</text>
                  <text class="meal-card__meta">{{ item.duration }} · {{ item.note }}</text>
                </view>
                <button
                  class="ghost meal-card__button"
                  :class="{ 'meal-card__button--locked': lockedMealId === item.id }"
                  @click="toggleLock(item.id)"
                >
                  {{ lockedMealId === item.id ? "已锁定" : "锁定这道" }}
                </button>
              </view>
            </view>
          </view>

          <view class="footer-card">
            <text class="footer-card__title">下一步怎么走</text>
            <text class="footer-card__description">这轮先帮你把候选方案收出来；想继续安排，可以带去计划页或问大家。</text>
            <view class="action-row">
              <button class="secondary action-row__button" @click="openPlan">去计划页</button>
              <button class="secondary action-row__button" @click="openPoll">去问大家</button>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";

type EffortMode = "easy" | "home" | "formal";
type ShopMode = "stay" | "buy";
type MealIdea = {
  id: string;
  title: string;
  description: string;
  duration: string;
  note: string;
  styleLabel: string;
  people: number;
  effort: EffortMode;
  needsShop: boolean;
};

const pageStyle = usePageScrollStyle();
const { navBarTotalHeight } = useSystemInfo();

const RANDOM_NAV_GAP = 16;
const RANDOM_NAV_FADE_DISTANCE = 96;

const peopleOptions = [
  { value: 1, label: "1 人" },
  { value: 2, label: "2 人" },
  { value: 4, label: "3~4 人" }
] as const;
const effortOptions = [
  { value: "easy", label: "省事一点" },
  { value: "home", label: "家常稳一点" },
  { value: "formal", label: "正式一点" }
] as const;
const shopOptions = [
  { value: "stay", label: "不出门" },
  { value: "buy", label: "可顺手买" }
] as const;

const mealIdeas: MealIdea[] = [
  {
    id: "egg-noodle",
    title: "番茄鸡蛋面",
    description: "一锅热面，十几分钟就能端上桌。",
    duration: "20 分钟",
    note: "更适合不出门、快点开饭",
    styleLabel: "热乎的",
    people: 2,
    effort: "easy",
    needsShop: false
  },
  {
    id: "pepper-beef",
    title: "青椒牛肉 + 米饭",
    description: "一荤一主食，比较下饭，也容易被全家接受。",
    duration: "35 分钟",
    note: "适合想吃得踏实一点",
    styleLabel: "下饭的",
    people: 2,
    effort: "home",
    needsShop: true
  },
  {
    id: "steam-egg",
    title: "蒸蛋 + 凉拌黄瓜 + 米饭",
    description: "口味轻，步骤短，晚一点吃也不觉得负担重。",
    duration: "25 分钟",
    note: "适合清爽一点的晚餐",
    styleLabel: "清爽的",
    people: 2,
    effort: "easy",
    needsShop: false
  },
  {
    id: "curry",
    title: "咖喱鸡块饭",
    description: "一锅出菜，配饭稳定，适合家里人多一点的时候。",
    duration: "40 分钟",
    note: "适合多人一起吃",
    styleLabel: "家常的",
    people: 4,
    effort: "home",
    needsShop: true
  },
  {
    id: "fried-rice",
    title: "腊肠蛋炒饭",
    description: "优先清冰箱，省步骤，也不容易翻车。",
    duration: "18 分钟",
    note: "最适合想快一点开饭",
    styleLabel: "省事的",
    people: 2,
    effort: "easy",
    needsShop: false
  },
  {
    id: "fish-soup",
    title: "清蒸鱼 + 豆腐汤",
    description: "适合正式一点的家庭晚饭，清爽但不单薄。",
    duration: "45 分钟",
    note: "更适合可顺手补货",
    styleLabel: "正式一点",
    people: 4,
    effort: "formal",
    needsShop: true
  },
  {
    id: "mapo-tofu",
    title: "麻婆豆腐 + 青菜",
    description: "够下饭，也不需要太多准备，适合工作日晚餐。",
    duration: "25 分钟",
    note: "适合想吃点有味道的",
    styleLabel: "下饭的",
    people: 2,
    effort: "home",
    needsShop: false
  },
  {
    id: "shrimp-salad",
    title: "虾仁滑蛋 + 生菜",
    description: "整体更轻，口感也更柔和，适合夏天或晚吃。",
    duration: "28 分钟",
    note: "适合清爽路线",
    styleLabel: "清爽的",
    people: 2,
    effort: "formal",
    needsShop: true
  }
];

const peopleCount = ref<(typeof peopleOptions)[number]["value"]>(2);
const effortMode = ref<(typeof effortOptions)[number]["value"]>("home");
const shopMode = ref<(typeof shopOptions)[number]["value"]>("stay");
const lockedMealId = ref<string>("");
const rerollSeed = ref(0);
const randomScrollTop = ref(0);
const resultItems = ref<MealIdea[]>(buildResult());

const peopleLabel = computed(() => peopleOptions.find(item => item.value === peopleCount.value)?.label ?? "2 人");
const resultTitle = computed(() => {
  if (lockedMealId.value) {
    const lockedMeal = resultItems.value.find(item => item.id === lockedMealId.value);
    return lockedMeal ? `先围着“${lockedMeal.title}”来定` : "先锁一套最顺手的方案";
  }
  if (effortMode.value === "easy") return "先从最省事的 3 套开始";
  if (effortMode.value === "formal") return "先看更正式一点的 3 套";
  return "先给你 3 套更稳的家常方案";
});
const resultDescription = computed(() => {
  if (shopMode.value === "stay") {
    return "这轮优先保留“不出门也能做”的方向；真要补货，也只给顺手可补的方案。";
  }
  return "这轮允许顺手补一点菜，候选会更完整，但还是优先保留今晚能落地的做法。";
});
const navProgress = computed(() => Math.min(1, Math.max(0, randomScrollTop.value / RANDOM_NAV_FADE_DISTANCE)));
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: `${navProgress.value}`
}));
const heroStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + RANDOM_NAV_GAP}px`
}));

function buildResult() {
  const filtered = mealIdeas
    .filter(item => (shopMode.value === "stay" ? !item.needsShop : true))
    .map(item => ({
      item,
      score:
        Math.abs(item.people - peopleCount.value) * 2 +
        (item.effort === effortMode.value ? 0 : 3) +
        (item.needsShop && shopMode.value === "stay" ? 99 : 0)
    }))
    .sort((left, right) => left.score - right.score || left.item.title.localeCompare(right.item.title));

  const rotated = filtered.length
    ? filtered.map((_, index) => filtered[(index + rerollSeed.value) % filtered.length].item)
    : mealIdeas;

  if (lockedMealId.value) {
    const locked = rotated.find(item => item.id === lockedMealId.value) ?? mealIdeas.find(item => item.id === lockedMealId.value) ?? null;
    const rest = rotated.filter(item => item.id !== lockedMealId.value).slice(0, 2);
    return locked ? [locked, ...rest] : rotated.slice(0, 3);
  }

  return rotated.slice(0, 3);
}

function recommendMeals() {
  rerollSeed.value = 0;
  resultItems.value = buildResult();
}

function rerollMeals() {
  rerollSeed.value += 1;
  resultItems.value = buildResult();
}

function toggleLock(mealId: string) {
  lockedMealId.value = lockedMealId.value === mealId ? "" : mealId;
  resultItems.value = buildResult();
}

function handleRandomScroll(event: { detail?: { scrollTop?: number } }) {
  randomScrollTop.value = event.detail?.scrollTop ?? 0;
}

function openPlan() {
  void uniPlatform.navigation.navigateTo("/pages_meal/plan/index");
}

function openPoll() {
  void uniPlatform.navigation.navigateTo("/pages_meal/poll/index");
}
</script>

<style scoped lang="scss">
.random-nav-backdrop {
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

.random-scroll {
  height: 100%;
  background: var(--color-page);
}

.random-page {
  min-height: 100%;
  padding-bottom: calc(var(--space-xl) + env(safe-area-inset-bottom));
}

.random-hero {
  padding: 64rpx var(--space-page) 164rpx;
  background:
    linear-gradient(180deg, var(--color-surface-mask-weak), var(--color-surface-mask-medium)),
    radial-gradient(circle at 18% 26%, rgba(168, 224, 255, 0.42), transparent 30%),
    radial-gradient(circle at 84% 18%, rgba(206, 230, 255, 0.38), transparent 28%),
    linear-gradient(145deg, rgba(234, 247, 255, 0.96), rgba(250, 252, 255, 0.98));
}

.random-content {
  position: relative;
  z-index: 1;
  margin-top: -96rpx;
  padding: 0 var(--space-page);
}

.random-hero__eyebrow,
.random-hero__title,
.random-hero__description,
.filter-group__title,
.result-card__label,
.result-card__title,
.result-card__description,
.footer-card__title,
.footer-card__description {
  display: block;
}

.random-hero__eyebrow,
.result-card__label {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.random-hero__title,
.result-card__title,
.footer-card__title,
.filter-group__title,
.meal-card__title {
  color: var(--color-text);
  font-weight: var(--font-weight-heavy);
}

.random-hero__title {
  margin-top: 10rpx;
  font-size: 42rpx;
  line-height: 1.2;
}

.random-hero__description,
.result-card__description,
.footer-card__description {
  margin-top: 12rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.filter-card,
.result-card,
.footer-card {
  margin-top: var(--space-md);
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.filter-group + .filter-group {
  margin-top: 24rpx;
}

.chip-row,
.action-row,
.result-card__header,
.meal-card__title-row {
  display: flex;
}

.chip-row {
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 16rpx;
}

.option-chip {
  padding: 14rpx 22rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  transition: transform 0.18s ease, background-color 0.18s ease;
}

.option-chip--hover {
  transform: translateY(-4rpx);
}

.option-chip--active {
  background: rgba(213, 236, 255, 0.9);
}

.option-chip__text {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.action-row {
  gap: 16rpx;
  margin-top: 24rpx;
}

.action-row__button {
  flex: 1;
  margin: 0;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.primary {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.secondary,
.ghost {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.result-card__header {
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.result-card__badge {
  flex: 0 0 auto;
  padding: 10rpx 18rpx;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary-active);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 24rpx;
}

.meal-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 22rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.meal-card--locked {
  background: rgba(255, 235, 202, 0.76);
}

.meal-card__main {
  min-width: 0;
}

.meal-card__title-row {
  align-items: center;
  gap: 12rpx;
}

.meal-card__tag {
  padding: 6rpx 12rpx;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.8);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.meal-card__description,
.meal-card__meta {
  display: block;
}

.meal-card__description {
  margin-top: 10rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.meal-card__meta {
  margin-top: 8rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.meal-card__button {
  flex: 0 0 auto;
  margin: 0;
  padding: 0 24rpx;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
}

.meal-card__button--locked {
  background: var(--color-primary-soft);
  color: var(--color-primary-active);
}
</style>
