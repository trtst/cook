<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="饭局邀请">
    <view v-if="loading && !preview" class="notice">加载中...</view>
    <view v-else-if="errorText && !preview" class="notice" @click="loadPreview">{{ errorText }}</view>
    <Empty v-else-if="!preview" title="分享已失效" description="请让发起人重新生成一条新的饭局邀请。" />

    <template v-else>
      <view class="invite-card">
        <view v-if="preview.coverImageUrl" class="invite-card__hero">
          <image class="invite-card__hero-image" :src="preview.coverImageUrl" mode="aspectFill" />
          <view class="invite-card__hero-mask" />
        </view>
        <view v-else class="invite-card__hero invite-card__hero--empty">
          <text class="invite-card__hero-empty">这顿饭等你来</text>
        </view>

        <view class="invite-card__body">
          <text class="invite-card__eyebrow">{{ eyebrowText }}</text>
          <text class="invite-card__title">{{ preview.title }}</text>
          <text class="invite-card__meta">{{ scheduleText }}</text>
          <text v-if="countdownLabel" class="invite-card__countdown">{{ countdownLabel }}</text>
          <text v-if="preview.locationHint" class="invite-card__hint">{{ preview.locationHint }}</text>

          <view v-if="preview.menuPreview.length" class="invite-card__chips">
            <text v-for="item in preview.menuPreview" :key="item" class="invite-card__chip">{{ item }}</text>
          </view>
        </view>
      </view>

      <Login
        v-if="!sessionStore.isLoggedIn"
        title="登录后查看并加入饭局"
        description="当前只展示轻信息；地点和加入动作会在登录后校验。"
      />

      <view v-else class="join-card">
        <text class="join-card__title">确认加入</text>
        <text class="join-card__desc">展示名称只用于这场饭局里显示你是谁，后面还可以再改。</text>
        <input v-model="guestName" class="join-card__input" maxlength="40" placeholder="例如：周末来蹭饭的我" />
        <button class="join-card__button" :disabled="submitting || !guestName.trim()" @click="acceptInvite">
          {{ submitting ? "加入中..." : "查看并加入饭局" }}
        </button>
        <text v-if="errorText" class="join-card__error">{{ errorText }}</text>
      </view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { computed, ref, watch } from "vue";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { shareApi, type SharePreviewResponse } from "../apis/share";
import { uniPlatform } from "@/platform/uni";
import { createOperationId } from "@/utils/operation-id";
import { formatMealSlot } from "@/utils/meal-slot";
import { useSessionStore } from "@/stores/session";
import { formatDateTimeMinute } from "../utils/date";

const pageStyle = usePageScrollStyle();
const sessionStore = useSessionStore();

const shareToken = ref("");
const preview = ref<SharePreviewResponse | null>(null);
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const guestName = ref("");

const eyebrowText = computed(() => {
  const parts = [preview.value?.organizerName?.trim() || "你的朋友", preview.value?.mealSlot ? formatMealSlot(preview.value.mealSlot) : ""].filter(Boolean);
  return parts.join(" · ") || "饭局邀请";
});

const scheduleText = computed(() => {
  if (!preview.value) return "";
  const schedule = formatDateTimeMinute(preview.value.scheduledAt) || preview.value.scheduledAt;
  return preview.value.planDate ? `${preview.value.planDate} · ${schedule}` : schedule;
});

const countdownLabel = computed(() => {
  if (!preview.value) return "";
  const scheduledAt = new Date(preview.value.scheduledAt).getTime();
  if (Number.isFinite(scheduledAt) && scheduledAt <= Date.now()) {
    return "已开始";
  }
  return preview.value.countdownText ? `距开饭还有 ${preview.value.countdownText}` : "";
});

onLoad(query => {
  const raw = Array.isArray(query?.token) ? query.token[0] : query?.token;
  shareToken.value = typeof raw === "string" ? decodeURIComponent(raw) : "";
  if (shareToken.value) {
    void loadPreview();
  } else {
    errorText.value = "分享链接无效";
  }
});

