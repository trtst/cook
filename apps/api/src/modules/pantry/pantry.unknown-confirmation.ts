export function buildUnknownInventoryConfirmationPatch() {
  return {
    fridgeAppliedQuantityText: "数量未记录",
    fridgeCovered: true
  } as const;
}
