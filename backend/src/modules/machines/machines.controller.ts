import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Public, Roles } from "../../common/auth/auth.decorators";
import type { AuthenticatedRequest } from "../../common/auth/authenticated-request.type";
import { getClientIp, type RequestWithClientIp } from "../../common/http/client-ip";
import { HeartbeatDto } from "./dto/heartbeat.dto";
import {
  AckMachineCommandDto,
  ApproveMachineRegistrationRequestDto,
  CheckMachineRegistrationStatusQueryDto,
  CreateMachineCommandDto,
  CreateMachineDto,
  CreateMachineRegistrationRequestDto,
  ImportMachineRegistrationLicenseDto,
  RejectMachineRegistrationRequestDto,
  ResolveMachineIdentityQueryDto,
  UpdateMachineDto
} from "./dto/machine-crud.dto";
import { MachinesService } from "./machines.service";

@Controller("machines")
export class MachinesController {
  constructor(private readonly machinesService: MachinesService) {}

  @Get()
  @ApiTags("machines-admin")
  @ApiOkResponse({ description: "List registered server machines." })
  listMachines() {
    return this.machinesService.listMachines();
  }

  @Post("register-request")
  @ApiTags("local-machine")
  @Public()
  @ApiOkResponse({ description: "Send a pairing/identification request from a new local machine." })
  createRegistrationRequest(@Body() dto: CreateMachineRegistrationRequestDto, @Req() request: RequestWithClientIp) {
    return this.machinesService.createRegistrationRequest(dto, getClientIp(request));
  }

  @Get("register-requests/:request_id/status")
  @ApiTags("local-machine")
  @Public()
  @ApiOkResponse({ description: "Check whether a local machine registration request has been approved or rejected." })
  getRegistrationRequestStatus(@Param("request_id") requestId: string, @Query() query: CheckMachineRegistrationStatusQueryDto) {
    return this.machinesService.getRegistrationRequestStatus(requestId, query);
  }

  @Get("identity/status")
  @ApiTags("local-machine")
  @Public()
  @ApiOkResponse({ description: "Resolve the approved machine identity from stable local serial and uid." })
  getMachineIdentityStatus(@Query() query: ResolveMachineIdentityQueryDto) {
    return this.machinesService.getMachineIdentityStatus(query);
  }

  @Get("register-requests")
  @ApiTags("machines-admin")
  @ApiQuery({ name: "take", required: false, example: 50 })
  @ApiQuery({ name: "status", required: false, enum: ["PENDING", "APPROVED", "REJECTED"] })
  @ApiOkResponse({ description: "List machine registration requests waiting for server identification." })
  listRegistrationRequests(@Query("take") take?: string, @Query("status") status?: "PENDING" | "APPROVED" | "REJECTED") {
    return this.machinesService.listRegistrationRequests(Number(take || 50), status);
  }

  @Get("register-requests/:id/license-export")
  @ApiTags("machines-admin")
  @Roles("ADMIN", "DEV")
  @ApiOkResponse({ description: "Export raw serial/uid information for external license generation." })
  exportRegistrationLicenseInfo(@Param("id", ParseIntPipe) id: number) {
    return this.machinesService.exportRegistrationLicenseInfo(id);
  }

  @Post("register-requests/:id/license/import")
  @ApiTags("machines-admin")
  @Roles("ADMIN", "DEV")
  @ApiOkResponse({ description: "Import a raw license file and verify it against the registration serial/uid." })
  importRegistrationLicense(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ImportMachineRegistrationLicenseDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.machinesService.importRegistrationLicense(id, dto, request.user?.id);
  }

  @Post("register-requests/:id/approve")
  @ApiTags("machines-admin")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Approve a local machine registration request and create the official machine identity." })
  approveRegistrationRequest(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ApproveMachineRegistrationRequestDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.machinesService.approveRegistrationRequest(id, dto, request.user?.id);
  }

