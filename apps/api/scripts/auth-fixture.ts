import { randomInt } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/common/security/password";
import type { AuthSessionResult } from "../src/contracts/types";

type RequestData = <T>(path: string, options?: RequestInit) => Promise<T>;

let deviceSeed = 0;

export async function ensurePasswordUser(phone: string, password: string) {
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (existing) return;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        await prisma.user.create({
          data: {
            phone,
            passwordHash: hashPassword(password),
            uid: randomInt(10_000_000, 100_000_000)
          }
        });
        return;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
        const targets = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [];
        if (targets.includes("phone")) return;
      }
    }

    throw new Error(`unable to create password test user for ${phone}`);
  } finally {
    await prisma.$disconnect();
  }
}

export async function loginWithPassword(requestData: RequestData, phone: string, password: string) {
  await ensurePasswordUser(phone, password);
  deviceSeed += 1;
  const session = await requestData<AuthSessionResult>("/auth/password/login", {
    method: "POST",
    body: JSON.stringify({
      phone,
      password,
      deviceId: `script-${process.pid}-${deviceSeed}`
    })
  });

  return {
    ...session,
    token: session.accessToken,
    expiresAt: session.accessExpiresAt
  };
}
