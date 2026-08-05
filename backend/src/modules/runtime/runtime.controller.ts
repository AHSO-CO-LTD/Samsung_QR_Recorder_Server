import { Controller, Get, Param, ParseIntPipe, Query } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import { RuntimeService } from "./runtime.service";

@Controller("runtime")
@ApiTags("machine-runtime")
export class RuntimeController {
  constructor(private readonly runtimeService: RuntimeService) {}

  @Get("sessions")
  @ApiQuery({ name: "take", required: false, example: 100 })
  @ApiQuery({ name: "machine_code", required: false, example: "LOCAL01" })
  @ApiQuery({ name: "status", required: false, enum: ["RUNNING", "PAUSED", "STOPPED", "DISCONNECTED", "ERROR"] })
  @ApiQuery({ name: "include_scans", required: false, example: false })
  @ApiOkResponse({ description: "List machine runtime sessions captured by WebSocket." })
  listSessions(@Query("take") take?: string, @Query("machine_code") machineCode?: string, @Query("status") status?: string, @Query("include_scans") includeScans?: string) {
    return this.runtimeService.listSessions({
      take: Number(take || 100),
      machine_code: machineCode,
      status,
      include_scans: includeScans === "true" || includeScans === "1"
    });
  }

  @Get("sessions/:id")
  @ApiOkResponse({ description: "Load one machine runtime session with product changes, events, scans, and adjustment logs." })
  getSession(@Param("id", ParseIntPipe) id: number) {
    return this.runtimeService.getSession(id);
  }
}
