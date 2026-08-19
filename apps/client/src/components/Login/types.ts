import type { AuthSessionResult } from "@/apis/auth";

export interface LoginSuccessPayload {
  session: AuthSessionResult;
}
