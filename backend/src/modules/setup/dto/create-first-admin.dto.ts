import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class CreateFirstAdminDto {
  @ApiProperty({ example: "admin" })
  @IsString()
  @MinLength(3)
  username!: string;

  @ApiProperty({ example: "System Administrator" })
  @IsString()
  @MinLength(2)
  full_name!: string;

  @ApiProperty({ example: "Admin@123456" })
  @IsString()
  @MinLength(8)
  password!: string;
}
