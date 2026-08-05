import { Global, Module } from "@nestjs/common";
import { RuntimeConnectionRegistry } from "./runtime-connection-registry.service";

@Global()
@Module({
  providers: [RuntimeConnectionRegistry],
  exports: [RuntimeConnectionRegistry]
})
export class RuntimeConnectionModule {}
