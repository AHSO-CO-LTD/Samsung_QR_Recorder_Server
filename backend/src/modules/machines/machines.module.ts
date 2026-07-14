import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { MachinesController } from "./machines.controller";
import { MachinesService } from "./machines.service";

@Module({
  imports: [NotificationsModule],
  controllers: [MachinesController],
  providers: [MachinesService],
  exports: [MachinesService]
})
export class MachinesModule {}
