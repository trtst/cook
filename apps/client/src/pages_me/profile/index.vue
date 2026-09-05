<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="编辑资料" full-screen :navbar-placeholder="false" navbar-transparent>
    <scroll-view class="profile-edit" scroll-y :style="pageBodyStyle">
      <view class="profile-edit__avatar-wrap" @click="selectAvatar">
        <view class="profile-edit__avatar" hover-class="is-pressed" hover-stay-time="100">
          <image v-if="avatarUrl" class="profile-edit__avatar-image" :src="avatarUrl" mode="aspectFill" />
          <text v-else class="profile-edit__avatar-text">{{ avatarText }}</text>
          <view class="profile-edit__camera">
            <text class="cookfont icon-profile-camera profile-edit__camera-icon" />
          </view>
        </view>
      </view>

      <view class="profile-edit__panel">
        <view
          v-for="item in fields"
          :key="item.type"
          class="profile-edit__row"
          hover-class="is-pressed"
          hover-stay-time="100"
          @click="openField(item.type)"
        >
          <text class="profile-edit__label">{{ item.label }}</text>
          <text class="profile-edit__value" :class="{ 'profile-edit__value--empty': !item.value }">{{ item.value || item.placeholder }}</text>
          <text class="profile-edit__arrow cookfont icon-back" />
        </view>
      </view>
    </scroll-view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, nextTick } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { userApi, type MeResponse } from "@/apis/user";
import Layout from "@/components/Layout/Layout.vue";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { useTheme } from "@/composables/useTheme";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { createOperationId } from "@/utils/operation-id";
import { useImageCropFlow } from "../composables/useImageCropFlow";
import { imageCropPresets, type ImageCropResult } from "../utils/image-crop";

type ProfileFieldType = "nickname" | "cookNo" | "bio" | "gender" | "birthDate";

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();
const userStore = useUserStore();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const pageBodyStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + 20}px`
}));

const avatarUrl = computed(() => sessionStore.user?.avatarUrl || userStore.profile?.avatarUrl || "");
const nickname = computed(() => sessionStore.user?.nickname || "炊火记用户");
const avatarText = computed(() => nickname.value.trim().slice(0, 1) || "我");
const profile = computed(() => userStore.profile?.profile ?? null);
const cookNoLocked = computed(() => {
  const cookNo = profile.value?.cookNo?.trim();
  return Boolean(cookNo && cookNo !== String(sessionStore.uid));
});
const fields = computed(() => [
  { type: "nickname" as const, label: "名字", value: nickname.value, placeholder: "设置名字" },
  { type: "cookNo" as const, label: "炊火号", value: profile.value?.cookNo || "", placeholder: "设置炊火号" },
  { type: "bio" as const, label: "简介", value: profile.value?.bio || "", placeholder: "设置简介" },
  { type: "gender" as const, label: "性别", value: genderText(profile.value?.gender ?? null), placeholder: "设置性别" },
  { type: "birthDate" as const, label: "生日", value: profile.value?.birthDate || "", placeholder: "设置生日" }
]);

const { queueCrop, consumeCropResult } = useImageCropFlow<"avatar">({
  tokenPrefix: "profile-avatar",
  async onApply(result: ImageCropResult) {
    if (!result.croppedPath) return;
    await uploadAvatar(result.croppedPath);
  },
  async onOpenError(error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "打开裁剪失败", icon: "none" });
  }
});

onShow(() => {
  void consumeCropResult();
});

function genderText(value: MeResponse["profile"]["gender"]) {
  if (value === "MALE") return "男";
  if (value === "FEMALE") return "女";
  if (value === "UNSPECIFIED") return "不透露";
  return "";
}

function openField(type: ProfileFieldType) {
  if (type === "cookNo" && cookNoLocked.value) {
    void uniPlatform.feedback.toast({ title: "炊火号是账号的唯一凭证，只能修改一次。", icon: "none" });
    return;
  }
  void uniPlatform.navigation.navigateTo(`/pages_me/profile-field/index?type=${type}`);
}

async function selectAvatar() {
  try {
    const [file] = await uniPlatform.media.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"]
    });
    if (!file?.path) return;
    queueCrop({
      sourcePath: file.path,
      policy: imageCropPresets.profileAvatar,
      target: "avatar"
    });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "选择头像失败", icon: "none" });
  }
}

async function uploadAvatar(filePath: string) {
  try {
    const nextAvatar = await userApi.uploadCurrentAvatar({
      filePath,
      operationId: createOperationId()
    });
    userStore.patchProfile({ avatarUrl: nextAvatar.avatarUrl }, sessionStore.uid);
    if (sessionStore.user) {
      await sessionStore.setSession({
        accessToken: sessionStore.accessToken,
        refreshToken: sessionStore.refreshToken,
        uid: sessionStore.uid,
        user: { ...sessionStore.user, avatarUrl: nextAvatar.avatarUrl },
        expiresAt: sessionStore.expiresAt,
        refreshExpiresAt: sessionStore.refreshExpiresAt,
        refreshCheckedAt: sessionStore.refreshCheckedAt
      });
    }
    await nextTick();
    await uniPlatform.feedback.toast({ title: "头像已更新", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "头像上传失败", icon: "none" });
  }
}
</script>

<style scoped lang="scss">
.profile-edit {
  box-sizing: border-box;
  height: 100%;
  padding-right: var(--space-page);
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
  padding-left: var(--space-page);
  background: var(--page-primary-soft-bg);
}

.profile-edit__avatar-wrap {
  display: flex;
  justify-content: center;
  padding: 34rpx 0 48rpx;
}

.profile-edit__avatar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 156rpx;
  height: 156rpx;
  border-radius: 50%;
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
}

.profile-edit__avatar-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.profile-edit__avatar-text {
  color: var(--color-primary);
  font-size: 54rpx;
  font-weight: 800;
}

.profile-edit__camera {
  position: absolute;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50rpx;
  height: 50rpx;
  border: 4rpx solid var(--material-card-bg);
  border-radius: 50%;
  background: var(--color-text);
}

.profile-edit__camera-icon {
  color: var(--color-page);
  font-size: 28rpx;
}

.profile-edit__panel {
  overflow: hidden;
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.profile-edit__row {
  display: flex;
  align-items: center;
  min-height: 100rpx;
  padding: 0 26rpx;
}

.profile-edit__row + .profile-edit__row {
  border-top: 1rpx solid var(--color-divider);
}

.profile-edit__label {
  flex: 0 0 140rpx;
  color: var(--color-text-secondary);
  font-size: 30rpx;
}

.profile-edit__value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--color-text);
  font-size: 30rpx;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-edit__value--empty {
  color: var(--color-text-tertiary);
}

.profile-edit__arrow {
  margin-left: 12rpx;
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  transform: rotate(180deg);
}
</style>