  @Post("register-requests/:id/reject")
  @ApiTags("machines-admin")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Reject a local machine registration request." })
  rejectRegistrationRequest(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RejectMachineRegistrationRequestDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.machinesService.rejectRegistrationRequest(id, dto, request.user?.id);
  }

  @Post()
  @ApiTags("machines-admin")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Create a local machine registration." })
  createMachine(@Body() dto: CreateMachineDto, @Req() request: AuthenticatedRequest) {
    return this.machinesService.createMachine(dto, request.user?.id);
  }

  @Patch(":id")
  @ApiTags("machines-admin")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Update a local machine registration." })
  updateMachine(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateMachineDto, @Req() request: AuthenticatedRequest) {
    return this.machinesService.updateMachine(id, dto, request.user?.id);
  }

  @Delete(":id")
  @ApiTags("machines-admin")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Deactivate a local machine registration." })
  deactivateMachine(@Param("id", ParseIntPipe) id: number, @Req() request: AuthenticatedRequest) {
    return this.machinesService.deactivateMachine(id, request.user?.id);
  }

  @Delete(":id/purge")
  @ApiTags("machines-admin")
  @Roles("ADMIN", "DEV")
  @ApiOkResponse({ description: "Permanently delete a local machine only when it has no scan records." })
  deleteMachineIfNoScans(@Param("id", ParseIntPipe) id: number, @Req() request: AuthenticatedRequest) {
    return this.machinesService.deleteMachineIfNoScans(id, request.user?.id);
  }

  @Get("config")
  @ApiTags("local-machine")
  @Public()
  @ApiQuery({ name: "serial", required: true, example: "SN-LOCAL01-2026" })
  @ApiQuery({ name: "uid", required: true, example: "UID-8f8f2f1c-local01" })
  @ApiOkResponse({ description: "Load server config by stable local serial and uid." })
  getMachineConfigByIdentity(@Query("serial") serial: string, @Query("uid") uid: string) {
    return this.machinesService.getMachineConfigByIdentity({ serial, uid });
  }

  @Get(":id/commands")
  @ApiTags("machine-commands-admin")
  @ApiQuery({ name: "take", required: false, example: 50 })
  @ApiOkResponse({ description: "List queued commands for one machine." })
  listCommands(@Param("id", ParseIntPipe) id: number, @Query("take") take?: string) {
    return this.machinesService.listCommands(id, Number(take || 50));
  }

  @Post(":id/commands")
  @ApiTags("machine-commands-admin")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Queue a command for a local machine to poll." })
  createCommand(@Param("id", ParseIntPipe) id: number, @Body() dto: CreateMachineCommandDto, @Req() request: AuthenticatedRequest) {
    return this.machinesService.createCommand(id, dto, request.user?.id);
  }

  @Get("commands/poll")
  @ApiTags("local-machine")
  @Public()
  @ApiQuery({ name: "take", required: false, example: 20 })
  @ApiQuery({ name: "serial", required: true, example: "SN-LOCAL01-2026" })
  @ApiQuery({ name: "uid", required: true, example: "UID-8f8f2f1c-local01" })
  @ApiOkResponse({ description: "Poll pending commands by stable local serial and uid." })
  pollCommandsByIdentity(@Query("serial") serial: string, @Query("uid") uid: string, @Query("take") take?: string) {
    return this.machinesService.pollCommandsByIdentity(Number(take || 20), { serial, uid });
  }

  @Post("commands/:id/ack")
  @ApiTags("local-machine")
  @Public()
  @ApiOkResponse({ description: "Acknowledge or fail a command from a local machine." })
  ackCommand(@Param("id", ParseIntPipe) id: number, @Body() dto: AckMachineCommandDto) {
    return this.machinesService.ackCommand(id, dto);
  }

  @Post("heartbeat")
  @ApiTags("local-machine")
  @Public()
  @ApiOkResponse({ description: "Update current connection/sync state for a local machine." })
  heartbeat(@Body() dto: HeartbeatDto, @Req() request: RequestWithClientIp) {
    return this.machinesService.heartbeat(dto, getClientIp(request));
  }
}
