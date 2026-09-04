import assert from "node:assert/strict";
import test from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { APP_STORAGE_KEYS, uniPlatform } from "@/platform/uni";
import { useSessionStore } from "./session";

const snapshots = new Map<string, unknown>();
uniPlatform.storage.get = async <T>(key: string) => (snapshots.get(key) as T | undefined) ?? null;
uniPlatform.storage.set = async <T>(key: string, value: T) => {
  snapshots.set(key, value);
};
uniPlatform.storage.remove = async (key: string) => {
  snapshots.delete(key);
};

test("restores the access and refresh session with an authenticated status", async () => {
  setActivePinia(createPinia());
  snapshots.set(APP_STORAGE_KEYS.session, {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    uid: 7,
    expiresAt: "2099-01-01T00:00:00.000Z",
    refreshExpiresAt: "2099-02-01T00:00:00.000Z"
  });

  const store = useSessionStore();
  await store.restore();

  assert.equal(store.accessToken, "access-token");
  assert.equal(store.refreshToken, "refresh-token");
  assert.equal(store.authStatus, "authenticated");
  assert.equal(store.logoutExplicit, false);
});

test("explicit logout clears secrets and prevents silent restoration", async () => {
  setActivePinia(createPinia());
  const store = useSessionStore();
  await store.setSession({
    accessToken: "access-token",
    refreshToken: "refresh-token",
    uid: 7,
    expiresAt: "2099-01-01T00:00:00.000Z",
    refreshExpiresAt: "2099-02-01T00:00:00.000Z"
  });

  await store.clearSession({ explicitLogout: true });

  assert.equal(store.accessToken, "");
  assert.equal(store.refreshToken, "");
  assert.equal(store.authStatus, "guest");
  assert.equal(store.logoutExplicit, true);
  assert.equal(snapshots.has(APP_STORAGE_KEYS.session), false);
});

test("persists explicit logout across a fresh store restore", async () => {
  setActivePinia(createPinia());
  const store = useSessionStore();
  await store.clearSession({ explicitLogout: true });

  setActivePinia(createPinia());
  const restored = useSessionStore();
  await restored.restore();

  assert.equal(restored.authStatus, "guest");
  assert.equal(restored.logoutExplicit, true);
});
