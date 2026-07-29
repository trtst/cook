import { reactive } from "vue";

export type ConfirmTone = "default" | "danger";

export interface ConfirmOptions {
  title: string;
  content: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
  maskClosable?: boolean;
}

type ConfirmPhase = "idle" | "enter" | "shown" | "leave";

interface ConfirmState {
  visible: boolean;
  phase: ConfirmPhase;
  nonce: number;
  title: string;
  content: string;
  confirmText: string;
  cancelText: string;
  tone: ConfirmTone;
  maskClosable: boolean;
}

const confirmState = reactive<ConfirmState>({
  visible: false,
  phase: "idle",
  nonce: 0,
  title: "",
  content: "",
  confirmText: "确认",
  cancelText: "取消",
  tone: "default",
  maskClosable: true
});

let pendingResolve: ((value: boolean) => void) | null = null;
let enterTimer: ReturnType<typeof setTimeout> | null = null;
let leaveTimer: ReturnType<typeof setTimeout> | null = null;

function clearTimer(timer: ReturnType<typeof setTimeout> | null) {
  if (timer != null) {
    clearTimeout(timer);
  }
}

function clearConfirmTimers() {
  clearTimer(enterTimer);
  clearTimer(leaveTimer);
  enterTimer = null;
  leaveTimer = null;
}

function finalizeConfirm(expectedNonce: number) {
  if (confirmState.nonce !== expectedNonce) return;

  confirmState.visible = false;
  confirmState.phase = "idle";
  confirmState.title = "";
  confirmState.content = "";
  confirmState.confirmText = "确认";
  confirmState.cancelText = "取消";
  confirmState.tone = "default";
  confirmState.maskClosable = true;
}

function closeConfirm(expectedNonce: number) {
  clearTimer(enterTimer);
  enterTimer = null;

  confirmState.phase = "leave";

  leaveTimer = setTimeout(() => {
    finalizeConfirm(expectedNonce);
  }, 180);
}

export function useConfirmState() {
  return confirmState;
}

export function dismissConfirm(expectedNonce = confirmState.nonce) {
  if (!confirmState.visible || confirmState.nonce !== expectedNonce) return;

  const resolve = pendingResolve;
  pendingResolve = null;
  resolve?.(false);
  closeConfirm(expectedNonce);
}

export function submitConfirm(expectedNonce = confirmState.nonce) {
  if (!confirmState.visible || confirmState.nonce !== expectedNonce) return;

  const resolve = pendingResolve;
  pendingResolve = null;
  resolve?.(true);
  closeConfirm(expectedNonce);
}

export function showConfirm(options: ConfirmOptions) {
  const title = String(options.title || "").trim();
  const content = String(options.content || "").trim();

  if (pendingResolve) {
    pendingResolve(false);
    pendingResolve = null;
  }

  clearConfirmTimers();

  const nonce = confirmState.nonce + 1;
  confirmState.nonce = nonce;
  confirmState.visible = true;
  confirmState.phase = "enter";
  confirmState.title = title;
  confirmState.content = content;
  confirmState.confirmText = String(options.confirmText || "").trim() || "确认";
  confirmState.cancelText = String(options.cancelText || "").trim() || "取消";
  confirmState.tone = options.tone ?? "default";
  confirmState.maskClosable = options.maskClosable ?? true;

  enterTimer = setTimeout(() => {
    if (confirmState.nonce !== nonce || !confirmState.visible) return;
    confirmState.phase = "shown";
  }, 16);

  return new Promise<boolean>((resolve) => {
    pendingResolve = resolve;
  });
}
