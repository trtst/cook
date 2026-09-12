export function toOwnerNicknameSnapshot(nickname: string | null | undefined) {
  return nickname?.trim() || null;
}
