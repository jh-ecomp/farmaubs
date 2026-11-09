import { Logger } from "@nestjs/common";
import type {
  MovimentacaoLoteItemDto,
  RastreabilidadeLoteDto,
  TipoMovimentacaoEstoque,
} from "@farmaubs/shared";
import { LoteNaoEncontradoException } from "../../domain/errors/ajuste-estoque.errors";
import {
  type MovimentacaoLoteBruta,
  type RepositorioEstoqueRastreabilidadePort,
} from "../../domain/ports/estoque-rastreabilidade.repository.port";

const MAPA_TIPO: Record<string, TipoMovimentacaoEstoque> = {
  ENTRADA_RECEBIMENTO: "ENTRADA_RECEBIMENTO",
  ESTORNO_RECEBIMENTO: "ESTORNO_ENTRADA",
  SAIDA_DISPENSACAO: "SAIDA_DISPENSACAO",
  ENTRADA_ESTORNO_DISPENSACAO: "ESTORNO_DISPENSACAO",
};

/**
 * [RF028]: Traduz o tipo gravado no livro-razão para o tipo exposto no DTO.
 * @param m - Tipo do banco (`tipoBanco`) e sinal da operação (`operacao`); ajustes usam o sinal.
 * @returns Tipo de movimentação do contrato compartilhado.
 * @throws Error se `tipoBanco` não for mapeado nem começar com `AJUSTE`.
 */
export function traduzirTipo(m: Pick<MovimentacaoLoteBruta, "tipoBanco" | "operacao">): TipoMovimentacaoEstoque {
  const direto = MAPA_TIPO[m.tipoBanco];
  if (direto) return direto;
  if (m.tipoBanco.startsWith("AJUSTE")) {
    return m.operacao === "+" ? "AJUSTE_ENTRADA" : "AJUSTE_SAIDA";
  }
  throw new Error(`Tipo de movimentação desconhecido: ${m.tipoBanco}`);
}

/**
 * [RF028]: Verifica se o saldoAnterior de cada evento é igual ao saldoResultante do anterior.
 * @param movs - Movimentações em ordem cronológica.
 * @param saldoAtual - Saldo atual do lote, comparado ao saldo resultante do último evento.
 * @returns `true` se a cadeia for íntegra (ou vazia); `false` caso contrário.
 */
export function conciliarCadeia(movs: MovimentacaoLoteBruta[], saldoAtual: number): boolean {
  for (let i = 1; i < movs.length; i++) {
    if (movs[i].saldoAnterior !== movs[i - 1].saldoResultante) return false;
  }
  return movs.length === 0 || movs[movs.length - 1].saldoResultante === saldoAtual;
}

/**
 * [RF028]: Mantém a ordem do SQL e, em grupos de mesmo `dataHora`, reordena seguindo a cadeia de saldos.
 * @param movs - Movimentações já ordenadas por data e id pelo repositório.
 * @returns Nova lista; se a cadeia estiver quebrada, preserva a ordem original do grupo.
 */
export function ordenarPorCadeia(movs: MovimentacaoLoteBruta[]): MovimentacaoLoteBruta[] {
  const resultado: MovimentacaoLoteBruta[] = [];
  let i = 0;
  while (i < movs.length) {
    let j = i;
    while (j < movs.length && movs[j].dataHora === movs[i].dataHora) j++;
    const pendentes = movs.slice(i, j);
    let esperado: number | undefined = resultado.at(-1)?.saldoResultante;
    while (pendentes.length > 0) {
      let idx =
        esperado === undefined
          ? pendentes.findIndex(
              (p) => !pendentes.some((o) => o !== p && o.saldoResultante === p.saldoAnterior),
            )
          : pendentes.findIndex((p) => p.saldoAnterior === esperado);
      if (idx < 0) idx = 0; // cadeia quebrada: mantém a ordem do SQL
      const [proximo] = pendentes.splice(idx, 1);
      resultado.push(proximo);
      esperado = proximo.saldoResultante;
    }
    i = j;
  }
  return resultado;
}

export class ConsultarRastreabilidadeLoteUseCase {
  private readonly logger = new Logger(ConsultarRastreabilidadeLoteUseCase.name);

  constructor(private readonly repo: RepositorioEstoqueRastreabilidadePort) {}

  /**
   * [RF028 / NF009]: Monta a rastreabilidade do lote (metadados, medicamento e linha do tempo com saldos).
   * @param loteId - UUID do lote consultado.
   * @param unidadeIds - UUIDs das UBSs às quais o usuário tem acesso.
   * @returns DTO de rastreabilidade; cadeia de saldos inconsistente só gera `warn` no log.
   * @throws LoteNaoEncontradoException se o lote não existir ou estiver fora das UBSs.
   */
  async execute(loteId: string, unidadeIds: string[]): Promise<RastreabilidadeLoteDto> {
    const dados = await this.repo.buscarLinhaDoTempoLote(loteId, unidadeIds);
    if (!dados) throw new LoteNaoEncontradoException(loteId);

    const ordenadas = ordenarPorCadeia(dados.movimentacoes);

    if (!conciliarCadeia(ordenadas, dados.lote.saldoAtual)) {
      this.logger.warn(`Cadeia de saldos inconsistente no lote ${loteId}`);
    }

    const movimentacoes: MovimentacaoLoteItemDto[] = ordenadas.map(
      ({ tipoBanco, saldoAnterior: _ignorado, ...resto }) => ({
        ...resto,
        tipoMovimentacao: traduzirTipo({ tipoBanco, operacao: resto.operacao }),
      }),
    );

    return {
      lote: {
        ...dados.lote,
        saldoInicial: ordenadas[0]?.saldoResultante ?? dados.lote.saldoAtual,
      },
      medicamento: dados.medicamento,
      movimentacoes,
    };
  }
}
