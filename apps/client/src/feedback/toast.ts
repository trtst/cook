import { reactive } from "vue";

export type ToastTone = "default" | "error";

export interface ToastOptions {
  title: string;
  content?: string;
  icon?: "success" | "error" | "loading" | "none";
  tone?: ToastTone;
  duration?: number;
}

type ToastPhase = "idle" | "enter" | "shown" | "leave";

interface ToastState {
  visible: boolean;
  phase: ToastPhase;
  nonce: number;
  title: string;
  content: string;
  tone: ToastTone;
}

const toastState = reactive<ToastState>({
  visible: false,
  phase: "idle",
  nonce: 0,
  title: "",
  content: "",
  tone: "default"
});

let enterTimer: ReturnType<typeof setTimeout> | null = null;
let autoHideTimer: ReturnType<typeof setTimeout> | null = null;
let leaveTimer: ReturnType<typeof setTimeout> | null = null;
let lastToastKey = "";
let lastToastAt = 0;

function clearTimer(timer: ReturnType<typeof setTimeout> | null) {
  if (timer != null) {
    clearTimeout(timer);
  }
}

function clearToastTimers() {
  clearTimer(enterTimer);
  clearTimer(autoHideTimer);
  clearTimer(leaveTimer);
  enterTimer = null;
  autoHideTimer = null;
  leaveTimer = null;
}

function resolveTone(options: ToastOptions): ToastTone {
  if (options.tone) return options.tone;
  return options.icon === "error" ? "error" : "default";
}

function finalizeToast(expectedNonce: number) {
  if (toastState.nonce !== expectedNonce) return;

  toastState.visible = false;
  toastState.phase = "idle";
  toastState.title = "";
  toastState.content = "";
  toastState.tone = "default";
}

export function useToastState() {
  return toastState;
}

export function hideToast(expectedNonce = toastState.nonce) {
  if (!toastState.visible || toastState.nonce !== expectedNonce) return;

  clearTimer(enterTimer);
  clearTimer(autoHideTimer);
  enterTimer = null;
  autoHideTimer = null;

  toastState.phase = "leave";

  leaveTimer = setTimeout(() => {
    finalizeToast(expectedNonce);
  }, 180);
}

export function showToast(options: ToastOptions) {
  const title = String(options.title || "").trim();
  if (!title) return Promise.resolve();

  const content = String(options.content || "").trim();
  const tone = resolveTone(options);
  const toastKey = `${title}::${content}::${tone}`;
  const now = Date.now();

  if (toastKey === lastToastKey && now - lastToastAt < 300) {
    return Promise.resolve();
  }

  lastToastKey = toastKey;
  lastToastAt = now;

  clearToastTimers();

  const nonce = toastState.nonce + 1;
  toastState.nonce = nonce;
  toastState.visible = true;
  toastState.phase = "enter";
  toastState.title = title;
  toastState.content = content;
  toastState.tone = tone;

  enterTimer = setTimeout(() => {
    if (toastState.nonce !== nonce || !toastState.visible) return;
    toastState.phase = "shown";
  }, 16);

  const duration = Math.max(1200, options.duration ?? (tone === "error" ? 2200 : 1600));
  // const duration = 500000;
  autoHideTimer = setTimeout(() => {
    hideToast(nonce);
  }, duration);

  return Promise.resolve();
}
