import { PrismaClient, type UserTasteProfile } from "@prisma/client";
import type { TasteProfileResponse, UpdateTasteProfileRequest } from "@next-meal/api-client";
import { loadLocalEnv } from "../src/common/load-env";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const ownerPhone = process.env.TEST_OWNER_PHONE ?? "13800000000";
const guestPhone = process.env.TEST_GUEST_PHONE ?? "13900000000";
const password = process.env.TEST_USER_PASSWORD ?? "change-me";

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface LoginResult {
  token: string;
  user: { id: string; uid: number };
}

const commonHeaders = {
  "content-type": "application/json",
  "x-cook-from": "mini_program",
  "x-cook-version": "0.1.0"
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { ...commonHeaders, ...options.headers }
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  return { status: response.status, body };
}

async function requestData<T>(path: string, options: RequestInit = {}) {
  const result = await request<T>(path, options);
  assert(result.status >= 200 && result.status < 300, `${path} HTTP ${result.status}: ${result.body.message}`);
  assert(result.body.code === 0, `${path} code ${result.body.code}: ${result.body.message}`);
  return result.body.data;
}

function assertProfile(actual: TasteProfileResponse, expected: UpdateTasteProfileRequest, message: string) {
  assert(
    JSON.stringify(actual.allergies) === JSON.stringify(expected.allergies),
    `${message}: allergies mismatch ${JSON.stringify(actual.allergies)}`
  );
  assert(
    JSON.stringify(actual.strictDislikes) === JSON.stringify(expected.strictDislikes),
    `${message}: strictDislikes mismatch`
  );
  assert(
    JSON.stringify(actual.dislikedIngredients) === JSON.stringify(expected.dislikedIngredients),
    `${message}: dislikedIngredients mismatch`
  );
  assert(
    JSON.stringify(actual.flavorPreferences) === JSON.stringify(expected.flavorPreferences),
    `${message}: flavorPreferences mismatch`
  );
  assert(actual.note === expected.note, `${message}: note mismatch`);
  assert(!Number.isNaN(Date.parse(actual.updatedAt)), `${message}: updatedAt is not ISO time`);
}

async function restoreProfile(prisma: PrismaClient, userId: string, profile: UserTasteProfile | null) {
  await prisma.userTasteProfile.deleteMany({ where: { userId } });
  if (!profile) return;

  await prisma.userTasteProfile.create({
    data: {
      userId,
      allergies: profile.allergies,
      strictDislikes: profile.strictDislikes,
      dislikedIngredients: profile.dislikedIngredients,
      flavorPreferences: profile.flavorPreferences,
      note: profile.note,
      updatedAt: profile.updatedAt
    }
  });
}

