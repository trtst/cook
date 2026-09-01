import { userApi, type NotificationBadgeResponse } from "@/apis/user";
import { uniPlatform } from "@/platform/uni";
import { ref } from "vue";

export type NotificationBadgeSnapshot = NotificationBadgeResponse;

const NOTIFICATION_BADGE_KEY = "cook_meal_notification_badge_v1";

export const EMPTY_BADGE_SNAPSHOT: NotificationBadgeSnapshot = {
  unreadCount: 0,
  reminderUnreadCount: 0,
  showReminderDot: false,
  latestTime: ""
};

export const notificationBadgeState = ref<NotificationBadgeSnapshot>(EMPTY_BADGE_SNAPSHOT);

export function readNotificationBadgeSnapshot() {
  const snapshot = uniPlatform.storage.getSync<NotificationBadgeSnapshot>(NOTIFICATION_BADGE_KEY) ?? EMPTY_BADGE_SNAPSHOT;
  notificationBadgeState.value = snapshot;
  return snapshot;
}

export function writeNotificationBadgeSnapshot(snapshot: NotificationBadgeSnapshot) {
  uniPlatform.storage.setSync(NOTIFICATION_BADGE_KEY, snapshot);
  notificationBadgeState.value = snapshot;
}

export function clearNotificationBadgeSnapshot() {
  uniPlatform.storage.removeSync(NOTIFICATION_BADGE_KEY);
  notificationBadgeState.value = EMPTY_BADGE_SNAPSHOT;
}

export async function refreshNotificationBadgeSnapshot() {
  const snapshot = await userApi.getNotificationBadge();
  writeNotificationBadgeSnapshot(snapshot);
  return snapshot;
}

export async function markNotificationFeedRead() {
  const snapshot = await userApi.markNotificationFeedRead();
  writeNotificationBadgeSnapshot(snapshot);
  return snapshot;
}
