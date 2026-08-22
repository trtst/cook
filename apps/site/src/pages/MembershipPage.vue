<template>
  <section class="membership-page">
    <header class="membership-page__hero">
      <div class="membership-page__hero-top">
        <img class="membership-page__hero-logo" :src="heroLogoSrc" alt="炊火记" />

        <div class="membership-page__hero-copy">
          <h1>会员权益对比</h1>
          <p class="membership-page__summary">Free / Plus / Pro 权益对照</p>
        </div>
      </div>
    </header>

    <section class="membership-table" aria-label="会员权益对比">
      <div class="membership-table__row membership-table__row--head">
        <div class="membership-table__cell membership-table__cell--label">权益</div>
        <div class="membership-table__cell membership-table__cell--free">Free</div>
        <div class="membership-table__cell membership-table__cell--plus">Plus</div>
        <div class="membership-table__cell membership-table__cell--pro">Pro</div>
      </div>

      <div
        v-for="item in benefitRows"
        :key="item.label"
        class="membership-table__row"
      >
        <div class="membership-table__cell membership-table__cell--label">{{ item.label }}</div>
        <div class="membership-table__cell membership-table__cell--free">{{ item.free }}</div>
        <div class="membership-table__cell membership-table__cell--plus">{{ item.plus }}</div>
        <div class="membership-table__cell membership-table__cell--pro">{{ item.pro }}</div>
      </div>
    </section>

    <footer class="membership-page__support">
      <p class="membership-page__support-label">客服时间</p>
      <p class="membership-page__support-value">工作日上午、下午</p>
    </footer>
  </section>
</template>

<script setup lang="ts">
import heroLogoSrc from "@/assets/img/assets-logo.png";

const benefitRows = [
  { label: "菜谱数量", free: "20", plus: "60", pro: "100" },
  { label: "逻辑空间", free: "50 MB", plus: "200 MB", pro: "500 MB" },
  { label: "图片质量", free: "50", plus: "70", pro: "80" },
  { label: "主题皮肤", free: "默认", plus: "基础", pro: "高级" },
  { label: "个性化展示", free: "无", plus: "基础", pro: "高级" },
  { label: "专属标识", free: "无", plus: "有", pro: "有" },
  { label: "客服响应", free: "无", plus: "标准响应", pro: "优先响应" },
  { label: "广告策略", free: "有", plus: "少频率", pro: "无" }
] as const;
</script>

<style scoped lang="scss">
.membership-page {
  --membership-hero-bg: rgba(249, 251, 247, 0.96);
  --membership-hero-border: rgba(62, 106, 79, 0.18);
  --membership-hero-border-soft: rgba(62, 106, 79, 0.1);
  --membership-hero-shadow: rgba(53, 62, 49, 0.12);
  --membership-blob-1: rgba(125, 179, 138, 0.24);
  --membership-blob-2: rgba(189, 219, 154, 0.26);
  --membership-title: var(--accent-strong);
  --membership-summary: var(--text-muted);
  --membership-table-bg: rgba(250, 252, 249, 0.97);
  --membership-table-border: rgba(62, 106, 79, 0.14);
  --membership-table-shadow: rgba(53, 62, 49, 0.12);
  --membership-table-top: rgba(125, 179, 138, 0.12);
  --membership-row-bg: rgba(255, 255, 255, 0.78);
  --membership-row-alt: rgba(245, 249, 245, 0.92);
  --membership-head-bg: rgba(239, 246, 240, 0.96);
  --membership-cell-text: var(--text);
  --membership-label-text: #27382d;
  --membership-head-text: rgba(62, 106, 79, 0.84);
  --membership-free-text: rgba(68, 76, 70, 0.9);
  --membership-free-bg: rgba(71, 78, 71, 0.08);
  --membership-plus-text: #3f624a;
  --membership-plus-bg: rgba(125, 179, 138, 0.14);
  --membership-pro-text: #2f5540;
  --membership-pro-bg: rgba(125, 179, 138, 0.26);
  --membership-pro-border: rgba(62, 106, 79, 0.2);
  --membership-pro-shadow: rgba(62, 106, 79, 0.12);
  width: min(1120px, calc(100% - 44px));
  margin: 0 auto;
  padding: calc(var(--site-header-height) + 18px) 0 64px;
}

