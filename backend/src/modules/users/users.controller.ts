import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../common/auth/auth.decorators";
import type { AuthenticatedRequest } from "../../common/auth/authenticated-request.type";
import { CreateUserDto, UpdateUserDto } from "./dto/user-crud.dto";
import { UsersService } from "./users.service";

@ApiTags("server-ui")
@Roles("ADMIN", "DEV")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOkResponse({ description: "List server UI users without password hashes." })
  listUsers(@Req() request: AuthenticatedRequest) {
    return this.usersService.listUsers(request.user?.role);
  }

  @Post()
  @ApiOkResponse({ description: "Create a server UI user." })
  createUser(@Body() dto: CreateUserDto, @Req() request: AuthenticatedRequest) {
    return this.usersService.createUser(dto, request.user?.id, request.user?.role);
  }

  @Patch(":id")
  @ApiOkResponse({ description: "Update a server UI user." })
  updateUser(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateUserDto, @Req() request: AuthenticatedRequest) {
    return this.usersService.updateUser(id, dto, request.user?.id, request.user?.role);
  }

  @Delete(":id")
  @ApiOkResponse({ description: "Deactivate a server UI user." })
  deactivateUser(@Param("id", ParseIntPipe) id: number, @Req() request: AuthenticatedRequest) {
    return this.usersService.deactivateUser(id, request.user?.id, request.user?.role);
  }
}
