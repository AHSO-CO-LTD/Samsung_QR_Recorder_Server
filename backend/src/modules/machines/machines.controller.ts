import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Public, Roles } from "../../common/auth/auth.decorators";
import type { AuthenticatedRequest } from "../../common/auth/authenticated-request.type";
import { HeartbeatDto } from "./dto/heartbeat.dto";
import { AckMachineCommandDto, CreateMachineCommandDto, CreateMachineDto, UpdateMachineDto } from "./dto/machine-crud.dto";
import { MachinesService } from "./machines.service";

@ApiTags("local-machine")
@Controller("machines")
export class MachinesController {
  constructor(private readonly machinesService: MachinesService) {}

  @Get()
  @ApiOkResponse({ description: "List registered server machines." })
  listMachines() {
    return this.machinesService.listMachines();
  }

  @Post()
  @ApiTags("server-ui")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Create a local machine registration." })
  createMachine(@Body() dto: CreateMachineDto, @Req() request: AuthenticatedRequest) {
    return this.machinesService.createMachine(dto, request.user?.id);
  }

  @Patch(":id")
  @ApiTags("server-ui")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Update a local machine registration." })
  updateMachine(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateMachineDto, @Req() request: AuthenticatedRequest) {
    return this.machinesService.updateMachine(id, dto, request.user?.id);
  }

  @Delete(":id")
  @ApiTags("server-ui")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Deactivate a local machine registration." })
  deactivateMachine(@Param("id", ParseIntPipe) id: number, @Req() request: AuthenticatedRequest) {
    return this.machinesService.deactivateMachine(id, request.user?.id);
  }

  @Get(":machine_code/config")
  @Public()
  @ApiOkResponse({ description: "Load server config, active profiles, and pending commands for a local machine." })
  getMachineConfig(@Param("machine_code") machineCode: string) {
    return this.machinesService.getMachineConfig(machineCode);
  }

  @Get(":id/commands")
  @ApiTags("server-ui")
  @ApiQuery({ name: "take", required: false, example: 50 })
  @ApiOkResponse({ description: "List queued commands for one machine." })
  listCommands(@Param("id", ParseIntPipe) id: number, @Query("take") take?: string) {
    return this.machinesService.listCommands(id, Number(take || 50));
  }

  @Post(":id/commands")
  @ApiTags("server-ui")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Queue a command for a local machine to poll." })
  createCommand(@Param("id", ParseIntPipe) id: number, @Body() dto: CreateMachineCommandDto, @Req() request: AuthenticatedRequest) {
    return this.machinesService.createCommand(id, dto, request.user?.id);
  }

  @Get(":machine_code/commands/poll")
  @Public()
  @ApiQuery({ name: "take", required: false, example: 20 })
  @ApiOkResponse({ description: "Poll pending commands from a local machine." })
  pollCommands(@Param("machine_code") machineCode: string, @Query("take") take?: string) {
    return this.machinesService.pollCommands(machineCode, Number(take || 20));
  }

  @Post("commands/:id/ack")
  @Public()
  @ApiOkResponse({ description: "Acknowledge or fail a command from a local machine." })
  ackCommand(@Param("id", ParseIntPipe) id: number, @Body() dto: AckMachineCommandDto) {
    return this.machinesService.ackCommand(id, dto);
  }

  @Post("heartbeat")
  @Public()
  @ApiOkResponse({ description: "Update current connection/sync state for a local machine." })
  heartbeat(@Body() dto: HeartbeatDto) {
    return this.machinesService.heartbeat(dto);
  }
}
