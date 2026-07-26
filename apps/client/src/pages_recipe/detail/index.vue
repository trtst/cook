<template>
  <Layout :title="kind === 'inspiration' ? '灵感详情' : '菜谱详情'">
    <view v-if="loading" class="notice">加载中...</view>
    <view v-else-if="errorText" class="notice" @click="loadDetail">{{ errorText }}</view>
    <Empty v-else-if="!detail" title="未找到菜谱" description="可能已被删除、下架，或当前访问路径不正确。" />

    <template v-else>
      <view class="hero">
        <text class="hero__title">{{ detail.title }}</text>
        <text class="hero__meta">{{ metaLine }}</text>
        <text v-if="detail.content.story" class="hero__story">{{ detail.content.story }}</text>
      </view>

      <view class="section">
        <text class="section__label">基础信息</text>
        <text class="subline">分类：{{ detail.category.name }}</text>
        <text class="subline">人数：{{ detail.content.baseServings }} 人份</text>
        <text class="subline">难度：{{ detail.content.difficulty || "未设置" }}</text>
        <text class="subline">时长：{{ detail.content.durationMinutes ? `${detail.content.durationMinutes} 分钟` : "未设置" }}</text>
        <text v-if="sceneText" class="subline">场景：{{ sceneText }}</text>
      </view>

      <view class="section">
        <text class="section__label">食材与用量</text>
        <view v-for="item in detail.content.ingredients" :key="`${item.ingredientId}-${item.ingredientName}`" class="line">
          <text>{{ item.ingredientName }}</text>
          <text>{{ formatAmount(item.amount) }}</text>
        </view>
      </view>

      <view class="section">
        <text class="section__label">制作步骤</text>
        <view v-for="(item, index) in detail.content.steps" :key="index" class="step">
          <text class="step__index">{{ index + 1 }}</text>
          <text class="step__text">{{ item.text }}</text>
        </view>
      </view>

      <view v-if="detail.content.tips" class="section">
        <text class="section__label">小贴士</text>
        <text class="subline">{{ detail.content.tips }}</text>
      </view>

      <view class="action-row">
        <button v-if="kind === 'my'" class="primary" @click="editRecipe">编辑</button>
        <button v-else class="secondary" @click="copyRecipeName">复制菜名</button>
      </view>

      <view v-if="kind === 'inspiration' && sessionStore.isLoggedIn" class="section">
        <text class="section__label">举报说明</text>
        <textarea
          v-model="reportReason"
          class="report-box"
          maxlength="255"
          placeholder="仅在违规、侵权或明显不当时提交举报"
        />
        <button class="danger" :disabled="submitting || !reportReason.trim()" @click="handleReport">提交举报</button>
      </view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import {
	recipeApi,
	type InspirationRecipeDetail,
	type MyRecipeDetail,
	type RecipeAmountSnapshot
} from "@/apis/recipe";
import Empty from "@/components/Empty/Empty.vue";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";

type DetailKind = "my" | "inspiration";
type PageDetail = MyRecipeDetail | InspirationRecipeDetail;

const sessionStore = useSessionStore();
const recipeId = ref("");
const kind = ref<DetailKind>("my");
const detail = ref<PageDetail | null>(null);
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const reportReason = ref("");

const metaLine = computed(() => {
	if (!detail.value) return "";
	if (kind.value === "my") {
		return `我的菜谱 · 更新于 ${detail.value.updatedAt.slice(0, 10)}`;
	}
	const inspirationDetail = detail.value as InspirationRecipeDetail;
	const sourceText = inspirationDetail.curatedByName ? ` · ${inspirationDetail.curatedByName}` : "";
	return `灵感菜谱${sourceText} · 更新于 ${inspirationDetail.updatedAt.slice(0, 10)}`;
});

const sceneText = computed(() => {
	if (!detail.value || kind.value !== "my") return "";
	return (detail.value as MyRecipeDetail).scenes.map((item) => item.name).join("、");
});

