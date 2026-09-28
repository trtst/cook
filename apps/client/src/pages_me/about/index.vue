<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="关于炊火记" full-screen :navbar-placeholder="false" navbar-transparent>
    <scroll-view class="about-page" scroll-y :show-scrollbar="false" :style="pageBodyStyle">
      <view class="about-brand">
        <image class="about-brand__logo" :src="logoUrl" mode="aspectFit" />
        <text class="about-brand__version">Version {{ APP_VERSION }}</text>
        <text class="about-brand__slogan">{{ APP_SLOGAN }}</text>
      </view>

      <view class="about-links">
        <view class="about-link" hover-class="is-pressed" hover-stay-time="100" @click="openPage('/pages_me/terms/index')">
          <view class="about-link__icon-wrap">
            <text class="about-link__icon cookfont icon-policy-user" aria-hidden="true" />
          </view>
          <view class="about-link__copy">
            <text class="about-link__title">用户协议</text>
          </view>
          <text class="about-link__arrow cookfont icon-back" />
        </view>
        <view class="about-link" hover-class="is-pressed" hover-stay-time="100" @click="openPage('/pages_me/privacy/index')">
          <view class="about-link__icon-wrap">
            <text class="about-link__icon cookfont icon-policy-privacy" aria-hidden="true" />
          </view>
          <view class="about-link__copy">
            <text class="about-link__title">隐私政策</text>
          </view>
          <text class="about-link__arrow cookfont icon-back" />
        </view>
      </view>
    </scroll-view>
  </Layout>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Layout from "@/components/Layout/Layout.vue";
import { APP_SLOGAN, APP_VERSION } from "@/config/app";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { useTheme } from "@/composables/useTheme";
import { uniPlatform } from "@/platform/uni";
import lightLogo from "@/assets/logo.png";
import darkLogo from "@/assets/assets-logo.png";

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses, effectiveTheme } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const { navBarTotalHeight } = useSystemInfo();
const pageBodyStyle = computed(() => ({ paddingTop: `calc(${navBarTotalHeight.value}px + 36rpx)` }));
const logoUrl = computed(() => effectiveTheme.value === "dark" ? darkLogo : lightLogo);

function openPage(url: string) {
  void uniPlatform.navigation.navigateTo(url).catch(() => undefined);
}
</script>

<style scoped lang="scss">
.about-page {
  box-sizing: border-box;
  height: 100%;
  padding: 0 var(--space-page) 48rpx;
  background: var(--color-page);
}

.about-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 76rpx 0 0;
}

.about-brand__logo {
  width: 280rpx;
  height: 156rpx;
  margin-bottom: 12rpx;
}

.about-brand__version,
.about-brand__slogan {
  color: var(--color-text-tertiary);
  font-size: 28rpx;
  line-height: 1.5;
}

.about-brand__version {
  margin-top: 12rpx;
}

.about-brand__slogan {
  margin-top: 18rpx;
  font-size: 32rpx;
}

.about-links {
  margin-top: var(--space-lg);
  overflow: hidden;
}

.about-link {
  display: flex;
  align-items: center;
  min-height: 112rpx;
}

.about-link + .about-link {
  border-top: 1rpx solid var(--color-divider);
}

.about-link__icon-wrap {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 58rpx;
  height: 58rpx;
}

.about-link__icon {
  color: var(--color-text);
  font-size: 46rpx;
  line-height: 1;
}

.about-link__copy {
  flex: 1;
  min-width: 0;
  margin-left: var(--space-md);
}

.about-link__title {
  display: block;
  overflow: hidden;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.about-link__arrow {
	flex: 0 0 auto;
	margin-left: var(--space-lg);
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  line-height: 1;
  transform: rotate(180deg);
}

.is-pressed {
  opacity: 0.86;
}
</style>
