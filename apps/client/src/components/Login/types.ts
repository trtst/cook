import type { CodeLoginResult } from "@/apis/auth";

export interface LoginSuccessPayload {
  session: CodeLoginResult;
}
