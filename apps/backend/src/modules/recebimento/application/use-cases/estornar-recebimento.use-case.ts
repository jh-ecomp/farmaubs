import { ResultadoEstornoRecebimento } from "@farmaubs/shared";
import type { HistoricoRecebimentoRepositoryPort } from "../../domain/ports/historico-recebimento.repository.port";
import {
  DocumentoEntradaInvalidoException,
  DocumentoJaEstornadoException,
  DocumentoNaoEncontradoException,
  UbsAcessoNegadoException,
} from "../../domain/errors/recebimento.errors";

export interface ContextoEstornoRecebimento {
  municipioId: string;
  usuarioId: string;
  unidadeIdsUsuario: string[];
}

/**
 * [RF008 / RF028 / ADR-017]: Caso de uso puro para estorno atômico de recebimento físico e contábil.
 */
export class EstornarRecebimentoUseCase {
  constructor(
    private readonly historicoRepo: HistoricoRecebimentoRepositoryPort,
  ) {}

  async execute(
    documentoId: string,
    motivo: string,
    contexto: ContextoEstornoRecebimento,
  ): Promise<ResultadoEstornoRecebimento> {
    const motivoLimpo = motivo?.trim() ?? "";
    if (motivoLimpo.length < 10) {
      throw new DocumentoEntradaInvalidoException(
        "A justificativa para o estorno deve conter ao menos 10 caracteres.",
      );
    }

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

    if (documento.status === "ESTORNADO") {
      throw new DocumentoJaEstornadoException(documento.numeroDocumento);
    }

    return this.historicoRepo.executarEstornoAtomico({
      documentoId,
      motivo: motivoLimpo,
      usuarioId: contexto.usuarioId,
      municipioId: contexto.municipioId,
    });
  }
}
