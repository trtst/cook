import type { SessionUserSnapshot } from "@/stores/session";

export function resolveShareGuestName(user: SessionUserSnapshot | null, uid: number) {
  const nickname = user?.nickname?.trim() || "";
  if (nickname) return nickname;
  if (uid > 0) return `用户 ${uid}`;
  return "你";
}
