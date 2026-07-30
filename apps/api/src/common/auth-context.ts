export interface UserAuthContext {
  userId: number;
}

export interface AdminAuthContext {
  adminId: number;
  roles: string[];
}

export type ClientPlatform = "mp-weixin" | "h5" | "pc" | "ios" | "android" | "harmony" | "admin-web" | "unknown";

export interface RequestContext {
  requestId: string;
  ip: string;
  userAgent: string;
  platform: ClientPlatform;
  appVersion: string | null;
  appBuild: number | null;
}

export interface RequestWithUser {
  user: UserAuthContext;
}

export interface RequestWithAdmin {
  admin: AdminAuthContext;
}

export interface RequestWithContext {
  context: RequestContext;
}
