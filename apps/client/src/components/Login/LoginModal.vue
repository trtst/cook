<template>
  <view
    v-if="loginModalStore.visible"
    class="login-popup"
    :class="{
      'login-popup--phone': loginModalStore.mode === 'phone',
      'login-popup--mini': loginModalStore.openedInMiniProgram
    }"
    @touchmove.stop.prevent
  >
    <view class="login-popup__backdrop" @click="handleClose" />
    <view class="login-popup__panel">
      <button class="login-popup__nav" @click="handleNav">
        {{ navSymbol }}
      </button>

      <view class="login-popup__hero">
        <image
          class="login-popup__image"
          :src="heroImageUrl"
          mode="aspectFill"
          @error="imageFailed = true"
        />
        <view class="login-popup__hero-mask" />
        <view class="login-popup__hero-copy">
          <text class="login-popup__app">{{ APP_NAME }}</text>
          <text class="login-popup__slogan">{{ APP_SLOGAN }}</text>
        </view>
      </view>

      <view class="login-popup__sheet">
        <view class="login-popup__sheet-header">
          <text class="login-popup__title">{{ panelTitle }}</text>
          <text class="login-popup__description">{{ panelDescription }}</text>
        </view>

        <template v-if="loginModalStore.mode === 'options'">
          <button class="login-popup__action login-popup__action--primary" @click="handleWeChatQuickLogin">
            微信手机号快捷登录
          </button>
          <button class="login-popup__action login-popup__action--ghost" @click="openPhoneMode">
            手机号验证码登录
          </button>
        </template>

        <template v-else>
          <view class="login-popup__fields">
            <input
              v-model="phone"
              class="login-popup__input"
              type="number"
              maxlength="11"
              placeholder="请输入手机号"
              :disabled="loading"
            />

            <view class="login-popup__code-row">
              <input
                v-model="code"
                class="login-popup__input login-popup__input--code"
                type="number"
                maxlength="6"
                placeholder="请输入验证码"
                :disabled="loading"
              />
              <button class="login-popup__code-button" :disabled="loading || countdown > 0" @click="sendCode">
                {{ countdownText }}
              </button>
            </view>
          </view>

          <text class="login-popup__hint">{{ helperText }}</text>
          <text v-if="errorText" class="login-popup__error">{{ errorText }}</text>

          <button
            class="login-popup__action login-popup__action--primary"
            :class="{ 'login-popup__action--disabled': loading }"
            :loading="loading"
            :disabled="loading"
            @click="handleLogin"
          >
            登录
          </button>
        </template>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import defaultIllustration from "@/assets/login-default-illustration.svg";
import { authApi } from "@/apis/auth";
import { APP_NAME, APP_SLOGAN } from "@/config";
import { userApi } from "@/apis/user";
import { ApiClientError } from "@/apis/http";
import { uniPlatform } from "@/platform/uni";
import { useDiningGroupStore } from "@/stores/dining-group";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { emitLoginSuccess } from "@/utils/session-events";

const loginModalStore = useLoginModalStore();
const sessionStore = useSessionStore();
const userStore = useUserStore();
const diningGroupStore = useDiningGroupStore();

const phone = ref("");
const code = ref("");
const loading = ref(false);
const countdown = ref(0);
const errorText = ref("");
const helperText = ref("测试阶段固定验证码为 123456");
const imageFailed = ref(false);

let countdownTimer: ReturnType<typeof setInterval> | null = null;

const heroImageUrl = computed(() => {
	if (imageFailed.value || !loginModalStore.openImageUrl) return defaultIllustration;
	return loginModalStore.openImageUrl;
});

const panelTitle = computed(() => (loginModalStore.mode === "phone" ? "手机号验证码登录" : "欢迎回来"));
const panelDescription = computed(() =>
	loginModalStore.mode === "phone"
		? "测试阶段输入合法手机号和验证码 123456 即可登录。"
		: "先用手机号登录，后续再接微信手机号快捷登录。"
);
const countdownText = computed(() => (countdown.value > 0 ? `${countdown.value}s` : "发送验证码"));
const navSymbol = computed(() => (loginModalStore.mode === "phone" && loginModalStore.openedInMiniProgram ? "←" : "×"));

