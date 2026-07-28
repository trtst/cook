<template>
  <Layout title="分享预览">
    <view v-if="loading" class="notice">加载中...</view>
    <view v-else-if="errorText" class="notice" @click="loadPreview">{{ errorText }}</view>
    <Empty v-else-if="!preview" title="分享已失效" description="请让发起人重新生成饭局分享。" />

    <template v-else>
      <view class="section">
        <text class="section__title">{{ preview.title }}</text>
        <text class="section__meta">发起人 UID {{ preview.organizerUid }}</text>
        <text class="section__meta">{{ preview.scheduledAt }}</text>
        <text class="section__meta">{{ preview.location || "未填写地点" }}</text>
      </view>

      <view class="section">
        <text class="section__title">菜单预览</text>
        <view v-for="item in preview.menu.ingredients" :key="`${item.ingredientId}-${item.amount.kind}`" class="line">
          <text>{{ item.ingredientName }}</text>
          <text>{{ formatAmount(item.amount) }}</text>
        </view>
      </view>

      <button class="primary" @click="goImport">我也参加这场饭局</button>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { ref } from "vue";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import { shareApi, type SharePreviewResponse } from "../apis/share";
import { uniPlatform } from "@/platform/uni";
import type { RecipeAmountSnapshot } from "@/apis/recipe";

const shareToken = ref("");
const preview = ref<SharePreviewResponse | null>(null);
const loading = ref(false);
const errorText = ref("");

onLoad((query) => {
  const raw = Array.isArray(query?.token) ? query.token[0] : query?.token;
  shareToken.value = typeof raw === "string" ? decodeURIComponent(raw) : "";
  if (shareToken.value) {
    void loadPreview();
  } else {
    errorText.value = "分享链接无效";
  }
});

async function loadPreview() {
  if (!shareToken.value || loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    preview.value = await shareApi.getPreview(shareToken.value);
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "分享加载失败";
  } finally {
    loading.value = false;
  }
}

function goImport() {
  if (!shareToken.value) return;
  void uniPlatform.navigation.navigateTo(`/pages_share/import/index?token=${encodeURIComponent(shareToken.value)}`);
}

function formatAmount(amount: RecipeAmountSnapshot) {
  if (amount.kind === "FUZZY") return amount.text;
  return `${amount.quantity}${amount.unitName}`;
}
</script>

<style scoped lang="scss">
.notice,
.section {
  padding: var(--space-md);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.section + .section {
  margin-top: var(--space-md);
}

.section__title,
.section__meta {
  display: block;
}

.section__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.section__meta {
  margin-top: 6rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.line {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
  border-bottom: 1rpx solid var(--color-border-light);
}

.primary {
  margin-top: var(--space-md);
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}
</style>
