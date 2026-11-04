import type {
  FiltroStatusEstoque,
  FiltroValidadeSaldos,
} from "@farmaubs/shared";

/** Token de injeção da porta de saldos de estoque. */
export const REPOSITORIO_ESTOQUE_SALDOS_PORT = Symbol(
  "REPOSITORIO_ESTOQUE_SALDOS_PORT",
);

/** Filtros normalizados da consulta de saldos. */
export interface FiltrosConsultaSaldos {
  termo?: string;
  categoria?: string;
  filtroValidade: FiltroValidadeSaldos;
  statusEstoque: FiltroStatusEstoque;
  pagina: number;
  itensPorPagina: number;
}

/** Lote ativo com saldo, como lido do banco. */
export interface LoteSaldoAgregado {
  id: string;
  numeroLote: string;
  fabricanteId: string;
  fabricanteNome: string;
  /** AAAA-MM-DD */
  dataValidade: string;
  saldoAtual: number;
}

/** Medicamento com saldo consolidado e consumo da janela de apuração. */
export interface ProdutoSaldoAgregado {
  produtoId: string;
  nome: string;
  principioAtivo: string;
  formaFarmaceutica: string;
  concentracao: string;
  unidadeMedida: string;
  categoria: string;
  saldoTotal: number;
  totalDispensado: number;
  diasApurados: number;
  lotes: LoteSaldoAgregado[];
}

export interface ResultadoSaldosPaginados {
  itens: ProdutoSaldoAgregado[];
  /** Total de medicamentos que atendem aos filtros (antes da paginação). */
  total: number;
}

/** Porta de leitura dos saldos de estoque por UBS (RF005 / RF022). */
export interface RepositorioEstoqueSaldosPort {
  consultarSaldosPaginados(
    ubsId: string,
    filtros: FiltrosConsultaSaldos,
    hoje: string,
  ): Promise<ResultadoSaldosPaginados>;
}