watch(
	() => loginModalStore.visible,
	(visible) => {
		if (!visible) {
			stopCountdown();
			return;
		}

		resetForm();
		imageFailed.value = false;
	}
);

onBeforeUnmount(() => {
	stopCountdown();
});

function handleNav() {
	if (loginModalStore.mode === "phone" && loginModalStore.openedInMiniProgram) {
		loginModalStore.back();
		errorText.value = "";
		return;
	}

	handleClose();
}

function handleClose() {
	stopCountdown();
	loginModalStore.close();
}

function openPhoneMode() {
	errorText.value = "";
	loginModalStore.openPhoneMode();
}

function handleWeChatQuickLogin() {
	// 当前范围只保留按钮，不接真实授权链路，也不提示占位。
}

function sendCode() {
	const phoneText = phone.value.trim();
	if (!phoneText) {
		errorText.value = "请输入手机号";
		return;
	}

	if (!/^1[3-9]\d{9}$/.test(phoneText)) {
		errorText.value = "请输入正确的手机号";
		return;
	}

	errorText.value = "";
	helperText.value = "测试验证码已固定为 123456";
	countdown.value = 60;
	stopCountdown();
	countdownTimer = setInterval(() => {
		if (countdown.value <= 1) {
			stopCountdown();
			countdown.value = 0;
			return;
		}

		countdown.value -= 1;
	}, 1000);

	void uniPlatform.feedback.toast({ title: "测试验证码 123456", icon: "none" }).catch(() => undefined);
}

async function handleLogin() {
	if (loading.value) return;

	const phoneText = phone.value.trim();
	const codeText = code.value.trim();
	const validationError = validateLogin(phoneText, codeText);
	if (validationError) {
		errorText.value = validationError;
		return;
	}

	loading.value = true;
	errorText.value = "";

	try {
		const session = await authApi.loginWithCode({
			phone: phoneText,
			code: codeText
		});

		await sessionStore.setSession({
			token: session.token,
			uid: session.user.uid,
			expiresAt: session.expiresAt
		});
		userStore.setProfile(await userApi.getCurrent());
		await diningGroupStore.refreshCurrent().catch(() => undefined);

		const { sourceId, action } = loginModalStore.complete(session);
		await emitLoginSuccess({
			sourceId,
			session
		});
		action?.();
	} catch (error) {
		errorText.value = getErrorText(error);
	} finally {
		loading.value = false;
	}
}

function validateLogin(phoneText: string, codeText: string) {
	if (!phoneText) return "请输入手机号";
	if (!/^1[3-9]\d{9}$/.test(phoneText)) return "请输入正确的手机号";
	if (!codeText) return "请输入验证码";
	if (!/^\d{6}$/.test(codeText)) return "请输入 6 位验证码";
	return "";
}

function getErrorText(error: unknown) {
	if (error instanceof ApiClientError) {
		if (error.code === 400) return error.message || "验证码错误";
		if (error.code === 429) return error.message || "请求过于频繁，请稍后重试";
	}

	if (error instanceof Error && error.message) {
		return error.message;
	}

	return "登录失败，请稍后重试";
}

function resetForm() {
	phone.value = "";
	code.value = "";
	errorText.value = "";
	helperText.value = "测试阶段固定验证码为 123456";
	countdown.value = 0;
	stopCountdown();
}

function stopCountdown() {
	if (!countdownTimer) return;
	clearInterval(countdownTimer);
	countdownTimer = null;
}
</script>

<style lang="scss">
.login-popup {
  position: fixed;
  inset: 0;
  z-index: 1200;
}

.login-popup__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 19, 0.36);
}

.login-popup__panel {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #f4eadf 0%, #f7f2ea 38%, #fffdf8 100%);
  animation: login-popup-rise 280ms ease-out;
}

