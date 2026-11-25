import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";
import { initSentryIfConfigured } from "./config/observability.config";

async function bootstrap() {
  initSentryIfConfigured();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(
    process.env.API_PORT ?? 3000,
    process.env.API_HOST ?? "0.0.0.0",
  );
}
void bootstrap();
