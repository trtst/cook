import { computed, onBeforeUnmount, ref } from "vue";
import { uniPlatform } from "@/platform/uni";

const activeLocks = new Set<symbol>();
const lockCount = ref(0);

function supportsPageMetaLock() {
  return uniPlatform.system.getRuntimeChannel() === "mini_program";
}

function addLock(token: symbol) {
  if (activeLocks.has(token)) return;
  activeLocks.add(token);
  lockCount.value += 1;
}

function removeLock(token: symbol) {
  if (!activeLocks.delete(token)) return;
  lockCount.value = Math.max(0, lockCount.value - 1);
}

export function usePageScrollStyle() {
  return computed(() => {
    if (!supportsPageMetaLock()) return "overflow: visible;";
    return lockCount.value > 0 ? "overflow: hidden;" : "overflow: visible;";
  });
}

export function usePageScrollLock(token = Symbol("page-scroll-lock")) {
  function setLocked(locked: boolean) {
    if (locked) {
      addLock(token);
      return;
    }
    removeLock(token);
  }

  onBeforeUnmount(() => {
    removeLock(token);
  });

  return {
    lock() {
      addLock(token);
    },
    unlock() {
      removeLock(token);
    },
    setLocked
  };
}
