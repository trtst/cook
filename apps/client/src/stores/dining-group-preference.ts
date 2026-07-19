import type { UUID } from "@next-meal/api-client";
import { uniPlatform } from "@/platform/uni";

const CURRENT_DINING_GROUP_STORAGE_KEY = "next_meal_current_dining_group_id";

export function getCurrentDiningGroupPreference() {
  return uniPlatform.storage.get<UUID>(CURRENT_DINING_GROUP_STORAGE_KEY);
}

export function setCurrentDiningGroupPreference(diningGroupId: UUID) {
  return uniPlatform.storage.set(CURRENT_DINING_GROUP_STORAGE_KEY, diningGroupId);
}

export function clearCurrentDiningGroupPreference() {
  return uniPlatform.storage.remove(CURRENT_DINING_GROUP_STORAGE_KEY);
}
