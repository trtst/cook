import { createApiClient, UnauthorizedError } from "@next-meal/api-client";
import type { ApiRequest } from "@next-meal/api-client";
import { adminAppConfig } from "./config";

function getRequestId() {
  return crypto.randomUUID();
}

async function request({ url, method, headers, body }: ApiRequest) {
  const response = await fetch(url, {
    method,
    headers: {
      ...headers,
      "X-Admin-Version": adminAppConfig.appVersion,
      "X-Admin-Build": String(adminAppConfig.appBuild),
      "X-Platform": "admin-web",
      "X-Request-Id": getRequestId()
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  const parsedBody = text ? JSON.parse(text) : null;

  return {
    status: response.status,
    body: parsedBody
  };
}

export const adminApi = createApiClient({
  baseUrl: adminAppConfig.apiBaseUrl,
  request,
  getAuthHeader(scheme) {
    if (scheme !== "admin") return null;

    const token = localStorage.getItem(adminAppConfig.adminTokenStorageKey);
    return token ? `Bearer ${token}` : null;
  },
  onUnauthorized() {
    localStorage.removeItem(adminAppConfig.adminTokenStorageKey);
  }
});

export function isUnauthorized(error: unknown) {
  return error instanceof UnauthorizedError;
}
