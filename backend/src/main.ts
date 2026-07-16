import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { createRequire } from "node:module";
import { AppModule } from "./app.module";

const runtimeRequire = createRequire(__filename);
const backendPackage = runtimeRequire("../package.json") as { version?: string };
const apiVersion = backendPackage.version?.trim() || "1.0.2";

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
    .setDescription("API contract for the Electron server app and Python local machines.")
    .setVersion(apiVersion)
    .addBearerAuth()
    .addTag("local-machine", "Endpoints called by Python local machines over LAN")
    .addTag("machines-admin", "Machine registration and management endpoints for the server UI")
    .addTag("machine-commands-admin", "Endpoints used by the server UI to inspect and queue machine commands")
    .addTag("machine-runtime", "Runtime WebSocket session history and monitoring endpoints")
    .addTag("scan-dashboard", "Scan history and summary endpoints for the server UI")
    .addTag("reports", "Excel report export endpoints for the server UI")
    .addTag("sync-dashboard", "Sync batch and request log endpoints for the server UI")
    .addTag("server-ui", "Endpoints used by the Electron/Next.js UI")
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
