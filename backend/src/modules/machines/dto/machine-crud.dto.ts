import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateMachineDto {
  @ApiProperty({ example: "LOCAL01" })
  @IsString()
  machine_code!: string;

  @ApiProperty({ example: "Local scanner 01" })
  @IsString()
  machine_name!: string;

  @ApiPropertyOptional({ example: "LINE-A" })
  @IsOptional()
  @IsString()
  line_name?: string;

  @ApiPropertyOptional({ example: "ST-01" })
  @IsOptional()
  @IsString()
  station_name?: string;

  @ApiPropertyOptional({ example: "192.168.1.50" })
  @IsOptional()
  @IsString()
  ip_address?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateMachineDto {
  @ApiPropertyOptional({ example: "Local scanner 01" })
  @IsOptional()
  @IsString()
  machine_name?: string;

  @ApiPropertyOptional({ example: "LINE-A" })
  @IsOptional()
  @IsString()
  line_name?: string | null;

  @ApiPropertyOptional({ example: "ST-01" })
  @IsOptional()
  @IsString()
  station_name?: string | null;

  @ApiPropertyOptional({ example: "192.168.1.50" })
  @IsOptional()
  @IsString()
  ip_address?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class CreateMachineCommandDto {
  @ApiProperty({ enum: ["SYNC_PROFILE", "SYNC_SCAN_DATA", "RELOAD_CONFIG", "SHOW_MESSAGE"], example: "SYNC_PROFILE" })
  @IsIn(["SYNC_PROFILE", "SYNC_SCAN_DATA", "RELOAD_CONFIG", "SHOW_MESSAGE"])
  command_type!: "SYNC_PROFILE" | "SYNC_SCAN_DATA" | "RELOAD_CONFIG" | "SHOW_MESSAGE";

  @ApiPropertyOptional({ example: { message: "Reload profile cache" } })
  @IsOptional()
  payload_json?: unknown;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  created_by?: number;
}

export class AckMachineCommandDto {
  @ApiProperty({ example: "LOCAL01" })
  @IsString()
  machine_code!: string;

  @ApiProperty({ enum: ["ACK", "FAILED"], example: "ACK" })
  @IsIn(["ACK", "FAILED"])
  status!: "ACK" | "FAILED";

  @ApiPropertyOptional({ example: "Local command execution failed." })
  @IsOptional()
  @IsString()
  error_message?: string | null;
}
