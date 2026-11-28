import {
  FUSO_UBS,
  PERIODO_MAXIMO_RELATORIO_DIAS,
  PERIODO_PADRAO_RELATORIO_DIAS,
  calcularStatusValidade,
  type TipoRelatorioEstoque,
} from "@farmaubs/shared";
import {
  IntervaloDatasRelatorioInvalidoException,
  UbsNaoEncontradaRelatorioException,
} from "../../domain/errors/estoque-relatorios.errors";
import type { RepositorioEstoqueRelatoriosPort } from "../../domain/ports/estoque-relatorios.repository.port";
import type {
  GeradorPlanilhaEstoquePort,
  LinhaRelatorioEstoque,
  LinhaRelatorioSaldosAtuais,
} from "../../domain/ports/gerador-planilha-estoque.port";

export interface EntradaGerarRelatorioEstoqueXlsx {
  tipoRelatorio: TipoRelatorioEstoque;
  ubsId: string;
  dataInicio?: string;
  dataFim?: string;
  principioAtivo?: string;
  produtoId?: string;
  categoria?: string;
}

export interface SaidaGerarRelatorioEstoqueXlsx {
  buffer: Buffer;
  nomeArquivo: string;
  contentType: string;
}

const REGEX_DATA_YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

const FORMATADOR_YMD_UBS = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_UBS,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Devolve YYYY-MM-DD do instante informado no fuso da UBS (America/Fortaleza). */
function ymdNoFusoUbs(instante: Date): string {
  return FORMATADOR_YMD_UBS.format(instante);
}

/** True se a string YYYY-MM-DD representa uma data real (rejeita 2026-02-31). */
function dataYmdValida(valor: string): boolean {
  const m = REGEX_DATA_YMD.exec(valor);
  if (!m) return false;
  const [, y, mo, d] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  return (
    dt.getUTCFullYear() === Number(y) &&
    dt.getUTCMonth() === Number(mo) - 1 &&
    dt.getUTCDate() === Number(d)
  );
}

/**
 * [RF020 / RF028]: Caso de uso puro para geração e exportação de relatórios de estoque em formato XLSX.
 */
export class GerarRelatorioEstoqueXlsxUseCase {
  constructor(
    private readonly repositorio: RepositorioEstoqueRelatoriosPort,
    private readonly geradorPlanilha: GeradorPlanilhaEstoquePort,
  ) {}

  /**
   * [RF020 / RF028 / NF003]: Consulta os dados da UBS conforme o tipo de relatório e gera o buffer XLSX.
   * @param entrada - Tipo de relatório, `ubsId`, intervalo opcional de datas e filtros de medicamento.
   * @returns Buffer binário `.xlsx`, nome padronizado do arquivo e `contentType`.
   * @throws {UbsNaoEncontradaRelatorioException} Se a UBS não existir no município do tenant.
   * @throws {IntervaloDatasRelatorioInvalidoException} Se as datas forem inválidas, invertidas ou > 365 dias.
   */
  async execute(
    entrada: EntradaGerarRelatorioEstoqueXlsx,
  ): Promise<SaidaGerarRelatorioEstoqueXlsx> {
    const { tipoRelatorio, ubsId } = entrada;

    const cabecalhoUbs = await this.repositorio.obterCabecalhoUbs(ubsId);
    if (!cabecalhoUbs) {
      throw new UbsNaoEncontradaRelatorioException(ubsId);
    }

    const { dataInicio, dataFim } = this.validarEResolverPeriodo(
      tipoRelatorio,
      entrada.dataInicio,
      entrada.dataFim,
    );

    const linhasBrutas = await this.repositorio.consultarDadosParaRelatorio(
      tipoRelatorio,
      {
        ubsId,
        dataInicio,
        dataFim,
        principioAtivo: entrada.principioAtivo?.trim() || undefined,
        produtoId: entrada.produtoId,
        categoria: entrada.categoria?.trim() || undefined,
      },
    );

    const agora = new Date();
    const hojeIso = agora.toISOString();
    const dataEmissaoYmd = ymdNoFusoUbs(agora);

    const linhas: LinhaRelatorioEstoque[] =
      tipoRelatorio === "SALDOS_ATUAIS"
        ? (linhasBrutas as LinhaRelatorioSaldosAtuais[]).map((linha) => ({
            ...linha,
            status:
              typeof linha.validade === "string" &&
              REGEX_DATA_YMD.test(linha.validade)
                ? calcularStatusValidade(linha.validade, dataEmissaoYmd)
                : linha.status,
          }))
        : linhasBrutas;

    const buffer = await this.geradorPlanilha.gerar({
      tipoRelatorio,
      cabecalho: {
        nomeUbs: cabecalhoUbs.nomeUbs,
        cnes: cabecalhoUbs.cnes,
        municipio: cabecalhoUbs.municipio,
        dataEmissao: hojeIso,
      },
      periodo: dataInicio && dataFim ? { dataInicio, dataFim } : undefined,
      linhas,
    });

    const sufixoPeriodo =
      tipoRelatorio === "SALDOS_ATUAIS"
        ? dataEmissaoYmd
        : `${dataInicio ?? ""}_${dataFim ?? ""}`;
    const nomeArquivo = `relatorio_estoque_${tipoRelatorio}_${ubsId}_${sufixoPeriodo}.xlsx`;

    return {
      buffer,
      nomeArquivo,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  private validarEResolverPeriodo(
    tipo: TipoRelatorioEstoque,
    dataInicio?: string,
    dataFim?: string,
  ): { dataInicio?: string; dataFim?: string } {
    if (tipo === "SALDOS_ATUAIS") {
      return { dataInicio: undefined, dataFim: undefined };
    }

    const hoje = new Date();
    const inicioPadrao = new Date(
      hoje.getTime() - PERIODO_PADRAO_RELATORIO_DIAS * 24 * 60 * 60 * 1000,
    );

    const dtInicioStr = dataInicio || ymdNoFusoUbs(inicioPadrao);
    const dtFimStr = dataFim || ymdNoFusoUbs(hoje);

    if (!dataYmdValida(dtInicioStr) || !dataYmdValida(dtFimStr)) {
      throw new IntervaloDatasRelatorioInvalidoException(
        "Datas inválidas: use o formato YYYY-MM-DD com uma data existente.",
      );
    }

    const inicio = new Date(dtInicioStr);
    const fim = new Date(dtFimStr);

    if (fim < inicio) {
      throw new IntervaloDatasRelatorioInvalidoException(
        "A data de término não pode ser anterior à data de início.",
      );
    }

    const diferencaDias = Math.floor(
      (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diferencaDias > PERIODO_MAXIMO_RELATORIO_DIAS) {
      throw new IntervaloDatasRelatorioInvalidoException(
        `O intervalo selecionado não pode ser superior a ${PERIODO_MAXIMO_RELATORIO_DIAS} dias.`,
      );
    }

    return { dataInicio: dtInicioStr, dataFim: dtFimStr };
  }
}
