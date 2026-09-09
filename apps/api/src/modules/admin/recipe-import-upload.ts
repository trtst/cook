import { BadRequestException } from "@nestjs/common";
import type { Readable } from "node:stream";

const maxJsonFileBytes = 10 * 1024 * 1024;
const maxJsonBatchBytes = 20 * 1024 * 1024;
const recipeJsonUploadBytes = Symbol("recipeJsonUploadBytes");

type UploadRequest = {
  [recipeJsonUploadBytes]?: number;
};

type UploadFile = {
  stream: Readable;
};

type UploadInfo = {
  buffer: Buffer;
  size: number;
};

type UploadCallback = (error: Error | null, info?: UploadInfo) => void;

function uploadLimitError(message: string) {
  return new BadRequestException(message);
}

export const recipeJsonUploadStorage = {
  _handleFile(request: UploadRequest, file: UploadFile, callback: UploadCallback) {
    const chunks: Buffer[] = [];
    const initialTotal = request[recipeJsonUploadBytes] ?? 0;
    let total = initialTotal;
    let size = 0;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      file.stream.resume();
      callback(error);
    };

    file.stream.once("limit", () => fail(uploadLimitError("单个 JSON 文件大小不能超过 10 MB")));
    file.stream.on("data", chunk => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (total + buffer.length > maxJsonBatchBytes) {
        fail(uploadLimitError("批量 JSON 总大小不能超过 20 MB"));
        return;
      }
      total += buffer.length;
      size += buffer.length;
      chunks.push(buffer);
    });
    file.stream.once("error", error => fail(error));
    file.stream.once("end", () => {
      if (settled) return;
      settled = true;
      request[recipeJsonUploadBytes] = total;
      callback(null, { buffer: Buffer.concat(chunks), size });
    });
  },

  _removeFile(_request: UploadRequest, file: UploadInfo) {
    file.buffer = Buffer.alloc(0);
  }
};

export const recipeJsonUploadLimits = {
  fileSize: maxJsonFileBytes,
  files: 100
};
