import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async listProfiles() {
    const profiles = await this.prisma.productProfile.findMany({
      orderBy: [{ is_active: "desc" }, { updated_at: "desc" }],
      include: {
        chassis_code: true,
        vendor: true,
        profile_led_codes: {
          include: {
            led_code: true
          },
          orderBy: {
            led_slot: "asc"
          }
        }
      }
    });

    return {
      success: true,
      code: "PROFILES_LISTED",
      message: "Product profiles loaded.",
      data: profiles
    };
  }
}
