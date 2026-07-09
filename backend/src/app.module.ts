import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./modules/auth/auth.module";
import { DuplicatesModule } from "./modules/duplicates/duplicates.module";
import { HealthModule } from "./modules/health/health.module";
import { MachinesModule } from "./modules/machines/machines.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ProfilesModule } from "./modules/profiles/profiles.module";
import { ScansModule } from "./modules/scans/scans.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { SyncModule } from "./modules/sync/sync.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../.env", ".env"]
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    MachinesModule,
    ProfilesModule,
    ScansModule,
    DuplicatesModule,
    SyncModule,
    NotificationsModule,
    SettingsModule
  ]
})
export class AppModule {}
