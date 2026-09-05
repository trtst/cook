<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="兑换" full-screen>
    <template #navbar-center>
      <text class="redeem-nav-title">兑换</text>
    </template>

    <view class="redeem-page">
      <view class="redeem-card">
        <text class="redeem-card__title">输入兑换码</text>
        <text class="redeem-card__description">兑换成功后，会员时长会自动到账当前账号。</text>

        <LoginEmptyState
          v-if="!sessionStore.isLoggedIn"
          title="登录后兑换"
          description="下方兑换说明会继续保留；登录后再把会员时长兑换到当前账号。"
        />

        <template v-else>
          <input
            v-model="redeemCode"
            class="redeem-input"
            maxlength="40"
            placeholder="请输入 6 ~ 40 位兑换码"
            placeholder-class="redeem-input__placeholder"
            :disabled="submitting"
          />

          <text class="redeem-card__hint">兑换码由字母或数字组成，不区分大小写。</text>
          <button
            class="redeem-button"
            :class="{ 'redeem-button--disabled': !canSubmit || submitting }"
            :disabled="!canSubmit || submitting"
            :loading="submitting"
            @click="submitRedeem"
          >
            确认兑换
          </button>
        </template>

        <view class="rule-block">
          <view class="rule-block__head">
            <text class="cookfont rule-block__icon icon-notice" />
            <text class="rule-block__title">兑换说明</text>
          </view>

          <view class="rule-block__list">
            <text class="rule-block__item">支持当前已上架的会员兑换码，是否可兑换以系统校验结果为准。</text>
            <text class="rule-block__item">同档会员会顺延有效期，不同档位按实际到账结果处理。</text>
            <text class="rule-block__item">每个兑换码只能成功使用一次，失效或未开放批次无法到账。</text>
          </view>
        </view>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ApiClientError } from "@/apis/http";
import { userApi } from "@/apis/user";
import LoginEmptyState from "@/components/Login/LoginEmptyState.vue";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { membershipApi } from "@/pages_me/apis/membership";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { createOperationId } from "@/utils/operation-id";

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const sessionStore = useSessionStore();
const userStore = useUserStore();
const redeemCode = ref("");
const submitting = ref(false);
const normalizedRedeemCode = computed(() => redeemCode.value.replace(/[\s-]/g, "").toUpperCase());
const canSubmit = computed(() => normalizedRedeemCode.value.length > 0);

async function submitRedeem() {
  if (submitting.value) return;

  const normalized = normalizedRedeemCode.value;
  if (!/^[A-Z0-9]{6,40}$/.test(normalized)) {
    await uniPlatform.feedback.toast({
      title: "请输入 6 到 40 位的会员兑换码",
      icon: "none"
    }).catch(() => undefined);
    return;
  }

  submitting.value = true;
  try {
    await membershipApi.redeemCode(normalized, createOperationId());
    redeemCode.value = "";
    await uniPlatform.feedback.toast({
      title: "兑换成功，会员已到账",
      icon: "none"
    }).catch(() => undefined);
    try {
      const profile = await userApi.getCurrent();
      userStore.setProfile(profile, sessionStore.uid);
    } catch {
      // 兑换已经成功，资料刷新失败只影响本地展示，不回滚成功提示。
    }
  } catch (error) {
    const message = error instanceof ApiClientError ? error.message : "兑换失败，请稍后重试";
    await uniPlatform.feedback.toast({
      title: message,
      icon: "none"
    }).catch(() => undefined);
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.redeem-page {
  position: relative;
  height: 100%;
  padding: var(--space-lg) var(--space-page) calc(var(--space-xl) + env(safe-area-inset-bottom));
  background: var(--page-ambient-duo-bg);
  box-sizing: border-box;
  overflow: hidden;
}

.redeem-page::after {
  position: absolute;
  right: -72rpx;
  bottom: -112rpx;
  width: 460rpx;
  height: 320rpx;
  border-radius: 50%;
  background: var(--color-cover-empty-warm-bg);
  opacity: 0.98;
  content: "";
  pointer-events: none;
  transform: rotate(-10deg);
}

.redeem-nav-title {
  overflow: hidden;
  max-width: 420rpx;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: 700;
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.redeem-card {
  position: relative;
  z-index: 1;
  padding: 30rpx 30rpx 32rpx;
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.redeem-card__description,
.redeem-card__hint,
.rule-block__item {
  color: var(--color-text-secondary);
}

.redeem-card__title,
.rule-block__title {
  color: var(--color-text);
}

.redeem-card__title {
  display: block;
  font-size: var(--font-size-hero);
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
}

.redeem-card__description,
.redeem-card__hint,
.rule-block__item {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-loose);
}

.redeem-card__description {
  display: block;
  margin-top: 14rpx;
}

.redeem-input {
  margin-top: 26rpx;
  min-height: 96rpx;
  padding: 0 28rpx;
  border: 1rpx solid var(--material-input-border);
  border-radius: var(--radius-xs);
  background: var(--material-input-bg);
  color: var(--color-text);
  font-size: var(--font-size-lg);
  box-shadow: var(--material-input-shadow);
  -webkit-backdrop-filter: var(--material-input-filter);
  backdrop-filter: var(--material-input-filter);
}

.redeem-input__placeholder {
  color: var(--color-text-tertiary);
  font-weight: 500;
}

.redeem-card__hint {
  display: block;
  margin-top: 18rpx;
}

.redeem-button {
  margin-top: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  height: 88rpx;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  font-size: 30rpx;
  font-weight: var(--font-weight-bold);
  line-height: 1;
  box-shadow: var(--button-primary-shadow);
}

.redeem-button::after {
  border: 0;
}

.redeem-button--disabled {
  opacity: 0.5;
  box-shadow: none;
}

.rule-block {
  margin-top: 32rpx;
  padding-top: 28rpx;
  border-top: 1rpx solid var(--color-divider);
}

.rule-block__head {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.rule-block__icon {
  color: var(--color-support-action);
  font-size: 30rpx;
  font-weight: 700;
  line-height: 1;
}

.rule-block__title {
  font-size: var(--font-size-xl);
  font-weight: 700;
  line-height: var(--line-height-tight);
}

.rule-block__list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 24rpx;
}

.rule-block__item {
  position: relative;
  display: block;
  padding-left: 32rpx;
}

.rule-block__item::before {
  position: absolute;
  top: 14rpx;
  left: 0;
  width: 12rpx;
  height: 12rpx;
  border-radius: 999rpx;
  background: var(--button-primary-bg);
  content: "";
}
</style>
