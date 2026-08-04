<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="我的口味" full-screen>
    <template #navbar-center>
      <text class="taste-navbar__title">我的口味</text>
    </template>

    <view class="taste-page">
      <scroll-view scroll-y class="taste-scroll" show-scrollbar="false">
        <view class="taste-scroll__body">
          <RecipeEmptyState
            v-if="!sessionStore.isLoggedIn"
            class="taste-empty"
            :art="tasteEmptyArt"
            title="登录后记录你的口味"
            description="把过敏、严格忌口、不喜欢和偏好记在这里。点一下开始登录，这些信息只归你本人所有。"
            clickable
            @click="openLogin"
          />

          <template v-else>
            <view class="taste-shell">
              <view class="taste-head">
                <view class="taste-head__copy">
                  <text class="taste-head__description">这些信息只归本人所有。可用逗号、顿号、分号或换行分隔多个条目。</text>
                </view>
              </view>

              <view v-if="loading" class="taste-status">
                <text class="taste-status__text">加载中</text>
              </view>

              <view v-else-if="loadErrorText" class="taste-status">
                <text class="taste-status__text">{{ loadErrorText }}</text>
                <button class="taste-status__button" :disabled="saving" @click="loadTaste">重新加载</button>
              </view>

              <view v-else class="taste-form">
                <view v-for="field in tasteFields" :key="field.key" class="taste-field">
                  <view class="taste-field__head">
                    <text class="taste-field__label">{{ field.label }}</text>
                    <text class="taste-field__hint">例如 {{ field.placeholder }}</text>
                  </view>
                  <textarea
                    v-model="tasteText[field.key]"
                    class="taste-field__textarea"
                    auto-height
                    :placeholder="`例如 ${field.placeholder}`"
                    :disabled="saving"
                  />
                </view>

                <view class="taste-field">
                  <view class="taste-field__head">
                    <text class="taste-field__label">备注</text>
                    <text class="taste-field__hint">补充你的饮食习惯</text>
                  </view>
                  <textarea
                    v-model="noteText"
                    class="taste-field__textarea taste-field__textarea--note"
                    auto-height
                    maxlength="300"
                    placeholder="例如少油、喜欢清淡"
                    :disabled="saving"
                  />
                </view>

                <text class="taste-form__tip">这些内容只保存给你自己，不会自动共享给其他成员。</text>
                <text v-if="saveErrorText" class="taste-form__error">{{ saveErrorText }}</text>
                <button class="taste-form__button" :loading="saving" :disabled="saving" @click="saveTaste">保存</button>
              </view>
            </view>
          </template>
        </view>
      </scroll-view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { reactive, ref } from "vue";
import tasteEmptyArt from "@/assets/me-page/taste-empty-state.svg";
import { ApiClientError, UnauthorizedError } from "@/apis/http";
import { userApi, type UpdateTasteProfileRequest } from "@/apis/user";
import Layout from "@/components/Layout/Layout.vue";
import RecipeEmptyState from "@/components/Recipe/RecipeEmptyState.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { uniPlatform } from "@/platform/uni";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";

type TasteListKey = "allergies" | "strictDislikes" | "dislikedIngredients" | "flavorPreferences";
type TasteField = { key: TasteListKey; label: string; placeholder: string };

const pageStyle = usePageScrollStyle();
const tasteItemMaxLength = 64;
const tasteItemMaxCount = 50;

const loginModalStore = useLoginModalStore();
const sessionStore = useSessionStore();
const loading = ref(false);
const saving = ref(false);
const loaded = ref(false);
const loadErrorText = ref("");
const saveErrorText = ref("");
const noteText = ref("");
const tasteText = reactive<Record<TasteListKey, string>>({
  allergies: "",
  strictDislikes: "",
  dislikedIngredients: "",
  flavorPreferences: ""
});
const tasteFields: TasteField[] = [
  {
    key: "allergies",
    label: "过敏",
    placeholder: "花生、虾"
  },
  {
    key: "strictDislikes",
    label: "严格忌口",
    placeholder: "酒精、动物内脏"
  },
  {
    key: "dislikedIngredients",
    label: "不喜欢",
    placeholder: "香菜、苦瓜"
  },
  {
    key: "flavorPreferences",
    label: "偏好",
    placeholder: "微辣、少油"
  }
];

onShow(() => {
  if (!sessionStore.isLoggedIn) {
    loaded.value = false;
    loadErrorText.value = "";
    saveErrorText.value = "";
    return;
  }

  if (!loaded.value) {
    void loadTaste();
  }
});

function openLogin() {
  loginModalStore.open(null, () => {
    void loadTaste();
  });
}

async function loadTaste() {
  if (!sessionStore.isLoggedIn || loading.value) return;

  loading.value = true;
  loadErrorText.value = "";
  saveErrorText.value = "";

  try {
    const profile = await userApi.getTasteProfile();
    tasteText.allergies = profile.allergies.join("、");
    tasteText.strictDislikes = profile.strictDislikes.join("、");
    tasteText.dislikedIngredients = profile.dislikedIngredients.join("、");
    tasteText.flavorPreferences = profile.flavorPreferences.join("、");
    noteText.value = profile.note ?? "";
    loaded.value = true;
  } catch (error) {
    loadErrorText.value = error instanceof Error ? error.message : "口味加载失败";
  } finally {
    loading.value = false;
  }
}

