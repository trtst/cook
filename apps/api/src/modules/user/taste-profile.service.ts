import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
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
          allergies: body.allergies,
          strictDislikes: body.strictDislikes,
          dislikedIngredients: body.dislikedIngredients,
          flavorPreferences: body.flavorPreferences,
          note: body.note
        },
        update: {
          allergies: body.allergies,
          strictDislikes: body.strictDislikes,
          dislikedIngredients: body.dislikedIngredients,
          flavorPreferences: body.flavorPreferences,
          note: body.note
        }
      });

      return toResponse(profile);
    });
  }
}