:global(:root[data-theme="dark"]) .membership-page {
  --membership-hero-bg: rgba(24, 31, 27, 0.96);
  --membership-hero-border: rgba(204, 233, 201, 0.18);
  --membership-hero-border-soft: rgba(204, 233, 201, 0.1);
  --membership-hero-shadow: rgba(0, 0, 0, 0.26);
  --membership-blob-1: rgba(155, 204, 160, 0.2);
  --membership-blob-2: rgba(99, 140, 88, 0.24);
  --membership-title: var(--accent-strong);
  --membership-summary: var(--text-muted);
  --membership-table-bg: rgba(27, 35, 31, 0.96);
  --membership-table-border: rgba(204, 233, 201, 0.12);
  --membership-table-shadow: rgba(0, 0, 0, 0.26);
  --membership-table-top: rgba(155, 204, 160, 0.1);
  --membership-row-bg: rgba(30, 38, 33, 0.92);
  --membership-row-alt: rgba(24, 32, 27, 0.96);
  --membership-head-bg: rgba(33, 43, 37, 0.98);
  --membership-cell-text: var(--text);
  --membership-label-text: var(--text);
  --membership-head-text: rgba(204, 233, 201, 0.84);
  --membership-free-text: rgba(238, 246, 234, 0.76);
  --membership-free-bg: rgba(238, 246, 234, 0.06);
  --membership-plus-text: #c6e1c4;
  --membership-plus-bg: rgba(155, 204, 160, 0.12);
  --membership-pro-text: #eef6ea;
  --membership-pro-bg: rgba(155, 204, 160, 0.22);
  --membership-pro-border: rgba(204, 233, 201, 0.16);
  --membership-pro-shadow: rgba(0, 0, 0, 0.22);
}

.membership-page__hero {
  position: relative;
  display: block;
  padding: 28px 28px 20px;
  border: 1px solid var(--membership-hero-border);
  border-bottom-color: var(--membership-hero-border-soft);
  border-radius: 28px 28px 0 0;
  background: var(--membership-hero-bg);
  box-shadow:
    0 18px 40px var(--membership-hero-shadow),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
  overflow: hidden;
}

.membership-page__hero::before,
.membership-page__hero::after {
  content: "";
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
  filter: blur(2px);
}

.membership-page__hero::before {
  top: -34px;
  right: -26px;
  width: 280px;
  height: 220px;
  background: var(--membership-blob-1);
  opacity: 0.92;
}

.membership-page__hero::after {
  top: -72px;
  right: 120px;
  width: 240px;
  height: 180px;
  background: var(--membership-blob-2);
  opacity: 0.78;
}

.membership-page__hero-copy {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 6px;
}

.membership-page__hero-top {
  position: relative;
  z-index: 1;
}

.membership-page__hero-logo {
  display: none;
}

.membership-page__hero h1 {
  margin: 0;
  color: var(--membership-title);
  font-family: var(--font-display);
  font-size: clamp(30px, 4vw, 48px);
  line-height: 0.98;
  letter-spacing: -0.05em;
}

.membership-page__summary {
  margin: 0;
  color: var(--membership-summary);
  font-size: 14px;
  line-height: 1.5;
}

.membership-table {
  overflow: hidden;
  margin-top: -1px;
  position: relative;
  border: 1px solid var(--membership-table-border);
  border-top: 0;
  border-radius: 0 0 28px 28px;
  background: var(--membership-table-bg);
  box-shadow:
    0 24px 52px var(--membership-table-shadow),
    inset 0 1px 0 rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(14px) saturate(112%);
  -webkit-backdrop-filter: blur(14px) saturate(112%);
}

.membership-table::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 112px;
  background: var(--membership-table-top);
  pointer-events: none;
}

.membership-page__support {
  display: grid;
  gap: 4px;
  padding: 16px 8px 0;
}