onLoad((query) => {
	const rawId = Array.isArray(query?.recipeId) ? query.recipeId[0] : query?.recipeId;
	const rawKind = Array.isArray(query?.kind) ? query.kind[0] : query?.kind;
	recipeId.value = typeof rawId === "string" ? decodeURIComponent(rawId) : "";
	kind.value = rawKind === "inspiration" ? "inspiration" : "my";
	if (recipeId.value) {
		void loadDetail();
	}
});

async function loadDetail() {
	if (!recipeId.value || loading.value) return;
	loading.value = true;
	errorText.value = "";
	try {
		detail.value =
			kind.value === "inspiration"
				? await recipeApi.getInspirationRecipe(recipeId.value)
				: await recipeApi.getMyRecipe(recipeId.value);
	} catch (error) {
		errorText.value = error instanceof Error ? error.message : "菜谱加载失败";
	} finally {
		loading.value = false;
	}
}

function editRecipe() {
	if (!recipeId.value) return;
	void uniPlatform.navigation.navigateTo(`/pages_recipe/edit/index?recipeId=${encodeURIComponent(recipeId.value)}`);
}

async function copyRecipeName() {
	if (!detail.value) return;
	await uniPlatform.clipboard.set(detail.value.title);
	await uniPlatform.feedback.toast({ title: "已复制", icon: "success" });
}

async function handleReport() {
	if (!recipeId.value || submitting.value || !reportReason.value.trim()) return;
	submitting.value = true;
	try {
		await recipeApi.reportRecipe(recipeId.value, createOperationId(), reportReason.value.trim());
		reportReason.value = "";
		await uniPlatform.feedback.toast({ title: "举报已提交", icon: "success" });
	} catch (error) {
		await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "举报失败", icon: "none" });
	} finally {
		submitting.value = false;
	}
}

function formatAmount(amount: RecipeAmountSnapshot) {
	if (amount.kind === "FUZZY") return amount.text;
	return `${amount.quantity}${amount.unitName}`;
}
</script>

<style scoped lang="scss">
.notice,
.hero,
.section {
	padding: var(--space-md);
	border-radius: var(--radius-md);
	background: var(--color-surface);
}

.hero__title,
.hero__meta,
.hero__story,
.section__label,
.subline {
	display: block;
}

.hero__title {
	color: var(--color-text);
	font-size: var(--font-size-xl);
	font-weight: var(--font-weight-bold);
}

.hero__meta,
.subline {
	margin-top: 8rpx;
	color: var(--color-text-secondary);
	font-size: var(--font-size-sm);
}

.hero__story {
	margin-top: var(--space-sm);
	color: var(--color-text);
	font-size: var(--font-size-md);
	line-height: 1.7;
}

.section {
	margin-top: var(--space-md);
}

.section__label {
	margin-bottom: var(--space-sm);
	color: var(--color-text);
	font-size: var(--font-size-md);
	font-weight: var(--font-weight-semibold);
}

.line,
.step,
.action-row {
	display: flex;
	gap: var(--space-sm);
}

.line {
	justify-content: space-between;
	padding: 12rpx 0;
	border-bottom: 1rpx solid var(--color-border-light);
}

.step + .step,
.line + .line {
	margin-top: 8rpx;
}

.step__index {
	width: 40rpx;
	color: var(--color-primary);
}

.step__text {
	flex: 1;
	color: var(--color-text);
	line-height: 1.7;
}

.action-row {
	margin-top: var(--space-md);
}

.action-row button {
	flex: 1;
}

.primary,
.secondary,
.danger {
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

.danger {
	margin-top: var(--space-sm);
	background: var(--color-danger-button-bg);
	color: var(--color-danger-button-text);
}

.report-box {
	width: 100%;
	min-height: 180rpx;
	padding: 20rpx;
	border: 1rpx solid var(--color-border);
	border-radius: var(--radius-md);
	background: var(--color-surface-muted);
	box-sizing: border-box;
}
</style>
