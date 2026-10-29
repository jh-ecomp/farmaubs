import type {
  EstornarDispensacaoRequest,
  EstornarDispensacaoResultado,
} from "@farmaubs/shared";
import {
  DadosDispensacaoInvalidosException,
  DispensacaoJaEstornadaException,
  DispensacaoNaoEncontradaException,
  MotivoEstornoInvalidoException,
} from "../../domain/errors/dispensacao.errors";
import type { HistoricoDispensacaoRepositoryPort } from "../../domain/ports/historico-dispensacao.repository.port";

export interface ContextoEstornoDispensacao {
  unidadeId?: string | null;
  estornadoPorId: string;
}

export class EstornarDispensacaoUseCase {
  constructor(
    private readonly historicoRepository: HistoricoDispensacaoRepositoryPort,
  ) {}

  /**
   * Realiza o estorno transacional de uma dispensação concluída, devolvendo os saldos aos lotes físicos
   * e registrando o motivo e o responsável pela reversão (RF028, ADR-015).
   * @param dispensacaoId Identificador da dispensação a estornar.
   * @param request Payload contendo o motivo obrigatório (>= 10 caracteres).
   * @param contexto Identificadores da UBS e do profissional que executa o estorno.
   * @returns Resultado do estorno com os saldos restituídos aos lotes.
   */
  async execute(
    dispensacaoId: string,
    request: EstornarDispensacaoRequest,
    contexto: ContextoEstornoDispensacao,
  ): Promise<EstornarDispensacaoResultado> {
    if (!contexto.estornadoPorId) {
      throw new DadosDispensacaoInvalidosException(
        "Profissional responsável pelo estorno não identificado na sessão.",
      );
    }

    const motivoLimpo = request?.motivoEstorno ? request.motivoEstorno.trim() : "";
    if (motivoLimpo.length < 10) {
      throw new MotivoEstornoInvalidoException();
    }

    const dispensacao =
      await this.historicoRepository.buscarDispensacaoParaEstorno(
        dispensacaoId,
        contexto.unidadeId,
      );
    if (!dispensacao) {
      throw new DispensacaoNaoEncontradaException(dispensacaoId);
    }

    if (dispensacao.status === "estornada") {
      throw new DispensacaoJaEstornadaException(dispensacaoId);
    }

    return this.historicoRepository.executarEstornoAtomico({
      dispensacaoId: dispensacao.id,
      estornadoPorId: contexto.estornadoPorId,
      motivoEstorno: motivoLimpo,
      itens: dispensacao.itens,
    });
  }
}

