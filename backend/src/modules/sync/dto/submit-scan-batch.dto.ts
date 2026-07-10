import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from "class-validator";
import { SubmitScanDto } from "../../scans/dto/submit-scan.dto";

export class SubmitScanBatchDto {
  @ApiProperty({ example: "LOCAL01-20260710-STARTUP-001" })
  @IsString()
  batch_code!: string;

  @ApiProperty({ example: "LOCAL01" })
  @IsString()
  machine_code!: string;

  @ApiProperty({ enum: ["STARTUP", "SHUTDOWN", "NETWORK_RESTORED", "MANUAL"], example: "NETWORK_RESTORED" })
  @IsIn(["STARTUP", "SHUTDOWN", "NETWORK_RESTORED", "MANUAL"])
  trigger_type!: "STARTUP" | "SHUTDOWN" | "NETWORK_RESTORED" | "MANUAL";

  @ApiProperty({ type: [SubmitScanDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitScanDto)
  scans!: SubmitScanDto[];

  @ApiPropertyOptional({ example: { local_pending_before_batch: 10 } })
  @IsOptional()
  summary_json?: unknown;
}
