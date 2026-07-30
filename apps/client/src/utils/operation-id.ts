import type { OperationId } from "@/apis/http";

// 小程序运行环境不一定完整暴露 Web Crypto，这里先把可用能力收窄出来。
type RandomSource = typeof globalThis & {
  crypto?: {
    getRandomValues?: <T extends Uint8Array>(array: T) => T;
  };
};

// 给字节数组填充随机数。
// 优先走 Web Crypto；不支持时才退回到 Math.random。
function fillRandom(bytes: Uint8Array) {
  const randomSource = globalThis as RandomSource;

  if (randomSource.crypto?.getRandomValues) {
    randomSource.crypto.getRandomValues(bytes);
    return;
  }

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
}

// 生成纯数字 operationId，供前端可重试写请求复用幂等键。
export function createOperationId(): OperationId {
  const bytes = new Uint8Array(4);
  fillRandom(bytes);
  const randomPart = Array.from(bytes, byte => byte.toString().padStart(3, "0")).join("");
  return `${Date.now()}${randomPart}`;
}