.login-popup__nav {
  position: absolute;
  top: calc(var(--size-navbar-content, 88rpx) + 12rpx);
  left: 28rpx;
  z-index: 3;
  width: 72rpx;
  height: 72rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.9);
  color: #31433b;
  font-size: 36rpx;
  line-height: 72rpx;
  text-align: center;
  box-shadow: 0 18rpx 36rpx rgba(49, 67, 59, 0.12);
}

.login-popup__hero {
  position: relative;
  flex: 1 1 52%;
  min-height: 420rpx;
  overflow: hidden;
}

.login-popup__image {
  width: 100%;
  height: 100%;
}

.login-popup__hero-mask {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 24% 18%, rgba(255, 255, 255, 0.44), transparent 38%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.48));
}

.login-popup__hero-copy {
  position: absolute;
  right: 40rpx;
  bottom: 46rpx;
  left: 40rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  color: #31433b;
}

.login-popup__app {
  font-family: "阿里妈妈方圆体 VF Regular";
  font-size: 60rpx;
  font-weight: 700;
  line-height: 1.05;
}

.login-popup__slogan {
  max-width: 520rpx;
  color: rgba(49, 67, 59, 0.8);
  font-size: 28rpx;
  line-height: 1.6;
}

.login-popup__sheet {
  position: relative;
  margin-top: -44rpx;
  display: flex;
  min-height: 440rpx;
  flex-direction: column;
  gap: 28rpx;
  padding: 52rpx 36rpx 56rpx;
  border-radius: 42rpx 42rpx 0 0;
  background: rgba(255, 251, 246, 0.96);
  box-shadow: 0 -20rpx 60rpx rgba(49, 67, 59, 0.08);
  transition: min-height 220ms ease, margin-top 220ms ease, padding 220ms ease;
}

.login-popup--phone .login-popup__sheet {
  min-height: 620rpx;
  margin-top: -96rpx;
  padding-top: 60rpx;
}

.login-popup__sheet-header {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.login-popup__title {
  color: #23312a;
  font-size: 44rpx;
  font-weight: 700;
}

.login-popup__description {
  color: rgba(35, 49, 42, 0.62);
  font-size: 28rpx;
  line-height: 1.6;
}

.login-popup__fields {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.login-popup__input {
  height: 94rpx;
  padding: 0 28rpx;
  border: 2rpx solid rgba(98, 123, 112, 0.14);
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.92);
  color: #23312a;
  font-size: 30rpx;
}

.login-popup__code-row {
  display: flex;
  gap: 18rpx;
}

.login-popup__input--code {
  flex: 1 1 auto;
}

.login-popup__code-button {
  width: 220rpx;
  height: 94rpx;
  border-radius: 28rpx;
  background: rgba(132, 181, 160, 0.12);
  color: #4d7563;
  font-size: 28rpx;
}

.login-popup__action {
  width: 100%;
  height: 96rpx;
  border-radius: 999rpx;
  font-size: 30rpx;
  line-height: 96rpx;
}

.login-popup__action--primary {
  background: linear-gradient(135deg, #e7a37d 0%, #8ab7a4 100%);
  color: #fffdf8;
  box-shadow: 0 22rpx 44rpx rgba(138, 183, 164, 0.24);
}

.login-popup__action--ghost {
  margin-top: 6rpx;
  border: 2rpx solid rgba(98, 123, 112, 0.18);
  background: rgba(255, 255, 255, 0.84);
  color: #31433b;
}

.login-popup__action--disabled {
  opacity: 0.7;
}

.login-popup__hint {
  color: rgba(77, 117, 99, 0.82);
  font-size: 24rpx;
  line-height: 1.5;
}

.login-popup__error {
  color: #cb5c4a;
  font-size: 24rpx;
  line-height: 1.5;
}

@keyframes login-popup-rise {
  from {
    transform: translateY(100%);
  }

  to {
    transform: translateY(0);
  }
}
</style>
