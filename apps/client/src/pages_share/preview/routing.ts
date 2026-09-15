export function mealInvitePath(eventId: number | string, planItemId: number | string | null, planDate: string | null | undefined) {
  if (!eventId) return "/pages_meal/event/index";

  const eventQuery = `eventId=${encodeURIComponent(String(eventId))}`;
  if (planItemId && planDate) {
    return `/pages_meal/detail/index?planItemId=${encodeURIComponent(String(planItemId))}&planDate=${encodeURIComponent(planDate)}&${eventQuery}`;
  }

  return `/pages_meal/detail/index?${eventQuery}`;
}
