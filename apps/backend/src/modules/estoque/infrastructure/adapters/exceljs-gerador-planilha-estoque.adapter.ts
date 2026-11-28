import { Injectable } from "@nestjs/common";
import { Workbook } from "exceljs";
import type { CellValue, Worksheet } from "exceljs";
import type {
  EntradaGeradorPlanilhaEstoque,
  FiltroTipoRelatorioEstoque,
  GeradorPlanilhaEstoquePort,
  LinhaRelatorioMovimentacoesPeriodo,
  LinhaRelatorioPerdasVencimento,
  LinhaRelatorioSaldosAtuais,
} from "../../domain/ports/gerador-planilha-estoque.port";

const FUSO_UBS = "America/Fortaleza";
const REGEX_FORMULA_INJECTION = /^[=+\-@\t\r]/;

const FORMATADOR_DATA_HORA_UBS = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO_UBS,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hour12: false,
});

/**
 * [RF020 / RF028 / NF003]: Adaptador de infraestrutura com ExcelJS para geração de planilhas de estoque (.xlsx).
 * Inclui formatação nacional (dd/mm/yyyy, #,##0) e blindagem contra Formula Injection (CWE-1236).
 */
@Injectable()
export class ExcelJsGeradorPlanilhaEstoqueAdapter
  implements GeradorPlanilhaEstoquePort
{
  private static readonly ROTULOS_STATUS_LOTE: Record<string, string> = {
    REGULAR: "Regular",
    CURTA_90D: "Validade curta (90 dias)",
    MES_CORRENTE: "Vence no mês",
    VENCIDO: "Vencido",
    ATIVO: "Ativo",
  };

  private static readonly ROTULOS_MOTIVOS_PERDA: Record<string, string> = {
    VENCIMENTO: "Vencimento",
    AVARIA_FISICA: "Avaria física",
    EXTRAVIO: "Extravio",
    RECOLHIMENTO_SANITARIO: "Recolhimento sanitário",
    OUTRO: "Outro",
  };

  private static readonly ORDEM_MOTIVOS_PERDA = [
    "VENCIMENTO",
    "AVARIA_FISICA",
    "EXTRAVIO",
    "RECOLHIMENTO_SANITARIO",
    "OUTRO",
  ] as const;

  private static readonly ROTULOS_TIPO_MOVIMENTACAO: Record<string, string> = {
    ENTRADA_RECEBIMENTO: "Entrada por Recebimento",
    ESTORNO_RECEBIMENTO: "Estorno de Recebimento",
    SAIDA_DISPENSACAO: "Dispensação",
    ENTRADA_ESTORNO_DISPENSACAO: "Estorno de Dispensação",
    ENTRADA: "Entrada por Recebimento",
    DISPENSACAO: "Dispensação",
    AJUSTE_ENTRADA: "Ajuste de Entrada",
    AJUSTE_SAIDA: "Ajuste de Saída",
    ESTORNO_DISPENSACAO: "Estorno de Dispensação",
    TRANSFERENCIA_ENTRADA: "Transferência (Entrada)",
    TRANSFERENCIA_SAIDA: "Transferência (Saída)",
  };

  /**
   * [RF020 / RF028 / NF003]: Gera uma planilha Excel (.xlsx) estruturada em memória conforme o tipo solicitado.
   * @param entrada - Dados do relatório contendo `tipoRelatorio`, `cabecalho` institucional, `periodo` e `linhas`.
   * @returns Buffer binário pronto para download HTTP.
   */
  async gerar(entrada: EntradaGeradorPlanilhaEstoque): Promise<Buffer> {
    const workbook = new Workbook();
    workbook.creator = "FarmaUBS";
    workbook.lastModifiedBy = "FarmaUBS";
    workbook.created = new Date();

    const nomeAba = this.obterNomeAba(entrada.tipoRelatorio);
    const worksheet = workbook.addWorksheet(nomeAba, {
      views: [{ showGridLines: true }],
    });

    const municipio = entrada.cabecalho.municipio;
    const linha1 = worksheet.addRow([
      `Município de ${municipio} - Secretaria Municipal de Saúde`,
    ]);
    linha1.font = { bold: true, size: 12, color: { argb: "FF0D5C75" } };

    const cnesInfo = entrada.cabecalho.cnes
      ? ` | CNES: ${entrada.cabecalho.cnes}`
      : "";
    const linha2 = worksheet.addRow([
      `Unidade Básica de Saúde: ${entrada.cabecalho.nomeUbs}${cnesInfo}`,
    ]);
    linha2.font = { bold: true, size: 10 };

    const dataEmissaoFormatada = this.formatarDataBr(
      entrada.cabecalho.dataEmissao,
    );
    let infoEmissao = `Data de Emissão: ${dataEmissaoFormatada}`;
    if (entrada.periodo?.dataInicio && entrada.periodo?.dataFim) {
      infoEmissao += ` | Período: ${this.formatarDataBr(entrada.periodo.dataInicio)} a ${this.formatarDataBr(entrada.periodo.dataFim)}`;
    }
    const linha3 = worksheet.addRow([infoEmissao]);
    linha3.font = { italic: true, size: 9 };

    worksheet.addRow([]);

    const cabecalhoLinhaIndex = worksheet.rowCount + 1;

    switch (entrada.tipoRelatorio) {
      case "SALDOS_ATUAIS":
        this.montarRelatorioSaldos(
          worksheet,
          entrada.linhas as LinhaRelatorioSaldosAtuais[],
        );
        break;
      case "PERDAS_VENCIMENTO":
        this.montarRelatorioPerdas(
          worksheet,
          entrada.linhas as LinhaRelatorioPerdasVencimento[],
        );
        break;
      case "MOVIMENTACOES_PERIODO":
        this.montarRelatorioMovimentacoes(
          worksheet,
          entrada.linhas as LinhaRelatorioMovimentacoesPeriodo[],
        );
        break;
      default:
        throw new Error(
          `Tipo de relatório não suportado: ${String(entrada.tipoRelatorio)}`,
        );
    }

    const headerRow = worksheet.getRow(cabecalhoLinhaIndex);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0D5C75" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    worksheet.views = [
      { state: "frozen", xSplit: 0, ySplit: cabecalhoLinhaIndex },
    ];

    worksheet.columns.forEach((column) => {
      let maxLen = 12;
      if (column.eachCell) {
        column.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
          if (rowNumber >= cabecalhoLinhaIndex) {
            const strLen = this.calcularLarguraTexto(cell.value);
            if (strLen > maxLen) {
              maxLen = strLen;
            }
          }
        });
      }
      column.width = Math.min(Math.max(maxLen + 3, 14), 45);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private obterNomeAba(tipo: FiltroTipoRelatorioEstoque): string {
    switch (tipo) {
      case "SALDOS_ATUAIS":
        return "Saldos Atuais";
      case "PERDAS_VENCIMENTO":
        return "Perdas (Vencimento e Avaria)";
      case "MOVIMENTACOES_PERIODO":
        return "Movimentações";
      default:
        return "Relatório";
    }
  }

  private montarRelatorioSaldos(
    worksheet: Worksheet,
    linhas: LinhaRelatorioSaldosAtuais[],
  ): void {
    worksheet.addRow([
      "Medicamento",
      "Princípio Ativo",
      "Fabricante",
      "Lote",
      "Validade",
      "Saldo",
      "Status",
    ]);

    for (const item of linhas) {
      const dataValidade = this.converterDataPuraUtc(item.validade);
      const saldoNumerico = Number(item.saldo ?? 0);
      const rotuloStatus = this.formatarStatusLote(item.status ?? "");

      const row = worksheet.addRow([
        this.sanitizarTextoPlanilha(item.medicamento),
        this.sanitizarTextoPlanilha(item.principioAtivo),
        this.sanitizarTextoPlanilha(item.fabricante),
        this.sanitizarTextoPlanilha(item.lote),
        dataValidade,
        saldoNumerico,
        this.sanitizarTextoPlanilha(rotuloStatus),
      ]);

      const cellValidade = row.getCell(5);
      cellValidade.numFmt = "dd/mm/yyyy";
      cellValidade.alignment = { horizontal: "center" };

      const cellSaldo = row.getCell(6);
      cellSaldo.numFmt = "#,##0";
      cellSaldo.alignment = { horizontal: "right" };
    }
  }

  private montarRelatorioPerdas(
    worksheet: Worksheet,
    linhas: LinhaRelatorioPerdasVencimento[],
  ): void {
    worksheet.addRow(["Data", "Medicamento", "Lote", "Quantidade", "Motivo"]);

    let totalQuantidadePerdida = 0;
    const subtotaisPorMotivo = new Map<string, number>();

    for (const item of linhas) {
      const dataPerda = this.converterDataPuraUtc(item.data);
      const qtdNumerica = Number(item.quantidade ?? 0);
      totalQuantidadePerdida += qtdNumerica;

      const motivoRaw = item.motivo ?? "";
      subtotaisPorMotivo.set(
        motivoRaw,
        (subtotaisPorMotivo.get(motivoRaw) ?? 0) + qtdNumerica,
      );

      const rotuloMotivo = this.formatarMotivo(motivoRaw);

      const row = worksheet.addRow([
        dataPerda,
        this.sanitizarTextoPlanilha(item.medicamento),
        this.sanitizarTextoPlanilha(item.lote),
        qtdNumerica,
        this.sanitizarTextoPlanilha(rotuloMotivo),
      ]);

      const cellData = row.getCell(1);
      cellData.numFmt = "dd/mm/yyyy";
      cellData.alignment = { horizontal: "center" };

      const cellQtd = row.getCell(4);
      cellQtd.numFmt = "#,##0";
      cellQtd.alignment = { horizontal: "right" };
    }

    const motivosOrdenados: string[] = [];
    for (const motivoPadrao of ExcelJsGeradorPlanilhaEstoqueAdapter.ORDEM_MOTIVOS_PERDA) {
      if (subtotaisPorMotivo.has(motivoPadrao)) {
        motivosOrdenados.push(motivoPadrao);
      }
    }
    for (const motivoPresente of subtotaisPorMotivo.keys()) {
      if (!motivosOrdenados.includes(motivoPresente)) {
        motivosOrdenados.push(motivoPresente);
      }
    }

    for (const motivo of motivosOrdenados) {
      const subtotalQtd = subtotaisPorMotivo.get(motivo) ?? 0;
      const rotulo = this.formatarMotivo(motivo);
      const linhaSubtotal = worksheet.addRow([
        this.sanitizarTextoPlanilha(`Subtotal - ${rotulo}`),
        "",
        "",
        subtotalQtd,
        "",
      ]);
      linhaSubtotal.font = { italic: true };
      const cellSubtotalQtd = linhaSubtotal.getCell(4);
      cellSubtotalQtd.numFmt = "#,##0";
      cellSubtotalQtd.alignment = { horizontal: "right" };
    }

    const linhaTotal = worksheet.addRow([
      "Total Geral",
      "",
      "",
      totalQuantidadePerdida,
      "",
    ]);
    linhaTotal.font = { bold: true };
    const cellTotalQtd = linhaTotal.getCell(4);
    cellTotalQtd.numFmt = "#,##0";
    cellTotalQtd.alignment = { horizontal: "right" };
  }

  private montarRelatorioMovimentacoes(
    worksheet: Worksheet,
    linhas: LinhaRelatorioMovimentacoesPeriodo[],
  ): void {
    worksheet.addRow([
      "Data/Hora",
      "Tipo",
      "Medicamento",
      "Lote",
      "Quantidade",
      "Saldo Resultante",
      "Responsável",
    ]);

    for (const item of linhas) {
      const dataHora = this.converterDataHoraBrasilia(item.dataHora);
      const qtdNumerica = Number(item.quantidade ?? 0);
      const saldoResultante = Number(item.saldoResultante ?? 0);
      const rotuloTipo = this.formatarTipoMovimentacao(item.tipo ?? "");

      const row = worksheet.addRow([
        dataHora,
        this.sanitizarTextoPlanilha(rotuloTipo),
        this.sanitizarTextoPlanilha(item.medicamento),
        this.sanitizarTextoPlanilha(item.lote),
        qtdNumerica,
        saldoResultante,
        this.sanitizarTextoPlanilha(item.responsavel),
      ]);

      const cellDataHora = row.getCell(1);
      cellDataHora.numFmt = "dd/mm/yyyy hh:mm";
      cellDataHora.alignment = { horizontal: "center" };

      const cellQtd = row.getCell(5);
      cellQtd.numFmt = "#,##0";
      cellQtd.alignment = { horizontal: "right" };

      const cellSaldoResult = row.getCell(6);
      cellSaldoResult.numFmt = "#,##0";
      cellSaldoResult.alignment = { horizontal: "right" };
    }
  }

  /**
   * [OWASP / CWE-1236]: Escapa células textuais iniciadas por =, +, -, @, TAB ou CR para impedir execução de fórmulas.
   */
  private sanitizarTextoPlanilha(valor: string | undefined | null): string {
    const texto = valor ?? "";
    return REGEX_FORMULA_INJECTION.test(texto) ? `'${texto}` : texto;
  }

  private formatarStatusLote(status: string): string {
    return (
      ExcelJsGeradorPlanilhaEstoqueAdapter.ROTULOS_STATUS_LOTE[status] ?? status
    );
  }

  private formatarMotivo(motivo: string): string {
    return (
      ExcelJsGeradorPlanilhaEstoqueAdapter.ROTULOS_MOTIVOS_PERDA[motivo] ??
      motivo
    );
  }

  private formatarTipoMovimentacao(tipo: string): string {
    return (
      ExcelJsGeradorPlanilhaEstoqueAdapter.ROTULOS_TIPO_MOVIMENTACAO[tipo] ??
      tipo
    );
  }

  private converterDataPuraUtc(
    valor: string | Date | undefined | null,
  ): Date | null {
    if (!valor) return null;
    if (typeof valor === "string") {
      const ymd = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (ymd) {
        const [, y, m, d] = ymd;
        return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0));
      }
      const dmy = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (dmy) {
        const [, d, m, y] = dmy;
        return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0));
      }
      return this.converterDataHoraBrasilia(valor);
    }
    if (valor instanceof Date) {
      return new Date(
        Date.UTC(
          valor.getUTCFullYear(),
          valor.getUTCMonth(),
          valor.getUTCDate(),
          0,
          0,
          0,
        ),
      );
    }
    return null;
  }

  private converterDataHoraBrasilia(
    valor: string | Date | undefined | null,
  ): Date | null {
    if (!valor) return null;
    const d = typeof valor === "string" ? new Date(valor) : valor;
    if (isNaN(d.getTime())) return null;

    const parts = FORMATADOR_DATA_HORA_UBS.formatToParts(d);
    let ano = 0;
    let mes = 0;
    let dia = 0;
    let hora = 0;
    let minuto = 0;
    let segundo = 0;

    for (const part of parts) {
      switch (part.type) {
        case "year":
          ano = Number(part.value);
          break;
        case "month":
          mes = Number(part.value);
          break;
        case "day":
          dia = Number(part.value);
          break;
        case "hour":
          hora = part.value === "24" ? 0 : Number(part.value);
          break;
        case "minute":
          minuto = Number(part.value);
          break;
        case "second":
          segundo = Number(part.value);
          break;
      }
    }

    return new Date(Date.UTC(ano, mes - 1, dia, hora, minuto, segundo));
  }

  private formatarDataBr(valor: string | Date | undefined | null): string {
    if (!valor) return "";
    if (typeof valor === "string") {
      const ymd = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (ymd) {
        const [, y, m, d] = ymd;
        return `${d}/${m}/${y}`;
      }
    }
    const d = typeof valor === "string" ? new Date(valor) : valor;
    if (isNaN(d.getTime())) return String(valor);

    const parts = FORMATADOR_DATA_HORA_UBS.formatToParts(d);
    let dia = "";
    let mes = "";
    let ano = "";

    for (const part of parts) {
      if (part.type === "day") {
        dia = part.value.padStart(2, "0");
      } else if (part.type === "month") {
        mes = part.value.padStart(2, "0");
      } else if (part.type === "year") {
        ano = part.value;
      }
    }

    return `${dia}/${mes}/${ano}`;
  }

  private calcularLarguraTexto(val: CellValue): number {
    if (val === null || val === undefined) {
      return 0;
    }
    if (typeof val === "string") {
      return val.length;
    }
    if (typeof val === "number" || typeof val === "boolean") {
      return String(val).length;
    }
    if (val instanceof Date) {
      return 16;
    }
    if (typeof val === "object") {
      if ("text" in val && typeof val.text === "string") {
        return val.text.length;
      }
      if ("richText" in val && Array.isArray(val.richText)) {
        return val.richText.reduce(
          (acc, item) =>
            acc + (typeof item.text === "string" ? item.text.length : 0),
          0,
        );
      }
      if ("result" in val && val.result !== undefined && val.result !== null) {
        return String(val.result).length;
      }
    }
    return String(val).length;
  }
}
