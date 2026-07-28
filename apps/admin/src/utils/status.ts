const statusTextMap = {
  ACTIVE: "启用中",
  DISABLED: "已禁用",
  ARCHIVED: "已归档",
  RESTRICTED: "受限中",
  ENDED: "已结束",
  RECYCLED: "已回收",
  BLOCKED: "已下架",
  DELETED: "已删除",
  OPEN: "待处理",
  RESOLVED: "已处理",
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已拒绝",
  ALL: "全部"
} as const;

export function formatStatusText(status: string) {
  return statusTextMap[status as keyof typeof statusTextMap] ?? status;
}
