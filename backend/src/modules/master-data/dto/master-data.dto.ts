import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";

export class CreateVendorDto {
  @ApiProperty({ example: "Samsung Display" })
  @IsString()
  vendor_name!: string;

  @ApiProperty({ example: "L" })
  @IsString()
  vendor_char!: string;

  @ApiPropertyOptional({ enum: ["ACTIVE", "PENDING", "DISABLED"], example: "ACTIVE" })
  @IsOptional()
  @IsIn(["ACTIVE", "PENDING", "DISABLED"])
  status?: "ACTIVE" | "PENDING" | "DISABLED";
}

export class UpdateVendorDto {
  @ApiPropertyOptional({ example: "Samsung Display" })
  @IsOptional()
  @IsString()
  vendor_name?: string;

  @ApiPropertyOptional({ example: "L" })
  @IsOptional()
  @IsString()
  vendor_char?: string;

  @ApiPropertyOptional({ enum: ["ACTIVE", "PENDING", "DISABLED"], example: "ACTIVE" })
  @IsOptional()
  @IsIn(["ACTIVE", "PENDING", "DISABLED"])
  status?: "ACTIVE" | "PENDING" | "DISABLED";
}

export class CreateChassisCodeDto {
  @ApiProperty({ example: "BN96-60877C" })
  @IsString()
  code_full!: string;

  @ApiProperty({ example: "60877C" })
  @IsString()
  code_input!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateChassisCodeDto {
  @ApiPropertyOptional({ example: "BN96-60877C" })
  @IsOptional()
  @IsString()
  code_full?: string;

  @ApiPropertyOptional({ example: "60877C" })
  @IsOptional()
  @IsString()
  code_input?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class CreateLedCodeDto {
  @ApiProperty({ example: "BN96-60376A" })
  @IsString()
  code_full!: string;

  @ApiProperty({ example: "60376A" })
  @IsString()
  code_input!: string;

  @ApiProperty({ example: "0376A" })
  @IsString()
  suffix_check!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateLedCodeDto {
  @ApiPropertyOptional({ example: "BN96-60376A" })
  @IsOptional()
  @IsString()
  code_full?: string;

  @ApiPropertyOptional({ example: "60376A" })
  @IsOptional()
  @IsString()
  code_input?: string;

  @ApiPropertyOptional({ example: "0376A" })
  @IsOptional()
  @IsString()
  suffix_check?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
