import type { HomeRecentArrangement, HomeRecentArrangementStatus } from "../apis/home";

export type RecentArrangementHintBranch =
  | "EMPTY_MENU"
  | "PENDING_CONFIRM_WITH_GAP"
  | "PENDING_CONFIRM_NO_GAP"
  | "PENDING_SHOPPING_WITH_GAP"
  | "PENDING_SHOPPING_NO_GAP"
  | "READY_TO_COOK"
  | "TIME_UP_SHARE";

export const recentArrangementStatusCopies: Record<HomeRecentArrangementStatus, readonly string[]> = {
  EMPTY_MENU: ["菜单还空着呢", "先来定几道菜", "空空如也的菜单", "该加菜了朋友", "菜单一片空白"],
  PENDING_CONFIRM: ["菜单等待确认", "就差你拍板了", "确认一下菜单吧", "菜单等你定夺", "确认菜单再继续"],
  PENDING_SHOPPING: ["食材还差一点", "出发采购食材", "备齐食材再开火", "该去采购了哦", "食材缺口待补"],
  READY_TO_COOK: ["食材齐备可开火", "万事俱备下厨吧", "可以开始做饭啦", "系上围裙开火吧", "一切就绪做饭去"],
  TIME_UP_SHARE: ["饭局结束分享吧", "该记录美好回忆", "回忆时刻到来了", "饭后一起分享吧", "留下今日份快乐"]
};

export const recentArrangementHintCopies: Record<RecentArrangementHintBranch, readonly string[]> = {
  EMPTY_MENU: [
    "这顿饭还没有安排菜，先去加点菜吧",
    "菜单还是空的，想好吃什么了吗",
    "没有菜怎么做饭，快来决定一下吧",
    "菜单空荡荡，先填满它再说",
    "还什么都没选呢，加几道拿手菜吧",
    "一顿好饭从点菜开始，去加几道吧",
    "菜单暂空，等你来填"
  ],
  PENDING_CONFIRM_WITH_GAP: [
    "还差 {n} 样食材，确认菜单后就能看到采购清单了",
    "菜单待确认，另有 {n} 样食材需要准备",
    "再差 {n} 样就齐了，确认一下菜单吧",
    "菜单还没敲定，还有 {n} 样缺口待补",
    "确认菜单后，我们会帮你列好这 {n} 样采购项",
    "菜单就差最后一步确认，还缺 {n} 样食材哦",
    "定下菜单，还有 {n} 样等着采购呢"
  ],
  PENDING_CONFIRM_NO_GAP: [
    "菜单已定，就差你点一下确认了",
    "确认菜单，就可以进入下一步了",
    "菜单已经想好了，确认一下吧",
    "就差一个确认，饭局就能推进了",
    "菜单就位，确认后正式开始准备",
    "菜都选好了，点个确认就出发",
    "万事俱备，只欠确认"
  ],
  PENDING_SHOPPING_WITH_GAP: [
    "还差 {n} 样食材，买齐就能开火了",
    "食材缺口 {n} 样，准备采购吧",
    "菜单定了，再补 {n} 样就齐了",
    "还差 {n} 样，买完就可以做饭了",
    "离下厨只差 {n} 样，快去采购",
    "清单已列，还有 {n} 样待购入",
    "补上这 {n} 样，厨房就能开工了"
  ],
  PENDING_SHOPPING_NO_GAP: [
    "菜单已确认，去把食材备齐吧",
    "采购准备就绪，出发买菜吧",
    "可以开始采购了，食材都在等着你",
    "食材备好，才能做好饭哦",
    "备齐食材，离美味更近一步",
    "是时候去一趟菜市场了",
    "采购启动，食材到位就可以下厨了"
  ],
  READY_TO_COOK: [
    "食材齐了，系上围裙开始吧",
    "一切就绪，可以大显身手了",
    "食材已备好，就差你的手艺了",
    "开火吧，美味马上就来",
    "菜已备齐，锅铲就位",
    "做饭时间到，露一手吧",
    "万事俱备，下厨正当时"
  ],
  TIME_UP_SHARE: [
    "饭局结束了，记录一下这顿的美好回忆吧",
    "到点啦，分享一下今天的美食瞬间",
    "饭已吃完，别忘了留下回忆",
    "美食值得被记住，来写点什么吧",
    "这顿饭结束了，但快乐可以留住",
    "饱餐过后，来记录一下今日份满足",
    "饭局已散，回忆永存，分享一下吧"
  ]
};

const actionCopies: Record<HomeRecentArrangementStatus, string> = {
  EMPTY_MENU: "去加菜",
  PENDING_CONFIRM: "确认菜单",
  PENDING_SHOPPING: "去采购",
  READY_TO_COOK: "开始做饭",
  TIME_UP_SHARE: "分享回忆"
};

interface CopyCache {
  status: Map<string, string>;
  hint: Map<string, string>;
}

export function recentArrangementActionText(status: HomeRecentArrangementStatus) {
  return actionCopies[status];
}

export function createRecentArrangementCopyPicker(random = Math.random) {
  const cache: CopyCache = {
    status: new Map(),
    hint: new Map()
  };

  function pick(candidates: readonly string[]) {
    const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
    return candidates[index] ?? "";
  }

  function statusText(item: HomeRecentArrangement) {
    const cacheKey = `${buildArrangementKey(item)}:${item.status}`;
    const cached = cache.status.get(cacheKey);
    if (cached) return cached;

    const selected = pick(recentArrangementStatusCopies[item.status]);
    cache.status.set(cacheKey, selected);
    return selected;
  }

  function hintText(item: HomeRecentArrangement) {
    const branch = recentArrangementHintBranch(item);
    const cacheKey = `${buildArrangementKey(item)}:${branch}`;
    const cached = cache.hint.get(cacheKey);
    const template = cached ?? pick(recentArrangementHintCopies[branch]);
    if (!cached) cache.hint.set(cacheKey, template);

    return template.replace("{n}", `${item.gapCount ?? 0}`);
  }

  return {
    statusText,
    hintText
  };
}

export const recentArrangementCopyPicker = createRecentArrangementCopyPicker();

export function recentArrangementHintBranch(item: HomeRecentArrangement): RecentArrangementHintBranch {
  const gapCount = item.gapCount ?? 0;
  if (item.status === "EMPTY_MENU") return "EMPTY_MENU";
  if (item.status === "PENDING_CONFIRM") return gapCount > 0 ? "PENDING_CONFIRM_WITH_GAP" : "PENDING_CONFIRM_NO_GAP";
  if (item.status === "PENDING_SHOPPING") return gapCount > 0 ? "PENDING_SHOPPING_WITH_GAP" : "PENDING_SHOPPING_NO_GAP";
  if (item.status === "READY_TO_COOK") return "READY_TO_COOK";
  return "TIME_UP_SHARE";
}

function buildArrangementKey(item: Pick<HomeRecentArrangement, "eventId" | "planDate" | "planItemId">) {
  if (item.eventId) return `event:${item.eventId}`;
  return `plan:${item.planItemId}:${item.planDate}`;
}
