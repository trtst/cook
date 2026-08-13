<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="餐次详情" full-screen>
    <view class="event-redirect">
      <text class="event-redirect__title">正在打开餐次详情…</text>
      <text class="event-redirect__desc">饭局相关信息已经收口到统一的全屏餐次详情页。</text>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { uniPlatform } from "@/platform/uni";

const pageStyle = usePageScrollStyle();

onLoad(query => {
  const planItemId = parseQueryText(query?.planItemId);
  const planDate = parseQueryText(query?.planDate);
  const eventId = parseQueryText(query?.eventId);
  const shouldCreate = !eventId && Boolean(planItemId);

  const params = [
    planItemId ? `planItemId=${encodeURIComponent(planItemId)}` : "",
    planDate ? `planDate=${encodeURIComponent(planDate)}` : "",
    eventId ? `eventId=${encodeURIComponent(eventId)}` : "",
    shouldCreate ? "mode=create-event" : ""
  ].filter(Boolean);

  const target = `/pages_meal/detail/index${params.length ? `?${params.join("&")}` : ""}`;
  void uniPlatform.navigation.redirectTo(target).catch(() => {
    void uniPlatform.navigation.navigateTo(target);
  });
});

function parseQueryText(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? decodeURIComponent(raw).trim() : "";
}
</script>

<style scoped lang="scss">
.event-redirect {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
  text-align: center;
}

.event-redirect__title {
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: 700;
}

.event-redirect__desc {
  margin-top: 16rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}
</style>
