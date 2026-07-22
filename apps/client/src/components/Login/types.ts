import type { PasswordLoginResult } from "@/apis/auth";

export interface LoginSuccessPayload {
  session: PasswordLoginResult;
}
