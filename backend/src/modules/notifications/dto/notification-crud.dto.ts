import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";

export class CreateNotificationTemplateDto {
  @ApiProperty({ example: "SERVER_DUPLICATE" })
  @IsString()
  noti_code!: string;

  @ApiProperty({ example: "Server duplicate detected" })
  @IsString()
  title_template!: string;

  @ApiProperty({ example: "Machine {{machine_code}} sent duplicate key {{duplicate_key}}." })
  @IsString()
  message_template!: string;

  @ApiPropertyOptional({ example: "Phát hiện trùng mã trên server" })
  @IsOptional()
  @IsString()
  title_template_vi?: string;

  @ApiPropertyOptional({ example: "Máy {{machine_code}} gửi duplicate key {{duplicate_key}}." })
  @IsOptional()
  @IsString()
  message_template_vi?: string;

  @ApiPropertyOptional({ example: "Server duplicate detected" })
  @IsOptional()
  @IsString()
  title_template_en?: string;

  @ApiPropertyOptional({ example: "Machine {{machine_code}} sent duplicate key {{duplicate_key}}." })
  @IsOptional()
  @IsString()
  message_template_en?: string;

  @ApiProperty({ enum: ["INFO", "WARNING", "ERROR", "CRITICAL"], example: "ERROR" })
  @IsIn(["INFO", "WARNING", "ERROR", "CRITICAL"])
  severity!: "INFO" | "WARNING" | "ERROR" | "CRITICAL";

  @ApiProperty({ enum: ["SERVER_UI", "LOCAL_UI", "BOTH"], example: "SERVER_UI" })
  @IsIn(["SERVER_UI", "LOCAL_UI", "BOTH"])
  target!: "SERVER_UI" | "LOCAL_UI" | "BOTH";

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateNotificationTemplateDto {
  @ApiPropertyOptional({ example: "Server duplicate detected" })
  @IsOptional()
  @IsString()
  title_template?: string;

  @ApiPropertyOptional({ example: "Machine {{machine_code}} sent duplicate key {{duplicate_key}}." })
  @IsOptional()
  @IsString()
  message_template?: string;

  @ApiPropertyOptional({ example: "Phát hiện trùng mã trên server" })
  @IsOptional()
  @IsString()
  title_template_vi?: string;

  @ApiPropertyOptional({ example: "Máy {{machine_code}} gửi duplicate key {{duplicate_key}}." })
  @IsOptional()
  @IsString()
  message_template_vi?: string;

  @ApiPropertyOptional({ example: "Server duplicate detected" })
  @IsOptional()
  @IsString()
  title_template_en?: string;

  @ApiPropertyOptional({ example: "Machine {{machine_code}} sent duplicate key {{duplicate_key}}." })
  @IsOptional()
  @IsString()
  message_template_en?: string;

  @ApiPropertyOptional({ enum: ["INFO", "WARNING", "ERROR", "CRITICAL"], example: "ERROR" })
  @IsOptional()
  @IsIn(["INFO", "WARNING", "ERROR", "CRITICAL"])
  severity?: "INFO" | "WARNING" | "ERROR" | "CRITICAL";

  @ApiPropertyOptional({ enum: ["SERVER_UI", "LOCAL_UI", "BOTH"], example: "SERVER_UI" })
  @IsOptional()
  @IsIn(["SERVER_UI", "LOCAL_UI", "BOTH"])
  target?: "SERVER_UI" | "LOCAL_UI" | "BOTH";

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateNotificationEventStatusDto {
  @ApiProperty({ enum: ["NEW", "SENT", "READ", "DISMISSED"], example: "READ" })
  @IsIn(["NEW", "SENT", "READ", "DISMISSED"])
  status!: "NEW" | "SENT" | "READ" | "DISMISSED";
}
