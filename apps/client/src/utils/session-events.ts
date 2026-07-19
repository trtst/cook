type SessionClearedHandler = () => Promise<void> | void;

const sessionClearedHandlers = new Set<SessionClearedHandler>();

export function onSessionCleared(handler: SessionClearedHandler) {
  sessionClearedHandlers.add(handler);
}

export async function emitSessionCleared() {
  await Promise.all(Array.from(sessionClearedHandlers, (handler) => handler()));
}
