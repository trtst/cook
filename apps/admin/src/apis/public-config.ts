import { requestData, uploadForm } from "./http";

export interface LoginImageConfig {
  imageUrl: string | null;
}

export interface AppConfigResponse {
  login: LoginImageConfig;
}

export const publicConfigApi = {
  getConfig() {
    return requestData<AppConfigResponse>("/admin/app-config");
  },
  uploadLoginImage(file: File, operationId: string) {
    const formData = new FormData();
    formData.append("operationId", operationId);
    formData.append("file", file);
    return uploadForm<AppConfigResponse>("/admin/app-config/login-image", formData);
  },
  clearLoginImage(operationId: string) {
    return requestData<AppConfigResponse>("/admin/app-config/login-image", {
      method: "DELETE",
      body: { operationId }
    });
  }
};
