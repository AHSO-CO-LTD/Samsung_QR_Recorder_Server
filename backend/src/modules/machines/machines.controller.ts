import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { HeartbeatDto } from "./dto/heartbeat.dto";
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

  @Post("heartbeat")
  @ApiOkResponse({ description: "Update current connection/sync state for a local machine." })
  heartbeat(@Body() dto: HeartbeatDto) {
    return this.machinesService.heartbeat(dto);
  }
}
