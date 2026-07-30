type RandomSource = typeof globalThis & {
  crypto?: {
    getRandomValues?: <T extends Uint8Array>(array: T) => T;
  };
};

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

export function createOperationId() {
  const bytes = new Uint8Array(4);
  fillRandom(bytes);
  const randomPart = Array.from(bytes, byte => byte.toString().padStart(3, "0")).join("");

  return `${Date.now()}${randomPart}`;
}
