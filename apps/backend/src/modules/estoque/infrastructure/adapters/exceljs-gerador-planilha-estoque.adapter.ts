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
 * Adaptador de infraestrutura com ExcelJS para geração de planilhas de estoque em formato .xlsx.
 * Atende ao RF028 (exportação de dados de estoque e extratos de auditoria) e ao NF003 (padrão nacional de datas dd/MM/yyyy e numFmt brasileiro).
 */
@Injectable()
export class ExcelJsGeradorPlanilhaEstoqueAdapter implements GeradorPlanilhaEstoquePort {
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
   * Gera uma planilha Excel (.xlsx) estruturada em memória de acordo com o tipo de relatório solicitado.
   * Conforma com RF028 e NF003.
   *
   * @param entrada Dados do relatório contendo tipoRelatorio, cabecalho institucional, periodo e linhas de dados.
   * @returns Buffer binário pronto para download ou streaming HTTP.
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

    // 1. Cabeçalho institucional nas primeiras linhas (sem fallback de município)
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

    worksheet.addRow([]); // Linha 4 em branco para separação visual

    // 2. Colunas e linhas de dados específicas do relatório
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
          `Tipo de relatório não suportado: ${entrada.tipoRelatorio}`,
        );
    }

    // 3. Estilização do cabeçalho da tabela (negrito com fundo colorido)
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

    // 4. Congelar primeira linha da tabela
    worksheet.views = [
      { state: "frozen", xSplit: 0, ySplit: cabecalhoLinhaIndex },
    ];

    // 5. Ajustar largura das colunas considerando apenas as linhas da tabela (a partir do cabeçalho)
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

  /**
   * [RF028]: Obtém o nome da aba da planilha com no máximo 31 caracteres (limite do Excel).
   * @param tipo - Filtro/tipo do relatório.
   */
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

  /**
   * [RF028]: Monta a tabela de saldos atuais de todos os lotes com saldo positivo.
   * @param worksheet - Aba onde a tabela é escrita.
   * @param linhas - Linhas com medicamento, princípio ativo, lote, validade, saldo e status.
   */
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

      const row = worksheet.addRow([
        item.medicamento ?? "",
        item.principioAtivo ?? "",
        item.fabricante ?? "",
        item.lote ?? "",
        dataValidade,
        saldoNumerico,
        item.status ?? "",
      ]);

      // Validade: dd/MM/yyyy
      const cellValidade = row.getCell(5);
      cellValidade.numFmt = "dd/mm/yyyy";
      cellValidade.alignment = { horizontal: "center" };

      // Saldo: número padrão brasileiro
      const cellSaldo = row.getCell(6);
      cellSaldo.numFmt = "#,##0";
      cellSaldo.alignment = { horizontal: "right" };
    }
  }

  /**
   * [RF020]: Monta a tabela de perdas com subtotais por motivo e, por último, o total geral.
   * @param worksheet - Aba onde a tabela é escrita (cabeçalho da tabela inclusive).
   * @param linhas - Perdas do período, já filtradas por motivo na consulta.
   */
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
        item.medicamento ?? "",
        item.lote ?? "",
        qtdNumerica,
        rotuloMotivo,
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
        `Subtotal - ${rotulo}`,
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

  /**
   * [RF028]: Monta o extrato cronológico de movimentações no período.
   * @param worksheet - Aba onde a tabela é escrita.
   * @param linhas - Movimentações ordenadas cronologicamente com tipo legível e responsável.
   */
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
        rotuloTipo,
        item.medicamento ?? "",
        item.lote ?? "",
        qtdNumerica,
        saldoResultante,
        item.responsavel ?? "",
      ]);

      // Data/Hora em Brasília: dd/mm/yyyy hh:mm
      const cellDataHora = row.getCell(1);
      cellDataHora.numFmt = "dd/mm/yyyy hh:mm";
      cellDataHora.alignment = { horizontal: "center" };

      // Quantidade: numFmt '#,##0'
      const cellQtd = row.getCell(5);
      cellQtd.numFmt = "#,##0";
      cellQtd.alignment = { horizontal: "right" };

      // Saldo Resultante: numFmt '#,##0'
      const cellSaldoResult = row.getCell(6);
      cellSaldoResult.numFmt = "#,##0";
      cellSaldoResult.alignment = { horizontal: "right" };
    }
  }

  /**
   * Converte o código de motivo de perda em um rótulo legível em português.
   */
  private formatarMotivo(motivo: string): string {
    return (
      ExcelJsGeradorPlanilhaEstoqueAdapter.ROTULOS_MOTIVOS_PERDA[motivo] ??
      motivo
    );
  }

  /**
   * Converte o código do tipo de movimentação em um rótulo legível em português.
   */
  private formatarTipoMovimentacao(tipo: string): string {
    return (
      ExcelJsGeradorPlanilhaEstoqueAdapter.ROTULOS_TIPO_MOVIMENTACAO[tipo] ??
      tipo
    );
  }

  /**
   * Converte uma data pura YYYY-MM-DD em Date UTC sem conversão de fuso horário.
   */
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
      // Se for ISO com horário, repassa para conversão de Brasília
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

  /**
   * Converte um instante UTC para o horário local da UBS (America/Fortaleza, UTC-3).
   * Gravado como Date em UTC correspondente ao horário civil de Brasília para exibição no Excel.
   */
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

  /**
   * Formata datas para o padrão brasileiro dd/MM/yyyy.
   * Datas com instante ISO completo são convertidas para o fuso da UBS (America/Fortaleza).
   * Datas puras YYYY-MM-DD não sofrem conversão de fuso.
   */
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

  /**
   * Calcula a largura estimada em caracteres para formatação de colunas do Excel.
   */
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
