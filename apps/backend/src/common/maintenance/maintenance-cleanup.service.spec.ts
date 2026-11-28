import { ConfigModule, ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { DataSource } from "typeorm";
import { MaintenanceCleanupService } from "./maintenance-cleanup.service";
import { SERVICO_EMAIL_PORT } from "../../modules/acesso/domain/ports/email-service.port";
import { ConsoleEmailServiceAdapter } from "../../modules/acesso/infrastructure/adapters/console-email-service.adapter";
import { ResendEmailServiceAdapter } from "../../modules/acesso/infrastructure/adapters/resend-email-service.adapter";

describe("E-mail Transacional e Manutenção Periódica (Camada A — RL-03)", () => {
  describe("Seleção e execução do adaptador de e-mail (EMAIL_PROVIDER)", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
      jest.restoreAllMocks();
    });

    it("seleciona ConsoleEmailServiceAdapter quando EMAIL_PROVIDER=console", async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            ignoreEnvFile: true,
            load: [() => ({ EMAIL_PROVIDER: "console" })],
          }),
        ],
        providers: [
          ConsoleEmailServiceAdapter,
          ResendEmailServiceAdapter,
          {
            provide: SERVICO_EMAIL_PORT,
            useFactory: (
              config: ConfigService,
              consoleAdapter: ConsoleEmailServiceAdapter,
              resendAdapter: ResendEmailServiceAdapter,
            ) =>
              config.get("EMAIL_PROVIDER") === "resend"
                ? resendAdapter
                : consoleAdapter,
            inject: [
              ConfigService,
              ConsoleEmailServiceAdapter,
              ResendEmailServiceAdapter,
            ],
          },
        ],
      }).compile();

      const resolved = moduleRef.get(SERVICO_EMAIL_PORT);
      expect(resolved).toBeInstanceOf(ConsoleEmailServiceAdapter);
    });

    it("envia e-mail via API HTTPS do Resend com AbortSignal de timeout e sem expor API key em erro", async () => {
      const fetchMock = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const config = new ConfigService({
        RESEND_API_KEY: "re_chave_super_secreta_123",
        SMTP_FROM: "no-reply@farmaubs.com.br",
        EMAIL_TIMEOUT_MS: "8000",
      });
      const adapter = new ResendEmailServiceAdapter(config);

      await adapter.enviarConfirmacaoCadastro(
        "  Farmaceutico@UBS.gov.br ",
        " Dra. Ana ",
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.resend.com/emails");
      expect(init.signal).toBeDefined();
      expect(JSON.parse(String(init.body)).to).toEqual([
        "farmaceutico@ubs.gov.br",
      ]);

      // Simula erro HTTP 503 garantindo que a chave secreta não vaza na mensagem lançada/logada
      fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
      await expect(
        adapter.enviarConfirmacaoCadastro("ana@ubs.gov.br", "Dra. Ana"),
      ).rejects.not.toThrow(/re_chave_super_secreta_123/);
    });
  });

  describe("Expurgo de relatórios temporários em REPORTS_DIR e ciclo de vida", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "farmaubs-rl03-"));
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("remove arquivo de 72h e preserva arquivo de 2h conforme REPORTS_RETENTION_HOURS=48", async () => {
      const oldFile = path.join(tempDir, "relatorio-antigo.xlsx");
      const recentFile = path.join(tempDir, "relatorio-recente.xlsx");
      const gitkeep = path.join(tempDir, ".gitkeep");

      await fs.writeFile(oldFile, "antigo");
      await fs.writeFile(recentFile, "recente");
      await fs.writeFile(gitkeep, "");

      const nowMs = Date.now();
      const seventyTwoHoursAgo = new Date(nowMs - 72 * 3_600 * 1_000);
      const twoHoursAgo = new Date(nowMs - 2 * 3_600 * 1_000);

      await fs.utimes(oldFile, seventyTwoHoursAgo, seventyTwoHoursAgo);
      await fs.utimes(recentFile, twoHoursAgo, twoHoursAgo);

      const dsMock = {
        query: jest.fn().mockResolvedValue([{ total: 2 }]),
      } as unknown as DataSource;
      const config = new ConfigService({
        REPORTS_DIR: tempDir,
        REPORTS_RETENTION_HOURS: "48",
        MAINTENANCE_JOBS_ENABLED: "true",
      });

      const service = new MaintenanceCleanupService(dsMock, config);
      service.onModuleInit();
      const resultado = await service.executarCicloManutencao();
      service.onModuleDestroy();

      expect(resultado).toEqual({ sessoesRemovidas: 2, relatoriosRemovidos: 1 });

      const remaining = await fs.readdir(tempDir);
      expect(remaining.sort()).toEqual([".gitkeep", "relatorio-recente.xlsx"]);
    });
  });
});
