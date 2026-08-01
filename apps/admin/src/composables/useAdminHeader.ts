import { onBeforeUnmount, shallowRef, toValue, watchEffect, type MaybeRefOrGetter } from "vue";

const titleValue = shallowRef<string | null>(null);
const refreshAction = shallowRef<(() => void | Promise<void>) | null>(null);
const titleOwner = shallowRef<symbol | null>(null);
const refreshOwner = shallowRef<symbol | null>(null);

export function resolveAdminHeaderTitle(value: unknown) {
  if (typeof value !== "string") return null;
  const next = value.trim();
  if (!next || next === "null" || next === "undefined") return null;
  return next;
}

export function useAdminHeaderState() {
  return {
    title: titleValue,
    refresh: refreshAction
  };
}

export function useAdminHeaderTitle(title: MaybeRefOrGetter<string | null | undefined>) {
  const owner = Symbol("admin-header-title");

  watchEffect(() => {
    titleOwner.value = owner;
    titleValue.value = resolveAdminHeaderTitle(toValue(title));
  });

  onBeforeUnmount(() => {
    if (titleOwner.value !== owner) return;
    titleOwner.value = null;
    titleValue.value = null;
  });
}

export function useAdminHeaderRefresh(action: (() => void | Promise<void>) | null) {
  const owner = Symbol("admin-header-refresh");

  watchEffect(() => {
    refreshOwner.value = owner;
    refreshAction.value = action;
  });

  onBeforeUnmount(() => {
    if (refreshOwner.value !== owner) return;
    refreshOwner.value = null;
    refreshAction.value = null;
  });
}
