/** Tipo de operação de um ajuste manual de lote (RF009 / RF011). */
export const TIPOS_OPERACAO_AJUSTE = ["ENTRADA", "SAIDA"] as const;
export type TipoOperacaoAjuste = (typeof TIPOS_OPERACAO_AJUSTE)[number];

/** Motivos aceitos em ajustes de entrada (RF009). */
export const MOTIVOS_AJUSTE_ENTRADA = [
  "CORRECAO_INVENTARIO",
  "DEVOLUCAO_PACIENTE",
  "OUTRO",
] as const;

/** Motivos aceitos em ajustes de saída (RF011). */
export const MOTIVOS_AJUSTE_SAIDA = [
  "VENCIMENTO",
  "AVARIA_FISICA",
  "EXTRAVIO",
  "RECOLHIMENTO_SANITARIO",
  "OUTRO",
] as const;

/** União de todos os motivos de ajuste. */
export const MOTIVOS_AJUSTE = [
  "CORRECAO_INVENTARIO",
  "DEVOLUCAO_PACIENTE",
  "VENCIMENTO",
  "AVARIA_FISICA",
  "EXTRAVIO",
  "RECOLHIMENTO_SANITARIO",
  "OUTRO",
] as const;
export type MotivoAjuste = (typeof MOTIVOS_AJUSTE)[number];

/** Tipo de movimentação gravado na auditoria, por tipo de operação. */
export const TIPO_MOVIMENTACAO_AJUSTE = {
  ENTRADA: "AJUSTE_ENTRADA",
  SAIDA: "AJUSTE_SAIDA",
} as const satisfies Record<TipoOperacaoAjuste, string>;

export interface RegistrarAjusteLoteInputDto {
  tipoOperacao: TipoOperacaoAjuste;
  quantidade: number;
  motivo: MotivoAjuste;
  justificativa: string;
}

export interface AjusteEstoqueResultadoDto {
  movimentacaoId: string;
  loteId: string;
  tipoOperacao: TipoOperacaoAjuste;
  quantidadeAjustada: number;
  saldoAnterior: number;
  saldoAtualizado: number;
  motivo: MotivoAjuste;
  justificativa: string;
  realizadoPor: { id: string; nome: string };
  dataHora: string; // ISO 8601
}
