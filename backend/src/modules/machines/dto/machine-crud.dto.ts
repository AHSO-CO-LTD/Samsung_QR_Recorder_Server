import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";

export class CreateMachineDto {
  @ApiProperty({ example: "LOCAL01" })
  @IsString()
  machine_code!: string;

  @ApiProperty({ example: "Local scanner 01" })
  @IsString()
  machine_name!: string;

  @ApiHideProperty()
  @IsOptional()
  @IsString()
  ip_address?: string | null;

  @ApiPropertyOptional({ example: "Line A" })
  @IsOptional()
  @IsString()
  line_name?: string | null;

  @ApiPropertyOptional({ example: "Station 01" })
  @IsOptional()
  @IsString()
  station_name?: string | null;

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

  @ApiHideProperty()
  @IsOptional()
  @IsString()
  ip_address?: string | null;

  @ApiPropertyOptional({ example: "Line A" })
  @IsOptional()
  @IsString()
  line_name?: string | null;

  @ApiPropertyOptional({ example: "Station 01" })
  @IsOptional()
  @IsString()
  station_name?: string | null;

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
  @ApiProperty({ example: "SN-LOCAL01-2026" })
  @IsString()
  @IsNotEmpty()
  serial!: string;

  @ApiProperty({ example: "UID-8f8f2f1c-local01" })
  @IsString()
  @IsNotEmpty()
  uid!: string;

  @ApiProperty({ enum: ["ACK", "FAILED"], example: "ACK" })
  @IsIn(["ACK", "FAILED"])
  status!: "ACK" | "FAILED";

  @ApiPropertyOptional({ example: "Local command execution failed." })
  @IsOptional()
  @IsString()
  error_message?: string | null;
}

export class CreateMachineRegistrationRequestDto {
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
}

export class CheckMachineRegistrationStatusQueryDto {
  @ApiProperty({ example: "SN-LOCAL01-2026" })
  @IsString()
  @IsNotEmpty()
  serial!: string;

  @ApiProperty({ example: "UID-8f8f2f1c-local01" })
  @IsString()
  @IsNotEmpty()
  uid!: string;
}

export class ResolveMachineIdentityQueryDto {
  @ApiProperty({ example: "SN-LOCAL01-2026" })
  @IsString()
  @IsNotEmpty()
  serial!: string;

  @ApiProperty({ example: "UID-8f8f2f1c-local01" })
  @IsString()
  @IsNotEmpty()
  uid!: string;
}

export class ImportMachineRegistrationLicenseDto {
  @ApiPropertyOptional({ example: "SN-LOCAL01-2026|UID-8f8f2f1c-local01" })
  @IsOptional()
  @IsString()
  license_key?: string;

  @ApiPropertyOptional({
    example: {
      license_format: "SAMSUNG_QR_MACHINE_LICENSE_RAW_V1",
      serial: "SN-LOCAL01-2026",
      uid: "UID-8f8f2f1c-local01",
      license_key: "SN-LOCAL01-2026|UID-8f8f2f1c-local01"
    }
  })
  @IsOptional()
  license_file?: unknown;

  @ApiPropertyOptional({ example: "{\"serial\":\"SN-LOCAL01-2026\",\"uid\":\"UID-8f8f2f1c-local01\"}" })
  @IsOptional()
  @IsString()
  license_file_text?: string;

  @ApiPropertyOptional({ example: "SN-LOCAL01-2026" })
  @IsOptional()
  @IsString()
  serial?: string;

  @ApiPropertyOptional({ example: "UID-8f8f2f1c-local01" })
  @IsOptional()
  @IsString()
  uid?: string;
}

export class ApproveMachineRegistrationRequestDto {
  @ApiProperty({ example: "LOCAL01" })
  @IsString()
  @IsNotEmpty()
  machine_code!: string;

  @ApiProperty({ example: "Local scanner 01" })
  @IsString()
  @IsNotEmpty()
  machine_name!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class RejectMachineRegistrationRequestDto {
  @ApiProperty({ example: "Thiết bị không thuộc line này." })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
