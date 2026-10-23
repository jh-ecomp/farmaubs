import { DetalhesRecebimentoCompleto } from "@farmaubs/shared";
import type { HistoricoRecebimentoRepositoryPort } from "../../domain/ports/historico-recebimento.repository.port";
import {
  DocumentoNaoEncontradoException,
  UbsAcessoNegadoException,
} from "../../domain/errors/recebimento.errors";

export interface ContextoDetalhesRecebimento {
  municipioId: string;
  unidadeIdsUsuario: string[];
}

/**
 * [RF008 / RF028]: Caso de uso para obter detalhes completos do recebimento e emissão de comprovante.
 */
export class ObterDetalhesRecebimentoUseCase {
  constructor(
    private readonly historicoRepo: HistoricoRecebimentoRepositoryPort,
  ) {}

  async execute(
    documentoId: string,
    contexto: ContextoDetalhesRecebimento,
  ): Promise<DetalhesRecebimentoCompleto> {
    const documento = await this.historicoRepo.obterDetalhesPorId(
      documentoId,
      contexto.municipioId,
    );

    if (!documento) {
      throw new DocumentoNaoEncontradoException(documentoId);
    }

    if (
      contexto.unidadeIdsUsuario.length > 0 &&
      !contexto.unidadeIdsUsuario.includes(documento.ubsId)
    ) {
      throw new UbsAcessoNegadoException(documento.ubsId);
    }

    return documento;
  }
}
