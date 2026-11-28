import type {
  DispensacaoEfetivadaResultado,
  EfetivarDispensacaoRequest,
  ItemDispensadoResultadoDto,
  PacienteDispensacaoRequest,
} from "@farmaubs/shared";
import type { ItemCarrinho } from "./carrinho";

function temAntimicrobiano(itens: ItemCarrinho[]): boolean {
  return itens.some((item) => item.medicamento.antimicrobiano || item.medicamento.requerDataReceita === true);
}

/**
 * [DI-MOB-04]: O backend recusa saldo com 400 e esta frase. A história citava 409.
 * @param status - Código HTTP da resposta.
 * @param mensagem - Texto devolvido pela API.
 * @returns True quando o lote mudou e o atendimento deve permanecer aberto.
 */
export function ehFalhaSaldo(status: number, mensagem: string): boolean {
  if (status === 409) return true;
  return status === 400 && mensagem.toLowerCase().includes("saldo insuficiente");
}

/** [DI-MOB-04]: Mostra o protocolo como a API gravou, com # na frente. */
export function protocoloAtendimento(numero: string): string {
  const limpo = numero.trim();
  return limpo.startsWith("#") ? limpo : `#${limpo}`;
}

/** Data e hora locais do comprovante. */
export function formatarDataHoraAtendimento(valor: string | Date): string {
  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) return String(valor);
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const hora = String(data.getHours()).padStart(2, "0");
  const minuto = String(data.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${data.getFullYear()} ${hora}:${minuto}`;
}

/**
 * [DI-MOB-04]: Monta o POST /dispensacoes com o contrato real do shared.
 * A data da receita só sai quando há antimicrobiano.
 */
export function montarPedido(
  paciente: PacienteDispensacaoRequest,
  itens: ItemCarrinho[],
  dataReceita: string,
  ubsId: string | null,
): EfetivarDispensacaoRequest {
  return {
    ubsId: ubsId ?? undefined,
    paciente,
    receitaEmissaoEm: temAntimicrobiano(itens) ? dataReceita : undefined,
    itens: itens.map((item) => ({
      medicamentoId: item.medicamento.id,
      loteId: item.lote.id,
      quantidadeDispensada: item.quantidade,
      posologia: item.posologia.trim() || undefined,
    })),
  };
}

function lerItem(item: unknown): ItemDispensadoResultadoDto | null {
  if (!item || typeof item !== "object") return null;
  const linha = item as Partial<ItemDispensadoResultadoDto>;
  if (typeof linha.itemId !== "string" || typeof linha.loteId !== "string") return null;
  if (typeof linha.medicamentoNome !== "string" || typeof linha.numeroLote !== "string") return null;
  if (typeof linha.quantidadeDispensada !== "number") return null;
  return {
    itemId: linha.itemId,
    medicamentoId: typeof linha.medicamentoId === "string" ? linha.medicamentoId : "",
    medicamentoNome: linha.medicamentoNome,
    loteId: linha.loteId,
    numeroLote: linha.numeroLote,
    quantidadeDispensada: linha.quantidadeDispensada,
    saldoRestanteLote: typeof linha.saldoRestanteLote === "number" ? linha.saldoRestanteLote : 0,
  };
}

/**
 * [DI-MOB-04]: Lê o 201 de POST /dispensacoes. O DTO real é DispensacaoEfetivadaResultado.
 * @param data - Corpo já interpretado.
 * @returns Comprovante utilizável, ou null se faltar protocolo ou paciente.
 */
export function lerResultado(data: unknown): DispensacaoEfetivadaResultado | null {
  if (!data || typeof data !== "object") return null;
  const corpo = data as Partial<DispensacaoEfetivadaResultado>;
  if (typeof corpo.id !== "string" || typeof corpo.numeroAtendimento !== "string") return null;
  if (!corpo.paciente || typeof corpo.paciente !== "object") return null;
  if (typeof corpo.paciente.nomeCompleto !== "string") return null;
  if (!Array.isArray(corpo.itens)) return null;
  const itens = corpo.itens.flatMap((item) => {
    const linha = lerItem(item);
    return linha ? [linha] : [];
  });
  if (itens.length !== corpo.itens.length) return null;
  const quando = corpo.dataAtendimento;
  const dataAtendimento = quando instanceof Date || typeof quando === "string" ? quando : "";
  return {
    id: corpo.id,
    numeroAtendimento: corpo.numeroAtendimento,
    dataAtendimento,
    status: corpo.status === "estornada" ? "estornada" : "concluida",
    paciente: {
      id: typeof corpo.paciente.id === "string" ? corpo.paciente.id : "",
      nomeCompleto: corpo.paciente.nomeCompleto,
      cpf: typeof corpo.paciente.cpf === "string" ? corpo.paciente.cpf : "",
      cns: typeof corpo.paciente.cns === "string" ? corpo.paciente.cns : "",
    },
    dispensador: {
      id: corpo.dispensador && typeof corpo.dispensador.id === "string" ? corpo.dispensador.id : "",
      nomeCompleto:
        corpo.dispensador && typeof corpo.dispensador.nomeCompleto === "string"
          ? corpo.dispensador.nomeCompleto
          : "",
    },
    itens,
  };
}

export function posologiaDoLote(itens: ItemCarrinho[], loteId: string): string {
  return itens.find((item) => item.lote.id === loteId)?.posologia.trim() ?? "";
}

/**
 * [DI-MOB-04]: Texto plano enviado ao Share.share.
 */
export function textoComprovante(entrada: {
  numeroAtendimento: string;
  dataHora: string;
  ubsNome: string;
  farmaceutico: string;
  pacienteNome: string;
  linhas: { nome: string; lote: string; quantidade: number; posologia: string }[];
}): string {
  const itens = entrada.linhas
    .map((linha) => {
      const uso = linha.posologia ? ` | ${linha.posologia}` : "";
      return `- ${linha.nome} | Lote ${linha.lote} | ${linha.quantidade} un.${uso}`;
    })
    .join("\n");
  return [
    "Comprovante de dispensação — FarmaUBS",
    `Atendimento ${protocoloAtendimento(entrada.numeroAtendimento)}`,
    `Data: ${entrada.dataHora}`,
    `UBS: ${entrada.ubsNome}`,
    `Farmacêutico: ${entrada.farmaceutico}`,
    `Paciente: ${entrada.pacienteNome}`,
    itens,
  ].join("\n");
}
