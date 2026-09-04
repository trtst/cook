<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" :title="pageTitle" full-screen :navbar-placeholder="false" navbar-transparent>
    <view class="profile-field" :style="pageBodyStyle">
      <template v-if="fieldType === 'gender'">
        <view class="profile-field__panel">
          <view
            v-for="item in genderOptions"
            :key="item.value"
            class="profile-field__option"
            @click="genderDraft = item.value"
          >
            <text class="profile-field__option-text">{{ item.label }}</text>
            <text v-if="genderDraft === item.value" class="cookfont icon-select-on profile-field__check" />
          </view>
        </view>
      </template>

      <template v-else-if="fieldType === 'birthDate'">
        <view class="profile-field__panel">
          <view class="profile-field__date-input" @click="calendarOpen = true">
            <text>{{ selectedDate }}</text>
          </view>
        </view>
        <view v-if="calendarOpen" class="profile-field__calendar">
          <MealMonthCalendar
            :selected-date="selectedDate"
            :month-date="monthDate"
            :max-date="todayText()"
            :enable-view-switch="true"
            @select="handleDateSelect"
            @month-change="monthDate = monthAnchor($event)"
          />
        </view>
      </template>

      <template v-else>
        <view class="profile-field__panel">
          <textarea
            v-if="fieldType === 'bio'"
            v-model="textDraft"
            class="profile-field__textarea"
            maxlength="80"
            placeholder="写几句介绍自己"
          />
          <input
            v-else
            v-model="textDraft"
            class="profile-field__input"
            :maxlength="fieldType === 'nickname' ? 24 : 20"
            :placeholder="inputPlaceholder"
          />
          <text v-if="fieldType !== 'bio'" class="profile-field__tip">{{ ruleText }}</text>
          <text class="profile-field__count">{{ textDraft.length }}/{{ maxLength }}</text>
        </view>
      </template>

      <button class="profile-field__confirm" :loading="saving" :disabled="saving" @click="saveField">
        确定
      </button>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { userApi, type MeResponse, type UserGender } from "@/apis/user";
import Layout from "@/components/Layout/Layout.vue";
import MealMonthCalendar from "@/components/MealMonthCalendar.vue";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { useTheme } from "@/composables/useTheme";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { parseDateOnly, todayText } from "@/utils/date";

type ProfileFieldType = "nickname" | "cookNo" | "bio" | "gender" | "birthDate";

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();
const userStore = useUserStore();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const pageBodyStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + 24}px`
}));

const fieldType = ref<ProfileFieldType>("nickname");
const textDraft = ref("");
const genderDraft = ref<UserGender>("UNSPECIFIED");
const selectedDate = ref(todayText());
const monthDate = ref(monthAnchor(todayText()));
const calendarOpen = ref(false);
const saving = ref(false);

const genderOptions = [
  { value: "MALE" as const, label: "男" },
  { value: "FEMALE" as const, label: "女" },
  { value: "UNSPECIFIED" as const, label: "不透露" }
];
const pageTitle = computed(() => {
  if (fieldType.value === "nickname") return "编辑名字";
  if (fieldType.value === "cookNo") return "编辑炊火号";
  if (fieldType.value === "bio") return "编辑简介";
  if (fieldType.value === "gender") return "编辑性别";
  return "编辑生日";
});
const maxLength = computed(() => (fieldType.value === "bio" ? 80 : fieldType.value === "cookNo" ? 20 : 24));
const inputPlaceholder = computed(() => (fieldType.value === "cookNo" ? "请输入炊火号" : "请输入名字"));
const ruleText = computed(() => {
  if (fieldType.value === "nickname") return "请设置 2-24 个字符，不包括 @<>/ 等无效字符。";
  if (fieldType.value === "cookNo") return "炊火号为 5-20 位，仅支持字母、数字和下划线。只能设置一次，请谨慎修改。";
  return "最多 80 个字符。";
});

onLoad((query) => {
  const type = String(query?.type || "");
  if (["nickname", "cookNo", "bio", "gender", "birthDate"].includes(type)) {
    fieldType.value = type as ProfileFieldType;
  }
  fillDraft();
});

function fillDraft() {
  const profile = userStore.profile?.profile;
  if (fieldType.value === "nickname") textDraft.value = sessionStore.user?.nickname || "";
  if (fieldType.value === "cookNo") textDraft.value = profile?.cookNo || "";
  if (fieldType.value === "bio") textDraft.value = profile?.bio || "";
  if (fieldType.value === "gender") genderDraft.value = profile?.gender || "UNSPECIFIED";
  if (fieldType.value === "birthDate") {
    selectedDate.value = profile?.birthDate || todayText();
    monthDate.value = monthAnchor(selectedDate.value);
  }
}

function monthAnchor(dateText: string) {
  const date = parseDateOnly(dateText);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}-01`;
}

