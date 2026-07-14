import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../common/auth/auth.decorators";
import type { AuthenticatedRequest } from "../../common/auth/authenticated-request.type";
import {
  CreateNotificationTemplateDto,
  UpdateNotificationEventStatusDto,
  UpdateNotificationTemplateDto
} from "./dto/notification-crud.dto";
import { NotificationsService } from "./notifications.service";

@ApiTags("server-ui")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiQuery({ name: "take", required: false, example: 50 })
  @ApiOkResponse({ description: "List latest notification events." })
  listNotifications(@Query("take") take?: string) {
    return this.notificationsService.listNotifications(Number(take || 50));
  }

  @Patch(":id/status")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Update one notification event status." })
  updateNotificationStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateNotificationEventStatusDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.notificationsService.updateNotificationStatus(id, dto, request.user?.id);
  }

  @Get("templates")
  @ApiOkResponse({ description: "List notification templates." })
  listTemplates() {
    return this.notificationsService.listTemplates();
  }

  @Post("templates")
  @Roles("ADMIN", "DEV")
  @ApiOkResponse({ description: "Create a notification template." })
  createTemplate(@Body() dto: CreateNotificationTemplateDto, @Req() request: AuthenticatedRequest) {
    return this.notificationsService.createTemplate(dto, request.user?.id);
  }

  @Patch("templates/:id")
  @Roles("ADMIN", "DEV")
  @ApiOkResponse({ description: "Update a notification template." })
  updateTemplate(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateNotificationTemplateDto, @Req() request: AuthenticatedRequest) {
    return this.notificationsService.updateTemplate(id, dto, request.user?.id);
  }

  @Delete("templates/:id")
  @Roles("ADMIN", "DEV")
  @ApiOkResponse({ description: "Deactivate a notification template." })
  deactivateTemplate(@Param("id", ParseIntPipe) id: number, @Req() request: AuthenticatedRequest) {
    return this.notificationsService.deactivateTemplate(id, request.user?.id);
  }
}
