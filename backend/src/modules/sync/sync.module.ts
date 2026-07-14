import { Module } from "@nestjs/common";
import { MachinesModule } from "../machines/machines.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ScansModule } from "../scans/scans.module";
import { SyncController } from "./sync.controller";
import { SyncService } from "./sync.service";

@Module({
  imports: [MachinesModule, NotificationsModule, ScansModule],
  controllers: [SyncController],
  providers: [SyncService]
})
export class SyncModule {}
