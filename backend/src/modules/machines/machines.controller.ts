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
  @ApiOkResponse({ description: "Liệt kê các máy đã đăng ký trên máy chủ." })
  listMachines() {
    return this.machinesService.listMachines();
  }

  @Post("register-request")
  @ApiTags("local-machine")
  @Public()
  @ApiOkResponse({ description: "Gửi yêu cầu ghép cặp/định danh từ máy cục bộ mới." })
  createRegistrationRequest(@Body() dto: CreateMachineRegistrationRequestDto, @Req() request: RequestWithClientIp) {
    return this.machinesService.createRegistrationRequest(dto, getClientIp(request));
  }

  @Get("register-requests/:request_id/status")
  @ApiTags("local-machine")
  @Public()
  @ApiOkResponse({ description: "Kiểm tra yêu cầu đăng ký máy cục bộ đã được duyệt hay bị từ chối." })
  getRegistrationRequestStatus(@Param("request_id") requestId: string, @Query() query: CheckMachineRegistrationStatusQueryDto) {
    return this.machinesService.getRegistrationRequestStatus(requestId, query);
  }

  @Get("identity/status")
  @ApiTags("local-machine")
  @Public()
  @ApiOkResponse({ description: "Xác định định danh máy đã duyệt từ seri và UID cục bộ ổn định." })
  getMachineIdentityStatus(@Query() query: ResolveMachineIdentityQueryDto) {
    return this.machinesService.getMachineIdentityStatus(query);
  }

  @Get("register-requests")
  @ApiTags("machines-admin")
  @ApiQuery({ name: "take", required: false, example: 50 })
  @ApiQuery({ name: "status", required: false, enum: ["PENDING", "APPROVED", "REJECTED"] })
  @ApiOkResponse({ description: "Liệt kê yêu cầu đăng ký máy đang chờ máy chủ định danh." })
  listRegistrationRequests(@Query("take") take?: string, @Query("status") status?: "PENDING" | "APPROVED" | "REJECTED") {
    return this.machinesService.listRegistrationRequests(Number(take || 50), status);
  }

  @Get("register-requests/:id/license-export")
  @ApiTags("machines-admin")
  @Roles("ADMIN", "DEV")
  @ApiOkResponse({ description: "Xuất thông tin seri/UID thô để tạo giấy phép bên ngoài." })
  exportRegistrationLicenseInfo(@Param("id", ParseIntPipe) id: number) {
    return this.machinesService.exportRegistrationLicenseInfo(id);
  }

  @Post("register-requests/:id/license/import")
  @ApiTags("machines-admin")
  @Roles("ADMIN", "DEV")
  @ApiOkResponse({ description: "Nhập tệp giấy phép thô và kiểm tra với seri/UID đăng ký." })
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
  @ApiOkResponse({ description: "Duyệt yêu cầu đăng ký máy cục bộ và tạo định danh máy chính thức." })
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
  @ApiOkResponse({ description: "Từ chối yêu cầu đăng ký máy cục bộ." })
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
  @ApiOkResponse({ description: "Tạo đăng ký máy cục bộ." })
  createMachine(@Body() dto: CreateMachineDto, @Req() request: AuthenticatedRequest) {
    return this.machinesService.createMachine(dto, request.user?.id);
  }

  @Patch(":id")
  @ApiTags("machines-admin")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Cập nhật đăng ký máy cục bộ." })
  updateMachine(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateMachineDto, @Req() request: AuthenticatedRequest) {
    return this.machinesService.updateMachine(id, dto, request.user?.id);
  }

  @Delete(":id")
  @ApiTags("machines-admin")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Vô hiệu hóa đăng ký máy cục bộ." })
  deactivateMachine(@Param("id", ParseIntPipe) id: number, @Req() request: AuthenticatedRequest) {
    return this.machinesService.deactivateMachine(id, request.user?.id);
  }

  @Delete(":id/purge")
  @ApiTags("machines-admin")
  @Roles("ADMIN", "DEV")
  @ApiOkResponse({ description: "Xóa vĩnh viễn máy cục bộ chỉ khi máy chưa có bản ghi quét." })
  deleteMachineIfNoScans(@Param("id", ParseIntPipe) id: number, @Req() request: AuthenticatedRequest) {
    return this.machinesService.deleteMachineIfNoScans(id, request.user?.id);
  }

  @Get("config")
  @ApiTags("local-machine")
  @Public()
  @ApiQuery({ name: "serial", required: true, example: "SN-LOCAL01-2026" })
  @ApiQuery({ name: "uid", required: true, example: "UID-8f8f2f1c-local01" })
  @ApiOkResponse({ description: "Tải cấu hình máy chủ theo seri và UID cục bộ ổn định." })
  getMachineConfigByIdentity(@Query("serial") serial: string, @Query("uid") uid: string) {
    return this.machinesService.getMachineConfigByIdentity({ serial, uid });
  }

  @Get(":id/commands")
  @ApiTags("machine-commands-admin")
  @ApiQuery({ name: "take", required: false, example: 50 })
  @ApiOkResponse({ description: "Liệt kê lệnh đang xếp hàng cho một máy." })
  listCommands(@Param("id", ParseIntPipe) id: number, @Query("take") take?: string) {
    return this.machinesService.listCommands(id, Number(take || 50));
  }

  @Post(":id/commands")
  @ApiTags("machine-commands-admin")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Xếp hàng lệnh để máy cục bộ lấy về." })
  createCommand(@Param("id", ParseIntPipe) id: number, @Body() dto: CreateMachineCommandDto, @Req() request: AuthenticatedRequest) {
    return this.machinesService.createCommand(id, dto, request.user?.id);
  }

  @Get("commands/poll")
  @ApiTags("local-machine")
  @Public()
  @ApiQuery({ name: "take", required: false, example: 20 })
  @ApiQuery({ name: "serial", required: true, example: "SN-LOCAL01-2026" })
  @ApiQuery({ name: "uid", required: true, example: "UID-8f8f2f1c-local01" })
  @ApiOkResponse({ description: "Lấy lệnh đang chờ theo seri và UID cục bộ ổn định." })
  pollCommandsByIdentity(@Query("serial") serial: string, @Query("uid") uid: string, @Query("take") take?: string) {
    return this.machinesService.pollCommandsByIdentity(Number(take || 20), { serial, uid });
  }

  @Post("commands/:id/ack")
  @ApiTags("local-machine")
  @Public()
  @ApiOkResponse({ description: "Xác nhận hoặc báo lỗi lệnh từ máy cục bộ." })
  ackCommand(@Param("id", ParseIntPipe) id: number, @Body() dto: AckMachineCommandDto) {
    return this.machinesService.ackCommand(id, dto);
  }

  @Post("heartbeat")
  @ApiTags("local-machine")
  @Public()
  @ApiOkResponse({ description: "Cập nhật trạng thái kết nối/đồng bộ hiện tại cho máy cục bộ." })
  heartbeat(@Body() dto: HeartbeatDto, @Req() request: RequestWithClientIp) {
    return this.machinesService.heartbeat(dto, getClientIp(request));
  }
}
