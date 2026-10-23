import {
  FiltroHistoricoRecebimento,
  HistoricoRecebimentoPaginado,
} from "@farmaubs/shared";
import type { HistoricoRecebimentoRepositoryPort } from "../../domain/ports/historico-recebimento.repository.port";
import { UbsAcessoNegadoException } from "../../domain/errors/recebimento.errors";

export interface ContextoListagemHistorico {
  municipioId: string;
  unidadeIdsUsuario: string[];
}

/**
 * [RF008 / RF028]: Caso de uso para consulta e listagem paginada do histórico de recebimentos.
 */
export class ListarHistoricoRecebimentoUseCase {
  constructor(
    private readonly historicoRepo: HistoricoRecebimentoRepositoryPort,
  ) {}

  /**
   * Executa a busca paginada com aplicação de filtros de UBS, período e termo de busca.
   */
  async execute(
    filtro: FiltroHistoricoRecebimento,
    contexto: ContextoListagemHistorico,
  ): Promise<HistoricoRecebimentoPaginado> {
    const { municipioId, unidadeIdsUsuario } = contexto;

    // Se informou UBS específica, garante que pertença às UBS do operador (ou se for admin sem restrição)
    if (
      filtro.ubsId &&
      unidadeIdsUsuario.length > 0 &&
      !unidadeIdsUsuario.includes(filtro.ubsId)
    ) {
      throw new UbsAcessoNegadoException(filtro.ubsId);
    }

    return this.historicoRepo.listarHistorico(
      filtro,
      municipioId,
      unidadeIdsUsuario,
    );
  }
}
