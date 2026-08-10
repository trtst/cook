const mb = 1024 * 1024;
const gb = 1024 * mb;

/** 当前已冻结的服务端策略目录；扩大权限前必须更新契约并经过配置审计。 */
export const policy = {
  version: 1,
  inviteLimit: {
    FREE: 1,
    PLUS: 3,
    PRO: 5,
    ULTRA: 10
  },
  joinLimit: {
    FREE: 1,
    PLUS: 2,
    PRO: 4,
    ULTRA: 6
  },
  memberLimit: {
    FREE: 2,
    PLUS: 4,
    PRO: 6,
    ULTRA: 11
  },
  shoppingListMemberLimit: {
    FREE: 2,
    PLUS: 4,
    PRO: 6,
    ULTRA: 11
  },
  shoppingListInviteMessageDays: {
    FREE: 7,
    PLUS: 7,
    PRO: 7,
    ULTRA: 7
  },
  recipeLimit: {
    FREE: 50,
    PLUS: 120,
    PRO: 200,
    ULTRA: 350
  },
  storageLimitBytes: {
    FREE: 100 * mb,
    PLUS: 300 * mb,
    PRO: 500 * mb,
    ULTRA: 2 * gb
  },
  recycleDays: {
    FREE: 0,
    PLUS: 3,
    PRO: 5,
    ULTRA: 7
  },
  variantLimit: {
    FREE: 0,
    PLUS: 1,
    PRO: 2,
    ULTRA: 3
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
      quality: 70,
      maxWidth: 900,
      maxHeight: 1800,
      maxOutputBytes: 700 * 1024,
      maxInputBytes: 20 * mb
    },
    PRO: {
      quality: 80,
      maxWidth: 1125,
      maxHeight: 2250,
      maxOutputBytes: mb,
      maxInputBytes: 20 * mb
    },
    ULTRA: {
      quality: 80,
      maxWidth: 1125,
      maxHeight: 2250,
      maxOutputBytes: mb,
      maxInputBytes: 20 * mb
    }
  },
  featureAccess: {
    myPageBackground: {
      FREE: false,
      PLUS: true,
      PRO: true,
      ULTRA: true
    },
    homePageBackground: {
      FREE: false,
      PLUS: false,
      PRO: true,
      ULTRA: true
    }
  },
  inviteExpiresMs: 24 * 60 * 60 * 1000
} as const;
