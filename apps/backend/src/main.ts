import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(
    process.env.API_PORT ?? 3000,
    process.env.API_HOST ?? '0.0.0.0',
  );
}
void bootstrap();
