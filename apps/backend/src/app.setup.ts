import { INestApplication, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix("api/v1");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("FarmaUBS API")
    .setDescription("API REST do FarmaUBS — Gestão de Insumos Farmacêuticos")
    .setVersion("1.0")
    .addTag("Acesso", "Autenticação e controle de sessão (RF002)")
    // Configura o suporte a Bearer Token no cabeçalho das requisições
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "Authorization",
        description: "Informe o token de acesso obtido na rota de login",
        in: "header",
      },
      "access-token",
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup("docs", app, document, { useGlobalPrefix: true });
}
