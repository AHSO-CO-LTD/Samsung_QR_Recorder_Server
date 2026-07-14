import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsISO8601, IsInt, IsOptional, Matches, Max, Min } from "class-validator";

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

export class UpsertHistoricalDuplicateScheduleDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ enum: ["DAILY", "WEEKLY", "MONTHLY"], example: "DAILY" })
  @IsIn(["DAILY", "WEEKLY", "MONTHLY"])
  frequency!: "DAILY" | "WEEKLY" | "MONTHLY";

  @ApiProperty({ example: "00:00", description: "Server local time in HH:mm format." })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  run_time!: string;

  @ApiPropertyOptional({ example: 1, description: "ISO weekday: 1 Monday through 7 Sunday." })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  day_of_week?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  day_of_month?: number;
}
