import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource } from "@nestjs/typeorm";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { DataSource } from "typeorm";

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 horas

/**
 * [NF004 / NF012 / ADR-006 / ADR-009 / RL-03]: Rotina periódica de higienização operacional.
 * Purga sessões expiradas via função SQL canônica auth_limpar_sessoes_expiradas(1)
 * e remove relatórios temporários acima de REPORTS_RETENTION_HOURS sem vazar timers nos testes.
 */
@Injectable()
export class MaintenanceCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceCleanupService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.isMaintenanceEnabled()) {
      return;
    }

    this.timer = setInterval(() => {
      void this.executarCicloManutencao();
    }, DEFAULT_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Executa um ciclo completo de limpeza de sessões expiradas e relatórios antigos.
   * @returns Quantidades removidas em cada frente.
   */
  async executarCicloManutencao(): Promise<{
    sessoesRemovidas: number;
    relatoriosRemovidos: number;
  }> {
    let sessoesRemovidas = 0;
    let relatoriosRemovidos = 0;

    try {
      sessoesRemovidas = await this.limparSessoesExpiradas(1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro desconhecido";
      this.logger.error(`Falha ao limpar sessões expiradas: ${msg}`);
    }

    try {
      relatoriosRemovidos = await this.expurgarRelatoriosAntigos();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro desconhecido";
      this.logger.error(`Falha ao expurgar relatórios temporários: ${msg}`);
    }

    return { sessoesRemovidas, relatoriosRemovidos };
  }

  /**
   * [ADR-006 / NF012]: Invoca a função SQL canônica auth_limpar_sessoes_expiradas(p_dias_retencao).
   * Com diasRetencao=1, remove sessões expiradas há mais de 24 horas preservando sessões ativas.
   * @param diasRetencao - Janela em dias após a expiração (padrão: 1 dia / 24h).
   * @returns Quantidade de sessões removidas.
   */
  async limparSessoesExpiradas(diasRetencao: number = 1): Promise<number> {
    const rows = await this.dataSource.query<Array<{ total: string | number }>>(
      `SELECT auth_limpar_sessoes_expiradas($1::int) AS total`,
      [diasRetencao],
    );
    return Number(rows?.[0]?.total ?? 0);
  }

  /**
   * [ADR-009]: Remove arquivos regulares em REPORTS_DIR cuja idade supere REPORTS_RETENTION_HOURS.
   * @param referenciaMs - Timestamp atual para cálculo de idade (padrão: Date.now()).
   * @returns Total de arquivos temporários excluídos.
   */
  async expurgarRelatoriosAntigos(
    referenciaMs: number = Date.now(),
  ): Promise<number> {
    const reportsDir = path.resolve(
      this.config.get<string>("REPORTS_DIR", "./storage/reports"),
    );
    const retentionHours = parseInt(
      this.config.get<string>("REPORTS_RETENTION_HOURS", "48"),
      10,
    );
    const maxAgeMs =
      (Number.isFinite(retentionHours) && retentionHours > 0
        ? retentionHours
        : 48) *
      3_600 *
      1_000;

    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(reportsDir, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return 0;
      }
      throw err;
    }

    let removidos = 0;
    for (const entry of entries) {
      if (!entry.isFile() || entry.name === ".gitkeep") {
        continue;
      }
      const fullPath = path.join(reportsDir, entry.name);
      const stats = await fs.stat(fullPath);
      if (referenciaMs - stats.mtimeMs > maxAgeMs) {
        await fs.unlink(fullPath);
        removidos += 1;
      }
    }

    return removidos;
  }

  private isMaintenanceEnabled(): boolean {
    const raw = this.config.get<string>("MAINTENANCE_JOBS_ENABLED");
    if (raw === "true") return true;
    if (raw === "false") return false;
    return this.config.get<string>("NODE_ENV") !== "test";
  }
}
