export const COOK_ASSISTANT_LOADING_MIN_MS = 2600;
export const COOK_ASSISTANT_LOADING_MAX_MS = 3400;

type Clock = () => number;
type Wait = (milliseconds: number) => Promise<void>;

export function getCookAssistantLoadingDuration(random: () => number = Math.random) {
  const ratio = Math.max(0, Math.min(1, random()));
  return Math.round(
    COOK_ASSISTANT_LOADING_MIN_MS +
      (COOK_ASSISTANT_LOADING_MAX_MS - COOK_ASSISTANT_LOADING_MIN_MS) * ratio
  );
}

export async function waitForCookAssistantLoading(
  startedAt: number,
  durationMs: number,
  now: Clock = Date.now,
  wait: Wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
) {
  const remainingMs = Math.max(0, durationMs - (now() - startedAt));
  if (!remainingMs) return;
  await wait(remainingMs);
}