watch(
  () => sessionStore.isLoggedIn,
  isLoggedIn => {
    if (!isLoggedIn || guestName.value.trim()) return;
    guestName.value = `用户 ${sessionStore.uid || ""}`.trim();
  },
  { immediate: true }
);

async function loadPreview() {
  if (!shareToken.value || loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    preview.value = await shareApi.getPreview(shareToken.value);
  } catch (error) {
    preview.value = null;
    errorText.value = error instanceof Error ? error.message : "分享加载失败";
  } finally {
    loading.value = false;
  }
}

async function acceptInvite() {
  if (!shareToken.value || !guestName.value.trim() || submitting.value || !preview.value) return;
  submitting.value = true;
  errorText.value = "";
  try {
    const result = await shareApi.acceptInvite(shareToken.value, createOperationId(), guestName.value.trim());
    await uniPlatform.feedback.toast({ title: "已加入饭局", icon: "success" });
    const redirectPath =
      result.planItemId && preview.value.planDate
        ? `/pages_meal/detail/index?planItemId=${encodeURIComponent(String(result.planItemId))}&planDate=${encodeURIComponent(preview.value.planDate)}&eventId=${encodeURIComponent(String(result.id))}`
        : "/pages_meal/event/index";
    void uniPlatform.navigation.redirectTo(redirectPath);
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "加入失败";
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.notice,
.invite-card,
.join-card {
  margin: var(--space-md) var(--space-page) 0;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.notice,
.join-card {
  padding: var(--space-md);
}

.invite-card {
  overflow: hidden;
}

.invite-card__hero {
  position: relative;
  height: 320rpx;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--entry-photo-bg) 86%, white 14%) 0%, color-mix(in srgb, var(--entry-board-bg) 88%, var(--entry-side-mint-bg) 12%) 100%);
}

.invite-card__hero-image,
.invite-card__hero-mask {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.invite-card__hero-mask {
  background: linear-gradient(180deg, rgba(16, 16, 16, 0.08), rgba(16, 16, 16, 0.42));
}

.invite-card__hero--empty {
  display: flex;
  align-items: flex-end;
  padding: 28rpx;
  box-sizing: border-box;
}

.invite-card__hero-empty {
  color: color-mix(in srgb, var(--entry-ink) 72%, white 28%);
  font-size: 28rpx;
  font-weight: 700;
}

.invite-card__body {
  padding: 28rpx;
}

.invite-card__eyebrow,
.invite-card__title,
.invite-card__meta,
.invite-card__countdown,
.invite-card__hint,
.join-card__title,
.join-card__desc,
.join-card__error {
  display: block;
}

.invite-card__eyebrow {
  color: var(--color-primary);
  font-size: 22rpx;
  font-weight: 700;
}

.invite-card__title {
  margin-top: 12rpx;
  color: var(--color-text);
  font-size: 42rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.24;
}

.invite-card__meta,
.invite-card__hint,
.join-card__desc {
  margin-top: 12rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.invite-card__countdown {
  margin-top: 14rpx;
  color: var(--color-warning-text);
  font-size: 24rpx;
  font-weight: 700;
}

.invite-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 22rpx;
}

.invite-card__chip {
  display: inline-flex;
  align-items: center;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--color-primary-soft) 68%, var(--color-surface) 32%);
  color: var(--color-primary);
  font-size: 22rpx;
  font-weight: 600;
}

.join-card__title {
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: 700;
}

.join-card__input {
  width: 100%;
  margin-top: 18rpx;
  padding: 22rpx 24rpx;
  border: 1rpx solid var(--color-border);
  border-radius: 24rpx;
  background: var(--color-surface-muted);
  box-sizing: border-box;
}

.join-card__button {
  margin-top: 20rpx;
  border-radius: 999rpx;
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow);
}

.join-card__error {
  margin-top: 14rpx;
  color: var(--color-danger-text);
  font-size: 22rpx;
  line-height: 1.5;
}
</style>
