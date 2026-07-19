<template>
  <section class="page-stack">
    <div class="summary-grid">
      <div class="metric-panel">
        <span class="metric-label">当前阶段</span>
        <strong>后台基础壳</strong>
      </div>
      <div class="metric-panel">
        <span class="metric-label">已接接口</span>
        <strong>3</strong>
      </div>
      <div class="metric-panel">
        <span class="metric-label">下一主链路</span>
        <strong>菜谱导入</strong>
      </div>
    </div>

    <div class="work-panel">
      <div class="panel-heading">
        <h2>业务入口</h2>
      </div>
      <div class="entry-grid">
        <router-link to="/users" class="entry-item">用户查询</router-link>
        <router-link to="/dining-groups" class="entry-item">饭搭子查询</router-link>
      </div>
    </div>
  </section>
</template>
