import type { ApiResponse } from "@next-meal/api-client";

export function ok<T>(data: T): ApiResponse<T> {
  return {
    code: 0,
    message: "ok",
    data,
    serverTime: new Date().toISOString()
  };
}
