import { BadRequestException, Injectable } from "@nestjs/common";
import { Severity } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpsertErrorDefinitionDto } from "./dto/upsert-error-definition.dto";

type ObservedReason = {
  code: string;
  scan_count: number;
  led_count: number;
  occurrence_count: number;
  first_seen_at: Date | null;
  last_seen_at: Date | null;
};

@Injectable()
export class ErrorConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async listErrorDefinitions() {
    const [definitions, observations] = await Promise.all([
      this.prisma.errorCode.findMany({ orderBy: { code: "asc" } }),
      this.prisma.$queryRaw<ObservedReason[]>`
        WITH observed AS (
          SELECT
            "id" AS scan_record_id,
            UPPER(BTRIM("ng_reason")) AS code,
            "created_at",
            TRUE AS is_scan_reason
          FROM "scan_records"
          WHERE "ng_reason" IS NOT NULL AND BTRIM("ng_reason") <> ''

          UNION ALL

          SELECT
            "scan_record_id",
            UPPER(BTRIM("ng_reason")) AS code,
            "created_at",
            FALSE AS is_scan_reason
          FROM "scan_led_items"
          WHERE "ng_reason" IS NOT NULL AND BTRIM("ng_reason") <> ''
        )
        SELECT
          code,
          COUNT(*) FILTER (WHERE is_scan_reason)::INTEGER AS scan_count,
          COUNT(*) FILTER (WHERE NOT is_scan_reason)::INTEGER AS led_count,
          COUNT(DISTINCT scan_record_id)::INTEGER AS occurrence_count,
          MIN("created_at") AS first_seen_at,
          MAX("created_at") AS last_seen_at
        FROM observed
        GROUP BY code
      `
    ]);

    const observationByCode = new Map(observations.map((observation) => [observation.code, observation]));

    const definitionByCode = new Map(definitions.map((definition) => [definition.code, definition]));
    const codes = new Set([...definitionByCode.keys(), ...observationByCode.keys()]);
    const data = [...codes]
      .map((code) => {
        const definition = definitionByCode.get(code) ?? null;
        const observation = observationByCode.get(code) ?? this.emptyObservation();
        return {
          ...observation,
          code,
          identified: Boolean(definition),
          definition
        };
      })
      .sort((left, right) => {
        if (left.identified !== right.identified) {
          return left.identified ? 1 : -1;
        }
        const latestDifference = (right.last_seen_at?.getTime() ?? 0) - (left.last_seen_at?.getTime() ?? 0);
        return latestDifference || left.code.localeCompare(right.code);
      });

    return {
      success: true,
      code: "ERROR_DEFINITIONS_LISTED",
      message: "Đã tải danh sách cấu hình lỗi.",
      data
    };
  }

  async upsertErrorDefinition(dto: UpsertErrorDefinitionDto, actorUserId?: number | null) {
    const code = this.normalizeCode(dto.code);
    const current = await this.prisma.errorCode.findUnique({ where: { code } });
    const data = {
      name_vi: dto.name_vi.trim(),
      name_en: this.cleanOptionalText(dto.name_en),
      default_message: this.cleanOptionalText(dto.default_message),
      group_name: this.cleanOptionalText(dto.group_name),
      severity: dto.severity ?? current?.severity ?? Severity.ERROR,
      local_action: this.cleanOptionalText(dto.local_action),
      is_active: dto.is_active ?? current?.is_active ?? true
    };

    const definition = await this.prisma.errorCode.upsert({
      where: { code },
      create: { code, ...data },
      update: data
    });

    await this.audit.write({
      userId: actorUserId,
      action: current ? "UPDATE_ERROR_DEFINITION" : "IDENTIFY_ERROR_CODE",
      tableName: "error_codes",
      recordId: definition.id,
      oldValue: current,
      newValue: definition
    });

    return {
      success: true,
      code: current ? "ERROR_DEFINITION_UPDATED" : "ERROR_CODE_IDENTIFIED",
      message: current ? "Đã cập nhật cấu hình lỗi." : "Đã định danh mã lỗi.",
      data: definition
    };
  }

  private normalizeCode(value: string) {
    const code = value.trim().toUpperCase();
    if (!code) {
      throw new BadRequestException({
        success: false,
        code: "ERROR_CODE_INVALID",
        message: "Mã lỗi không được để trống."
      });
    }
    return code;
  }

  private cleanOptionalText(value?: string | null) {
    const text = value?.trim();
    return text || null;
  }

  private emptyObservation(): ObservedReason {
    return { code: "", scan_count: 0, led_count: 0, occurrence_count: 0, first_seen_at: null, last_seen_at: null };
  }
}
