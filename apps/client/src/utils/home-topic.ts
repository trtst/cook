export function isTopicQueued(itemId: number, queuedIds: number[]) {
  return queuedIds.includes(itemId);
}
