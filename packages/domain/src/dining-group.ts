export type DiningGroupRole = "OWNER" | "ADMIN" | "MEMBER";

export type DiningGroupStatus = "ACTIVE" | "FROZEN" | "ARCHIVED";

export type LongTermMemberStatus = "ACTIVE" | "RESTRICTED" | "ENDED";

export type LongTermMemberStatusReason = "LEFT" | "REMOVED" | "GROUP_DOWNGRADED" | "GROUP_DISSOLVED";

export type DiningGroupInviteStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED" | "EXPIRED";

export type OriginalSpaceStatus = "ACTIVE" | "FROZEN";

export type CarryBackSnapshotStatus = "AVAILABLE" | "EXPIRED" | "DELETED" | "INVALIDATED";

/** 当前空间的服务端判定状态，客户端不得自行合并权益后推导。 */
export type SpaceState = "NORMAL" | "OVER_RECIPE_LIMIT" | "OVER_STORAGE_READONLY";

export type ImportableItemType = "RECIPE" | "FRIDGE_ITEM" | "PLAN_DRAFT" | "SHOPPING_ITEM";

export type DuplicateState = "NONE" | "EXACT" | "SIMILAR";
