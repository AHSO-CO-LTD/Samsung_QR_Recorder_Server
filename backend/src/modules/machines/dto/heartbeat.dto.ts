import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class HeartbeatDto {
  @ApiProperty({ example: "LOCAL01" })
  @IsString()
  machine_code!: string;

  @ApiPropertyOptional({ example: "192.168.1.50" })
  @IsOptional()
  @IsString()
  ip_address?: string;

  @ApiPropertyOptional({ example: "1.0.0" })
  @IsOptional()
  @IsString()
  app_version?: string;

  @ApiPropertyOptional({ example: "20260709.001" })
  @IsOptional()
  @IsString()
  local_db_version?: string;

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

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  local_pending_sync?: number;

  @ApiPropertyOptional({ example: "sha256:summary" })
  @IsOptional()
  @IsString()
  local_checksum?: string;
}
