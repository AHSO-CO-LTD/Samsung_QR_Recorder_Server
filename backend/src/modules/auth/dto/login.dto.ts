import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "admin" })
  @IsString()
  username!: string;

  @ApiProperty({ example: "Admin@123456" })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  remember_password?: boolean;
}
