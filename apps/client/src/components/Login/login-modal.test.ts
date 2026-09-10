import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(resolve(__dirname, "./LoginModal.vue"), "utf8");
const storeSource = readFileSync(resolve(__dirname, "../../stores/login-modal.ts"), "utf8");
const fontSource = readFileSync(resolve(__dirname, "../../assets/fonts/font.scss"), "utf8");

function styleBlock(selector: string) {
  const match = source.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `${selector} style block should exist`);
  return match[1];
}

function functionBody(name: string) {
  const start = source.indexOf(`async function ${name}`);
  assert.ok(start >= 0, `${name} should exist`);
  const end = source.indexOf("\nasync function ", start + 1);
  return source.slice(start, end === -1 ? source.length : end);
}

test("login modal keeps WeChat phone code hidden from the rendered entry", () => {
  assert.doesNotMatch(source, /open-type="getPhoneNumber"/);
  assert.doesNotMatch(source, /@getphonenumber="handleWeChatPhoneLogin"/);
  assert.doesNotMatch(source, /微信手机号登录|微信快捷登录/);
  assert.match(source, /uniPlatform\.auth\.getPhoneNumberCode/);
  assert.match(source, /authApi\.wechatSession/);
  assert.match(source, /authApi\.loginWithWechatPhone/);
  assert.match(source, /uniPlatform\.auth\.getDeviceId/);
  assert.ok(
    source.indexOf("await uniPlatform.auth.login()") < source.indexOf("await uniPlatform.auth.getPhoneNumberCode(event)"),
    "the identity session must be checked before requesting phone authorization"
  );
  assert.doesNotMatch(source, /authApi\.loginWithWechat\(/);
});

test("login modal opens from the local preferred login mode", () => {
  assert.match(storeSource, /mode: "phone" as LoginModalMode/);
  assert.doesNotMatch(storeSource, /this\.mode = isMiniProgram \? "wechat" : "phone"/);
  assert.match(storeSource, /this\.entryMode = preferredLoginMode\(\)/);
  assert.match(storeSource, /this\.mode = this\.entryMode/);
  assert.doesNotMatch(storeSource, /this\.mode = this\.openedInMiniProgram \? "wechat" : "phone"/);
  assert.doesNotMatch(source, /renderMode === 'wechat'|renderMode === "wechat"/);
});

test("login modal remembers the default method after three same successful logins", () => {
  assert.match(storeSource, /type LoginMethodHabit = \{\s*method: Extract<LoginModalMode, "phone" \| "password">;\s*successCount: number;\s*preferredMode: Extract<LoginModalMode, "phone" \| "password"> \| null;\s*\}/);
  assert.match(storeSource, /const LOGIN_METHOD_PREFERENCE_THRESHOLD = 3/);
  assert.match(storeSource, /APP_STORAGE_KEYS\.loginMethodHabit/);
  assert.match(storeSource, /function preferredLoginMode\(\)/);
  assert.match(storeSource, /function recordLoginMethod\(method: Extract<LoginModalMode, "phone" \| "password">\)/);
  assert.ok(storeSource.includes("successCount >= LOGIN_METHOD_PREFERENCE_THRESHOLD ? method : current?.preferredMode ?? null"));
  assert.match(functionBody("handlePhoneLogin"), /loginModalStore\.recordLoginMethod\("phone"\)[\s\S]*await applySession\(result\.data\)/);
  assert.match(functionBody("handlePasswordLogin"), /loginModalStore\.recordLoginMethod\("password"\)[\s\S]*await applySession\(result\.data\)/);
  assert.doesNotMatch(functionBody("handleWeChatPhoneLogin"), /recordLoginMethod/);
});

test("login modal treats only a user-triggered method switch as a second page", () => {
  assert.match(storeSource, /entryMode: "phone" as LoginModalMode/);
  assert.match(storeSource, /modeHistory: false/);
  assert.match(storeSource, /this\.entryMode = preferredLoginMode\(\)/);
  assert.match(storeSource, /this\.modeHistory = true/);
  assert.match(storeSource, /this\.modeHistory = false/);
  assert.match(source, /const navIconClass = computed\(\(\) => \{[\s\S]*return loginModalStore\.modeHistory \? "icon-back" : "icon-close";/);
  assert.match(source, /if \(loginModalStore\.modeHistory\) \{[\s\S]*loginModalStore\.back\(\);/);
});

test("SMS login uses one clear description without an extra hint row", () => {
  assert.match(source, /<text class="login-popup__auth-description">输入手机号，用短信验证码登录<\/text>/);
  assert.doesNotMatch(source, /login-popup__hint/);
  assert.doesNotMatch(source, /helperText/);
  assert.doesNotMatch(source, /验证码会发送到你的手机号|验证码将发送到你的手机号|验证码已发送，请留意短信/);
});

test("login modal exposes SMS and password login without legacy routes", () => {
  assert.match(source, /authApi\.sendSmsCode/);
  assert.match(source, /authApi\.loginWithSms/);
  assert.match(source, /authApi\.loginWithPassword/);
  assert.match(source, /loginModalStore\.openPasswordMode/);
  assert.doesNotMatch(source, /authApi\.(sendCode|loginWithCode)\(/);
});

test("login form inputs use phone password and visibility font icons", () => {
  assert.match(source, /class="login-popup__field-icon cookfont icon-login-phone"/);
  assert.match(source, /class="login-popup__field-icon cookfont icon-login-password"/);
  assert.match(fontSource, /\.icon-login-phone::before \{\s*content: "\\e6eb";\s*\}/);
  assert.match(fontSource, /\.icon-login-password::before \{\s*content: "\\e6d5";\s*\}/);
  assert.match(fontSource, /\.icon-login-visible::before \{\s*content: "\\e6df";\s*\}/);
  assert.match(fontSource, /\.icon-login-hidden::before \{\s*content: "\\e6e0";\s*\}/);
  assert.match(source, /const passwordVisible = ref\(false\)/);
  assert.match(source, /:password="!passwordVisible"/);
  assert.match(source, /@click="togglePasswordVisible"/);
  assert.match(source, /passwordVisible \? 'icon-login-visible' : 'icon-login-hidden'/);
  assert.match(source, /\.login-popup__field[\s\S]*height: 92rpx/);
  assert.match(source, /\.login-popup__visibility[\s\S]*min-width: 64rpx/);
});

test("login action button copy hides WeChat and uses generic form login text", () => {
  assert.doesNotMatch(source, /loading \? "登录中\.\.\." : "微信手机号登录"/);
  assert.match(source, /@click="handlePhoneLogin"[\s\S]*loading \? "登录中\.\.\." : "登录"/);
  assert.match(source, /@click="handlePasswordLogin"[\s\S]*loading \? "登录中\.\.\." : "登录"/);
  assert.doesNotMatch(source, /@click="handlePhoneLogin"[\s\S]*loading \? "登录中\.\.\." : "手机号登录"/);
  assert.doesNotMatch(source, /@click="handlePasswordLogin"[\s\S]*loading \? "登录中\.\.\." : "手机号登录"/);
});

test("login modal uses local theme logos, plain-color decoration, and stable copy", () => {
  assert.match(source, /@\/assets\/logo\.png/);
  assert.match(source, /@\/assets\/assets-logo\.png/);
  assert.match(source, /useTheme\(\)/);
  assert.match(source, /effectiveTheme/);
  assert.match(source, /pickLoginCopy/);
  assert.match(source, /loginCopy/);
  assert.doesNotMatch(source, /raw\.githubusercontent\.com/);
  assert.doesNotMatch(source, /linear-gradient|radial-gradient/);
});

test("login modal uses the soft page background without pseudo decoration and has no guest skip entry", () => {
  assert.match(source, /\.login-popup__panel[\s\S]*background: var\(--page-primary-soft-bg\)/);
  assert.doesNotMatch(source, /\.login-popup__panel::before|\.login-popup__panel::after/);
  assert.doesNotMatch(source, /filter: var\(--page-glow-cluster-filter\)/);
  assert.doesNotMatch(source, /background: var\(--color-primary-soft-fill-medium\)|background: var\(--color-secondary-soft\)/);
  assert.doesNotMatch(source, /login-popup__decor-block/);
  assert.doesNotMatch(source, /login-popup__decor-cloud/);
  assert.doesNotMatch(source, /login-popup__text-link--muted/);
  assert.doesNotMatch(source, /暂不登录/);
});

test("login modal layout keeps actions near bottom and agreement inside the action section", () => {
  const mainStyle = styleBlock(".login-popup__main");
  const mainButtonStyle = styleBlock(".login-popup__main-button");

  assert.ok(source.indexOf('class="login-popup__brand"') < source.indexOf('class="login-popup__main"'));
  assert.ok(source.indexOf('class="login-popup__main"') < source.indexOf('class="login-popup__copy" aria-live="polite"'));
  assert.ok(source.indexOf('class="login-popup__auth-card"') < source.indexOf('class="login-popup__agreement"'));
  assert.ok(source.indexOf('class="login-popup__agreement"') < source.indexOf('class="login-popup__copy" aria-live="polite"'));
  assert.match(mainStyle, /flex: 1/);
  assert.match(mainStyle, /justify-content: flex-end/);
  assert.match(mainStyle, /padding: 0 0 200rpx/);
  assert.match(mainButtonStyle, /height: 90rpx/);
  assert.match(mainButtonStyle, /padding: 0/);
  assert.match(source, /\.login-popup__auth-card/);
});

test("phone login secondary links are one row plain text", () => {
  const textLinkStyle = styleBlock(".login-popup__text-link");

  assert.match(source, /login-popup__link-row/);
  assert.match(source, /\.login-popup__link-row[\s\S]*justify-content: center/);
  assert.doesNotMatch(source, /\.login-popup__link-row[\s\S]*justify-content: space-between/);
  assert.doesNotMatch(source, /goBackToWechatMode|微信快捷登录/);
  assert.match(source, /<view class="login-popup__text-link" @click="openPasswordMode">密码登录<\/view>/);
  assert.match(source, /<view class="login-popup__text-link" @click="openPhoneMode">验证码登录<\/view>/);
  assert.match(textLinkStyle, /align-self: center/);
  assert.match(textLinkStyle, /color: var\(--color-text\)/);
  assert.doesNotMatch(textLinkStyle, /color: var\(--color-primary\)/);
});

test("login modal copy uses a single background rule and no highlighted line", () => {
  assert.match(source, /\.login-popup__copy-rule/);
  assert.match(source, /\.login-popup__copy-text/);
  assert.match(source, /background: var\(--color-page\)/);
  assert.doesNotMatch(source, /login-popup__copy-line--accent/);
  assert.doesNotMatch(source, /\.login-popup__copy::before|\.login-popup__copy::after/);
});

test("every login action keeps the agreement gate", () => {
  assert.match(source, /handleWeChatPhoneLogin[\s\S]*ensureAgreementAccepted/);
  assert.match(source, /handlePhoneLogin[\s\S]*ensureAgreementAccepted/);
  assert.match(source, /handlePasswordLogin[\s\S]*ensureAgreementAccepted/);
});

test("login failures show a Toast and stay in the current login mode", () => {
  assert.match(source, /async function showAuthError\(error: unknown\)/);
  assert.match(source, /async function showAuthResultError/);
  assert.match(source, /if \(!result\.ok\) \{\s*await showAuthResultError\(result\);[\s\S]*return;\s*\}/);
  assert.match(source, /catch \(error\) \{\s*await showAuthError\(error\);\s*\}/);

  for (const handler of ["handleWeChatPhoneLogin", "sendCode", "handlePhoneLogin", "handlePasswordLogin"]) {
    const start = source.indexOf(`async function ${handler}`);
    const end = source.indexOf("\nasync function ", start + 1);
    const body = source.slice(start, end === -1 ? source.length : end);

    assert.match(body, /await showAuth(Error|ResultError)\(/, `${handler} must show an error Toast`);
    assert.doesNotMatch(body, /openPhoneMode\(\)|openPasswordMode\(\)|goBackToWechatMode\(\)/);
  }
});

test("login modal toasts are shown from the bottom", () => {
  assert.match(source, /async function showAuthError\(error: unknown\)[\s\S]*placement: "bottom"/);
  assert.match(source, /title: "请勾选协议"[\s\S]*placement: "bottom"/);
  assert.match(source, /title: "请勾选协议"[\s\S]*tone: "error"/);
  assert.match(source, /title: "验证码已发送"[\s\S]*placement: "bottom"/);
});

test("SMS send success reuses the inline feedback area", () => {
  assert.match(source, /const messageTone = ref<"error" \| "success">\("error"\)/);
  assert.match(source, /login-popup__error--success/);
  assert.match(source, /errorText\.value = "【速通互联验证码】您的验证码发送成功。"/);
  assert.match(source, /messageTone\.value = "success"[\s\S]*startCountdown\(result\.data\.cooldownSeconds\)/);
  assert.match(source, /async function showAuthError\(error: unknown\)[\s\S]*messageTone\.value = "error"/);
  assert.match(source, /\.login-popup__error--success[\s\S]*color: var\(--color-state-success-text\)/);
});

test("SMS countdown button keeps a solid primary background", () => {
  const codeDisabledStyle = styleBlock(".login-popup__code-button--disabled");
  const mainDisabledStyle = styleBlock(".login-popup__main-button--disabled");

  assert.match(codeDisabledStyle, /background: var\(--button-primary-bg\)/);
  assert.match(codeDisabledStyle, /color: var\(--color-overlay-text\)/);
  assert.match(codeDisabledStyle, /opacity: 1/);
  assert.doesNotMatch(codeDisabledStyle, /opacity: 0\.52/);
  assert.match(mainDisabledStyle, /opacity: 0\.52/);
});

test("disabled login buttons use explicit disabled classes without attribute style selectors", () => {
  const mainDisabledStyle = styleBlock(".login-popup__main-button--disabled");
  const codeDisabledStyle = styleBlock(".login-popup__code-button--disabled");

  assert.doesNotMatch(source, /\.login-popup__(main|code)-button[^{]*\[disabled\]/);
  assert.match(source, /:class="\{ 'login-popup__code-button--disabled': loading \|\| countdown > 0 \}"/);
  assert.match(source, /:class="\{ 'login-popup__main-button--disabled': loading \}"/);
  assert.match(mainDisabledStyle, /opacity: 0\.52/);
  assert.match(codeDisabledStyle, /background: var\(--button-primary-bg\)/);
  assert.match(codeDisabledStyle, /color: var\(--color-overlay-text\)/);
  assert.match(codeDisabledStyle, /opacity: 1/);
});

test("agreement and inline error keep stable warning states", () => {
  assert.match(source, /const agreementWarn = ref\(false\)/);
  assert.match(source, /login-popup__checkbox--warning/);
  assert.match(source, /\.login-popup__checkbox--warning[\s\S]*color: var\(--color-state-danger-text\)/);
  assert.match(source, /class="login-popup__error"[\s\S]*\{\{ errorText \|\| " " \}\}/);
  assert.match(source, /:class="\{ 'login-popup__error--success': messageTone === 'success' \}"/);
  assert.match(source, /\.login-popup__error[\s\S]*height: 40rpx[\s\S]*line-height: 40rpx/);
  assert.doesNotMatch(source, /v-if="errorText" class="login-popup__error"/);
});

console.log("login modal contract tests loaded");
