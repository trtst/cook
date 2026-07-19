import type { PasswordLoginResult } from "@next-meal/api-client";

export interface LoginSuccessPayload {
  session: PasswordLoginResult;
}
