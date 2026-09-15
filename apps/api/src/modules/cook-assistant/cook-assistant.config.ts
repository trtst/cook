import type { IsoDateTime } from "../../contracts/types";

export type CookAssistantActivityConfig = {
  activityEnabled: boolean;
  startsAt: IsoDateTime | null;
  endsAt: IsoDateTime | null;
  timeZone: string;
  dailyUnlockLimit: number;
  tipText: string;
};

export const cookAssistantActivityConfig: CookAssistantActivityConfig = {
  activityEnabled: true,
  startsAt: null,
  endsAt: null,
  timeZone: "Asia/Shanghai",
  dailyUnlockLimit: 2,
  tipText: "活动期间，免费生成，每天 2 次，当日有效"
};
