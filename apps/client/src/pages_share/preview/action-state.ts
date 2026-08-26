import type { SharePreviewViewerResponse } from "../apis/share";

export type SharePreviewAction = "LOGIN" | "PENDING" | "RETRY" | "ACCEPT" | "VIEW" | "BLOCKED";

export interface SharePreviewActionStateInput {
  isLoggedIn: boolean;
  viewer: SharePreviewViewerResponse | null;
  viewerLoading: boolean;
  viewerFailed: boolean;
  submitting: boolean;
}

export interface SharePreviewActionState {
  action: SharePreviewAction;
  label: string;
  disabled: boolean;
  secondary: boolean;
}

export function resolveSharePreviewActionState(input: SharePreviewActionStateInput): SharePreviewActionState {
  if (!input.isLoggedIn) {
    return {
      action: "LOGIN",
      label: "登录查看",
      disabled: false,
      secondary: false
    };
  }

  if (input.submitting) {
    return {
      action: "ACCEPT",
      label: "加入中...",
      disabled: true,
      secondary: false
    };
  }

  if (input.viewerLoading) {
    return {
      action: "PENDING",
      label: "加载中...",
      disabled: true,
      secondary: false
    };
  }

  if (input.viewer?.action) {
    return {
      action: input.viewer.action,
      label: input.viewer.action === "VIEW" ? "查看邀请" : input.viewer.action === "BLOCKED" ? "无法加入" : "确认加入",
      disabled: input.viewer.action === "BLOCKED",
      secondary: input.viewer.action === "VIEW" || input.viewer.action === "BLOCKED"
    };
  }

  if (input.viewerFailed) {
    return {
      action: "RETRY",
      label: "重试加载",
      disabled: false,
      secondary: true
    };
  }

  return {
    action: "PENDING",
    label: "加载中...",
    disabled: true,
    secondary: false
  };
}
