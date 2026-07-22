import { refreshSessionIfNeeded } from "@/apis/auth";
import { userApi } from "@/apis/user";
import { useDiningGroupStore } from "@/stores/dining-group";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";

const USER_PROFILE_CACHE_MS = 10 * 60 * 1000;

let restorePromise: Promise<void> | null = null;
let restored = false;

export function restoreAppSession() {
  if (restored) return Promise.resolve();

  restorePromise ??= restoreCurrentUser().finally(() => {
    restored = true;
    restorePromise = null;
  });

  return restorePromise;
}

async function restoreCurrentUser() {
  const sessionStore = useSessionStore();
  const diningGroupStore = useDiningGroupStore();
  const userStore = useUserStore();

  await sessionStore.restore();
  if (!sessionStore.isLoggedIn) return;

  try {
    const restoredProfile =
      sessionStore.uid > 0 && (await userStore.restoreProfile(sessionStore.uid, USER_PROFILE_CACHE_MS));

    if (!restoredProfile) {
      const profile = await userApi.getCurrent();

      if (sessionStore.uid !== profile.uid) {
        await sessionStore.setSession({
          token: sessionStore.token,
          uid: profile.uid,
          expiresAt: sessionStore.expiresAt,
          refreshCheckedAt: sessionStore.refreshCheckedAt
        });
      }

      userStore.setProfile(profile);
    }
  } catch {
    userStore.clearProfile();
    diningGroupStore.clearDiningGroupState();
    return;
  }

  try {
    await diningGroupStore.refreshCurrent();
  } catch {
    diningGroupStore.clearDiningGroupState();
  }

  await refreshSessionIfNeeded().catch(() => undefined);
}