.membership-page__support-label,
.membership-page__support-value {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}

.membership-page__support-label {
  color: var(--text-muted);
}

.membership-page__support-value {
  color: var(--text);
}

.membership-table__row {
  display: grid;
  grid-template-columns: minmax(220px, 1.2fr) repeat(3, minmax(0, 1fr));
  position: relative;
  background: var(--membership-row-bg);
}

.membership-table__row:nth-child(even) {
  background: var(--membership-row-alt);
}

.membership-table__row:last-child {
  border-bottom: 0;
}

.membership-table__row--head {
  background: var(--membership-head-bg);
}

.membership-table__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 58px;
  padding: 12px 14px;
  color: var(--membership-cell-text);
  font-size: 15px;
  line-height: 1.4;
  text-align: center;
  word-break: break-word;
  position: relative;
  z-index: 1;
}

.membership-table__cell:last-child {
  border-right: 0;
}

.membership-table__cell--label {
  justify-content: flex-start;
  font-weight: 700;
  text-align: left;
  color: var(--membership-label-text);
}

.membership-table__row--head .membership-table__cell {
  min-height: 70px;
  color: var(--membership-head-text);
  font-size: 14px;
  font-weight: 700;
}

.membership-table__cell--free {
  color: var(--membership-free-text);
  background: var(--membership-free-bg);
}

.membership-table__cell--plus {
  color: var(--membership-plus-text);
  background: var(--membership-plus-bg);
}

.membership-table__cell--pro {
  color: var(--membership-pro-text);
  font-weight: 700;
  background: var(--membership-pro-bg);
  border-left: 1px solid var(--membership-pro-border);
  border-right: 1px solid var(--membership-pro-border);
  box-shadow:
    inset 1px 0 0 rgba(255, 255, 255, 0.42),
    inset -1px 0 0 rgba(255, 255, 255, 0.12);
  z-index: 2;
}

.membership-table__row--head .membership-table__cell--pro {
  color: var(--membership-pro-text);
  font-size: 15px;
  letter-spacing: 0.01em;
  box-shadow:
    0 14px 28px var(--membership-pro-shadow),
    inset 1px 0 0 rgba(255, 255, 255, 0.42),
    inset -1px 0 0 rgba(255, 255, 255, 0.12);
}

.membership-table__row:last-child .membership-table__cell--pro {
  box-shadow:
    0 16px 32px var(--membership-pro-shadow),
    inset 1px 0 0 rgba(255, 255, 255, 0.42),
    inset -1px 0 0 rgba(255, 255, 255, 0.12);
}

@media (max-width: 768px) {
  .membership-page {
    width: 100%;
    min-height: 100dvh;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .membership-page__hero {
    padding: 18px 16px 14px;
    border-radius: 0;
    border: 0;
  }

  .membership-page__hero-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .membership-page__hero-logo {
    display: block;
    width: 116px;
    max-width: 34vw;
    height: auto;
    flex: 0 0 auto;
    object-fit: contain;
  }

  .membership-page__hero::before {
    top: -12px;
    right: -64px;
    width: 200px;
    height: 148px;
  }

  .membership-page__hero::after {
    top: -42px;
    right: 48px;
    width: 144px;
    height: 112px;
  }

  .membership-page__hero-copy {
    margin-left: auto;
    text-align: right;
  }

  .membership-page__hero h1 {
    font-size: clamp(28px, 8vw, 38px);
  }

  .membership-page__summary {
    font-size: 13px;
  }

  .membership-table {
    overflow-x: auto;
    border-radius: 0;
    border: 0;
    flex: 1;
        display: flex;
        flex-direction: column;
  }

  .membership-page__support {
    display: none;
  }

  .membership-table__row {
    flex: 1;
    grid-template-columns: minmax(90px, 1fr) repeat(3, minmax(60px, 1fr));
  }

  .membership-table__cell {
    min-height: 46px;
    padding: 8px 6px;
    font-size: 12px;
    line-height: 1.3;
  }

  .membership-table__row--head .membership-table__cell {
    min-height: 48px;
    font-size: 12px;
  }
}
</style>
