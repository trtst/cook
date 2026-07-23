<template>
  <Layout title="菜谱详情">
    <Login v-if="!sessionStore.isLoggedIn" title="登录后查看菜谱详情" description="支持查看、导入、举报和编辑。" />

    <template v-else>
      <view v-if="loading" class="notice">加载中...</view>
      <view v-else-if="errorText" class="notice" @click="loadDetail">{{ errorText }}</view>
      <Empty v-else-if="!detail" title="未找到菜谱" description="可能已被删除或下架。" />

      <template v-else>
        <view class="hero">
          <text class="hero__title">{{ detail.content.name }}</text>
          <text class="hero__meta">
            {{ detail.ownerType === "SYSTEM" ? "系统菜谱" : detail.canEdit ? "我的菜谱" : `用户 ${detail.ownerUid ?? "--"} 的菜谱` }}
          </text>
        </view>

        <view class="section">
          <text class="section__label">食材</text>
          <view v-for="item in detail.content.ingredients" :key="`${item.name}-${item.amount}`" class="line">
            <text>{{ item.name }}</text>
            <text>{{ item.amount }}</text>
          </view>
        </view>

        <view class="section">
          <text class="section__label">步骤</text>
          <view v-for="(item, index) in detail.content.steps" :key="index" class="step">
            <text class="step__index">{{ index + 1 }}</text>
            <text class="step__text">{{ item.content }}</text>
          </view>
        </view>

        <view class="section">
          <text class="section__label">补充信息</text>
          <text class="subline">份量：{{ detail.content.servings || "未填写" }}</text>
          <text class="subline">用时：{{ detail.content.durationMinutes ? `${detail.content.durationMinutes} 分钟` : "未填写" }}</text>
          <text class="subline">图片：{{ detail.content.images.length }} 张</text>
        </view>

        <view class="action-row">
          <button v-if="detail.canEdit" class="primary" @click="editRecipe">编辑</button>
          <button v-else-if="detail.canImport" class="primary" :disabled="submitting" @click="handleImport">导入到我的菜谱</button>
          <button class="secondary" :disabled="submitting" @click="copyRecipeName">复制菜名</button>
        </view>

        <view v-if="!detail.canEdit" class="section">
          <text class="section__label">举报说明</text>
          <textarea v-model="reportReason" class="report-box" maxlength="255" placeholder="仅在违规、侵权或明显不当时提交举报" />
          <button class="danger" :disabled="submitting || !reportReason.trim()" @click="handleReport">提交举报</button>
        </view>
      </template>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { ref } from "vue";
import { recipeApi, type RecipeDetail } from "@/apis/recipe";
import Empty from "@/components/Empty/Empty.vue";
import Login from "@/components/Login/Login.vue";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";

const sessionStore = useSessionStore();
const recipeId = ref("");
const detail = ref<RecipeDetail | null>(null);
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const reportReason = ref("");

onLoad((query) => {
  const raw = Array.isArray(query?.recipeId) ? query.recipeId[0] : query?.recipeId;
  recipeId.value = typeof raw === "string" ? decodeURIComponent(raw) : "";
  if (sessionStore.isLoggedIn && recipeId.value) {
    void loadDetail();
  }
});

async function loadDetail() {
  if (!recipeId.value || loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    detail.value = await recipeApi.getDetail(recipeId.value);
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

async function handleImport() {
  if (!recipeId.value || submitting.value) return;
  submitting.value = true;
  try {
    const result = await recipeApi.importRecipe(recipeId.value, createOperationId());
    await uniPlatform.feedback.toast({
      title: result.reusedExisting ? "已打开已有入口" : "导入成功",
      icon: "success"
    });
    void uniPlatform.navigation.redirectTo(`/pages_recipe/detail/index?recipeId=${encodeURIComponent(result.recipe.id)}`);
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "导入失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
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

async function copyRecipeName() {
  if (!detail.value) return;
  await uniPlatform.clipboard.set(detail.value.content.name);
  await uniPlatform.feedback.toast({ title: "已复制", icon: "success" });
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
  background: var(--color-danger);
  color: #fff;
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
