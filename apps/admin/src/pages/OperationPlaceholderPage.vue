<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();

const pageMeta = computed(() => {
  const pageType = typeof route.meta.operationPage === "string" ? route.meta.operationPage : "";
  if (pageType === "site-home") {
    return {
      title: "官网首页",
      description: "这里预留给官网首页的运营配置。后续建议单独管理 Hero、主叙事区块、CTA 和专题入口，不和小程序首页共用同一套字段。",
      scope: "建议后续独立承接官网首页 section、文案和专题位。"
    };
  }

  if (pageType === "pre-meal") {
    return {
      title: "餐前准备",
      description: "这里预留给餐前准备类运营内容。后续更适合做成专题列表、活动合集或内容流，不建议并入首页卡位配置。",
      scope: "建议后续独立承接周末食谱、备菜清单、采购提醒等内容。"
    };
  }

  return {
    title: "厨房知识",
    description: "这里预留给厨房知识类运营内容。后续更适合做成专题内容、知识栏目或外链聚合入口，不建议和首页入口配置混编。",
    scope: "建议后续独立承接技巧专题、器具知识、烹饪知识等内容。"
  };
});
</script>

<template>
  <section class="page-stack">
    <div class="table-panel placeholder-panel">
      <div class="placeholder-panel__copy">
        <h3>{{ pageMeta.title }}</h3>
        <p>{{ pageMeta.description }}</p>
      </div>

      <div class="placeholder-panel__note">
        <span class="placeholder-panel__tag">结构已预留</span>
        <p>{{ pageMeta.scope }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.placeholder-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.placeholder-panel__copy h3 {
  margin: 0 0 8px;
  color: #111827;
  font-size: 22px;
}

.placeholder-panel__copy p,
.placeholder-panel__note p {
  margin: 0;
  color: #6b7280;
  line-height: 1.7;
}

.placeholder-panel__note {
  padding: 18px 20px;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: linear-gradient(180deg, #fffdf8, #f7f9f7);
}

.placeholder-panel__tag {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: #eef5ef;
  color: #2f6f4e;
  font-size: 12px;
  line-height: 1;
  margin-bottom: 12px;
}
</style>
