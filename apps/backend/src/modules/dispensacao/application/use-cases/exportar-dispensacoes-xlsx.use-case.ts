import {
  type ListarDispensacoesQuery,
  resolverIntervaloHistoricoDispensacoes,
} from "@farmaubs/shared";
import { IntervaloDatasInvalidoException } from "../../domain/errors/dispensacao.errors";
import type { GeradorPlanilhaPort } from "../../domain/ports/gerador-planilha.port";
import type { HistoricoDispensacaoRepositoryPort } from "../../domain/ports/historico-dispensacao.repository.port";

export interface ExportarDispensacoesXlsxResultado {
  buffer: Buffer;
  nomeArquivo: string;
  contentType: string;
  totalLinhas: number;
}

export class ExportarDispensacoesXlsxUseCase {
  constructor(
    private readonly historicoRepository: HistoricoDispensacaoRepositoryPort,
    private readonly geradorPlanilha: GeradorPlanilhaPort,
  ) {}

  /**
   * Consulta as dispensações filtradas da UBS e gera o binário .xlsx com as 12 colunas obrigatórias (RF012).
   * @param query Filtros temporais e de busca aplicados.
   * @param unidadeId Identificador da UBS ativa da sessão.
   * @param dataReferencia Data base para fallback D-1 e D0 (padrão: agora).
   * @returns Buffer do arquivo Excel (.xlsx), nome sugerido para download e metadados.
   */
  async execute(
    query: ListarDispensacoesQuery = {},
    unidadeId?: string | null,
    dataReferencia: Date = new Date(),
  ): Promise<ExportarDispensacoesXlsxResultado> {
    const intervalo = resolverIntervaloHistoricoDispensacoes(
      query.dataInicio,
      query.dataFim,
      dataReferencia,
    );
    if (!intervalo.valido) {
      throw new IntervaloDatasInvalidoException();
    }

    const linhas = await this.historicoRepository.buscarParaExportacao({
      unidadeId,
      dataInicio: intervalo.dataInicioEfetiva,
      dataFim: intervalo.dataFimEfetiva,
      pacienteTermo: query.pacienteTermo?.trim() || undefined,
      medicamentoTermo: query.medicamentoTermo?.trim() || undefined,
      categoria: query.categoria?.trim() || undefined,
      status: query.status,
    });

    const buffer = await this.geradorPlanilha.gerarXlsx(linhas);
    const sufixoUnidade = (unidadeId || "geral")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 12);
    const nomeArquivo = `dispensacoes_ubs_${sufixoUnidade}_${intervalo.dataInicioEfetiva}_${intervalo.dataFimEfetiva}.xlsx`;

    return {
      buffer,
      nomeArquivo,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      totalLinhas: linhas.length,
    };
  }
}

