<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { recipeApi, type AdminRecipeDetail } from "@/apis/recipe";
import { formatStatusText } from "@/utils/status";

const props = defineProps<{
  visible: boolean;
  recipeId: number | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const loading = ref(false);
const detail = ref<AdminRecipeDetail | null>(null);
const errorText = ref("");

const headerTitle = computed(() => {
  if (!detail.value) return "菜谱详情预览";
  return `菜谱详情 · ${detail.value.title}`;
});

watch(
  () => [props.visible, props.recipeId] as const,
  ([visible, recipeId]) => {
    if (!visible || !recipeId) {
      detail.value = null;
      errorText.value = "";
      return;
    }
    void loadDetail(recipeId);
  },
  { immediate: true }
);

function formatAmount(amount: AdminRecipeDetail["content"]["ingredients"][number]["amount"]) {
  if (amount.kind === "FUZZY") return amount.text;
  return `${amount.quantity}${amount.unitName}`;
}

async function loadDetail(recipeId: number) {
  loading.value = true;
  try {
    detail.value = await recipeApi.getDetail(recipeId);
    errorText.value = "";
  } catch (error) {
    detail.value = null;
    errorText.value = error instanceof Error ? error.message : "加载菜谱详情失败";
    ElMessage.error(errorText.value);
  } finally {
    loading.value = false;
  }
}

function handleClose() {
  emit("close");
}
</script>

<template>
  <el-drawer
    :model-value="visible"
    :title="headerTitle"
    direction="rtl"
    size="640px"
    destroy-on-close
    append-to-body
    @close="handleClose"
  >
    <div class="recipe-preview">
      <div v-if="loading" class="recipe-preview__state">加载中...</div>
      <div v-else-if="errorText" class="recipe-preview__state recipe-preview__state--error">{{ errorText }}</div>
      <div v-else-if="!detail" class="recipe-preview__state">未找到菜谱</div>

      <template v-else>
        <div class="recipe-preview__hero">
          <img v-if="detail.coverImageUrl" :src="detail.coverImageUrl" alt="菜谱封面" class="recipe-preview__cover" />
          <div v-else class="recipe-preview__cover recipe-preview__cover--empty">菜谱封面</div>

          <div class="recipe-preview__summary">
            <div class="recipe-preview__chips">
              <span class="recipe-preview__chip">{{ formatStatusText(detail.status) }}</span>
              <span v-if="detail.inspirationCategory" class="recipe-preview__chip recipe-preview__chip--soft">
                {{ detail.inspirationCategory.name }}
              </span>
              <span class="recipe-preview__chip recipe-preview__chip--soft">ID {{ detail.id }}</span>
            </div>

            <h3>{{ detail.title }}</h3>
            <p v-if="detail.content.story" class="recipe-preview__story">{{ detail.content.story }}</p>

            <div class="recipe-preview__facts">
              <span>{{ detail.content.baseServings }} 人份</span>
              <span>{{ detail.difficultyText || "难度待补" }}</span>
              <span>{{ detail.durationText || "时长待补" }}</span>
              <span>点赞 {{ detail.likeCount }}</span>
              <span>收藏 {{ detail.collectCount }}</span>
            </div>
          </div>
        </div>

        <section class="recipe-preview__section">
          <div class="recipe-preview__head">
            <h4>食材清单</h4>
            <span>{{ detail.content.ingredients.length }} 项</span>
          </div>
          <div v-if="detail.content.ingredients.length" class="recipe-preview__list">
            <div v-for="item in detail.content.ingredients" :key="`${item.ingredientId}-${item.ingredientName}`" class="recipe-preview__ingredient">
              <span class="recipe-preview__ingredient-name">{{ item.ingredientName }}</span>
              <span class="recipe-preview__ingredient-amount">{{ formatAmount(item.amount) }}</span>
            </div>
          </div>
          <p v-else class="recipe-preview__empty">暂未填写食材</p>
        </section>

        <section class="recipe-preview__section">
          <div class="recipe-preview__head">
            <h4>步骤</h4>
            <span>{{ detail.content.steps.length }} 步</span>
          </div>
          <div v-if="detail.content.steps.length" class="recipe-preview__steps">
            <article v-for="(step, index) in detail.content.steps" :key="index" class="recipe-preview__step">
              <div class="recipe-preview__step-index">{{ index + 1 }}</div>
              <div class="recipe-preview__step-main">
                <img v-if="step.imageUrl" :src="step.imageUrl" alt="" class="recipe-preview__step-image" />
                <p>{{ step.text }}</p>
              </div>
            </article>
          </div>
          <p v-else class="recipe-preview__empty">暂未填写步骤</p>
        </section>

        <section v-if="detail.content.tips" class="recipe-preview__section">
          <div class="recipe-preview__head">
            <h4>小贴士</h4>
          </div>
          <p class="recipe-preview__tips">{{ detail.content.tips }}</p>
        </section>
      </template>
    </div>
  </el-drawer>
</template>

<style scoped lang="scss">
.recipe-preview {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.recipe-preview__state {
  padding: 40px 16px;
  color: #6b7280;
  text-align: center;
}

.recipe-preview__state--error {
  color: #b42318;
}

.recipe-preview__hero {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.recipe-preview__cover {
  width: 180px;
  height: 240px;
  border-radius: 24px;
  object-fit: cover;
  background: #f3f4f6;
}

.recipe-preview__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #48614f;
  font-weight: 700;
}

.recipe-preview__summary {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.recipe-preview__chips,
.recipe-preview__facts {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.recipe-preview__chip {
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(47, 111, 78, 0.14);
  color: #2f6f4e;
  font-size: 12px;
  font-weight: 600;
}

.recipe-preview__chip--soft {
  background: #f3f4f6;
  color: #4b5563;
}

.recipe-preview__summary h3 {
  margin: 0;
  color: #111827;
  font-size: 28px;
  line-height: 1.2;
}

.recipe-preview__story,
.recipe-preview__facts,
.recipe-preview__tips,
.recipe-preview__step p,
.recipe-preview__empty {
  margin: 0;
  color: #4b5563;
  line-height: 1.7;
}

.recipe-preview__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recipe-preview__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.recipe-preview__head h4 {
  margin: 0;
  color: #111827;
  font-size: 16px;
}

.recipe-preview__head span {
  color: #6b7280;
  font-size: 12px;
}

.recipe-preview__list,
.recipe-preview__steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recipe-preview__ingredient {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid #eef2f7;
  border-radius: 16px;
  background: #fff;
}

.recipe-preview__ingredient-name {
  color: #111827;
  font-weight: 600;
}

.recipe-preview__ingredient-amount {
  color: #6b7280;
}

.recipe-preview__step {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid #eef2f7;
  border-radius: 16px;
  background: #fff;
}

.recipe-preview__step-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: rgba(47, 111, 78, 0.12);
  color: #2f6f4e;
  font-weight: 700;
}

.recipe-preview__step-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.recipe-preview__step-image {
  width: 100%;
  border-radius: 16px;
  object-fit: cover;
}

@media (max-width: 720px) {
  .recipe-preview__hero {
    grid-template-columns: minmax(0, 1fr);
  }

  .recipe-preview__cover {
    width: 100%;
    height: 220px;
  }
}
</style>
