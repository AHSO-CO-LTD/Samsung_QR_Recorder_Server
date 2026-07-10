import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class UpsertServerSettingsDto {
  @ApiProperty({ example: "DYS3" })
  @IsString()
  factory_code_default!: string;

  @ApiPropertyOptional({ example: 35 })
  @IsOptional()
  @IsInt()
  @Min(1)
  full_code_length_default?: number;

  @ApiPropertyOptional({ example: 18 })
  @IsOptional()
  @IsInt()
  @Min(1)
  full_vendor_position_default?: number;

  @ApiPropertyOptional({ example: 22 })
  @IsOptional()
  @IsInt()
  @Min(1)
  led_scan_length_default?: number;

  @ApiPropertyOptional({ example: 16 })
  @IsOptional()
  @IsInt()
  @Min(1)
  led_vendor_position_default?: number;

  @ApiPropertyOptional({ example: 31 })
  @IsOptional()
  @IsInt()
  @Min(1)
  duplicate_days?: number;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  heartbeat_timeout_seconds?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  updated_by?: number;
}
