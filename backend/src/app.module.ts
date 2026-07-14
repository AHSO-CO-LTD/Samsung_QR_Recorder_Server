import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ApiAuthGuard } from "./common/auth/auth.guard";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { DuplicatesModule } from "./modules/duplicates/duplicates.module";
import { HealthModule } from "./modules/health/health.module";
import { MachinesModule } from "./modules/machines/machines.module";
import { MasterDataModule } from "./modules/master-data/master-data.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ProfilesModule } from "./modules/profiles/profiles.module";
import { RuntimeModule } from "./modules/runtime/runtime.module";
import { ScansModule } from "./modules/scans/scans.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { SetupModule } from "./modules/setup/setup.module";
import { SyncModule } from "./modules/sync/sync.module";
import { UsersModule } from "./modules/users/users.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../.env", ".env"]
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    HealthModule,
    MachinesModule,
    MasterDataModule,
    ProfilesModule,
    RuntimeModule,
    ScansModule,
    DuplicatesModule,
    SyncModule,
    NotificationsModule,
    SettingsModule,
    SetupModule,
    UsersModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiAuthGuard
    }
  ]
})
export class AppModule {}
