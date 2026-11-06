import {
  type DispensacoesPaginadasResultado,
  type ListarDispensacoesQuery,
  PAGINATION_DEFAULTS,
  resolverIntervaloHistoricoDispensacoes,
} from "@farmaubs/shared";
import { IntervaloDatasInvalidoException } from "../../domain/errors/dispensacao.errors";
import type { HistoricoDispensacaoRepositoryPort } from "../../domain/ports/historico-dispensacao.repository.port";

export class ListarDispensacoesUseCase {
  constructor(
    private readonly historicoRepository: HistoricoDispensacaoRepositoryPort,
  ) {}

  /**
   * Lista as dispensações da UBS com filtro temporal padrão de ontem e hoje (D-1 e D0),
   * filtros combinados (paciente, medicamento, categoria, status) e paginação (RF012).
   * @param query Parâmetros de filtro e paginação.
   * @param unidadeId Identificador da UBS ativa da sessão.
   * @param dataReferencia Data base para fallback padrão D-1 e D0 (padrão: agora).
   * @returns Resultado paginado com os itens e as datas efetivas aplicadas.
   */
  async execute(
    query: ListarDispensacoesQuery = {},
    unidadeId?: string | null,
    dataReferencia: Date = new Date(),
  ): Promise<DispensacoesPaginadasResultado> {
    const intervalo = resolverIntervaloHistoricoDispensacoes(
      query.dataInicio,
      query.dataFim,
      dataReferencia,
    );
    if (!intervalo.valido) {
      throw new IntervaloDatasInvalidoException();
    }

    const pagina = Math.max(1, Number(query.pagina ?? PAGINATION_DEFAULTS.PAGE));
    const limite = Math.min(
      PAGINATION_DEFAULTS.MAX_LIMIT,
      Math.max(1, Number(query.limite ?? PAGINATION_DEFAULTS.LIMIT)),
    );

    const { itens, totalItens } = await this.historicoRepository.listarFiltrado({
      unidadeId,
      dataInicio: intervalo.dataInicioEfetiva,
      dataFim: intervalo.dataFimEfetiva,
      pacienteTermo: query.pacienteTermo?.trim() || undefined,
      medicamentoTermo: query.medicamentoTermo?.trim() || undefined,
      categoria: query.categoria?.trim() || undefined,
      status: query.status,
      pagina,
      limite,
    });

    const totalPaginas = Math.max(1, Math.ceil(totalItens / limite));

    return {
      itens,
      totalItens,
      pagina,
      limite,
      totalPaginas,
      dataInicioEfetiva: intervalo.dataInicioEfetiva,
      dataFimEfetiva: intervalo.dataFimEfetiva,
    };
  }
}

