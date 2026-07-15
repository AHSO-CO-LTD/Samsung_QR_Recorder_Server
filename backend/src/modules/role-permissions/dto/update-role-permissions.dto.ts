import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsString } from "class-validator";
import { allScreenPermissionKeys } from "../role-permissions.constants";

export class UpdateRolePermissionsDto {
  @ApiProperty({ isArray: true, enum: allScreenPermissionKeys })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(allScreenPermissionKeys.length)
  @ArrayUnique()
  @IsString({ each: true })
  @IsIn(allScreenPermissionKeys, { each: true })
  permission_keys!: string[];
}
