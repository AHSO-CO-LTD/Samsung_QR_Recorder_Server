import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsISO8601, IsOptional, IsString, Min, ValidateNested } from "class-validator";

export class FullCodePayloadDto {
  @ApiProperty({ example: "VN39BN9660877C1A1L60376ADYS3Y420673" })
  @IsString()
  raw!: string;

  @ApiProperty({ example: "VN39" })
  @IsString()
  prefix!: string;

  @ApiProperty({ example: "BN96-60877C" })
  @IsString()
  chassis_code!: string;

  @ApiProperty({ example: "1A1" })
  @IsString()
  before_vendor!: string;

  @ApiProperty({ example: "L" })
  @IsString()
  vendor_char!: string;

  @ApiProperty({ example: "BN96-60376A" })
  @IsString()
  led_code!: string;

  @ApiProperty({ example: "DYS3" })
  @IsString()
  factory_code!: string;

  @ApiProperty({ example: "Y420673" })
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

  @ApiProperty({ example: "ZB36L582465U528LD0376A" })
  @IsString()
  raw!: string;

  @ApiProperty({ example: "528" })
  @IsString()
  lot_no!: string;

  @ApiProperty({ example: "L" })
  @IsString()
  vendor_char!: string;

  @ApiProperty({ example: "0376A" })
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

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  profile_id!: number;

  @ApiProperty({ example: "1A1Y420673" })
  @IsString()
  duplicate_key!: string;

  @ApiProperty({ type: FullCodePayloadDto })
  @ValidateNested()
  @Type(() => FullCodePayloadDto)
  full_code!: FullCodePayloadDto;

  @ApiProperty({ example: "BN96-60877C" })
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
