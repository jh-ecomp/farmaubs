import { ConfigService } from "@nestjs/config";
import * as Sentry from "@sentry/nestjs";
import type { ErrorEvent } from "@sentry/nestjs";
import type { Params } from "nestjs-pino";
import * as crypto from "node:crypto";
import type { IncomingMessage } from "node:http";

export const SENSITIVE_LOG_FIELDS = [
  "password",
  "senha",
  "senhaAtual",
  "novaSenha",
  "senhaProvisoria",
  "cpf",
  "cns",
  "token",
] as const;

const SENSITIVE_KEY_PATTERN =
  /^(password|senha|senhaatual|novasenha|senhaprovisoria|cpf|cns|token|cookie|set-cookie|authorization|secret|apikey|resend_api_key|db_password)$/i;

/**
 * [NF010 / ADR-026 / ADR-027 / RL-04]: Gera os caminhos de redação do Pino cobrindo cabeçalhos HTTP
 * e campos sensíveis (PII/credenciais) na raiz e em objetos aninhados.
 * @returns Lista de expressões compatíveis com fast-redact do Pino.
 */
export function buildPinoRedactPaths(): string[] {
  const paths: string[] = [
    "headers.authorization",
    "headers.cookie",
    'headers["set-cookie"]',
    "req.headers.authorization",
    "req.headers.cookie",
    'res.headers["set-cookie"]',
  ];

  for (const field of SENSITIVE_LOG_FIELDS) {
    paths.push(field, `*.${field}`, `*.*.${field}`, `*.*.*.${field}`);
  }

  return paths;
}

/**
 * [ADR-026 / RL-04]: Monta a configuração do nestjs-pino por ambiente.
 * Em produção emite JSON puro em stdout; em test fica silencioso sem worker threads.
 * @param config - Instância do ConfigService do NestJS.
 * @returns Parâmetros prontos para LoggerModule.forRootAsync.
 */
export function buildLoggerModuleParams(config: ConfigService): Params {
  const nodeEnv = config.get<string>("NODE_ENV", "development");
  const defaultLevel = nodeEnv === "test" ? "silent" : "info";
  const level = config.get<string>("LOG_LEVEL", defaultLevel);

  return {
    pinoHttp: {
      level,
      redact: {
        paths: buildPinoRedactPaths(),
        censor: "[Redacted]",
      },
      genReqId: (req: IncomingMessage) => {
        const incoming = req.headers["x-request-id"];
        const headerId = Array.isArray(incoming) ? incoming[0] : incoming;
        return headerId && headerId.trim().length > 0
          ? headerId.trim()
          : crypto.randomUUID();
      },
      transport:
        nodeEnv === "development"
          ? {
              target: "pino-pretty",
              options: { singleLine: true, colorize: true },
            }
          : undefined,
    },
  };
}

function maskSensitiveObject(value: unknown, depth: number = 0): unknown {
  if (depth > 5 || value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveObject(item, depth + 1));
  }
  if (typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      sanitized[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? "[Redacted]"
        : maskSensitiveObject(val, depth + 1);
    }
    return sanitized;
  }
  return value;
}

/**
 * [NF010 / ADR-026 / ADR-027 / RL-04]: Hook beforeSend do Sentry que expurga cookies,
 * cabeçalhos Authorization e campos de PII (CPF, CNS, senhas) antes de sair do servidor.
 * @param event - Evento de erro capturado pelo SDK do Sentry.
 * @returns Evento higienizado seguro para transmissão externa.
 */
export function sanitizeSentryEvent<T extends ErrorEvent>(event: T): T {
  const cloned = { ...event };

  if (cloned.request) {
    const reqCopy = { ...cloned.request };
    delete reqCopy.cookies;

    if (reqCopy.headers) {
      reqCopy.headers = maskSensitiveObject(reqCopy.headers) as Record<
        string,
        string
      >;
    }
    if (reqCopy.data !== undefined) {
      if (typeof reqCopy.data === "string") {
        try {
          reqCopy.data = JSON.stringify(
            maskSensitiveObject(JSON.parse(reqCopy.data)),
          );
        } catch {
          reqCopy.data = "[Redacted]";
        }
      } else {
        reqCopy.data = maskSensitiveObject(reqCopy.data);
      }
    }
    cloned.request = reqCopy;
  }

  if (cloned.extra) {
    cloned.extra = maskSensitiveObject(cloned.extra) as Record<string, unknown>;
  }

  return cloned;
}

/**
 * [ADR-026 / RL-04]: Inicializa o Sentry condicionalmente apenas quando SENTRY_DSN está preenchida.
 * @param env - Variáveis de ambiente em execução.
 * @returns Verdadeiro se o Sentry foi inicializado; falso quando desabilitado.
 */
export function initSentryIfConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) {
    return false;
  }

  Sentry.init({
    dsn,
    environment: env.APP_ENV?.trim() || env.NODE_ENV || "development",
    beforeSend: (event) => sanitizeSentryEvent(event),
  });

  return true;
}
