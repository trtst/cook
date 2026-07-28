<template>
  <Layout title="我的口味">
    <view class="taste-page">
      <Login
        v-if="!sessionStore.isLoggedIn"
        title="登录后维护口味"
        description="登录后可以保存本人的口味、忌口和过敏信息。"
        @success="loadTaste"
      />

      <template v-else>
        <view class="taste-card">
          <view class="taste-card__header">
            <view class="taste-card__copy">
              <text class="taste-card__title">我的口味</text>
              <text class="taste-card__description">这些信息只归本人所有。</text>
            </view>
            <button class="taste-card__reload" :disabled="loading || saving" @click="loadTaste">刷新</button>
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
              <text class="taste-field__label">{{ field.label }}</text>
              <textarea
                v-model="tasteText[field.key]"
                class="taste-field__textarea"
                auto-height
                maxlength="200"
                :placeholder="field.placeholder"
                :disabled="saving"
              />
            </view>

            <view class="taste-field">
              <text class="taste-field__label">备注</text>
              <textarea
                v-model="noteText"
                class="taste-field__textarea taste-field__textarea--note"
                auto-height
                maxlength="300"
                placeholder="例如少油、喜欢清淡"
                :disabled="saving"
              />
            </view>

            <text v-if="saveErrorText" class="taste-form__error">{{ saveErrorText }}</text>
            <button class="taste-form__button" :loading="saving" :disabled="saving" @click="saveTaste">保存</button>
          </view>
        </view>
      </template>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { reactive, ref } from "vue";
import { userApi, type UpdateTasteProfileRequest } from "@/apis/user";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";

type TasteListKey = "allergies" | "strictDislikes" | "dislikedIngredients" | "flavorPreferences";

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
const tasteFields: Array<{ key: TasteListKey; label: string; placeholder: string }> = [
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

  saving.value = true;
  saveErrorText.value = "";

  const payload: UpdateTasteProfileRequest = {
    allergies: readItems(tasteText.allergies),
    strictDislikes: readItems(tasteText.strictDislikes),
    dislikedIngredients: readItems(tasteText.dislikedIngredients),
    flavorPreferences: readItems(tasteText.flavorPreferences),
    note: noteText.value.trim() || null
  };

  try {
    const profile = await userApi.updateTasteProfile(payload);
    tasteText.allergies = profile.allergies.join("、");
    tasteText.strictDislikes = profile.strictDislikes.join("、");
    tasteText.dislikedIngredients = profile.dislikedIngredients.join("、");
    tasteText.flavorPreferences = profile.flavorPreferences.join("、");
    noteText.value = profile.note ?? "";
    loaded.value = true;
  } catch (error) {
    saveErrorText.value = error instanceof Error ? error.message : "保存失败";
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
</script>

<style scoped lang="scss">
.taste-page {
  padding-bottom: var(--space-lg);
}

.taste-card {
  padding: var(--space-lg);
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.taste-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
}

.taste-card__copy {
  flex: 1;
  min-width: 0;
}

.taste-card__title,
.taste-card__description {
  display: block;
}

.taste-card__title {
  color: var(--color-text);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
}

.taste-card__description {
  margin-top: var(--space-xs);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.taste-card__reload,
.taste-status__button {
  flex: 0 0 auto;
  min-height: 60rpx;
  padding: 0 20rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-pill);
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
  margin-top: var(--space-lg);
  padding: 0 var(--space-md);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.taste-status__text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
}

.taste-form {
  margin-top: var(--space-lg);
}

.taste-field + .taste-field {
  margin-top: var(--space-md);
}

.taste-field__label {
  display: block;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.taste-field__textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 92rpx;
  margin-top: var(--space-sm);
  padding: 22rpx var(--space-md);
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  color: var(--color-text);
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
}

.taste-field__textarea--note {
  min-height: 132rpx;
}

.taste-form__error {
  display: block;
  margin-top: var(--space-md);
  color: var(--color-danger-text);
  font-size: var(--font-size-sm);
}

.taste-form__button {
  min-height: var(--size-button-primary);
  margin-top: var(--space-lg);
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}
</style>
