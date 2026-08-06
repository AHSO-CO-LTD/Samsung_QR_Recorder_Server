import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsDefined, IsIn, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, Min, ValidateIf, ValidateNested } from "class-validator";
import { LOCAL_SCAN_STATUSES, requiresCompleteScanPayload, type LocalSubmitScanStatus } from "../local-scan-status";

export class FullCodePayloadDto {
  @ApiProperty({ example: "VN39BN9658567A1F1S58282ADZLVX880447" })
  @IsString()
  raw!: string;

  @ApiProperty({ example: "VN39" })
  @IsString()
  prefix!: string;

  @ApiProperty({ example: "BN96-58567A" })
  @IsString()
  chassis_code!: string;

  @ApiProperty({ example: "1F1" })
  @IsString()
  before_vendor!: string;

  @ApiProperty({ example: "S" })
  @IsString()
  vendor_char!: string;

  @ApiProperty({ example: "BN96-58282A" })
  @IsString()
  led_code!: string;

  @ApiProperty({ example: "DZLV" })
  @IsString()
  factory_code!: string;

  @ApiProperty({ example: "X880447" })
  @IsString()
  after_factory!: string;
}

export class LedScanPayloadDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  slot!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  index!: number;

  @ApiProperty({ example: "000000000000001S8282AX" })
  @IsString()
  raw!: string;

  @ApiProperty({ example: "000000000000001" })
  @IsString()
  lot_no!: string;

  @ApiProperty({ example: "S" })
  @IsString()
  vendor_char!: string;

  @ApiProperty({ example: "8282A" })
  @IsString()
  suffix!: string;

  @ApiProperty({ enum: LOCAL_SCAN_STATUSES, example: "OK" })
  @IsIn(LOCAL_SCAN_STATUSES)
  status!: LocalSubmitScanStatus;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsString()
  ng_reason?: string | null;
}

export class SubmitScanDto {
  @ApiProperty({
    example: "LOCAL01-20260708-000001",
    description: "For REWORK, use RW- followed by the original NG local_scan_id, for example RW-LOCAL01-20260708-000001."
  })
  @IsString()
  local_scan_id!: string;

  @ApiProperty({ example: "LOCAL01" })
  @IsString()
  machine_code!: string;

  @ApiProperty({ example: "SN-LOCAL01-2026" })
  @IsString()
  @IsNotEmpty()
  serial!: string;

  @ApiProperty({ example: "UID-8f8f2f1c-local01" })
  @IsString()
  @IsNotEmpty()
  uid!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  profile_id!: number;

  @ApiPropertyOptional({ example: "1F1SX880447", description: "Required when local_status is OK or REWORK. Local NG may omit it." })
  @ValidateIf((dto: SubmitScanDto) => requiresCompleteScanPayload(dto.local_status))
  @IsString()
  duplicate_key?: string;

  @ApiPropertyOptional({ type: FullCodePayloadDto, description: "Required when local_status is OK or REWORK. Local NG may send malformed or partial code data." })
  @ValidateIf((dto: SubmitScanDto) => requiresCompleteScanPayload(dto.local_status))
  @IsDefined()
  @ValidateNested()
  @Type(() => FullCodePayloadDto)
  full_code?: FullCodePayloadDto;

  @ApiPropertyOptional({ example: "BN96-58567A", description: "Required when local_status is OK or REWORK. Local NG may omit it." })
  @ValidateIf((dto: SubmitScanDto) => requiresCompleteScanPayload(dto.local_status))
  @IsString()
  chassis_scan_raw?: string;

  @ApiPropertyOptional({ type: [LedScanPayloadDto], description: "Required when local_status is OK or REWORK. Local NG may omit it." })
  @ValidateIf((dto: SubmitScanDto) => requiresCompleteScanPayload(dto.local_status))
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LedScanPayloadDto)
  led_scans?: LedScanPayloadDto[];

  @ApiProperty({ enum: LOCAL_SCAN_STATUSES, example: "OK" })
  @IsIn(LOCAL_SCAN_STATUSES)
  local_status!: LocalSubmitScanStatus;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsString()
  local_ng_reason?: string | null;

  @ApiProperty({ example: "2026-07-08T14:30:25+07:00" })
  @IsISO8601()
  scan_at!: string;
}
