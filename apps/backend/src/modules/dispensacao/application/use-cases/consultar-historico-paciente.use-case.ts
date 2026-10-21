import { Inject, Injectable } from "@nestjs/common";
import type {
  HistoricoPacienteResultado,
  ItemHistoricoConsumoDto,
} from "@farmaubs/shared";
import { PacienteNaoEncontradoException } from "../../domain/errors/paciente.errors";
import {
  PACIENTE_REPOSITORY_PORT,
  type PacienteRepositoryPort,
} from "../../domain/ports/paciente.repository.port";

@Injectable()
export class ConsultarHistoricoPacienteUseCase {
  constructor(
    @Inject(PACIENTE_REPOSITORY_PORT)
    private readonly pacienteRepository: PacienteRepositoryPort,
  ) {}

  /**
   * Consulta o histórico de retiradas dos últimos 90 dias do paciente e detecta risco de uso irracional (RF012).
   * @param pacienteId Identificador único do paciente.
   * @param dataReferencia Data base para cálculo dos dias decorridos (padrão: agora).
   * @returns Resultado contendo o cadastro do paciente e a lista de itens retirados com alertas clínicos.
   */
  async execute(
    pacienteId: string,
    dataReferencia: Date = new Date(),
  ): Promise<HistoricoPacienteResultado> {
    const paciente = await this.pacienteRepository.buscarPorId(pacienteId);
    if (!paciente) {
      throw new PacienteNaoEncontradoException(pacienteId);
    }

    const registros =
      await this.pacienteRepository.buscarHistorico90Dias(pacienteId);

    const itensConsumo: ItemHistoricoConsumoDto[] = registros.map((item) => {
      const dataItem = new Date(item.dataDispensacao);
      const diffMs = dataReferencia.getTime() - dataItem.getTime();
      const dias = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      const possivelUsoIrracional = dias < 25;

      return {
        dispensacaoId: item.dispensacaoId,
        dataDispensacao: item.dataDispensacao.toISOString
          ? item.dataDispensacao.toISOString()
          : String(item.dataDispensacao),
        medicamentoId: item.medicamentoId,
        medicamentoNome: item.medicamentoNome,
        quantidadeDispensada: item.quantidadeDispensada,
        posologia: item.posologia,
        diasDesdeUltimaRetirada: dias,
        possivelUsoIrracional,
      };
    });

    return {
      paciente,
      itensConsumo,
    };
  }
}

