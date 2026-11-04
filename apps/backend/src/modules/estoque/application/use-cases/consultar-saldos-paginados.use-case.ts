import {
  calcularConsumoMedioDiario,
  calcularStatusEstoque,
  calcularStatusValidade,
  ordenarLotesSaldoPorFEFO,
  type ConsultarSaldosPaginadosResponseDto,
} from "@farmaubs/shared";
import type {
  FiltrosConsultaSaldos,
  RepositorioEstoqueSaldosPort,
} from "../../domain/ports/estoque-saldos.repository.port";

/**
 * [RF005 / RF022]: Consulta paginada de saldos por medicamento, com lotes em ordem FEFO,
 * status de validade por lote e status de estoque por medicamento.
 * Classe pura: depende apenas da porta e das regras do @farmaubs/shared.
 */
export class ConsultarSaldosPaginadosUseCase {
  constructor(private readonly repositorio: RepositorioEstoqueSaldosPort) {}

  /**
   * @param ubsId UBS consultada (já validada contra o escopo pelo TenantScopeGuard).
   * @param filtros Filtros e paginação normalizados.
   * @param hoje Data de referência 'AAAA-MM-DD' no fuso da UBS.
   * @returns Página de medicamentos com lotes enriquecidos e metadados de paginação.
   */
  async executar(
    ubsId: string,
    filtros: FiltrosConsultaSaldos,
    hoje: string,
  ): Promise<ConsultarSaldosPaginadosResponseDto> {
    const { itens, total } = await this.repositorio.consultarSaldosPaginados(
      ubsId,
      filtros,
      hoje,
    );

    return {
      itens: itens.map((p) => {
        const consumoMedioDiario = calcularConsumoMedioDiario(
          p.totalDispensado,
          p.diasApurados,
        );
        return {
          produtoId: p.produtoId,
          nome: p.nome,
          principioAtivo: p.principioAtivo,
          formaFarmaceutica: p.formaFarmaceutica,
          concentracao: p.concentracao,
          unidadeMedida: p.unidadeMedida,
          categoria: p.categoria,
          saldoTotal: p.saldoTotal,
          statusEstoque: calcularStatusEstoque(p.saldoTotal, consumoMedioDiario),
          lotes: ordenarLotesSaldoPorFEFO(p.lotes).map((l) => ({
            id: l.id,
            numeroLote: l.numeroLote,
            fabricanteId: l.fabricanteId,
            fabricanteNome: l.fabricanteNome,
            dataValidade: l.dataValidade,
            saldoAtual: l.saldoAtual,
            statusValidade: calcularStatusValidade(l.dataValidade, hoje),
          })),
        };
      }),
      total,
      pagina: filtros.pagina,
      itensPorPagina: filtros.itensPorPagina,
      totalPaginas: Math.ceil(total / filtros.itensPorPagina),
    };
  }
}
