import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsISO8601, IsInt, IsOptional, Min } from "class-validator";

export class RunHistoricalDuplicateJobDto {
  @ApiProperty({ example: "2026-07-01T00:00:00+07:00" })
  @IsISO8601()
  from_date!: string;

  @ApiProperty({ example: "2026-07-31T23:59:59+07:00" })
  @IsISO8601()
  to_date!: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  profile_id?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  created_by?: number;
}
