import { INestApplication, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";

/**
 * [NF009 / RL-01]: Extrai o IP real do cliente atrás da cadeia Cloudflare -> Caddy -> Nginx.
 * Prioriza CF-Connecting-IP e o primeiro salto de X-Forwarded-For antes do IP de socket.
 * @param req - Requisição HTTP contendo cabeçalhos de proxy e metadados de conexão.
 * @returns Endereço IP real do cliente para auditoria e rate limiting.
 */
export function extractClientIp(req: {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}): string {
  const cfIp = req.headers?.["cf-connecting-ip"];
  const rawCf = Array.isArray(cfIp) ? cfIp[0] : cfIp;
  if (rawCf && rawCf.trim().length > 0) {
    return rawCf.trim();
  }

  const xff = req.headers?.["x-forwarded-for"];
  const rawXff = Array.isArray(xff) ? xff[0] : xff;
  if (rawXff && rawXff.trim().length > 0) {
    const firstHop = rawXff.split(",")[0]?.trim();
    if (firstHop) return firstHop;
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
}

/**
 * [NF009 / RL-01]: Converte CORS_ORIGIN separada por vírgulas em lista higienizada de origens permitidas.
 * @param rawOrigins - String bruta da variável CORS_ORIGIN.
 * @returns Lista de origens autorizadas.
 */
export function parseCorsOrigins(rawOrigins?: string): string[] {
  const source = rawOrigins?.trim() ? rawOrigins : "http://localhost:5173";
  return source
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/**
 * [NF004 / NF009 / RL-01]: Configura middlewares globais de segurança, proxy, CORS, validação e Swagger.
 * @param app - Instância da aplicação NestJS.
 */
export function configureApp(app: INestApplication): void {
  const isProd = process.env.NODE_ENV === "production";
  const swaggerEnabled = !isProd || process.env.SWAGGER_ENABLED === "true";

  const httpInstance = app.getHttpAdapter().getInstance() as {
    set?: (setting: string, val: unknown) => void;
  };
  if (typeof httpInstance?.set === "function") {
    httpInstance.set("trust proxy", "loopback, linklocal, uniquelocal");
  }

  app.use(
    helmet({
      contentSecurityPolicy: swaggerEnabled ? false : undefined,
    }),
  );

  app.use(cookieParser());

  const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);
  app.enableCors({
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    exposedHeaders: [
      "Authorization",
      "X-Session-Expires-At",
      "Set-Cookie",
      "Content-Disposition",
    ],
  });

  app.setGlobalPrefix("api/v1");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (swaggerEnabled) {
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
      .addTag(
        "Estoque",
        "Controle de saldos, ajustes, rastreabilidade e relatórios (RF005, RF020, RF028)",
      )
      .addTag("health", "Verificação de saúde do serviço e banco de dados")
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
}
