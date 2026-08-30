export const WECHAT_SUBSCRIBE_TEMPLATE_IDS = Object.freeze({
  fridgeExpiry: "aBwl_-hcLknlqzz22iRMvtFWep9ZvmTEoUy44lgnMHY"
});

export interface SubscribeMessagePayload {
  touser: string;
  templateId: string;
  page: string;
  data: Record<string, { value: string }>;
}

export interface FridgeExpiryReminderInput {
  openid: string;
  ingredientName: string;
  expireAt: string;
  daysLeft: number;
  storedDays: number;
  tipText: string;
  pagePath: string;
}

function toDateText(value: string) {
  return value.slice(0, 10);
}

export function buildFridgeExpiryReminderMessage(input: FridgeExpiryReminderInput): SubscribeMessagePayload {
  return {
    touser: input.openid,
    templateId: WECHAT_SUBSCRIBE_TEMPLATE_IDS.fridgeExpiry,
    page: input.pagePath,
    data: {
      thing1: { value: input.ingredientName },
      date2: { value: toDateText(input.expireAt) },
      number5: { value: String(input.daysLeft) },
      number12: { value: String(input.storedDays) },
      thing8: { value: input.tipText }
    }
  };
}
