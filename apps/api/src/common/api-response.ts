import type { ApiResponse } from "../contracts/types";

export function ok<T>(data: T): ApiResponse<T> {
  return {
    code: 0,
    message: "ok",
    data,
    serverTime: new Date().toISOString()
  };
}

export function fail(code: number, message: string): ApiResponse<null> {
  return {
    code,
    message,
    data: null,
    serverTime: new Date().toISOString()
  };
}
