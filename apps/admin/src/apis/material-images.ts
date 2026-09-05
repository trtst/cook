import { requestData, uploadForm, type IsoDateTime, type OperationId, type PageQuery, type PageResult, type UUID } from "./http";

export interface AdminMaterialImageItem {
  id: UUID;
  imageUrl: string;
  note: string;
  contentType: string;
  sizeBytes: number;
  width: number;
  height: number;
  uploader: {
    id: UUID;
    displayName: string;
  };
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AdminMaterialImageDeleteResult {
  id: UUID;
  deleted: boolean;
}

export const materialImagesApi = {
  list(query: PageQuery) {
    return requestData<PageResult<AdminMaterialImageItem>>("/admin/material-images", {
      query: {
        page: query.page,
        pageSize: query.pageSize
      }
    });
  },
  upload(file: File, note: string, operationId: OperationId) {
    const formData = new FormData();
    formData.append("note", note);
    formData.append("file", file);
    return uploadForm<AdminMaterialImageItem>("/admin/material-images", formData, {
      idempotencyKey: operationId
    });
  },
  delete(imageId: UUID, operationId: OperationId) {
    return requestData<AdminMaterialImageDeleteResult>(`/admin/material-images/${encodeURIComponent(String(imageId))}`, {
      method: "DELETE",
      idempotencyKey: operationId
    });
  }
};
