import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Min } from "class-validator";

export class RuntimeHelloDto {
  @IsString()
  machine_code!: string;

  @IsString()
  serial!: string;

  @IsString()
  uid!: string;

  @IsOptional()
  @IsString()
  ip_address?: string;

  @IsOptional()
  @IsString()
  app_version?: string;

  @IsOptional()
  @IsString()
  local_db_version?: string;
}

export class RuntimeStartDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  profile_id?: number;

  @IsOptional()
  @IsString()
  product_code?: string;

  @IsOptional()
  @IsISO8601()
  started_at?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  total_count?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  ok_count?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  ng_count?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  product_total_count?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  product_ok_count?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  product_ng_count?: number;
}

export class RuntimeUpdateDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  profile_id?: number;

  @IsOptional()
  @IsString()
  product_code?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  total_count?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  ok_count?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  ng_count?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  product_total_count?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  product_ok_count?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  product_ng_count?: number;

  @IsOptional()
  @IsString()
  @IsIn(["OK", "NG", "PENDING", "SKIPPED", "ERROR"])
  last_result?: string;

  @IsOptional()
  @IsString()
  last_code?: string;

  @IsOptional()
  @IsString()
  local_scan_id?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  pending_sync?: number;
}

export class RuntimeStopDto extends RuntimeUpdateDto {
  @IsOptional()
  @IsISO8601()
  stopped_at?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class RuntimeErrorDto extends RuntimeUpdateDto {
  @IsOptional()
  @IsString()
  error_code?: string;

  @IsOptional()
  @IsString()
  message?: string;
}
