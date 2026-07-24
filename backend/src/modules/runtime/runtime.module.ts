import { Module } from "@nestjs/common";
import { MachinesModule } from "../machines/machines.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { RuntimeController } from "./runtime.controller";
import { RuntimeGateway } from "./runtime.gateway";
import { RuntimeService } from "./runtime.service";

@Module({
  imports: [MachinesModule, NotificationsModule],
  controllers: [RuntimeController],
  providers: [RuntimeService, RuntimeGateway],
  exports: [RuntimeService, RuntimeGateway]
})
export class RuntimeModule {}
