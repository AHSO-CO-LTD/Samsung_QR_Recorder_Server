import { Module } from "@nestjs/common";
import { ScansModule } from "../scans/scans.module";
import { SyncController } from "./sync.controller";
import { SyncService } from "./sync.service";

@Module({
  imports: [ScansModule],
  controllers: [SyncController],
  providers: [SyncService]
})
export class SyncModule {}
