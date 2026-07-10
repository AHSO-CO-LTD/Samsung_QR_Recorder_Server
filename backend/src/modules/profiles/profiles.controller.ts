import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../common/auth/auth.decorators";
import type { AuthenticatedRequest } from "../../common/auth/authenticated-request.type";
import { CreateProfileDto, UpdateProfileDto } from "./dto/profile-crud.dto";
import { ProfilesService } from "./profiles.service";

@ApiTags("server-ui")
@Controller("profiles")
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  @ApiOkResponse({ description: "List product profiles with chassis, vendor, and LED settings." })
  listProfiles() {
    return this.profilesService.listProfiles();
  }

  @Get(":id")
  @ApiOkResponse({ description: "Get one product profile." })
  getProfile(@Param("id", ParseIntPipe) id: number) {
    return this.profilesService.getProfile(id);
  }

  @Post()
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Create a product profile and its first snapshot." })
  createProfile(@Body() dto: CreateProfileDto, @Req() request: AuthenticatedRequest) {
    return this.profilesService.createProfile(dto, request.user?.id);
  }

  @Patch(":id")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Update a product profile and create a snapshot when rules change." })
  updateProfile(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateProfileDto, @Req() request: AuthenticatedRequest) {
    return this.profilesService.updateProfile(id, dto, request.user?.id);
  }

  @Delete(":id")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Deactivate a product profile." })
  deactivateProfile(@Param("id", ParseIntPipe) id: number, @Req() request: AuthenticatedRequest) {
    return this.profilesService.deactivateProfile(id, request.user?.id);
  }
}
