import { onBeforeUnmount } from "vue";
import type { AuthSessionResult } from "@/apis/auth";
import { useLoginModalStore } from "@/stores/login-modal";
import { createOperationId } from "@/utils/operation-id";
import { onLoginSuccess, type LoginSuccessPayload } from "@/utils/session-events";

export interface LoginEmptySuccessPayload {
  session: AuthSessionResult;
}

type LoginEmptySuccessHandler = (payload: LoginEmptySuccessPayload) => Promise<void> | void;

export function createLoginEmptyStateController(
  open: (sourceId: string) => void,
  onSuccess?: LoginEmptySuccessHandler,
  sourceId = createOperationId()
) {
  function openLogin() {
    open(sourceId);
  }

  function handleLoginSuccess(payload: LoginSuccessPayload) {
    if (payload.sourceId !== sourceId || !onSuccess) return;
    return onSuccess({ session: payload.session });
  }

  return {
    sourceId,
    openLogin,
    handleLoginSuccess
  };
}

export function useLoginEmptyState(onSuccess?: LoginEmptySuccessHandler) {
  const loginModalStore = useLoginModalStore();
  const controller = createLoginEmptyStateController(sourceId => loginModalStore.open(sourceId), onSuccess);
  const stopListening = onLoginSuccess(controller.handleLoginSuccess);

  onBeforeUnmount(stopListening);

  return {
    openLogin: controller.openLogin
  };
}
