import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";

interface UserTokenPayload {
  sub: string;
  exp: number;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function readPayload(encodedPayload: string): UserTokenPayload {
  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<UserTokenPayload>;

    if (typeof payload.sub !== "string" || !payload.sub || typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
      throw new UnauthorizedException("未登录或 token 失效");
    }

    return {
      sub: payload.sub,
      exp: payload.exp
    };
  } catch {
    throw new UnauthorizedException("未登录或 token 失效");
  }
}

function getSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret === "replace-with-local-secret") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be configured in production");
    }

    return "next-meal-local-development-secret";
  }

  return secret;
}

function sign(data: string) {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

function getTokenSeconds() {
  const configured = process.env.USER_TOKEN_EXPIRES_SECONDS;

  if (configured) {
    const seconds = Number(configured);
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  }

  return process.env.NODE_ENV === "production" ? 1_209_600 : 2_592_000;
}

@Injectable()
export class UserTokenService {
  createToken(userId: string) {
    const expiresInSeconds = getTokenSeconds();
    const payload: UserTokenPayload = {
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds
    };
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = sign(encodedPayload);

    return {
      token: `${encodedPayload}.${signature}`,
      expiresAt: new Date(payload.exp * 1000).toISOString()
    };
  }

  verifyToken(token: string) {
    const [encodedPayload, signature] = token.split(".");

    if (!encodedPayload || !signature) {
      throw new UnauthorizedException("未登录或 token 失效");
    }

    const expected = sign(encodedPayload);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
      throw new UnauthorizedException("未登录或 token 失效");
    }

    const payload = readPayload(encodedPayload);

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException("未登录或 token 失效");
    }

    return payload;
  }
}
