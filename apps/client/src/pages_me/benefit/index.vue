<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="权益中心" full-screen>
    <Login
      v-if="!sessionStore.isLoggedIn"
      title="登录后查看权益中心"
      description="会员、体验码和广告减免只对当前登录用户到账。"
    />

    <template v-else>
      <scroll-view scroll-y class="benefit-page" show-scrollbar="false">
        <view class="hero-card">
          <text class="hero-card__eyebrow">当前会员</text>
          <view class="hero-card__headline">
            <text class="hero-card__tier">{{ currentTierLabel }}</text>
            <text class="hero-card__summary">{{ currentTierSummary }}</text>
          </view>
          <text class="hero-card__meta">{{ validUntilText }}</text>
          <text class="hero-card__description">会员只影响当前登录用户自己的菜谱、空间、展示和广告权益。</text>
          <view class="hero-card__footer">
            <text class="hero-card__hint">正式会员当前先开放 Plus 月卡、Pro 月卡</text>
            <view class="hero-card__action" hover-class="hero-card__action--pressed" hover-stay-time="100" @click="goRedeem">
              <text class="hero-card__action-text">去兑换会员</text>
            </view>
          </view>
        </view>

        <view class="section-card">
          <text class="section-card__title">当前开放的会员方案</text>
          <view class="sku-list">
            <view v-for="item in formalSkuLabels" :key="item.code" class="sku-item">
              <view class="sku-item__main">
                <text class="sku-item__title">{{ item.title }}</text>
                <text class="sku-item__code">{{ item.code }}</text>
              </view>
              <text class="sku-item__status">{{ item.status }}</text>
            </view>
          </view>
        </view>

        <view class="section-card">
          <text class="section-card__title">会员权益对照</text>
          <view class="policy-list">
            <view
              v-for="item in tierPolicyCards"
              :key="item.tier"
              class="policy-card"
              :class="{ 'policy-card--active': item.tier === currentTier }"
            >
              <view class="policy-card__head">
                <view>
                  <text class="policy-card__title">{{ item.title }}</text>
                  <text class="policy-card__summary">{{ item.summary }}</text>
                </view>
                <text v-if="item.tier === currentTier" class="policy-card__tag">当前</text>
              </view>

              <view class="policy-grid">
                <view class="policy-grid__item">
                  <text class="policy-grid__label">菜谱</text>
                  <text class="policy-grid__value">{{ item.recipeLimit }}</text>
                </view>
                <view class="policy-grid__item">
                  <text class="policy-grid__label">空间</text>
                  <text class="policy-grid__value">{{ item.storageLimit }}</text>
                </view>
                <view class="policy-grid__item">
                  <text class="policy-grid__label">展示</text>
                  <text class="policy-grid__value">{{ item.displayPolicy }}</text>
                </view>
                <view class="policy-grid__item">
                  <text class="policy-grid__label">回收站</text>
                  <text class="policy-grid__value">{{ item.recyclePolicy }}</text>
                </view>
              </view>

              <view class="note-block">
                <text class="note-block__title">广告说明</text>
                <text class="note-block__desc">{{ item.adPolicy }}</text>
              </view>

              <view class="policy-notes">
                <text v-for="note in item.notes" :key="note" class="policy-notes__item">{{ note }}</text>
              </view>
            </view>
          </view>
        </view>

        <view class="section-card">
          <text class="section-card__title">兑换与广告说明</text>
          <view class="rule-block">
            <text class="rule-block__heading">正式兑换条件</text>
            <text v-for="item in redeemRules" :key="item" class="rule-block__item">{{ item }}</text>
          </view>
          <view class="rule-block">
            <text class="rule-block__heading">体验码规则</text>
            <text v-for="item in trialRules" :key="item" class="rule-block__item">{{ item }}</text>
          </view>
          <view class="rule-block">
            <text class="rule-block__heading">次数型能力边界</text>
            <text v-for="item in creditRules" :key="item" class="rule-block__item">{{ item }}</text>
          </view>
        </view>
      </scroll-view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Login from "@/components/Login/Login.vue";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import {
  creditRules,
  formatTierLabel,
  formatTierSummary,
  formatValidUntil,
  formalSkuLabels,
  redeemRules,
  tierPolicyCards,
  trialRules
} from "../membership/present";

const pageStyle = usePageScrollStyle();
const sessionStore = useSessionStore();
const userStore = useUserStore();

