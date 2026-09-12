import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readFile(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf8");
}

function expectIncludes(source: string, snippet: string) {
  assert.ok(source.includes(snippet), `Expected file to include: ${snippet}`);
}

function expectExcludes(source: string, snippet: string) {
  assert.ok(!source.includes(snippet), `Expected file to exclude: ${snippet}`);
}

const eventPageSource = readFile("./pages_meal/event/index.vue");
const mealDetailSource = readFile("./pages_meal/detail/index.vue");
const recipeHistorySource = readFile("./pages_me/recipe-history/index.vue");
const topicPageSource = readFile("./pages_home/topic/index.vue");
const tableTopicPageSource = readFile("./pages_home/table-topic/index.vue");
const tableTopicDetailSource = readFile("./pages_home/table-topic-detail/index.vue");
const knowledgeDetailSource = readFile("./pages_me/knowledge-detail/index.vue");
const officialMessageSource = readFile("./pages_me/official-message/index.vue");
const ingredientUnitsSource = readFile("./pages_me/ingredient-units/index.vue");
const recipeDetailSource = readFile("./pages_recipe/detail/index.vue");
const pantryIndexSource = readFile("./pages_pantry/index/index.vue");
const pantryItemDetailSource = readFile("./pages_pantry/item-detail/index.vue");
const imageFieldSource = readFile("./components/ImageField.vue");
const loginModalSource = readFile("./components/Login/LoginModal.vue");

expectIncludes(eventPageSource, 'import ImageLoader from "@/components/ImageLoader.vue";');
expectIncludes(eventPageSource, '<ImageLoader class="event-card__cover" :src="item.coverImageUrl" />');
expectExcludes(eventPageSource, 'import ImageEmpty from "@/components/ImageEmpty.vue";');
expectExcludes(eventPageSource, "event-card__cover-empty");

expectIncludes(mealDetailSource, '<ImageEmpty v-else class="meal-hero__cover-empty" copy="封面图" ratio="fill" />');
expectIncludes(mealDetailSource, '<ImageEmpty v-else class="recipe-sheet__cover-placeholder" copy="封面图" ratio="fill" />');

expectIncludes(recipeHistorySource, 'import ImageEmpty from "@/components/ImageEmpty.vue";');
expectIncludes(recipeHistorySource, '<ImageEmpty v-else class="history-card__image history-card__image--empty" copy="封面图" ratio="fill" />');
expectExcludes(recipeHistorySource, "history-card__placeholder");

expectIncludes(topicPageSource, 'import ImageEmpty from "@/components/ImageEmpty.vue";');
expectIncludes(topicPageSource, '<ImageEmpty v-else class="topic-backdrop__image topic-backdrop__image--empty" copy="封面图" ratio="fill" />');
expectIncludes(topicPageSource, '<ImageEmpty v-else class="topic-summary__cover topic-summary__cover--empty" copy="封面图" ratio="fill" />');
expectIncludes(topicPageSource, '<ImageEmpty v-else class="recipe-card__cover recipe-card__cover--empty" copy="封面图" ratio="fill" />');
expectIncludes(topicPageSource, '<ImageEmpty v-else class="history-card__cover history-card__cover--empty" copy="封面图" ratio="fill" />');
expectExcludes(topicPageSource, "topic-backdrop__empty-text");
expectExcludes(topicPageSource, "topic-summary__cover-text");
expectExcludes(topicPageSource, "recipe-card__cover-text");
expectExcludes(topicPageSource, "history-card__cover-text");
expectIncludes(topicPageSource, 'import emptyStateArt from "@/assets/empty.png";');
expectIncludes(topicPageSource, '<Empty :art="emptyStateArt" title="本周灵感还在准备中" description="新的菜谱推荐准备好后，会第一时间出现在这里。" />');
expectExcludes(topicPageSource, "topic-empty :deep(.empty-state) {\n  width: 100%;\n  border-radius");
expectExcludes(topicPageSource, "topic-empty :deep(.empty-state) {\n  width: 100%;\n  background");
expectIncludes(topicPageSource, "align-items: flex-start;");
expectIncludes(topicPageSource, "margin-top: 48rpx;");
expectExcludes(topicPageSource, "transform: translateY(-64rpx);");

