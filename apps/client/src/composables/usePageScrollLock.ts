import { computed, onBeforeUnmount, reactive } from "vue";
import { uniPlatform } from "@/platform/uni";

const pageLockCounts = reactive<Record<string, number>>({});
const pageLocks = new Map<string, Set<symbol>>();

function supportsPageMetaLock() {
  return uniPlatform.system.getRuntimeChannel() === "mini_program";
}

function resolvePageKey() {
  if (typeof getCurrentPages !== "function") return "unknown-page";
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1] as
    | {
        route?: string;
        $page?: {
          id?: string | number;
          route?: string;
        };
      }
    | undefined;
  const route = currentPage?.route || currentPage?.$page?.route || "unknown-route";
  const pageId = currentPage?.$page?.id ?? route;
  return `${route}#${String(pageId)}`;
}

function setPageLockCount(pageKey: string, count: number) {
  if (count > 0) {
    pageLockCounts[pageKey] = count;
    return;
  }
  delete pageLockCounts[pageKey];
}

function addLock(pageKey: string, token: symbol) {
  const pageTokens = pageLocks.get(pageKey) || new Set<symbol>();
  if (pageTokens.has(token)) return;
  pageTokens.add(token);
  pageLocks.set(pageKey, pageTokens);
  setPageLockCount(pageKey, pageTokens.size);
}

function removeLock(pageKey: string, token: symbol) {
  const pageTokens = pageLocks.get(pageKey);
  if (!pageTokens?.delete(token)) return;
  if (!pageTokens.size) {
    pageLocks.delete(pageKey);
    setPageLockCount(pageKey, 0);
    return;
  }
  setPageLockCount(pageKey, pageTokens.size);
}

export function usePageScrollStyle(pageKey = resolvePageKey()) {
  return computed(() => {
    if (!supportsPageMetaLock()) return "overflow: visible;";
    return (pageLockCounts[pageKey] || 0) > 0 ? "overflow: hidden;" : "overflow: visible;";
  });
}

export function usePageScrollLock(token = Symbol("page-scroll-lock")) {
  const pageKey = resolvePageKey();

  function setLocked(locked: boolean) {
    if (locked) {
      addLock(pageKey, token);
      return;
    }
    removeLock(pageKey, token);
  }

  onBeforeUnmount(() => {
    removeLock(pageKey, token);
  });

  return {
    lock() {
      addLock(pageKey, token);
    },
    unlock() {
      removeLock(pageKey, token);
    },
    setLocked
  };
}
