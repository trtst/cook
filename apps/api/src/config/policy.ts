/**
 * 配置中心尚未接入时的最小安全默认值。
 * 后续服务端配置只能在安全上限内覆盖，业务模块不得散落相同数字。
 */
export const safePolicy = {
  memberLimit: 2,
  inviteExpiresMs: 24 * 60 * 60 * 1000,
  snapshotDays: 15,
  recipeLimit: {
    personal: 50,
    diningGroup: 120
  },
  storageLimitBytes: {
    personal: 100 * 1024 * 1024,
    diningGroup: 300 * 1024 * 1024
  },
  image: {
    quality: 50,
    maxWidth: 750,
    maxHeight: 1500,
    maxOutputBytes: 400 * 1024,
    maxInputBytes: 20 * 1024 * 1024
  }
} as const;
