import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1'); // ADR-007 — versionamento por URI

  const config = new DocumentBuilder()
    .setTitle('FarmaUBS API')
    .setDescription('API REST do FarmaUBS — Gestão de Insumos Farmacêuticos')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, { useGlobalPrefix: true }); // /api/v1/docs
}
