<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="兑换" full-screen>
    <template #navbar-center>
      <text class="redeem-nav-title">兑换</text>
    </template>

    <Login
      v-if="!sessionStore.isLoggedIn"
      title="登录后兑换"
      description="兑换成功后，会员时长会自动到账当前账号。"
    />

    <template v-else>
      <view class="redeem-page">
        <view class="redeem-card">
          <text class="redeem-card__title">输入兑换码</text>
          <text class="redeem-card__description">兑换成功后，会员时长会自动到账当前账号。</text>

          <input
            v-model="redeemCode"
            class="redeem-input"
            maxlength="40"
            placeholder="请输入 6 ~ 40 位兑换码"
            placeholder-class="redeem-input__placeholder"
            :disabled="submitting"
          />

          <text class="redeem-card__hint">兑换码由字母或数字组成，不区分大小写。</text>
          <button class="redeem-button" :disabled="!canSubmit || submitting" :loading="submitting" @click="submitRedeem">
            确认兑换
          </button>
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
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ApiClientError } from "@/apis/http";
import { userApi } from "@/apis/user";
import Login from "@/components/Login/Login.vue";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { membershipApi } from "@/pages_me/apis/membership";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { createOperationId } from "@/utils/operation-id";

const pageStyle = usePageScrollStyle();
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
      userStore.setProfile(profile);
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
  background:
    radial-gradient(circle at 14% 10%, color-mix(in srgb, var(--theme-primary) 7%, transparent), transparent 28%),
    radial-gradient(circle at 88% 8%, color-mix(in srgb, var(--theme-accent) 6%, transparent), transparent 24%),
    linear-gradient(180deg, color-mix(in srgb, var(--color-page) 92%, white 8%), var(--color-page));
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
  background:
    radial-gradient(circle at 24% 38%, var(--entry-side-aqua-bg) 0, transparent 46%),
    radial-gradient(circle at 74% 42%, var(--entry-primary-bg) 0, transparent 52%),
    linear-gradient(156deg, color-mix(in srgb, var(--entry-side-mint-bg) 84%, var(--color-page) 16%), color-mix(in srgb, var(--entry-board-bg) 80%, var(--color-page) 20%));
  opacity: 0.98;
  content: "";
  filter: blur(8rpx);
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
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.redeem-card {
  padding: 30rpx 30rpx 32rpx;
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
  border: 1rpx solid color-mix(in srgb, var(--color-border) 84%, transparent);
  border-radius: var(--radius-xs);
  background: color-mix(in srgb, var(--color-page) 30%, var(--color-surface));
  color: var(--color-text);
  font-size: var(--font-size-lg);
  box-shadow: inset 0 0 0 1rpx color-mix(in srgb, var(--color-surface) 82%, transparent);
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
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  color: var(--button-primary-text);
  font-size: 30rpx;
  font-weight: var(--font-weight-bold);
  line-height: 1;
  box-shadow: var(--button-primary-shadow);
}

.redeem-button::after {
  border: 0;
}

.redeem-button[disabled] {
  opacity: 0.5;
  box-shadow: none;
}

.rule-block {
  margin-top: 32rpx;
  padding-top: 28rpx;
  border-top: 1rpx solid color-mix(in srgb, var(--color-border) 74%, transparent);
}

.rule-block__head {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.rule-block__icon {
  color: var(--theme-primary);
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
  background: linear-gradient(180deg, var(--color-primary), var(--theme-accent));
  content: "";
}
</style>
