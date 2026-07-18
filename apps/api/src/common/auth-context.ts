export interface UserAuthContext {
  userId: string;
}

export interface AdminAuthContext {
  adminId: string;
}

export interface RequestWithUser {
  user: UserAuthContext;
}

export interface RequestWithAdmin {
  admin: AdminAuthContext;
}
