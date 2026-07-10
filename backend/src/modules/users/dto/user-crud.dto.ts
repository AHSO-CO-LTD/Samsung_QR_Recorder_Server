import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreateUserDto {
  @ApiProperty({ example: "operator01" })
  @IsString()
  username!: string;

  @ApiProperty({ example: "Operator 01" })
  @IsString()
  full_name!: string;

  @ApiProperty({ enum: ["OPERATOR", "ENGINEER", "ADMIN", "DEV"], example: "OPERATOR" })
  @IsIn(["OPERATOR", "ENGINEER", "ADMIN", "DEV"])
  role!: "OPERATOR" | "ENGINEER" | "ADMIN" | "DEV";

  @ApiProperty({ example: "Operator@123456" })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: "Operator 01" })
  @IsOptional()
  @IsString()
  full_name?: string;

  @ApiPropertyOptional({ enum: ["OPERATOR", "ENGINEER", "ADMIN", "DEV"], example: "ENGINEER" })
  @IsOptional()
  @IsIn(["OPERATOR", "ENGINEER", "ADMIN", "DEV"])
  role?: "OPERATOR" | "ENGINEER" | "ADMIN" | "DEV";

  @ApiPropertyOptional({ example: "Operator@123456" })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
