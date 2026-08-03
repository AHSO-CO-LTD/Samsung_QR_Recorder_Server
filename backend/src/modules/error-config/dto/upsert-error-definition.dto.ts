import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Severity } from "@prisma/client";
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class UpsertErrorDefinitionDto {
  @ApiProperty({ example: "QR_SCAN_FAILED" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  code!: string;

  @ApiProperty({ example: "Không đọc được mã QR" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  name_vi!: string;

  @ApiPropertyOptional({ example: "Unable to read QR code", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  name_en?: string | null;

  @ApiPropertyOptional({ example: "Vui lòng kiểm tra mã QR và quét lại.", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  default_message?: string | null;

  @ApiPropertyOptional({ example: "qr", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  group_name?: string | null;

  @ApiPropertyOptional({ enum: Severity, example: Severity.ERROR })
  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;

  @ApiPropertyOptional({ example: "Kiểm tra camera và quét lại.", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  local_action?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
