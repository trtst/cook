import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { UserTasteProfile } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import type { TasteProfileResponse, UpdateTasteProfileRequest, UUID } from "../../contracts/types";

function toResponse(profile: UserTasteProfile): TasteProfileResponse {
  return {
    allergies: profile.allergies,
    strictDislikes: profile.strictDislikes,
    dislikedIngredients: profile.dislikedIngredients,
    flavorPreferences: profile.flavorPreferences,
    note: profile.note,
    updatedAt: profile.updatedAt.toISOString()
  };
}

function cleanTextList(items: string[], fieldName: string) {
  if (items.length > 50) throw new BadRequestException(`${fieldName}最多 50 项`);

  const cleaned = items.map(item => item.trim());
  if (cleaned.some(item => item.length === 0)) throw new BadRequestException(`${fieldName}不能包含空项`);
  if (cleaned.some(item => item.length > 64)) throw new BadRequestException(`${fieldName}单项最多 64 个字符`);
  if (new Set(cleaned).size !== cleaned.length) throw new BadRequestException(`${fieldName}不能重复`);
  return cleaned;
}

function cleanProfile(body: UpdateTasteProfileRequest): UpdateTasteProfileRequest {
  const note = body.note === null ? null : body.note.trim();
  if (note !== null && note.length > 1000) throw new BadRequestException("备注最多 1000 个字符");

  return {
    allergies: cleanTextList(body.allergies, "过敏"),
    strictDislikes: cleanTextList(body.strictDislikes, "严格忌口"),
    dislikedIngredients: cleanTextList(body.dislikedIngredients, "不喜欢食材"),
    flavorPreferences: cleanTextList(body.flavorPreferences, "口味偏好"),
    note
  };
}

@Injectable()
export class TasteProfileService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getCurrent(userId: UUID): Promise<TasteProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
        createdAt: true,
        tasteProfile: true
      }
    });

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("未登录或 token 失效");
    }

    if (user.tasteProfile) return toResponse(user.tasteProfile);

    return {
      allergies: [],
      strictDislikes: [],
      dislikedIngredients: [],
      flavorPreferences: [],
      note: null,
      updatedAt: user.createdAt.toISOString()
    };
  }

  updateCurrent(userId: UUID, body: UpdateTasteProfileRequest): Promise<TasteProfileResponse> {
    const profileBody = cleanProfile(body);

    return this.prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { status: true }
      });

      if (!user || user.status !== "ACTIVE") {
        throw new UnauthorizedException("未登录或 token 失效");
      }

      const profile = await tx.userTasteProfile.upsert({
        where: { userId },
        create: {
          userId,
          allergies: profileBody.allergies,
          strictDislikes: profileBody.strictDislikes,
          dislikedIngredients: profileBody.dislikedIngredients,
          flavorPreferences: profileBody.flavorPreferences,
          note: profileBody.note
        },
        update: {
          allergies: profileBody.allergies,
          strictDislikes: profileBody.strictDislikes,
          dislikedIngredients: profileBody.dislikedIngredients,
          flavorPreferences: profileBody.flavorPreferences,
          note: profileBody.note
        }
      });

      return toResponse(profile);
    });
  }
}
