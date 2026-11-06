import {
  type SugestaoFefoResultado,
  ordenarLotesPorFEFO,
  selecionarLoteSugeridoFEFO,
} from "@farmaubs/shared";
import { MedicamentoNaoEncontradoException } from "../../domain/errors/dispensacao-catalogo.errors";
import type { DispensacaoCatalogoRepositoryPort } from "../../domain/ports/dispensacao-catalogo.repository.port";

export class ObterSugestaoLotesFefoUseCase {
  constructor(
    private readonly catalogoRepository: DispensacaoCatalogoRepositoryPort,
  ) {}

  /**
   * Consulta os lotes disponíveis na UBS para o medicamento e aplica a ordenação e sugestão FEFO,
   * bloqueando lotes vencidos da sugestão de saída (RF010).
   * @param medicamentoId Identificador único do medicamento.
   * @param unidadeId Identificador da UBS ativa da sessão.
   * @param dataReferencia Data base para cálculo de validade (padrão: hoje).
   * @returns Medicamento, lote sugerido por FEFO e lista de lotes ordenados por validade.
   */
  async execute(
    medicamentoId: string,
    unidadeId?: string | null,
    dataReferencia: Date = new Date(),
  ): Promise<SugestaoFefoResultado> {
    const medicamento = await this.catalogoRepository.buscarMedicamentoPorId(
      medicamentoId,
      unidadeId,
    );
    if (!medicamento) {
      throw new MedicamentoNaoEncontradoException(medicamentoId);
    }

    const lotesBrutos =
      await this.catalogoRepository.listarLotesPorMedicamentoEUnidade(
        medicamentoId,
        unidadeId,
      );

    const lotesDisponiveis = ordenarLotesPorFEFO(lotesBrutos, dataReferencia);
    const loteSugerido = selecionarLoteSugeridoFEFO(lotesDisponiveis);

    return {
      medicamento: {
        ...medicamento,
        requerDataReceita: medicamento.antimicrobiano,
      },
      loteSugerido,
      lotesDisponiveis,
    };
  }
}

