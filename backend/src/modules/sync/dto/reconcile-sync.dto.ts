import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";

export class ReconcileLocalRecordDto {
  @ApiProperty({ example: "LOCAL01-20260713-000001" })
  @IsString()
  @IsNotEmpty()
  local_scan_id!: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  profile_id?: number;

  @ApiPropertyOptional({ example: "1F1SX880447" })
  @IsOptional()
  @IsString()
  duplicate_key?: string;

  @ApiPropertyOptional({ enum: ["OK", "NG"], example: "OK" })
  @IsOptional()
  @IsIn(["OK", "NG"])
  local_status?: "OK" | "NG";

  @ApiPropertyOptional({ enum: ["OK", "NG", "SKIPPED"], example: "OK" })
  @IsOptional()
  @IsIn(["OK", "NG", "SKIPPED"])
  server_status?: "OK" | "NG" | "SKIPPED";

  @ApiPropertyOptional({ enum: ["OK", "NG"], example: "OK" })
  @IsOptional()
  @IsIn(["OK", "NG"])
  final_status?: "OK" | "NG";

  @ApiPropertyOptional({ example: "SERVER_DUPLICATE" })
  @IsOptional()
  @IsString()
  ng_reason?: string | null;

  @ApiPropertyOptional({ example: "2026-07-13T08:30:25+07:00" })
  @IsOptional()
  @IsISO8601()
  scan_at?: string;

  @ApiPropertyOptional({ example: "sha256:record-summary" })
  @IsOptional()
  @IsString()
  checksum?: string;
}

export class ReconcileCheckDto {
  @ApiProperty({ example: "SN-LOCAL01-2026" })
  @IsString()
  @IsNotEmpty()
  serial!: string;

  @ApiProperty({ example: "UID-8f8f2f1c-local01" })
  @IsString()
  @IsNotEmpty()
  uid!: string;

  @ApiHideProperty()
  @IsOptional()
  @IsString()
  ip_address?: string;

  @ApiPropertyOptional({ example: "2026-07-13T00:00:00+07:00" })
  @IsOptional()
  @IsISO8601()
  from_scan_at?: string;

  @ApiPropertyOptional({ example: "2026-07-13T23:59:59+07:00" })
  @IsOptional()
  @IsISO8601()
  to_scan_at?: string;

  @ApiPropertyOptional({ example: 1200 })
  @IsOptional()
  @IsInt()
  @Min(0)
  local_total_record?: number;

  @ApiPropertyOptional({ example: 1180 })
  @IsOptional()
  @IsInt()
  @Min(0)
  local_ok_record?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  local_ng_record?: number;

  @ApiPropertyOptional({ example: "sha256:manifest-summary" })
  @IsOptional()
  @IsString()
  local_checksum?: string;

  @ApiPropertyOptional({ type: [ReconcileLocalRecordDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10000)
  @ValidateNested({ each: true })
  @Type(() => ReconcileLocalRecordDto)
  records?: ReconcileLocalRecordDto[];
}

export class ReconcilePullDto {
  @ApiProperty({ example: "SN-LOCAL01-2026" })
  @IsString()
  @IsNotEmpty()
  serial!: string;

  @ApiProperty({ example: "UID-8f8f2f1c-local01" })
  @IsString()
  @IsNotEmpty()
  uid!: string;

  @ApiPropertyOptional({ example: ["LOCAL01-20260713-000001", "LOCAL01-20260713-000002"] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  local_scan_ids?: string[];

  @ApiPropertyOptional({ example: "2026-07-13T00:00:00+07:00" })
  @IsOptional()
  @IsISO8601()
  from_scan_at?: string;

  @ApiPropertyOptional({ example: "2026-07-13T23:59:59+07:00" })
  @IsOptional()
  @IsISO8601()
  to_scan_at?: string;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  take?: number;
}
