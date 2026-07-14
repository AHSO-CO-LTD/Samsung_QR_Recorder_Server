import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from "class-validator";

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

  @ApiProperty({ enum: ["OK", "NG"], example: "OK" })
  @IsIn(["OK", "NG"])
  status!: "OK" | "NG";

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsString()
  ng_reason?: string | null;
}

export class SubmitScanDto {
  @ApiProperty({ example: "LOCAL01-20260708-000001" })
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

  @ApiProperty({ example: "1F1SX880447" })
  @IsString()
  duplicate_key!: string;

  @ApiProperty({ type: FullCodePayloadDto })
  @ValidateNested()
  @Type(() => FullCodePayloadDto)
  full_code!: FullCodePayloadDto;

  @ApiProperty({ example: "BN96-58567A" })
  @IsString()
  chassis_scan_raw!: string;

  @ApiProperty({ type: [LedScanPayloadDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LedScanPayloadDto)
  led_scans!: LedScanPayloadDto[];

  @ApiProperty({ enum: ["OK", "NG"], example: "OK" })
  @IsIn(["OK", "NG"])
  local_status!: "OK" | "NG";

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsString()
  local_ng_reason?: string | null;

  @ApiProperty({ example: "2026-07-08T14:30:25+07:00" })
  @IsISO8601()
  scan_at!: string;
}