async function handleDateSelect(nextDate: string) {
  if (nextDate > todayText()) return;
  selectedDate.value = nextDate;
  if (ageOf(nextDate) <= 14) {
    await uniPlatform.feedback.confirm({
      title: "未满14岁需实名认证",
      content: "您填写的年龄未满15岁，需在监护人的指导下完成实名认证。",
      confirmText: "重新选择"
    });
  }
}

function ageOf(dateText: string) {
  const birthDate = parseDateOnly(dateText);
  const today = parseDateOnly(todayText());
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

async function saveField() {
  if (saving.value) return;
  const body = fieldPayload();
  if (!body) return;
  if (fieldType.value === "cookNo" && !(await confirmCookNoChange())) return;
  saving.value = true;
  try {
    const nextProfile = await userApi.updateCurrent(body);
    userStore.setProfile(nextProfile, sessionStore.uid);
    if (fieldType.value === "nickname" && sessionStore.user) {
      await sessionStore.setSession({
        accessToken: sessionStore.accessToken,
        refreshToken: sessionStore.refreshToken,
        uid: sessionStore.uid,
        user: { ...sessionStore.user, nickname: textDraft.value.trim() },
        expiresAt: sessionStore.expiresAt,
        refreshExpiresAt: sessionStore.refreshExpiresAt,
        refreshCheckedAt: sessionStore.refreshCheckedAt
      });
    }
    await uniPlatform.feedback.toast({ title: "已保存", icon: "success" });
    await uniPlatform.navigation.navigateBack();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "保存失败", icon: "none" });
  } finally {
    saving.value = false;
  }
}

function fieldPayload() {
  const value = textDraft.value.trim();
  if (fieldType.value === "nickname") {
    if (value.length < 2) return toastAndNull("名字至少 2 个字符");
    if (/[@<>/]/.test(value)) return toastAndNull("名字包含无效字符");
    return { nickname: value };
  }
  if (fieldType.value === "cookNo") {
    if (!/^[A-Za-z0-9_]{5,20}$/.test(value)) return toastAndNull("炊火号格式不正确");
    return { cookNo: value };
  }
  if (fieldType.value === "bio") return { bio: value || null };
  if (fieldType.value === "gender") return { gender: genderDraft.value };
  if (ageOf(selectedDate.value) <= 14) {
    void uniPlatform.feedback.confirm({
      title: "未满14岁需实名认证",
      content: "您填写的年龄未满15岁，需在监护人的指导下完成实名认证。",
      confirmText: "重新选择"
    });
    return null;
  }
  return { birthDate: selectedDate.value };
}

function toastAndNull(title: string) {
  void uniPlatform.feedback.toast({ title, icon: "none" });
  return null;
}

function confirmCookNoChange() {
  return uniPlatform.feedback.confirm({
    title: "确认设置炊火号",
    content: "炊火号只能设置一次，确认后不可再次修改。",
    confirmText: "确认",
    cancelText: "取消"
  });
}
</script>

<style scoped lang="scss">
.profile-field {
  box-sizing: border-box;
  height: 100%;
  padding-right: var(--space-page);
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
  padding-left: var(--space-page);
  background: var(--page-primary-soft-bg);
}

.profile-field__panel {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
}

.profile-field__input {
  box-sizing: border-box;
  width: 100%;
  height: 102rpx;
  padding: 0 104rpx 0 28rpx;
  color: var(--color-text);
  font-size: 32rpx;
}

.profile-field__textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 220rpx;
  padding: 28rpx 28rpx 72rpx;
  color: var(--color-text);
  font-size: 30rpx;
  line-height: 1.6;
}

.profile-field__count {
  position: absolute;
  right: 28rpx;
  bottom: 24rpx;
  pointer-events: none;
  color: var(--color-text-tertiary);
  font-size: 26rpx;
}

.profile-field__tip {
  display: block;
  padding: 0 28rpx 28rpx;
  color: var(--color-text-tertiary);
  font-size: 26rpx;
  line-height: 1.6;
}

.profile-field__confirm {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 92rpx;
  margin-top: 36rpx;
  border-radius: var(--radius-pill);
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  font-size: 30rpx;
  font-weight: 700;
}

.profile-field__confirm::after {
  border: 0;
}

.profile-field__option,
.profile-field__date-input {
  display: flex;
  align-items: center;
  min-height: 100rpx;
  padding: 0 28rpx;
}

.profile-field__option + .profile-field__option {
  border-top: 1rpx solid var(--color-divider);
}

.profile-field__option-text {
  flex: 1;
  color: var(--color-text);
  font-size: 30rpx;
}

.profile-field__check {
  color: var(--color-primary);
  font-size: 34rpx;
}

.profile-field__date-input {
  color: var(--color-text);
  font-size: 32rpx;
}

.profile-field__calendar {
  margin-top: 24rpx;
  padding: 24rpx;
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
}
</style>
