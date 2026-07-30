<template>
  <view
    v-if="renderVisible"
    class="login-popup"
    :class="{
      'login-popup--phone': renderMode === 'phone',
      'login-popup--mini': renderOpenedInMiniProgram,
      'login-popup--ready': motionState !== 'entering',
      'login-popup--closing': motionState === 'closing'
    }"
    @touchmove.stop.prevent
  >
    <view class="login-popup__backdrop" @click="handleClose" />
    <view class="login-popup__panel">
      <image
        class="login-popup__image"
        :src="heroImageUrl"
        mode="aspectFill"
        @error="imageFailed = true"
      />
      <view class="login-popup__hero-mask" />

      <view class="login-popup__nav" @click="handleNav">
        <text class="login-popup__nav-icon cookfont" :class="navIconClass" aria-hidden="true" />
      </view>

      <view class="login-popup__hero">
        <view class="login-popup__hero-copy">
          <text class="login-popup__app">{{ APP_NAME }}</text>
          <text class="login-popup__slogan">{{ APP_SLOGAN }}</text>
        </view>
      </view>

      <view class="login-popup__sheet">
        <view class="login-popup__sheet-header">
          <text class="login-popup__title font-black">{{ panelTitle }}</text>
          <text class="login-popup__description">{{ panelDescription }}</text>
        </view>

        <template v-if="loginModalStore.mode === 'options'">
          <view class="login-popup__action login-popup__action--ghost" @click="openPhoneMode">
            手机号验证码登录
          </view>
          <view class="login-popup__action login-popup__action--primary" @click="handleWeChatQuickLogin">
            微信手机号快捷登录
          </view>
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

          <view
            class="login-popup__action login-popup__action--primary"
            :class="{ 'login-popup__action--disabled': loading }"
            @click="handleLogin"
          >
            {{ loading ? "登录中..." : "登录" }}
          </view>
        </template>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { authApi } from "@/apis/auth";
import { APP_NAME, APP_SLOGAN } from "@/config";
import { usePageScrollLock } from "@/composables/usePageScrollLock";
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
const renderVisible = ref(false);
const renderMode = ref<"options" | "phone">("phone");
const renderOpenedInMiniProgram = ref(false);
const renderImageUrl = ref("");
const motionState = ref<"entering" | "open" | "closing">("entering");
const { setLocked: setPageLocked } = usePageScrollLock(Symbol("login-modal"));

let countdownTimer: ReturnType<typeof setInterval> | null = null;
let motionTimer: ReturnType<typeof setTimeout> | null = null;
const MINI_MOTION_MS = 280;

const heroImageUrl = computed(() => {
	if (imageFailed.value || !renderImageUrl.value) return 'https://raw.githubusercontent.com/trtst/img/refs/heads/master/login.jpg';
	return renderImageUrl.value;
});

const LOGIN_DEFAULT_TITLE = "人间烟火，记在心上";
const LOGIN_DEFAULT_DESCRIPTION = "登录即开启你的日常记录";

const panelTitle = computed(() => (renderMode.value === "phone" ? "手机号验证码登录" : LOGIN_DEFAULT_TITLE));
const panelDescription = computed(() =>
	renderMode.value === "phone"
		? "测试阶段输入合法手机号和验证码 123456 即可登录。"
		: LOGIN_DEFAULT_DESCRIPTION
);
const countdownText = computed(() => (countdown.value > 0 ? `${countdown.value}s` : "发送验证码"));
const navIconClass = computed(() =>
	renderMode.value === "phone" && renderOpenedInMiniProgram.value ? "icon-back" : "icon-close"
);

watch(
	() => loginModalStore.visible,
	async (visible) => {
		if (!visible) {
			startCloseMotion();
			stopCountdown();
			return;
		}

		syncRenderState();
		renderVisible.value = true;
		motionState.value = "entering";
		resetForm();
		imageFailed.value = false;
		stopMotionTimer();
		await nextTick();
		motionTimer = setTimeout(() => {
			motionState.value = "open";
			motionTimer = null;
		}, 16);
	}
);

watch(
	() => [loginModalStore.mode, loginModalStore.openedInMiniProgram, loginModalStore.openImageUrl] as const,
	() => {
		if (!loginModalStore.visible) return;
		syncRenderState();
	}
);

watch(
	() => renderVisible.value,
	(visible) => {
		setPageLocked(visible);
	},
	{ immediate: true }
);

onBeforeUnmount(() => {
	stopCountdown();
	stopMotionTimer();
});

function handleNav() {
	if (renderMode.value === "phone" && renderOpenedInMiniProgram.value) {
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

function syncRenderState() {
	renderMode.value = loginModalStore.mode;
	renderOpenedInMiniProgram.value = loginModalStore.openedInMiniProgram;
	renderImageUrl.value = loginModalStore.openImageUrl;
}

function startCloseMotion() {
	if (!renderVisible.value) return;
	stopMotionTimer();
	motionState.value = "closing";
	motionTimer = setTimeout(() => {
		renderVisible.value = false;
		renderMode.value = "phone";
		renderOpenedInMiniProgram.value = false;
		renderImageUrl.value = "";
		motionState.value = "entering";
		motionTimer = null;
	}, renderOpenedInMiniProgram.value ? MINI_MOTION_MS : 0);
}

function stopMotionTimer() {
	if (!motionTimer) return;
	clearTimeout(motionTimer);
	motionTimer = null;
}
</script>

<style lang="scss">
@import "@/assets/fonts/font.scss";

.login-popup {
  position: fixed;
  inset: 0;
  z-index: 1500;
}

.login-popup__backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--login-popup-backdrop-bg);
  -webkit-backdrop-filter: blur(24rpx) saturate(145%);
  backdrop-filter: blur(24rpx) saturate(145%);
}

