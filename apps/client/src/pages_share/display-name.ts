import type { MeResponse } from "@/apis/user";

export function resolveShareGuestName(profile: MeResponse | null, uid: number) {
  const nickname = profile?.nickname?.trim() || "";
  if (nickname) return nickname;
  if (uid > 0) return `用户 ${uid}`;
  return "你";
}
