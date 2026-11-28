import * as Sentry from "@sentry/nestjs";
import type { ErrorEvent } from "@sentry/nestjs";
import { Writable } from "node:stream";
import pino from "pino";
import {
  buildPinoRedactPaths,
  initSentryIfConfigured,
  sanitizeSentryEvent,
} from "./observability.config";

jest.mock("@sentry/nestjs", () => ({
  init: jest.fn(),
}));

describe("Observabilidade Pino + Sanitização Sentry (Camada A — RL-04)", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("mascara headers.cookie, authorization, senha, password, cpf e cns como [Redacted] na saída JSON do Pino", () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(chunk.toString("utf8"));
        callback();
      },
    });

    const logger = pino(
      {
        level: "info",
        redact: {
          paths: buildPinoRedactPaths(),
          censor: "[Redacted]",
        },
      },
      sink,
    );

    logger.info({
      headers: {
        cookie: "farmaubs_session=segredo",
        authorization: "Bearer token-123",
      },
      senha: "Admin@123456",
      password: "raw-password",
      cpf: "12345678901",
      cns: "700001122334455",
      paciente: {
        nome: "Maria",
        cpf: "99988877766",
        cns: "898001122334455",
      },
    });

    expect(lines).toHaveLength(1);
    const payload = JSON.parse(lines[0]);
    expect(payload.headers.cookie).toBe("[Redacted]");
    expect(payload.headers.authorization).toBe("[Redacted]");
    expect(payload.senha).toBe("[Redacted]");
    expect(payload.password).toBe("[Redacted]");
    expect(payload.cpf).toBe("[Redacted]");
    expect(payload.cns).toBe("[Redacted]");
    expect(payload.paciente).toEqual({
      nome: "Maria",
      cpf: "[Redacted]",
      cns: "[Redacted]",
    });
  });

  it("remove cookies, Authorization e PII no hook sanitizeSentryEvent (beforeSend)", () => {
    const rawEvent = {
      type: undefined,
      request: {
        cookies: { farmaubs_session: "token-secreto" },
        headers: {
          Authorization: "Bearer abc",
          Cookie: "farmaubs_session=abc",
          "User-Agent": "Mozilla/5.0",
        },
        data: JSON.stringify({
          email: "farma@ubs.gov.br",
          senha: "Farma@123",
          cpf: "11122233344",
          cns: "700000000000001",
        }),
      },
      extra: {
        novaSenha: "Nova@123",
        operacao: "dispensacao",
      },
    } as unknown as ErrorEvent;

    const clean = sanitizeSentryEvent(rawEvent);

    expect(clean.request?.cookies).toBeUndefined();
    expect(clean.request?.headers?.Authorization).toBe("[Redacted]");
    expect(clean.request?.headers?.Cookie).toBe("[Redacted]");
    expect(clean.request?.headers?.["User-Agent"]).toBe("Mozilla/5.0");
    expect(JSON.parse(String(clean.request?.data))).toEqual({
      email: "farma@ubs.gov.br",
      senha: "[Redacted]",
      cpf: "[Redacted]",
      cns: "[Redacted]",
    });
    expect(clean.extra).toEqual({
      novaSenha: "[Redacted]",
      operacao: "dispensacao",
    });
  });

  it("inicializa o Sentry apenas quando SENTRY_DSN está preenchida", () => {
    const initMock = Sentry.init as jest.Mock;

    expect(initSentryIfConfigured({ SENTRY_DSN: "   " })).toBe(false);
    expect(initMock).not.toHaveBeenCalled();

    expect(
      initSentryIfConfigured({
        SENTRY_DSN: "https://public@o0.ingest.sentry.io/1",
        APP_ENV: "hml",
      }),
    ).toBe(true);
    expect(initMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://public@o0.ingest.sentry.io/1",
        environment: "hml",
        beforeSend: expect.any(Function),
      }),
    );
  });
});
