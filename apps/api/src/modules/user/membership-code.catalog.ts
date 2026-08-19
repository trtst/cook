import { type EntitlementTier, type MembershipCodeKind, type Prisma, type PrismaClient } from "@prisma/client";

export type MembershipSkuPresetCode =
  | "PLUS_30D"
  | "PRO_30D"
  | "PRO_TRIAL_1D"
  | "PRO_TRIAL_3D"
  | "PRO_TRIAL_7D";

export type MembershipSkuPreset = {
  code: MembershipSkuPresetCode;
  kind: MembershipCodeKind;
  tier: EntitlementTier;
  durationDays: number;
  redeemEnabled: boolean;
};

type MembershipSkuCatalogDb = Prisma.TransactionClient | PrismaClient;

export const membershipSkuPresets: MembershipSkuPreset[] = [
  {
    code: "PLUS_30D",
    kind: "FORMAL",
    tier: "PLUS",
    durationDays: 30,
    redeemEnabled: true
  },
  {
    code: "PRO_30D",
    kind: "FORMAL",
    tier: "PRO",
    durationDays: 30,
    redeemEnabled: true
  },
  {
    code: "PRO_TRIAL_1D",
    kind: "TRIAL",
    tier: "PRO",
    durationDays: 1,
    redeemEnabled: true
  },
  {
    code: "PRO_TRIAL_3D",
    kind: "TRIAL",
    tier: "PRO",
    durationDays: 3,
    redeemEnabled: true
  },
  {
    code: "PRO_TRIAL_7D",
    kind: "TRIAL",
    tier: "PRO",
    durationDays: 7,
    redeemEnabled: true
  }
];

export const membershipSkuPresetCodes = membershipSkuPresets.map(item => item.code);

const membershipSkuPresetMap = new Map(membershipSkuPresets.map(item => [item.code, item] as const));

export function getMembershipSkuPreset(code: string) {
  return membershipSkuPresetMap.get(code as MembershipSkuPresetCode) ?? null;
}

export function isAllowedMembershipSkuPreset(input: {
  code: string;
  kind: string;
  tier: string;
  durationDays: number;
}) {
  const preset = getMembershipSkuPreset(input.code);
  if (!preset) return false;
  return (
    preset.kind === input.kind &&
    preset.tier === input.tier &&
    preset.durationDays === input.durationDays
  );
}

export async function ensureMembershipSkuCatalog(db: MembershipSkuCatalogDb) {
  for (const preset of membershipSkuPresets) {
    await db.membershipSku.upsert({
      where: { code: preset.code },
      update: {
        kind: preset.kind,
        tier: preset.tier,
        durationDays: preset.durationDays
      },
      create: {
        code: preset.code,
        kind: preset.kind,
        tier: preset.tier,
        durationDays: preset.durationDays,
        redeemEnabled: preset.redeemEnabled
      }
    });
  }
}