expectIncludes(tableTopicPageSource, 'import ImageEmpty from "@/components/ImageEmpty.vue";');
expectIncludes(tableTopicPageSource, '<ImageEmpty v-else class="topic-card__cover topic-card__cover--empty" copy="封面图" ratio="fill" />');
expectExcludes(tableTopicPageSource, "topic-card__empty-text");
expectIncludes(tableTopicPageSource, 'import emptyStateArt from "@/assets/empty.png";');
expectIncludes(tableTopicPageSource, '<Empty\n            :art="emptyStateArt"\n            title="还没有餐桌话题"\n            description="新的话题发布后，会按时间顺序展示在这里。"');
expectExcludes(tableTopicPageSource, "class=\"topic-hero\"");
expectExcludes(tableTopicPageSource, "topic-hero__eyebrow");
expectExcludes(tableTopicPageSource, "topic-hero__title");
expectExcludes(tableTopicPageSource, "topic-hero__desc");
expectIncludes(tableTopicPageSource, "align-items: flex-start;");
expectIncludes(tableTopicPageSource, "margin-top: 48rpx;");

expectIncludes(tableTopicDetailSource, 'import ImageEmpty from "@/components/ImageEmpty.vue";');
expectIncludes(tableTopicDetailSource, '<ImageEmpty v-else class="topic-hero__cover topic-hero__cover--empty" copy="封面图" ratio="fill" />');
expectExcludes(tableTopicDetailSource, "topic-hero__empty-text");

expectIncludes(knowledgeDetailSource, 'import ImageEmpty from "@/components/ImageEmpty.vue";');
expectIncludes(knowledgeDetailSource, '<ImageEmpty v-else class="detail-cover__empty" copy="封面图" ratio="fill" />');
expectExcludes(knowledgeDetailSource, "detail-cover__empty-text");

expectIncludes(officialMessageSource, 'import ImageEmpty from "@/components/ImageEmpty.vue";');
expectIncludes(officialMessageSource, '<ImageEmpty v-else class="detail-hero__cover detail-hero__cover--empty" copy="封面图" ratio="fill" />');
expectExcludes(officialMessageSource, "detail-hero__empty-text");

expectIncludes(ingredientUnitsSource, 'import ImageLoader from "@/components/ImageLoader.vue";');
expectIncludes(ingredientUnitsSource, '<ImageLoader class="ingredient-card__image" :src="item.imageUrl" />');
expectExcludes(ingredientUnitsSource, 'import ImageEmpty from "@/components/ImageEmpty.vue";');

expectIncludes(recipeDetailSource, 'import ImageLoader from "@/components/ImageLoader.vue";');
expectIncludes(recipeDetailSource, '<ImageLoader class="hero__image" :src="coverImageUrl" />');
expectExcludes(recipeDetailSource, 'import ImageEmpty from "@/components/ImageEmpty.vue";');

expectIncludes(pantryIndexSource, 'import ImageLoader from "@/components/ImageLoader.vue";');
expectIncludes(pantryIndexSource, '<ImageLoader class="item-card__image" :src="card.imageUrl" />');
expectExcludes(pantryIndexSource, "avatarText:");
expectExcludes(pantryIndexSource, "buildIngredientAvatarText");

expectIncludes(pantryItemDetailSource, 'import ImageLoader from "@/components/ImageLoader.vue";');
expectIncludes(pantryItemDetailSource, '<ImageLoader class="detail-hero__image" :src="itemImageUrl" />');
expectExcludes(pantryItemDetailSource, "detail-hero__avatar-text");
expectExcludes(pantryItemDetailSource, "buildIngredientAvatarText");

expectIncludes(imageFieldSource, 'import ImageEmpty from "@/components/ImageEmpty.vue";');
expectIncludes(imageFieldSource, '<ImageEmpty v-if="variant === \'cover\'" class="image-field__empty-cover" copy="封面图" ratio="fill" />');

expectIncludes(loginModalSource, 'class="login-popup__slogan font-medium"');

console.log("image empty usage tests passed");
