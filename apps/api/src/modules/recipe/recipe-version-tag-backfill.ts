export function isActiveCurrentVersion(status: string, currentVersionId: number | null, versionId: number) {
  return status === "ACTIVE" && currentVersionId === versionId;
}
