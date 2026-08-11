export function readTouchY(event: Event) {
  const payload = event as Event & {
    touches?: Array<{ pageY?: number; clientY?: number }>;
    changedTouches?: Array<{ pageY?: number; clientY?: number }>;
  };
  const touch = payload.touches?.[0] || payload.changedTouches?.[0];
  if (!touch) return null;
  return touch.pageY ?? touch.clientY ?? null;
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function rpxToPx(value: number, windowWidth?: number) {
  return (windowWidth || 375) * value / 750;
}
