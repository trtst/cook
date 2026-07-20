export type EntitlementTier = "FREE" | "PLUS";

export type EntitlementScope = "USER" | "DINING_GROUP";

/** 空间账本的固定模块维度。 */
export type StorageModule =
  | "RECIPE"
  | "FRIDGE"
  | "MEAL"
  | "SHOPPING"
  | "MEAL_GUEST"
  | "TECHNICAL_SNAPSHOT"
  | "RECYCLE_BIN";