const currentTier = computed(() => userStore.profile?.membership?.tier ?? "FREE");
const currentTierLabel = computed(() => formatTierLabel(currentTier.value));
const currentTierSummary = computed(() => formatTierSummary(currentTier.value));
const validUntilText = computed(() => formatValidUntil(userStore.profile?.membership?.validUntil ?? null));

function goRedeem() {
  void uniPlatform.navigation.navigateTo("/pages_me/membership-code/index");
}
</script>

<style scoped lang="scss">
.benefit-page {
  height: 100%;
  padding: 0 var(--space-page) calc(var(--space-xl) + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--theme-primary) 9%, transparent), transparent 36%),
    var(--color-page);
}

.hero-card,
.section-card {
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.hero-card {
  margin-top: var(--space-lg);
  padding: 30rpx;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--color-surface) 86%, var(--theme-primary) 14%), var(--color-surface)),
    var(--color-surface);
}

.hero-card__eyebrow,
.hero-card__meta,
.hero-card__description,
.hero-card__hint,
.sku-item__code,
.policy-card__summary,
.policy-grid__label,
.note-block__desc,
.rule-block__item {
  color: var(--color-text-secondary);
}

.hero-card__eyebrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--theme-primary) 14%, white);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.hero-card__headline {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-top: 26rpx;
}

.hero-card__tier {
  color: var(--color-text);
  font-size: 52rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1;
}

.hero-card__summary {
  color: var(--theme-primary);
  font-size: var(--font-size-lg);
  font-weight: 700;
}

.hero-card__meta,
.hero-card__description,
.hero-card__hint,
.note-block__desc,
.rule-block__item {
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.hero-card__meta {
  display: block;
  margin-top: 18rpx;
}

.hero-card__description {
  display: block;
  margin-top: 10rpx;
}

.hero-card__footer {
  display: flex;
  gap: var(--space-lg);
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 24rpx;
}

.hero-card__hint {
  flex: 1;
  min-width: 0;
}

.hero-card__action {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-width: 184rpx;
  min-height: 72rpx;
  padding: 0 28rpx;
  border-radius: 999rpx;
  background: linear-gradient(90deg, var(--color-primary), var(--theme-accent));
  box-shadow: var(--button-primary-shadow);
}

.hero-card__action--pressed {
  opacity: 0.92;
  transform: scale(0.98);
}

.hero-card__action-text {
  color: var(--button-primary-text);
  font-size: var(--font-size-sm);
  font-weight: 700;
}

.section-card {
  margin-top: var(--space-lg);
  padding: 28rpx;
}

.section-card__title,
.rule-block__heading,
.policy-card__title,
.note-block__title,
.sku-item__title,
.policy-grid__value {
  color: var(--color-text);
}

.section-card__title {
  display: block;
  font-size: var(--font-size-lg);
  font-weight: 700;
}

.sku-list,
.policy-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}

.sku-item,
.policy-card {
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-surface) 94%, var(--theme-primary) 6%);
}

.sku-item {
  display: flex;
  gap: var(--space-lg);
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 24rpx;
}

.sku-item__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.sku-item__title,
.policy-card__title,
.rule-block__heading {
  font-size: var(--font-size-md);
  font-weight: 700;
}

.sku-item__status,
.policy-card__tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44rpx;
  padding: 0 16rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--theme-primary) 12%, white);
  color: var(--theme-primary);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.policy-card {
  padding: 24rpx;
  border: 1rpx solid transparent;
}

.policy-card--active {
  border-color: color-mix(in srgb, var(--theme-primary) 22%, transparent);
  box-shadow: inset 0 0 0 1rpx color-mix(in srgb, var(--theme-primary) 10%, transparent);
}

.policy-card__head {
  display: flex;
  gap: var(--space-lg);
  align-items: flex-start;
  justify-content: space-between;
}

.policy-card__summary {
  display: block;
  margin-top: 8rpx;
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.policy-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx 24rpx;
  margin-top: 22rpx;
}

.policy-grid__item {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.policy-grid__label {
  font-size: var(--font-size-xs);
}

.policy-grid__value {
  font-size: var(--font-size-sm);
  font-weight: 700;
  line-height: 1.5;
}

.note-block,
.rule-block {
  margin-top: 22rpx;
}

.note-block__title,
.rule-block__heading {
  display: block;
}

.note-block__desc {
  display: block;
  margin-top: 10rpx;
}

.policy-notes {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}

.policy-notes__item {
  display: inline-flex;
  align-items: center;
  min-height: 42rpx;
  padding: 0 14rpx;
  border-radius: 999rpx;
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.rule-block__item {
  display: block;
  margin-top: 10rpx;
}
</style>