async function saveTaste() {
  if (saving.value) return;

  saveErrorText.value = "";

  const payload = buildPayload();
  if (!payload) return;

  saving.value = true;

  try {
    const profile = await userApi.updateTasteProfile(payload);
    tasteText.allergies = profile.allergies.join("、");
    tasteText.strictDislikes = profile.strictDislikes.join("、");
    tasteText.dislikedIngredients = profile.dislikedIngredients.join("、");
    tasteText.flavorPreferences = profile.flavorPreferences.join("、");
    noteText.value = profile.note ?? "";
    loaded.value = true;
  } catch (error) {
    saveErrorText.value = getSaveErrorText(error);
    return;
  } finally {
    saving.value = false;
  }

  await uniPlatform.feedback.toast({ title: "已保存", icon: "success" }).catch(() => undefined);
}

function readItems(text: string) {
  return text
    .split(/[\n,，、;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildPayload(): UpdateTasteProfileRequest | null {
  const payload: UpdateTasteProfileRequest = {
    allergies: [],
    strictDislikes: [],
    dislikedIngredients: [],
    flavorPreferences: [],
    note: noteText.value.trim() || null
  };

  for (const field of tasteFields) {
    const items = readItems(tasteText[field.key]);
    const errorText = validateItems(field, items);
    if (errorText) {
      saveErrorText.value = errorText;
      return null;
    }

    payload[field.key] = items;
  }

  return payload;
}

function validateItems(field: TasteField, items: string[]) {
  if (items.length > tasteItemMaxCount) return `${field.label}最多填写 ${tasteItemMaxCount} 项`;

  const overLimitItem = items.find((item) => item.length > tasteItemMaxLength);
  if (overLimitItem) {
    return `${field.label}内容最多${tasteItemMaxLength}个字符`;
  }

  return "";
}

function getSaveErrorText(error: unknown) {
  if (error instanceof UnauthorizedError) return "登录已失效，请重新登录";

  if (error instanceof ApiClientError) {
    if (error.message.includes("最多 50 项")) return "单个分类最多填写 50 项";
    if (error.message.includes("最多 64")) return "内容最多64个字符";
    if (error.message.includes("不能重复")) return "同一分类里不要重复填写";
    if (error.message.includes("不能包含空项")) return "请删除空白条目后再保存";
    return "保存失败，请检查输入后重试";
  }

  return "保存失败，请稍后重试";
}
</script>

<style scoped lang="scss">
.taste-navbar__title {
  overflow: hidden;
  max-width: 420rpx;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: 700;
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.taste-page {
  display: flex;
  flex: 1;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.taste-scroll {
  flex: 1;
  min-height: 0;
}

.taste-scroll__body {
  padding: 20rpx var(--space-page) calc(20rpx + env(safe-area-inset-bottom));
}

.taste-empty {
  margin-top: var(--space-sm);
}

.taste-shell {
  display: flex;
  flex-direction: column;
}

.taste-head {
  padding: 8rpx 0 var(--space-md);
}

.taste-head__copy {
  flex: 1;
  min-width: 0;
}

.taste-head__description {
  display: block;
}

.taste-head__description {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.taste-status__button {
  flex: 0 0 auto;
  min-height: 60rpx;
  padding: 0 20rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.taste-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 120rpx;
  margin-top: var(--space-sm);
  padding: 0 var(--space-md);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.taste-status__text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
}

.taste-form {
  margin-top: var(--space-md);
}

.taste-field + .taste-field {
  padding-top: var(--space-lg);
  border-top: 1rpx solid var(--color-border-light);
}

.taste-field__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-md);
}

.taste-field__label {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.taste-field__hint {
  flex: 0 0 auto;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.taste-field__textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 84rpx;
  margin-top: var(--space-sm);
  padding: 20rpx var(--space-md);
  border: 0;
  border-radius: var(--radius-xs);
  background: var(--color-surface-muted);
  box-shadow: inset 0 0 0 1rpx var(--color-border);
  color: var(--color-text);
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
}

.taste-field__textarea--note {
  min-height: 124rpx;
}

.taste-form__tip {
  display: block;
  margin-top: var(--space-lg);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.taste-form__error {
  display: block;
  margin-top: var(--space-md);
  color: var(--color-danger-text);
  font-size: var(--font-size-sm);
}

.taste-form__button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 96rpx;
  margin-top: var(--space-lg);
  padding: 0 34rpx;
  border: 0;
  border-radius: var(--radius-pill);
  background: linear-gradient(
    135deg,
    var(--button-primary-gradient-start) 0%,
    var(--button-primary-gradient-end) 100%
  );
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  font-size: 32rpx;
  font-weight: var(--font-weight-heavy);
}
</style>
