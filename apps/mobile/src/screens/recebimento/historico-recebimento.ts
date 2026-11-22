import type {
  DetalhesRecebimentoCompleto,
  FiltroHistoricoRecebimento,
  HistoricoRecebimentoPaginado,
  ItemDetalheRecebimento,
  ItemResumoHistoricoRecebimento,
  PeriodoPredefinido,
} from "@farmaubs/shared";
import { formatarDataIsoParaBr } from "@farmaubs/shared";

export function formatarDataRecebimento(valor: string | Date): string {
  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) return String(valor);
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const hora = String(data.getHours()).padStart(2, "0");
  const minuto = String(data.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${data.getFullYear()} ${hora}:${minuto}`;
}

export const LIMITE_HISTORICO_RECEBIMENTO = 20;
export const DEBOUNCE_HISTORICO_RECEBIMENTO_MS = 300;
export const PERIODO_INICIAL_RECEBIMENTO: PeriodoPredefinido = "HOJE";

export const CHIPS_RECEBIMENTO: { id: PeriodoPredefinido; rotulo: string }[] = [
  { id: "HOJE", rotulo: "Hoje" },
  { id: "ULTIMOS_7_DIAS", rotulo: "Últimos 7 dias" },
  { id: "ULTIMOS_30_DIAS", rotulo: "Últimos 30 dias" },
];

/**
 * [RE-MOB-04]: A história escreveu SETE_DIAS. A API aceita ULTIMOS_7_DIAS e ULTIMOS_30_DIAS.
 * shortcut: sem ubsId a lista cobre as UBS do login, quando o backend aceitar UUID v7
 */
export function consultaHistorico(
  periodo: PeriodoPredefinido,
  termo: string,
  pagina: number,
): FiltroHistoricoRecebimento {
  const texto = termo.trim();
  return {
    periodo,
    pagina,
    limite: LIMITE_HISTORICO_RECEBIMENTO,
    ...(texto ? { termoBusca: texto } : {}),
  };
}

export function estaEstornado(status: string): boolean {
  return status === "ESTORNADO";
}

export function textoProtocolo(detalhe: DetalhesRecebimentoCompleto): string {
  const linhas = detalhe.itens.map((item) => {
    const cancelado = estaEstornado(detalhe.status) ? " · Cancelado" : "";
    return `${item.produtoNome} ${item.concentracao} · ${item.fabricanteNome} · Lote ${item.numeroLote} · ${formatarDataIsoParaBr(item.dataValidade)} · ${item.quantidadeRecebida} un.${cancelado}`;
  });
  return [
    `Guia ${detalhe.numeroDocumento}`,
    detalhe.fornecedorOrigem,
    formatarDataRecebimento(detalhe.dataRecebimento),
    estaEstornado(detalhe.status) ? "ESTORNADO" : "Concluído",
    `${detalhe.totalItens} itens · ${detalhe.totalUnidades} unidades`,
    ...linhas,
  ].join("\n");
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor : null;
}

function numero(valor: unknown): number {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

function lerResumo(item: unknown): ItemResumoHistoricoRecebimento | null {
  if (!item || typeof item !== "object") return null;
  const linha = item as Partial<ItemResumoHistoricoRecebimento>;
  const id = texto(linha.id);
  const numeroDocumento = texto(linha.numeroDocumento);
  const fornecedorOrigem = texto(linha.fornecedorOrigem);
  if (!id || !numeroDocumento || !fornecedorOrigem) return null;
  if (linha.status !== "CONCLUIDO" && linha.status !== "ESTORNADO") return null;
  const quando = linha.dataRecebimento;
  return {
    id,
    numeroDocumento,
    tipoDocumento: texto(linha.tipoDocumento) ?? "",
    fornecedorOrigem,
    dataRecebimento: quando instanceof Date || typeof quando === "string" ? quando : "",
    usuarioRecebedorNome: texto(linha.usuarioRecebedorNome) ?? "",
    totalItens: numero(linha.totalItens),
    totalUnidades: numero(linha.totalUnidades),
    status: linha.status,
    podeEstornar: linha.podeEstornar === true,
  };
}

export function lerHistorico(data: unknown): HistoricoRecebimentoPaginado | null {
  if (!data || typeof data !== "object" || !("itens" in data)) return null;
  const corpo = data as Partial<HistoricoRecebimentoPaginado>;
  if (!Array.isArray(corpo.itens)) return null;
  return {
    itens: corpo.itens.flatMap((item) => {
      const linha = lerResumo(item);
      return linha ? [linha] : [];
    }),
    total: numero(corpo.total),
    pagina: numero(corpo.pagina) || 1,
    totalPaginas: numero(corpo.totalPaginas) || 1,
  };
}

function lerItemDetalhe(item: unknown): ItemDetalheRecebimento | null {
  if (!item || typeof item !== "object") return null;
  const linha = item as Partial<ItemDetalheRecebimento>;
  const id = texto(linha.id);
  const produtoNome = texto(linha.produtoNome);
  const numeroLote = texto(linha.numeroLote);
  if (!id || !produtoNome || !numeroLote) return null;
  return {
    id,
    produtoId: texto(linha.produtoId) ?? "",
    produtoNome,
    formaFarmaceutica: texto(linha.formaFarmaceutica) ?? "",
    concentracao: texto(linha.concentracao) ?? "",
    fabricanteId: texto(linha.fabricanteId) ?? "",
    fabricanteNome: texto(linha.fabricanteNome) ?? "",
    loteId: texto(linha.loteId) ?? "",
    numeroLote,
    dataValidade: texto(linha.dataValidade) ?? "",
    quantidadeRecebida: numero(linha.quantidadeRecebida),
    saldoAtualLote: numero(linha.saldoAtualLote),
  };
}

export function lerDetalhe(data: unknown): DetalhesRecebimentoCompleto | null {
  if (!data || typeof data !== "object") return null;
  const corpo = data as Partial<DetalhesRecebimentoCompleto>;
  const id = texto(corpo.id);
  const numeroDocumento = texto(corpo.numeroDocumento);
  if (!id || !numeroDocumento || !Array.isArray(corpo.itens)) return null;
  if (corpo.status !== "CONCLUIDO" && corpo.status !== "ESTORNADO") return null;
  const quando = corpo.dataRecebimento;
  return {
    id,
    ubsId: texto(corpo.ubsId) ?? "",
    numeroDocumento,
    tipoDocumento: texto(corpo.tipoDocumento) ?? "",
    fornecedorOrigem: texto(corpo.fornecedorOrigem) ?? "",
    dataRecebimento: quando instanceof Date || typeof quando === "string" ? quando : "",
    usuarioRecebedorId: texto(corpo.usuarioRecebedorId) ?? "",
    usuarioRecebedorNome: texto(corpo.usuarioRecebedorNome) ?? "",
    status: corpo.status,
    motivoEstorno: texto(corpo.motivoEstorno),
    observacoes: texto(corpo.observacoes),
    itens: corpo.itens.flatMap((item) => {
      const linha = lerItemDetalhe(item);
      return linha ? [linha] : [];
    }),
    totalItens: numero(corpo.totalItens),
    totalUnidades: numero(corpo.totalUnidades),
    podeEstornar: corpo.podeEstornar === true,
  };
}
