const mb = 1024 * 1024;
const gb = 1024 * mb;

/** 当前已冻结的服务端策略目录；扩大权限前必须更新契约并经过配置审计。 */
export const policy = {
  version: 1,
  memberLimit: {
    FREE: 2,
    PLUS: 6
  },
  recipeLimit: {
    USER: { FREE: 50, PLUS: 150 },
    DINING_GROUP: { FREE: 120, PLUS: 350 }
  },
  storageLimitBytes: {
    USER: { FREE: 100 * mb, PLUS: 500 * mb },
    DINING_GROUP: { FREE: 300 * mb, PLUS: 2 * gb }
  },
  snapshotDays: {
    FREE: 15,
    PLUS: 30
  },
  recycleDays: {
    FREE: 0,
    PLUS: 7
  },
  variantLimit: {
    FREE: 0,
    PLUS: 2
  },
  image: {
    FREE: {
      quality: 50,
      maxWidth: 750,
      maxHeight: 1500,
      maxOutputBytes: 400 * 1024,
      maxInputBytes: 20 * mb
    },
    PLUS: {
      quality: 80,
      maxWidth: 1125,
      maxHeight: 2250,
      maxOutputBytes: mb,
      maxInputBytes: 20 * mb
    }
  },
  inviteExpiresMs: 24 * 60 * 60 * 1000
} as const;
