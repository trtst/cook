import type { ApiRequest, ApiRequestResult } from "@next-meal/api-client";

export function uniRequestAdapter(request: ApiRequest): Promise<ApiRequestResult> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: request.url,
      method: request.method,
      header: request.headers,
      data: request.body as never,
      success: (response) => {
        resolve({
          status: response.statusCode,
          body: response.data
        });
      },
      fail: reject
    });
  });
}
