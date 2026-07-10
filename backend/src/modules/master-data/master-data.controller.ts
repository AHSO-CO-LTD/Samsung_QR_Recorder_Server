import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../common/auth/auth.decorators";
import type { AuthenticatedRequest } from "../../common/auth/authenticated-request.type";
import {
  CreateChassisCodeDto,
  CreateLedCodeDto,
  CreateVendorDto,
  UpdateChassisCodeDto,
  UpdateLedCodeDto,
  UpdateVendorDto
} from "./dto/master-data.dto";
import { MasterDataService } from "./master-data.service";

@ApiTags("server-ui")
@Controller("master-data")
export class MasterDataController {
  constructor(private readonly masterDataService: MasterDataService) {}

  @Get("vendors")
  @ApiOkResponse({ description: "List vendors." })
  listVendors() {
    return this.masterDataService.listVendors();
  }

  @Post("vendors")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Create a vendor." })
  createVendor(@Body() dto: CreateVendorDto, @Req() request: AuthenticatedRequest) {
    return this.masterDataService.createVendor(dto, request.user?.id);
  }

  @Patch("vendors/:id")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Update a vendor." })
  updateVendor(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateVendorDto, @Req() request: AuthenticatedRequest) {
    return this.masterDataService.updateVendor(id, dto, request.user?.id);
  }

  @Delete("vendors/:id")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Disable a vendor." })
  disableVendor(@Param("id", ParseIntPipe) id: number, @Req() request: AuthenticatedRequest) {
    return this.masterDataService.disableVendor(id, request.user?.id);
  }

  @Get("chassis-codes")
  @ApiOkResponse({ description: "List chassis codes." })
  listChassisCodes() {
    return this.masterDataService.listChassisCodes();
  }

  @Post("chassis-codes")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Create a chassis code." })
  createChassisCode(@Body() dto: CreateChassisCodeDto, @Req() request: AuthenticatedRequest) {
    return this.masterDataService.createChassisCode(dto, request.user?.id);
  }

  @Patch("chassis-codes/:id")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Update a chassis code." })
  updateChassisCode(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateChassisCodeDto, @Req() request: AuthenticatedRequest) {
    return this.masterDataService.updateChassisCode(id, dto, request.user?.id);
  }

  @Delete("chassis-codes/:id")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Deactivate a chassis code." })
  deactivateChassisCode(@Param("id", ParseIntPipe) id: number, @Req() request: AuthenticatedRequest) {
    return this.masterDataService.deactivateChassisCode(id, request.user?.id);
  }

  @Get("led-codes")
  @ApiOkResponse({ description: "List LED codes." })
  listLedCodes() {
    return this.masterDataService.listLedCodes();
  }

  @Post("led-codes")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Create a LED code." })
  createLedCode(@Body() dto: CreateLedCodeDto, @Req() request: AuthenticatedRequest) {
    return this.masterDataService.createLedCode(dto, request.user?.id);
  }

  @Patch("led-codes/:id")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Update a LED code." })
  updateLedCode(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateLedCodeDto, @Req() request: AuthenticatedRequest) {
    return this.masterDataService.updateLedCode(id, dto, request.user?.id);
  }

  @Delete("led-codes/:id")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Deactivate a LED code." })
  deactivateLedCode(@Param("id", ParseIntPipe) id: number, @Req() request: AuthenticatedRequest) {
    return this.masterDataService.deactivateLedCode(id, request.user?.id);
  }
}
