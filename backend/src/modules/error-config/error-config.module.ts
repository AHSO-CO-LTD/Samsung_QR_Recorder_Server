import { Module } from "@nestjs/common";
import { ErrorConfigController } from "./error-config.controller";
import { ErrorConfigService } from "./error-config.service";

@Module({
  controllers: [ErrorConfigController],
  providers: [ErrorConfigService]
})
export class ErrorConfigModule {}
