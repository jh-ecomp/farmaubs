import type { MedicamentoBuscaDto } from "@farmaubs/shared";
import type { DispensacaoCatalogoRepositoryPort } from "../../domain/ports/dispensacao-catalogo.repository.port";

export class BuscarMedicamentosDispensacaoUseCase {
  constructor(
    private readonly catalogoRepository: DispensacaoCatalogoRepositoryPort,
  ) {}

  /**
   * Busca medicamentos ativos no catálogo por termo textual (nome comercial, princípio ativo ou apresentação)
   * e retorna o saldo consolidado na UBS ativa da sessão (RF010, NF010).
   * @param termo Fragmento de texto para pesquisa.
   * @param unidadeId Identificador da UBS ativa da sessão.
   * @returns Lista de medicamentos correspondentes com flag de antimicrobiano e saldo consolidado.
   */
  async execute(
    termo?: string,
    unidadeId?: string | null,
  ): Promise<MedicamentoBuscaDto[]> {
    const termoLimpo = termo ? termo.trim() : "";
    if (!termoLimpo) {
      return [];
    }

    const itens = await this.catalogoRepository.buscarPorTermoEUnidade(
      termoLimpo,
      unidadeId,
    );

    return itens.map((med) => ({
      ...med,
      requerDataReceita: med.antimicrobiano,
    }));
  }
}

