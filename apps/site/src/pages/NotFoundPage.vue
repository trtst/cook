<template>
  <div class="not-found">
    <p class="not-found__label">404</p>
    <h1>这页内容还没准备好。</h1>
    <p>你可以先回到首页，或者看看关于我们与常见问题。</p>
    <div class="not-found__actions">
      <RouterLink class="primary-link" to="/">返回首页</RouterLink>
      <RouterLink class="ghost-link" to="/faq">常见问题</RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>
