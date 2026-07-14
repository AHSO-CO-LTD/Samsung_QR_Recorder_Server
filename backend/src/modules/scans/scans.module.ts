import { Module } from "@nestjs/common";
import { MachinesModule } from "../machines/machines.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { RuntimeModule } from "../runtime/runtime.module";
import { ScansController } from "./scans.controller";
import { ScansService } from "./scans.service";

@Module({
  imports: [MachinesModule, NotificationsModule, RuntimeModule],
  controllers: [ScansController],
  providers: [ScansService],
  exports: [ScansService]
})
export class ScansModule {}
