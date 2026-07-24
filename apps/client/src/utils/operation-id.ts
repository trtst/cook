import type { UUID } from "@/apis/http";

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

// 生成 UUID v4 形态的 operationId，供前端可重试写请求复用幂等键。
export function createOperationId(): UUID {
  const bytes = new Uint8Array(16);
  fillRandom(bytes);
  // 写入 RFC 4122 要求的 version / variant 位，再格式化成 UUID 字符串。
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
