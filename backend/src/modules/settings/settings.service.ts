import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getServerSettings() {
    const settings = await this.prisma.serverSetting.findFirst({
      orderBy: { id: "asc" }
    });

    return {
      success: true,
      code: "SERVER_SETTINGS_LOADED",
      message: "Server settings loaded.",
      data: settings
    };
  }
}
