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
  READY: "可发布",
  RUNNING: "处理中",
  FAILED: "失败",
  COMPLETED: "已完成",
  NEEDS_FIX: "待补全",
  PUBLISHED: "已发布",
  PUBLISHING: "发布中",
  PENDING_PARSE: "待解析",
  ALL: "全部"
} as const;

export function formatStatusText(status: string) {
  return statusTextMap[status as keyof typeof statusTextMap] ?? status;
}
