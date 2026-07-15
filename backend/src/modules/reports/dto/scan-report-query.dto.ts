import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsISO8601, IsOptional, MaxLength, ValidateBy, type ValidationArguments, type ValidationOptions } from "class-validator";
import { REPORT_COLUMN_KEYS, REPORT_FINAL_STATUSES, REPORT_LOCALES } from "../report-definition";

const csvMachineCodePattern = /^[A-Za-z0-9_-]+(?:,[A-Za-z0-9_-]+)*$/;
const csvPositiveIntegerPattern = /^[1-9]\d*(?:,[1-9]\d*)*$/;

function normalizeOptionalQueryValue({ value }: { value: unknown }) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const text = Array.isArray(value) ? value.join(",") : String(value);
  const normalized = text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(",");

  return normalized || undefined;
}

function IsCsvOf(allowedValues: readonly string[], maxItems: number, validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: "isCsvOf",
      constraints: [allowedValues, maxItems],
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (typeof value !== "string") {
            return false;
          }

          const [allowed, max] = args.constraints as [readonly string[], number];
          const items = parseCsv(value);
          if (items.length === 0 || items.length > max) {
            return false;
          }

          const unique = new Set(items);
          return unique.size === items.length && items.every((item) => allowed.includes(item));
        },
        defaultMessage(args: ValidationArguments) {
          const [allowed, max] = args.constraints as [readonly string[], number];
          return `${args.property} must be a comma-separated list with at most ${max} unique values from: ${allowed.join(", ")}`;
        }
      }
    },
    validationOptions
  );
}

function IsCsvPositiveIntegerList(maxItems: number, validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: "isCsvPositiveIntegerList",
      constraints: [maxItems],
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (typeof value !== "string" || !csvPositiveIntegerPattern.test(value)) {
            return false;
          }

          const [max] = args.constraints as [number];
          const items = parseCsv(value);
          const unique = new Set(items);
          return items.length > 0 && items.length <= max && unique.size === items.length;
        },
        defaultMessage(args: ValidationArguments) {
          const [max] = args.constraints as [number];
          return `${args.property} must contain at most ${max} unique positive integer ids`;
        }
      }
    },
    validationOptions
  );
}

function IsCsvMachineCodeList(maxItems: number, validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: "isCsvMachineCodeList",
      constraints: [maxItems],
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (typeof value !== "string" || !csvMachineCodePattern.test(value)) {
            return false;
          }

          const [max] = args.constraints as [number];
          const items = parseCsv(value);
          const unique = new Set(items);
          return items.length > 0 && items.length <= max && unique.size === items.length;
        },
        defaultMessage(args: ValidationArguments) {
          const [max] = args.constraints as [number];
          return `${args.property} must contain at most ${max} unique machine codes using letters, numbers, underscore, or dash`;
        }
      }
    },
    validationOptions
  );
}

function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export class ScanReportQueryDto {
  @ApiPropertyOptional({ example: "2026-07-01T00:00:00+07:00" })
  @Transform(normalizeOptionalQueryValue)
  @IsOptional()
  @IsISO8601({ strict: true }, { message: "from must be a valid ISO-8601 datetime" })
  from?: string;

  @ApiPropertyOptional({ example: "2026-07-15T23:59:59+07:00" })
  @Transform(normalizeOptionalQueryValue)
  @IsOptional()
  @IsISO8601({ strict: true }, { message: "to must be a valid ISO-8601 datetime" })
  to?: string;

  @ApiPropertyOptional({ description: "Comma-separated machine codes.", example: "LOCAL01,LOCAL02" })
  @Transform(normalizeOptionalQueryValue)
  @IsOptional()
  @MaxLength(800)
  @IsCsvMachineCodeList(50)
  machine_codes?: string;

  @ApiPropertyOptional({ description: "Comma-separated profile ids.", example: "1,2" })
  @Transform(normalizeOptionalQueryValue)
  @IsOptional()
  @MaxLength(400)
  @IsCsvPositiveIntegerList(50)
  profile_ids?: string;

  @ApiPropertyOptional({ description: "Comma-separated final statuses.", example: "OK,NG" })
  @Transform(normalizeOptionalQueryValue)
  @IsOptional()
  @IsCsvOf(REPORT_FINAL_STATUSES, REPORT_FINAL_STATUSES.length)
  final_statuses?: string;

  @ApiPropertyOptional({ description: "Comma-separated report column keys." })
  @Transform(normalizeOptionalQueryValue)
  @IsOptional()
  @MaxLength(1200)
  @IsCsvOf(REPORT_COLUMN_KEYS, REPORT_COLUMN_KEYS.length)
  column_keys?: string;

  @ApiPropertyOptional({ description: "Include workbook summary sheet.", example: "true" })
  @Transform(normalizeOptionalQueryValue)
  @IsOptional()
  @IsIn(["true", "false", "1", "0"], { message: "include_summary must be true, false, 1, or 0" })
  include_summary?: string;

  @ApiPropertyOptional({ enum: ["vi", "en"], example: "vi" })
  @Transform(normalizeOptionalQueryValue)
  @IsOptional()
  @IsIn(REPORT_LOCALES)
  locale?: "vi" | "en";
}
