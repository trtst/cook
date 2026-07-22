import { requestData, type IsoDateTime, type UUID } from "./http";

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminLoginResult {
  token: string;
  expiresAt: IsoDateTime;
  admin: {
    id: UUID;
    username: string;
    displayName: string;
    roles: string[];
  };
}

export const authApi = {
  login(body: AdminLoginRequest) {
    return requestData<AdminLoginResult>("/admin/auth/login", {
      method: "POST",
      auth: false,
      body
    });
  }
};
