import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DuplicatesService {
  constructor(private readonly prisma: PrismaService) {}

  async listRecentKeys(take: number) {
    const keys = await this.prisma.recentDuplicateKey.findMany({
      take: Math.min(Math.max(take || 100, 1), 500),
      orderBy: { created_at: "desc" },
      include: {
        profile: {
          include: {
            chassis_code: true
          }
        },
        first_machine: true,
        first_scan_record: true
      }
    });

    return {
      success: true,
      code: "RECENT_DUPLICATE_KEYS_LISTED",
      message: "Recent duplicate keys loaded.",
      data: keys
    };
  }

  async listHistoricalResults(take: number) {
    const results = await this.prisma.historicalDuplicateResult.findMany({
      take: Math.min(Math.max(take || 100, 1), 500),
      orderBy: { created_at: "desc" },
      include: {
        job: true,
        profile: {
          include: {
            chassis_code: true
          }
        }
      }
    });

    return {
      success: true,
      code: "HISTORICAL_DUPLICATES_LISTED",
      message: "Historical duplicate results loaded.",
      data: results
    };
  }
}
