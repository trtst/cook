<template>
  <Layout :title="recipeId ? '编辑菜谱' : '新建菜谱'">
    <Login v-if="!sessionStore.isLoggedIn" title="登录后维护个人菜谱" description="菜谱编辑只作用于你自己的入口。" />

    <template v-else>
      <view v-if="loading" class="notice">加载中...</view>
      <view v-else-if="errorText" class="notice" @click="loadRecipe">{{ errorText }}</view>

      <template v-else>
        <view class="section">
          <text class="label">菜名</text>
          <input v-model="form.name" class="input" placeholder="例如：番茄炒蛋" />
        </view>

        <view class="section">
          <text class="label">份量</text>
          <input v-model="form.servings" class="input" placeholder="例如：2 人份" />
        </view>

        <view class="section">
          <text class="label">用时（分钟）</text>
          <input v-model="form.durationMinutesText" class="input" type="number" placeholder="例如：20" />
        </view>

        <view class="section">
          <text class="label">食材（每行：名称|用量）</text>
          <textarea v-model="ingredientsText" class="textarea" placeholder="鸡蛋|2 个&#10;番茄|2 个" />
        </view>

        <view class="section">
          <text class="label">步骤（每行一步）</text>
          <textarea v-model="stepsText" class="textarea" placeholder="切番茄&#10;下锅翻炒" />
        </view>

        <view class="action-row">
          <button class="primary" :disabled="submitting" @click="submitForm">{{ recipeId ? "保存修改" : "创建菜谱" }}</button>
          <button v-if="recipeId" class="secondary" :disabled="submitting" @click="deleteRecipe">删除菜谱</button>
        </view>
      </template>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { reactive, ref } from "vue";
import { recipeApi, type RecipeContentInput } from "@/apis/recipe";
import Login from "@/components/Login/Login.vue";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";

const sessionStore = useSessionStore();
const recipeId = ref("");
const recipeVersion = ref<number | null>(null);
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const ingredientsText = ref("");
const stepsText = ref("");
const form = reactive({
  name: "",
  servings: "",
  durationMinutesText: ""
});

onLoad((query) => {
  const raw = Array.isArray(query?.recipeId) ? query.recipeId[0] : query?.recipeId;
  recipeId.value = typeof raw === "string" ? decodeURIComponent(raw) : "";
  if (sessionStore.isLoggedIn && recipeId.value) {
    void loadRecipe();
  }
});

async function loadRecipe() {
  if (!recipeId.value || loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    const detail = await recipeApi.getDetail(recipeId.value);
    recipeVersion.value = detail.version;
    form.name = detail.content.name;
    form.servings = detail.content.servings ?? "";
    form.durationMinutesText = detail.content.durationMinutes ? String(detail.content.durationMinutes) : "";
    ingredientsText.value = detail.content.ingredients.map(item => `${item.name}|${item.amount}`).join("\n");
    stepsText.value = detail.content.steps.map(item => item.content).join("\n");
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "菜谱加载失败";
  } finally {
    loading.value = false;
  }
}

function buildPayload(): RecipeContentInput {
  const ingredients = ingredientsText.value
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const [name = "", amount = ""] = item.split("|");
      return { name: name.trim(), amount: amount.trim() };
    });
  const steps = stepsText.value
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean)
    .map(content => ({ content }));
  return {
    name: form.name.trim(),
    ingredients,
    steps,
    servings: form.servings.trim() || null,
    durationMinutes: form.durationMinutesText ? Number(form.durationMinutesText) || 0 : null
  };
}

async function submitForm() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const payload = buildPayload();
    const result = recipeId.value && recipeVersion.value !== null
      ? await recipeApi.update(recipeId.value, {
          operationId: createOperationId(),
          expectedVersion: recipeVersion.value,
          content: payload
        })
      : await recipeApi.create({ operationId: createOperationId(), content: payload });
    await uniPlatform.feedback.toast({ title: "已保存", icon: "success" });
    void uniPlatform.navigation.redirectTo(`/pages_recipe/detail/index?recipeId=${encodeURIComponent(result.id)}`);
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "保存失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function deleteRecipe() {
  if (!recipeId.value || submitting.value) return;
  submitting.value = true;
  try {
    if (recipeVersion.value === null) return;
    await recipeApi.deleteRecipe(recipeId.value, createOperationId(), recipeVersion.value);
    await uniPlatform.feedback.toast({ title: "已删除", icon: "success" });
    void uniPlatform.navigation.redirectTo("/pages_recipe/list/index");
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "删除失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.notice,
.section {
  padding: var(--space-md);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.section + .section,
.action-row {
  margin-top: var(--space-md);
}

.label {
  display: block;
  margin-bottom: var(--space-sm);
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.input,
.textarea {
  width: 100%;
  padding: 20rpx 24rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  box-sizing: border-box;
}

.textarea {
  min-height: 220rpx;
}

.action-row {
  display: flex;
  gap: var(--space-sm);
}

.action-row button {
  flex: 1;
  border-radius: var(--radius-md);
}

.primary {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
}
</style>