async function main() {
  const prisma = new PrismaClient();
  const ownerLogin = await requestData<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone: ownerPhone, password })
  });
  const guestLogin = await requestData<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone: guestPhone, password })
  });
  const ownerAuthorization = `Bearer ${ownerLogin.token}`;
  const guestAuthorization = `Bearer ${guestLogin.token}`;
  const [ownerBefore, guestBefore] = await Promise.all([
    prisma.userTasteProfile.findUnique({ where: { userId: ownerLogin.user.id } }),
    prisma.userTasteProfile.findUnique({ where: { userId: guestLogin.user.id } })
  ]);

  try {
    await prisma.userTasteProfile.deleteMany({
      where: { userId: { in: [ownerLogin.user.id, guestLogin.user.id] } }
    });

    const unauthenticatedGet = await request<TasteProfileResponse>("/users/me/taste-profile");
    assert(unauthenticatedGet.status === 401, "unauthenticated taste profile GET should return 401");

    const unauthenticatedPut = await request<TasteProfileResponse>("/users/me/taste-profile", {
      method: "PUT",
      body: JSON.stringify({
        allergies: [],
        strictDislikes: [],
        dislikedIngredients: [],
        flavorPreferences: [],
        note: null
      })
    });
    assert(unauthenticatedPut.status === 401, "unauthenticated taste profile PUT should return 401");

    const empty = await requestData<TasteProfileResponse>("/users/me/taste-profile", {
      headers: { authorization: ownerAuthorization }
    });
    assertProfile(
      empty,
      { allergies: [], strictDislikes: [], dislikedIngredients: [], flavorPreferences: [], note: null },
      "empty profile"
    );

    const ownerProfile: UpdateTasteProfileRequest = {
      allergies: ["花生"],
      strictDislikes: ["香菜"],
      dislikedIngredients: ["苦瓜"],
      flavorPreferences: ["清淡", "微辣"],
      note: "过敏信息需优先提示"
    };
    const ownerInput: UpdateTasteProfileRequest = {
      allergies: [" 花生 "],
      strictDislikes: ["香菜"],
      dislikedIngredients: ["苦瓜"],
      flavorPreferences: ["清淡", "微辣"],
      note: " 过敏信息需优先提示 "
    };
    const saved = await requestData<TasteProfileResponse>("/users/me/taste-profile", {
      method: "PUT",
      headers: { authorization: ownerAuthorization },
      body: JSON.stringify(ownerInput)
    });
    assertProfile(saved, ownerProfile, "saved profile");

    const reloaded = await requestData<TasteProfileResponse>("/users/me/taste-profile", {
      headers: { authorization: ownerAuthorization }
    });
    assertProfile(reloaded, ownerProfile, "reloaded profile");

    const guestEmpty = await requestData<TasteProfileResponse>("/users/me/taste-profile", {
      headers: { authorization: guestAuthorization }
    });
    assertProfile(
      guestEmpty,
      { allergies: [], strictDislikes: [], dislikedIngredients: [], flavorPreferences: [], note: null },
      "guest isolation"
    );

    const guestProfile: UpdateTasteProfileRequest = {
      allergies: [],
      strictDislikes: ["葱"],
      dislikedIngredients: [],
      flavorPreferences: ["酸甜"],
      note: null
    };
    await requestData<TasteProfileResponse>("/users/me/taste-profile", {
      method: "PUT",
      headers: { authorization: guestAuthorization },
      body: JSON.stringify(guestProfile)
    });
    const ownerAfterGuestWrite = await requestData<TasteProfileResponse>("/users/me/taste-profile", {
      headers: { authorization: ownerAuthorization }
    });
    assertProfile(ownerAfterGuestWrite, ownerProfile, "owner after guest write");

    const oversized = await request<TasteProfileResponse>("/users/me/taste-profile", {
      method: "PUT",
      headers: { authorization: ownerAuthorization },
      body: JSON.stringify({ ...ownerProfile, allergies: Array.from({ length: 51 }, (_, index) => `食材${index}`) })
    });
    assert(oversized.status === 400, "oversized taste profile should return 400");

    const blankItem = await request<TasteProfileResponse>("/users/me/taste-profile", {
      method: "PUT",
      headers: { authorization: ownerAuthorization },
      body: JSON.stringify({ ...ownerProfile, allergies: ["   "] })
    });
    assert(blankItem.status === 400, "blank taste profile item should return 400");

    const duplicateItem = await request<TasteProfileResponse>("/users/me/taste-profile", {
      method: "PUT",
      headers: { authorization: ownerAuthorization },
      body: JSON.stringify({ ...ownerProfile, allergies: ["花生", " 花生 "] })
    });
    assert(duplicateItem.status === 400, "duplicate taste profile item should return 400");

    console.log(
      JSON.stringify(
        {
          apiBaseUrl,
          emptyProfileStable: true,
          saveAndReload: true,
          crossUserIsolation: true,
          unauthenticatedGetStatus: unauthenticatedGet.status,
          unauthenticatedPutStatus: unauthenticatedPut.status,
          oversizedStatus: oversized.status,
          blankItemStatus: blankItem.status,
          duplicateItemStatus: duplicateItem.status
        },
        null,
        2
      )
    );
  } finally {
    await Promise.all([
      restoreProfile(prisma, ownerLogin.user.id, ownerBefore),
      restoreProfile(prisma, guestLogin.user.id, guestBefore)
    ]);
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
