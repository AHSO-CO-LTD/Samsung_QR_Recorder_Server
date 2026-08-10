import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { createRequire } from "node:module";
import { AppModule } from "./app.module";

const runtimeRequire = createRequire(__filename);
const expressBodyParser = runtimeRequire("express");
const backendPackage = runtimeRequire("../package.json") as { version?: string };
const apiVersion = backendPackage.version?.trim() || "1.2.1";
const payloadLimitLogger = new Logger("PayloadLimit");

type PayloadLimitError = {
  type?: unknown;
  limit?: unknown;
  length?: unknown;
};

type PayloadLimitRequest = {
  method?: unknown;
  originalUrl?: unknown;
  url?: unknown;
  headers?: Record<string, unknown>;
  ip?: unknown;
  socket?: { remoteAddress?: unknown };
};

type PayloadLimitResponse = {
  status: (statusCode: number) => { json: (body: unknown) => void };
};

function toLogValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function resolveClientIp(request: PayloadLimitRequest) {
  const forwardedFor = request.headers?.["x-forwarded-for"];
  if (typeof forwardedFor === "string") {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return toLogValue(request.ip) ?? toLogValue(request.socket?.remoteAddress);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    cors: {
      origin: true,
      credentials: true,
      exposedHeaders: ["Content-Disposition"]
    }
  });

  app.use(expressBodyParser.json({ limit: "25mb" }));
  app.use(expressBodyParser.urlencoded({ extended: true, limit: "25mb" }));
  app.use((error: unknown, request: PayloadLimitRequest, response: PayloadLimitResponse, next: (nextError?: unknown) => void) => {
    const payloadError = error as PayloadLimitError;
    if (payloadError.type !== "entity.too.large") {
      next(error);
      return;
    }

    payloadLimitLogger.warn(
      JSON.stringify({
        event: "REQUEST_PAYLOAD_TOO_LARGE",
        method: toLogValue(request.method),
        path: toLogValue(request.originalUrl) ?? toLogValue(request.url),
        content_length: toLogValue(request.headers?.["content-length"]),
        expected_length: toLogValue(payloadError.length),
        limit: toLogValue(payloadError.limit),
        client_ip: resolveClientIp(request)
      })
    );
    response.status(413).json({
      success: false,
      code: "REQUEST_PAYLOAD_TOO_LARGE",
      message: "Dữ liệu gửi lên vượt quá giới hạn cho phép."
    });
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
