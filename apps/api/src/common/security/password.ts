import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const keyLength = 64;
const passwordLengthError = "密码需要 8-20 位字符";
const passwordCategoryError = "密码需至少包含字母、数字、符号中的两种";

export function passwordPolicyError(password: string) {
  if (password.length < 8 || password.length > 20) return passwordLengthError;

  const categoryCount = [
    /[A-Za-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ].filter(Boolean).length;

  return categoryCount >= 2 ? null : passwordCategoryError;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, keyLength).toString("base64url");

  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split(":");

  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "base64url");
  const actual = scryptSync(password, salt, expected.length);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
