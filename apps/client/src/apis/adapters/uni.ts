import type { ApiRequest, ApiRequestResult } from "@next-meal/api-client";
import { appConfig, type CookFrom } from "@/config";

const cookFromValues = new Set(["mini_program", "h5", "pc", "ios", "android", "harmony"]);

export interface FileResult {
  status: number;
  body: unknown;
}

export interface UploadFileOptions {
  url: string;
  filePath: string;
  name: string;
  headers?: Record<string, string>;
  formData?: Record<string, string | number | boolean>;
}

export interface DownloadFileOptions {
  url: string;
  headers?: Record<string, string>;
}

export interface DownloadFileResult {
  status: number;
  tempFilePath: string;
}

function readCookFrom(value: string | undefined): CookFrom | null {
  if (!value || !cookFromValues.has(value)) return null;
  return value as CookFrom;
}

function detectCookFrom(): CookFrom | null {
  if (typeof navigator === "undefined") return null;

  const userAgent = navigator.userAgent.toLowerCase();
  if (/harmonyos|openharmony/.test(userAgent)) return "harmony";
  if (/android/.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/.test(userAgent)) return "ios";

  const isMobile = /mobile/.test(userAgent);
  return isMobile ? "h5" : "pc";
}

function getCookFrom() {
  return readCookFrom(appConfig.cookFrom) ?? detectCookFrom() ?? "mini_program";
}

function buildHeaders(headers: Record<string, string>) {
  return {
    ...headers,
    "X-Cook-From": getCookFrom(),
    "X-Cook-Version": appConfig.cookVersion
  };
}

function buildUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;

  const base = appConfig.apiUrl.endsWith("/") ? appConfig.apiUrl.slice(0, -1) : appConfig.apiUrl;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base}${path}`;
}

function parseBody(data: unknown) {
  if (typeof data !== "string") return data;

  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

export function uniRequestAdapter(request: ApiRequest): Promise<ApiRequestResult> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: request.url,
      method: request.method,
      header: buildHeaders(request.headers),
      data: request.body as never,
      success: (response) => {
        resolve({
          status: response.statusCode,
          body: response.data
        });
      },
      fail: (error) => {
        reject(new Error(`请求未发出或被小程序环境拦截：${error.errMsg || request.url}`));
      }
    });
  });
}

export function getApiUrl() {
  return appConfig.apiUrl;
}

export function uploadFile(options: UploadFileOptions): Promise<FileResult> {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: buildUrl(options.url),
      filePath: options.filePath,
      name: options.name,
      header: buildHeaders(options.headers ?? {}),
      formData: options.formData,
      success: (response) => {
        resolve({
          status: response.statusCode,
          body: parseBody(response.data)
        });
      },
      fail: (error) => {
        reject(new Error(`上传请求未发出或被小程序环境拦截：${error.errMsg || options.url}`));
      }
    });
  });
}

export function downloadFile(options: DownloadFileOptions): Promise<DownloadFileResult> {
  return new Promise((resolve, reject) => {
    uni.downloadFile({
      url: buildUrl(options.url),
      header: buildHeaders(options.headers ?? {}),
      success: (response) => {
        resolve({
          status: response.statusCode,
          tempFilePath: response.tempFilePath
        });
      },
      fail: (error) => {
        reject(new Error(`下载请求未发出或被小程序环境拦截：${error.errMsg || options.url}`));
      }
    });
  });
}
