import { Body, Controller, Get, Param, Put, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../common/auth/auth.decorators";
import type { AuthenticatedRequest } from "../../common/auth/authenticated-request.type";
import { UpdateRolePermissionsDto } from "./dto/update-role-permissions.dto";
import { RolePermissionsService } from "./role-permissions.service";

@ApiTags("server-ui")
@Controller("role-permissions")
export class RolePermissionsController {
  constructor(private readonly rolePermissionsService: RolePermissionsService) {}

  @Get("me")
  @ApiOkResponse({ description: "Get screen permissions for the current signed-in user." })
  getCurrentUserPermissions(@Req() request: AuthenticatedRequest) {
    return this.rolePermissionsService.getCurrentUserPermissions(request.user!.role);
  }

  @Get()
  @Roles("ADMIN", "DEV")
  @ApiOkResponse({ description: "List screen permission matrix for configurable roles." })
  listRolePermissions(@Req() request: AuthenticatedRequest) {
    return this.rolePermissionsService.listRolePermissions(request.user?.role);
  }

  @Put(":role")
  @Roles("ADMIN", "DEV")
  @ApiOkResponse({ description: "Replace screen permissions for one role." })
  updateRolePermissions(@Param("role") role: string, @Body() dto: UpdateRolePermissionsDto, @Req() request: AuthenticatedRequest) {
    return this.rolePermissionsService.updateRolePermissions(role, dto, request.user?.id, request.user?.role);
  }
}
