<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  html: string;
}>();

const imageStyle = [
  "display:block",
  "width:100%",
  "max-width:100%",
  "height:auto",
  "margin:34rpx 0",
  "border-radius:16rpx"
].join(";");
const blockStyleMap = {
  p: "margin:0 0 14px;line-height:1.6",
  h2: "margin:20px 0;font-size:20px;font-weight:700;line-height:1.5",
  h3: "margin:14px 0;font-size:16px;font-weight:700;line-height:1.4",
  blockquote: "margin:20px 0;padding:6px 0 6px 14px;line-height:1.4;border-left:6px solid var(--color-border-active);background:var(--color-surface-soft-panel);",
  ul: "margin: 6px 0;padding-left:26px",
  ol: "margin: 6px 0;padding-left:26px",
  li: "margin:0 0 6px;line-height:1.4",
  a: "color:var(--color-support-action);text-decoration:none"
} as const;

const articleHtml = computed(() => buildArticleHtml(props.html));

function buildArticleHtml(value: string) {
  return value
    .replace(/<p\b[^>]*>\s*(?:<br\s*\/?>)?\s*<\/p>/giu, "")
    .replace(/<(strong|b)\b[^>]*>/giu, '<span class="article-body__strong" style="font-weight:700">')
    .replace(/<\/(?:strong|b)>/giu, "</span>")
    .replace(/<u\b[^>]*>/giu, '<span class="article-body__underline" style="text-decoration:underline;text-underline-offset:4rpx">')
    .replace(/<\/u>/giu, "</span>")
    .replace(/<(p|h2|h3|blockquote|ul|ol|li|a)\b([^>]*)>/giu, (_matched, tag: keyof typeof blockStyleMap, attrs: string) => {
      const styleMatch = attrs.match(/\sstyle=(["'])(.*?)\1/iu);
      const tagStyle = blockStyleMap[tag];
      const nextAttrs = styleMatch
        ? attrs.replace(styleMatch[0], ` style=${styleMatch[1]}${styleMatch[2]};${tagStyle}${styleMatch[1]}`)
        : `${attrs} style="${tagStyle}"`;
      return `<${tag}${nextAttrs}>`;
    })
    .replace(/<img\b([^>]*)>/giu, (_matched, attrs: string) => {
      const styleMatch = attrs.match(/\sstyle=(["'])(.*?)\1/iu);
      const nextAttrs = styleMatch
        ? attrs.replace(styleMatch[0], ` style=${styleMatch[1]}${styleMatch[2]};${imageStyle}${styleMatch[1]}`)
        : `${attrs} style="${imageStyle}"`;
      return `<img${nextAttrs}>`;
    });
}
</script>

<template>
  <view class="article-body">
    <rich-text class="article-body__rich" :nodes="articleHtml" />
  </view>
</template>

<style scoped lang="scss">
.article-body {
  display: block;
  color: var(--color-text);
}

.article-body__rich {
  display: block;
  color: var(--color-text);
  font-size: 32rpx;
  line-height: 2;
}

.article-body__strong {
  font-weight: var(--font-weight-bold);
}

.article-body__underline {
  text-decoration: underline;
  text-underline-offset: 4rpx;
}
</style>
