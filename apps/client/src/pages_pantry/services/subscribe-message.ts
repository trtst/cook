/**
 * 食材分包订阅消息服务。
 *
 * 冰箱临期提醒订阅只由 `pages_pantry` 分包首页消费，
 * 放在分包内避免根 `services` 生成主包未使用文件。
 */
import { uniPlatform, type SubscribeMessageResult } from "@/platform/uni";

export const SUBSCRIBE_TEMPLATE_IDS = Object.freeze({
  fridgeExpiry: "aBwl_-hcLknlqzz22iRMvtFWep9ZvmTEoUy44lgnMHY"
});

export type SubscribeScene = keyof typeof SUBSCRIBE_TEMPLATE_IDS;
export type FridgeExpirySubscribeOutcome = "accepted" | "rejected" | "blocked" | "unsupported";

export function buildFridgeExpirySubscribeRequest() {
  return {
    scene: "fridgeExpiry" as const,
    templateIds: [SUBSCRIBE_TEMPLATE_IDS.fridgeExpiry]
  };
}

export function isSubscribeMessageAccepted(result: SubscribeMessageResult, templateId: string) {
  return result[templateId] === "accept";
}

export function resolveFridgeExpirySubscribeOutcome(result: SubscribeMessageResult): FridgeExpirySubscribeOutcome {
  const templateId = SUBSCRIBE_TEMPLATE_IDS.fridgeExpiry;
  const status = result[templateId];
  if (status === "accept") return "accepted";
  if (status === "reject") return "rejected";
  if (status === "ban") return "blocked";
  return "unsupported";
}

export async function requestFridgeExpirySubscribeMessage() {
  const request = buildFridgeExpirySubscribeRequest();
  return uniPlatform.subscription.requestSubscribeMessage(request.templateIds);
}
