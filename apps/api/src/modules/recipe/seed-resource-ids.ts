export const resourceIdStart = 10_000_000;

/**
 * Keeps old fixture suffixes recognizable while moving seeded resource IDs
 * into the current 8-digit range. Runtime IDs come from database sequences.
 */
export function seedResourceId(legacyId: number) {
  return resourceIdStart + legacyId;
}