.login-popup__panel {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.login-popup__image {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
}

.login-popup__hero-mask {
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    radial-gradient(circle at 24% 18%, var(--login-popup-hero-mask-spot), transparent 38%),
    linear-gradient(180deg, var(--login-popup-hero-mask-top), var(--login-popup-hero-mask-bottom));
  pointer-events: none;
}

.login-popup--mini .login-popup__backdrop,
.login-popup--mini .login-popup__image,
.login-popup--mini .login-popup__hero-mask {
  transition: opacity 220ms ease;
}

.login-popup--mini .login-popup__panel {
  transform: translate3d(0, 100%, 0);
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.login-popup--mini.login-popup--ready .login-popup__panel {
  transform: translate3d(0, 0, 0);
}

.login-popup--mini.login-popup--closing .login-popup__panel {
  transform: translate3d(0, 100%, 0);
}

.login-popup--mini.login-popup--closing .login-popup__backdrop,
.login-popup--mini.login-popup--closing .login-popup__image,
.login-popup--mini.login-popup--closing .login-popup__hero-mask {
  opacity: 0;
  transition-duration: 140ms;
}

.login-popup--mini:not(.login-popup--ready) .login-popup__backdrop {
  opacity: 0;
}

.login-popup--mini:not(.login-popup--ready) .login-popup__image,
.login-popup--mini:not(.login-popup--ready) .login-popup__hero-mask {
  opacity: 0.72;
}

.login-popup__nav {
  position: absolute;
  top: calc(var(--size-navbar-content, 88rpx) + 12rpx);
  left: 28rpx;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 48rpx;
  min-height: 48rpx;
}

.login-popup__nav-icon {
  color: var(--color-text);
  line-height: 1;
}

.login-popup__hero {
  position: relative;
  z-index: 2;
  flex: 0 0 52%;
  min-height: 420rpx;
}

.login-popup__hero-copy {
  position: absolute;
  right: 40rpx;
  bottom: 46rpx;
  left: 40rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  color: var(--login-popup-hero-copy);
}

.login-popup__app {
  font-family: "阿里妈妈方圆体 VF Regular";
  font-size: 60rpx;
  font-weight: 700;
  line-height: 1.05;
}

.login-popup__slogan {
  max-width: 520rpx;
  color: var(--login-popup-hero-copy-secondary);
  font-size: 28rpx;
  line-height: 1.6;
}

.login-popup__sheet {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  overflow: hidden;
  z-index: 2;
  display: flex;
  height: calc(560rpx + env(safe-area-inset-bottom));
  flex-direction: column;
  gap: 28rpx;
  box-sizing: initial;
  padding: 60rpx 36rpx calc(56rpx + env(safe-area-inset-bottom));
  border-radius: 42rpx 42rpx 0 0;
  border: 2rpx solid var(--login-popup-sheet-border);
  box-shadow: var(--login-popup-sheet-shadow);
  transform: translate3d(0, 180rpx, 0);
  transition: transform 220ms ease;
  will-change: transform;
}

.login-popup__sheet::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  background: linear-gradient(180deg, var(--login-popup-sheet-overlay-start) 0%, var(--login-popup-sheet-overlay-end) 100%);
  -webkit-backdrop-filter: blur(28rpx) saturate(150%);
  backdrop-filter: blur(28rpx) saturate(150%);
  pointer-events: none;
}

.login-popup--phone .login-popup__sheet {
  transform: translate3d(0, 0, 0);
}

.login-popup__sheet-header {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.login-popup__title {
  color: var(--login-popup-title);
  font-size: 44rpx;
  font-weight: 700;
}

.login-popup__description {
  color: var(--login-popup-description);
  font-size: 28rpx;
  line-height: 1.6;
}

.login-popup__fields {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.login-popup__input {
  height: 94rpx;
  padding: 0 28rpx;
  border: 0;
  background: var(--login-popup-input-bg);
  color: var(--login-popup-input-text);
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
  background: var(--login-popup-code-bg);
  color: var(--login-popup-code-text);
  font-size: 28rpx;
}

.login-popup__action {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 96rpx;
  border-radius: var(--radius-pill);
  font-size: 30rpx;
  line-height: 96rpx;
  text-align: center;
}

.login-popup__action--primary {
  background: linear-gradient(
    135deg,
    var(--button-primary-gradient-start) 0%,
    var(--button-primary-gradient-end) 100%
  );
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow);
}

.login-popup__action--ghost {
  margin-top: 6rpx;
  border: 2rpx solid var(--login-popup-ghost-border);
  background: var(--login-popup-ghost-bg);
  color: var(--login-popup-ghost-text);
}

.login-popup__action--disabled {
  opacity: 0.7;
}

.login-popup__hint {
  position: relative;
  z-index: 1;
  color: var(--login-popup-hint);
  font-size: 24rpx;
  line-height: 1.5;
}

.login-popup__error {
  position: relative;
  z-index: 1;
  color: var(--login-popup-error);
  font-size: 24rpx;
  line-height: 1.5;
}

</style>
