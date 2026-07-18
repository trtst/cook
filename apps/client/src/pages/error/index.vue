<template>
  <Layout title="出错了">
    <text class="title">页面暂时不可用</text>
    <text class="description">请返回上一页后重试。</text>
  </Layout>
</template>


<style scoped lang="scss">
.title {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.description {
  display: block;
  margin-top: var(--space-sm);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-md);
}
</style>
