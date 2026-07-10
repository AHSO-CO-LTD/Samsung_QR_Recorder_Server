import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from "class-validator";

export class ProfileLedCodeInputDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  led_code_id!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  led_slot!: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_required?: boolean;
}

export class CreateProfileDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  chassis_code_id!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  vendor_id!: number;

  @ApiProperty({ example: "DYS3" })
  @IsString()
  factory_code!: string;

  @ApiPropertyOptional({ example: 35 })
  @IsOptional()
  @IsInt()
  @Min(1)
  full_code_length?: number;

  @ApiPropertyOptional({ example: 18 })
  @IsOptional()
  @IsInt()
  @Min(1)
  full_vendor_position?: number;

  @ApiPropertyOptional({ example: 22 })
  @IsOptional()
  @IsInt()
  @Min(1)
  led_scan_length?: number;

  @ApiPropertyOptional({ example: 16 })
  @IsOptional()
  @IsInt()
  @Min(1)
  led_vendor_position?: number;

  @ApiProperty({ type: [ProfileLedCodeInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileLedCodeInputDto)
  led_codes!: ProfileLedCodeInputDto[];

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  created_by?: number;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  vendor_id?: number;

  @ApiPropertyOptional({ example: "DYS3" })
  @IsOptional()
  @IsString()
  factory_code?: string;

  @ApiPropertyOptional({ example: 35 })
  @IsOptional()
  @IsInt()
  @Min(1)
  full_code_length?: number;

  @ApiPropertyOptional({ example: 18 })
  @IsOptional()
  @IsInt()
  @Min(1)
  full_vendor_position?: number;

  @ApiPropertyOptional({ example: 22 })
  @IsOptional()
  @IsInt()
  @Min(1)
  led_scan_length?: number;

  @ApiPropertyOptional({ example: 16 })
  @IsOptional()
  @IsInt()
  @Min(1)
  led_vendor_position?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ type: [ProfileLedCodeInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileLedCodeInputDto)
  led_codes?: ProfileLedCodeInputDto[];

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  updated_by?: number;
}
