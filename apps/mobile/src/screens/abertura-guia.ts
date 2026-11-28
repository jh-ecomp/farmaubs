import {
  FORNECEDORES_INSTITUCIONAIS_PADRAO,
  TipoDocumentoEntradaEnum,
  type CabecalhoRecebimentoDto,
  type TipoDocumentoRecebimento,
} from "@farmaubs/shared";

export const MENSAGEM_DOCUMENTO_CURTO = "Informe o número do documento fiscal ou guia da CAF";
export const MENSAGEM_DOCUMENTO_LONGO = "O número do documento não pode exceder 100 caracteres.";
export const MENSAGEM_OBSERVACAO_LONGA = "A observação não pode exceder 1000 caracteres.";

/** [RE-MOB-01]: Os quatro tipos da história, com os valores que o POST da API aceita. */
export const TIPOS_GUIA: { valor: TipoDocumentoRecebimento; rotulo: string }[] = [
  { valor: TipoDocumentoEntradaEnum.GUIA_CAF, rotulo: "Guia CAF" },
  { valor: TipoDocumentoEntradaEnum.NOTA_FISCAL, rotulo: "Nota Fiscal" },
  { valor: TipoDocumentoEntradaEnum.REMESSA_DLOG, rotulo: "Remessa DLOG" },
  { valor: TipoDocumentoEntradaEnum.DOACAO, rotulo: "Doação" },
];

export function fornecedorPadrao(): string {
  return FORNECEDORES_INSTITUCIONAIS_PADRAO.find((item) => item.padrao)?.nome ?? "CAF Central - SMS Parnaíba";
}

export function rotuloTipoGuia(tipo: string): string {
  return TIPOS_GUIA.find((item) => item.valor === tipo)?.rotulo ?? tipo;
}

export function erroNumeroDocumento(numero: string): string | null {
  const texto = numero.trim();
  if (texto.length < 2) return MENSAGEM_DOCUMENTO_CURTO;
  if (texto.length > 100) return MENSAGEM_DOCUMENTO_LONGO;
  return null;
}

export function erroObservacao(texto: string): string | null {
  if (texto.trim().length > 1000) return MENSAGEM_OBSERVACAO_LONGA;
  return null;
}

/**
 * [RE-MOB-01]: O avanço exige documento, um tipo da lista e fornecedor com nome.
 */
export function podeProsseguirGuia(numero: string, tipo: string, fornecedor: string, quando: Date, observacoes: string): boolean {
  return (
    erroNumeroDocumento(numero) === null &&
    TIPOS_GUIA.some((item) => item.valor === tipo) &&
    fornecedor.trim().length >= 3 &&
    !Number.isNaN(quando.getTime()) &&
    erroObservacao(observacoes) === null
  );
}

export function montarCabecalho(
  numero: string,
  tipo: TipoDocumentoRecebimento,
  fornecedor: string,
  quando: Date,
  observacoes: string,
): CabecalhoRecebimentoDto {
  const texto = observacoes.trim();
  return {
    numeroDocumento: numero.trim(),
    tipoDocumento: tipo,
    fornecedorOrigem: fornecedor.trim(),
    dataRecebimento: quando.toISOString(),
    observacoes: texto ? texto : undefined,
  };
}

/** Troca o dia e conserva a hora que já estava na guia. */
export function aplicarDia(atual: Date, escolhida: Date): Date {
  const proxima = new Date(atual);
  proxima.setFullYear(escolhida.getFullYear(), escolhida.getMonth(), escolhida.getDate());
  return proxima;
}

/** Troca a hora e conserva o dia que já estava na guia. */
export function aplicarHora(atual: Date, escolhida: Date): Date {
  const proxima = new Date(atual);
  proxima.setHours(escolhida.getHours(), escolhida.getMinutes(), 0, 0);
  return proxima;
}
