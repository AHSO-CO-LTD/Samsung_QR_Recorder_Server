import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
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

  @Get("templates")
  @ApiOkResponse({ description: "List notification templates." })
  listTemplates() {
    return this.notificationsService.listTemplates();
  }
}
