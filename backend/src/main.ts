import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { createRequire } from "node:module";
import { AppModule } from "./app.module";

const runtimeRequire = createRequire(__filename);
const backendPackage = runtimeRequire("../package.json") as { version?: string };
const apiVersion = backendPackage.version?.trim() || "1.1.1";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: true,
      credentials: true,
      exposedHeaders: ["Content-Disposition"]
    }
  });

  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("QR Recorder Server API")
    .setDescription("Hợp đồng API cho ứng dụng máy chủ Electron và máy cục bộ Python.")
    .setVersion(apiVersion)
    .addBearerAuth()
    .addTag("local-machine", "Điểm cuối do máy cục bộ Python gọi qua LAN")
    .addTag("machines-admin", "Điểm cuối đăng ký và quản lý máy cho giao diện máy chủ")
    .addTag("machine-commands-admin", "Điểm cuối để giao diện máy chủ xem và xếp hàng lệnh máy")
    .addTag("machine-runtime", "Điểm cuối lịch sử phiên WebSocket và giám sát phiên chạy")
    .addTag("scan-dashboard", "Điểm cuối lịch sử quét và tổng quan cho giao diện máy chủ")
    .addTag("reports", "Điểm cuối xuất báo cáo Excel cho giao diện máy chủ")
    .addTag("sync-dashboard", "Điểm cuối đợt đồng bộ và nhật ký yêu cầu cho giao diện máy chủ")
    .addTag("server-ui", "Điểm cuối dùng bởi giao diện Electron/Next.js")
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true
    }
  });

  const config = app.get(ConfigService);
  const host = config.get<string>("API_HOST", "0.0.0.0");
  const port = Number(config.get<string>("API_PORT", "4000"));

  await app.listen(port, host);
  console.log(`API listening on http://${host}:${port}/api`);
  console.log(`Swagger docs available at http://${host}:${port}/api/docs`);
}

void bootstrap();
