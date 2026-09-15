type ShoppingListMetaInput = {
  progressDoneCount: number;
  progressTotalCount: number;
  updatedAt: string;
};

export function shoppingListRows<T extends { id: number }>(items: readonly T[], selectedId: number | "") {
  return items.map(item => {
    const selected = item.id === selectedId;
    return {
      key: `${item.id}:${selected ? "active" : "idle"}`,
      item,
      selected
    };
  });
}

function twoDigits(value: number) {
  return `${value}`.padStart(2, "0");
}

export function shoppingListMetaText(item: ShoppingListMetaInput, now = new Date()) {
  const progressText = `进度 ${item.progressDoneCount}/${item.progressTotalCount}`;
  const updatedAt = new Date(item.updatedAt);
  if (Number.isNaN(updatedAt.getTime())) return progressText;

  const timeText = `${twoDigits(updatedAt.getHours())}:${twoDigits(updatedAt.getMinutes())}`;
  const sameDay = updatedAt.getFullYear() === now.getFullYear()
    && updatedAt.getMonth() === now.getMonth()
    && updatedAt.getDate() === now.getDate();
  if (sameDay) return `${progressText} · 今天 ${timeText} 更新`;

  const monthDayText = `${updatedAt.getMonth() + 1}月${updatedAt.getDate()}日 ${timeText}`;
  if (updatedAt.getFullYear() === now.getFullYear()) {
    return `${progressText} · ${monthDayText} 更新`;
  }
  return `${progressText} · ${updatedAt.getFullYear()}年${monthDayText} 更新`;
}
