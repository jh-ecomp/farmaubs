import { INestApplication, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function configureApp(app: INestApplication): void {
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    exposedHeaders: ["Authorization", "X-Session-Expires-At"],
  });

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
    .addTag("Usuários", "Operações de gestão e cadastro de usuários (RF001)")
    .addTag(
      "Administração",
      "Consultas de catálogo e topologia municipal (RF001, RF026)",
    )
    .addTag("health", "Verificação de saúde do serviço e banco de dados")
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
