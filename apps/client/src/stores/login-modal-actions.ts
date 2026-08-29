export type LoginModalAction = (() => void) | null;

export function createLoginActionRegistry() {
  const actions = new Map<string, NonNullable<LoginModalAction>>();
  let nextId = 0;

  function buildAnonymousKey() {
    nextId += 1;
    return `anonymous:${nextId}`;
  }

  return {
    set(sourceId: string | null, action: LoginModalAction) {
      if (!sourceId) return null;

      if (!action) {
        actions.delete(sourceId);
        return sourceId;
      }

      actions.set(sourceId, action);
      return sourceId;
    },
    register(action: LoginModalAction) {
      if (!action) return null;
      const key = buildAnonymousKey();
      actions.set(key, action);
      return key;
    },
    take(sourceId: string | null) {
      if (!sourceId) return null;
      const action = actions.get(sourceId) ?? null;
      actions.delete(sourceId);
      return action;
    },
    clear() {
      actions.clear();
    }
  };
}
