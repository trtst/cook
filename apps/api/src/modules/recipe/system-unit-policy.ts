import { buildSearchKey } from "./recipe-content";

export const allowedSystemUnitNames = ["克", "千克", "毫升", "升", "个", "瓣", "包", "盒", "瓶", "罐", "汤匙"] as const;

export const allowedSystemUnitSearchKeys = allowedSystemUnitNames.map(item => buildSearchKey(item));

const allowedSystemUnitSearchKeySet = new Set<string>(allowedSystemUnitSearchKeys);

export function isAllowedSystemUnitSearchKey(searchKey: string) {
  return allowedSystemUnitSearchKeySet.has(searchKey);
}
