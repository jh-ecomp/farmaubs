import { Workbook } from "exceljs";
import { ExcelJsGeradorPlanilhaEstoqueAdapter } from "./exceljs-gerador-planilha-estoque.adapter";
import type {
  EntradaGeradorPlanilhaEstoque,
  LinhaRelatorioMovimentacoesPeriodo,
  LinhaRelatorioPerdasVencimento,
  LinhaRelatorioSaldosAtuais,
} from "../../domain/ports/gerador-planilha-estoque.port";

describe("ExcelJsGeradorPlanilhaEstoqueAdapter", () => {
  let adapter: ExcelJsGeradorPlanilhaEstoqueAdapter;

  beforeEach(() => {
    adapter = new ExcelJsGeradorPlanilhaEstoqueAdapter();
  });

  const cabecalhoPadrao = {
    nomeUbs: "UBS São Judas Tadeu",
    cnes: "1234567",
    municipio: "Parnaíba",
    dataEmissao: "2026-11-19T13:40:00.000Z",
  };

  it("deve gerar relatório de SALDOS_ATUAIS com cabeçalho institucional, colunas corretas e tipos formatados", async () => {
    const linhas: LinhaRelatorioSaldosAtuais[] = [
      {
        medicamento: "Amoxicilina 500mg",
        principioAtivo: "Amoxicilina",
        fabricante: "EMS",
        lote: "LOTE123",
        validade: "2027-05-15",
        saldo: 350,
        status: "Normal",
      },
      {
        medicamento: "Dipirona 500mg/mL",
        principioAtivo: "Dipirona Monoidratada",
        fabricante: "Medley",
        lote: "LOTE456",
        validade: "2026-12-01",
        saldo: 120,
        status: "Atenção",
      },
    ];

    const entrada: EntradaGeradorPlanilhaEstoque<LinhaRelatorioSaldosAtuais> = {
      tipoRelatorio: "SALDOS_ATUAIS",
      cabecalho: cabecalhoPadrao,
      linhas,
    };

    const buffer = await adapter.gerar(entrada);
    expect(Buffer.isBuffer(buffer)).toBe(true);

    const wb = new Workbook();
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet("Saldos Atuais");
    expect(ws).toBeDefined();

    // 1. Cabeçalho institucional nas primeiras linhas (usando município obrigatório sem fallback)
    const r1 = ws!.getRow(1).getCell(1).text;
    const r2 = ws!.getRow(2).getCell(1).text;
    const r3 = ws!.getRow(3).getCell(1).text;

    expect(r1).toContain("Parnaíba");
    expect(r2).toContain("UBS São Judas Tadeu");
    expect(r2).toContain("1234567");
    expect(r3).toContain("19/11/2026");

    // 2. Colunas da tabela
    const headerRow = ws!.getRow(5);
    const colunasEsperadas = [
      "Medicamento",
      "Princípio Ativo",
      "Fabricante",
      "Lote",
      "Validade",
      "Saldo",
      "Status",
    ];
    colunasEsperadas.forEach((nomeCol, idx) => {
      expect(headerRow.getCell(idx + 1).text).toBe(nomeCol);
    });

    // 3. Valor de uma data pura (YYYY-MM-DD lida com getUTC*) e formato numérico
    const primeiraLinha = ws!.getRow(6);
    expect(primeiraLinha.getCell(1).value).toBe("Amoxicilina 500mg");
    expect(primeiraLinha.getCell(4).value).toBe("LOTE123");

    const cellValidade = primeiraLinha.getCell(5);
    expect(cellValidade.value).toBeInstanceOf(Date);
    const dataValidade = cellValidade.value as Date;
    expect(dataValidade.getUTCFullYear()).toBe(2027);
    expect(dataValidade.getUTCMonth()).toBe(4); // Maio = mês 4 (0-indexado)
    expect(dataValidade.getUTCDate()).toBe(15);
    expect(cellValidade.numFmt).toBe("dd/mm/yyyy");

    // Saldo: número com numFmt
    const cellSaldo = primeiraLinha.getCell(6);
    expect(cellSaldo.value).toBe(350);
    expect(typeof cellSaldo.value).toBe("number");
    expect(cellSaldo.numFmt).toBe("#,##0");

    // 4. Congelamento da primeira linha da tabela
    expect(ws!.views[0]).toMatchObject({
      state: "frozen",
      ySplit: 5,
    });
  });

  it("deve gerar relatório de PERDAS_VENCIMENTO na aba 'Perdas (Vencimento e Avaria)' com rótulos formatados, subtotais e total geral por último", async () => {
    const linhas: LinhaRelatorioPerdasVencimento[] = [
      {
        data: "2026-10-10",
        medicamento: "Paracetamol 500mg",
        lote: "PRC001",
        quantidade: 45,
        motivo: "VENCIMENTO",
      },
      {
        data: "2026-10-25",
        medicamento: "Ibuprofeno 400mg",
        lote: "IBU002",
        quantidade: 55,
        motivo: "AVARIA_FISICA",
      },
    ];

    const entrada: EntradaGeradorPlanilhaEstoque<LinhaRelatorioPerdasVencimento> =
      {
        tipoRelatorio: "PERDAS_VENCIMENTO",
        cabecalho: cabecalhoPadrao,
        periodo: {
          dataInicio: "2026-10-01",
          dataFim: "2026-10-31",
        },
        linhas,
      };

    const buffer = await adapter.gerar(entrada);
    const wb = new Workbook();
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);

    // Nome da aba com <= 31 caracteres
    const ws = wb.getWorksheet("Perdas (Vencimento e Avaria)");
    expect(ws).toBeDefined();

    // Período no cabeçalho institucional (datas puras sem conversão de fuso)
    const r3 = ws!.getRow(3).getCell(1).text;
    expect(r3).toContain("01/10/2026");
    expect(r3).toContain("31/10/2026");

    // Colunas da tabela
    const headerRow = ws!.getRow(5);
    const colunasEsperadas = [
      "Data",
      "Medicamento",
      "Lote",
      "Quantidade",
      "Motivo",
    ];
    colunasEsperadas.forEach((nomeCol, idx) => {
      expect(headerRow.getCell(idx + 1).text).toBe(nomeCol);
    });

    // Conferir data e rótulo legível do motivo na linha 6
    const rowItem1 = ws!.getRow(6);
    const cellData = rowItem1.getCell(1);
    expect(cellData.value).toBeInstanceOf(Date);
    const dataPerda = cellData.value as Date;
    expect(dataPerda.getUTCFullYear()).toBe(2026);
    expect(dataPerda.getUTCMonth()).toBe(9); // Outubro
    expect(dataPerda.getUTCDate()).toBe(10);
    expect(cellData.numFmt).toBe("dd/mm/yyyy");
    expect(rowItem1.getCell(5).value).toBe("Vencimento");

    // Linha 7 com motivo AVARIA_FISICA mapeado para "Avaria física"
    const rowItem2 = ws!.getRow(7);
    expect(rowItem2.getCell(5).value).toBe("Avaria física");

    // Subtotais vêm antes: linha 8 (Vencimento) e linha 9 (Avaria física)
    const subtotalRow1 = ws!.getRow(8);
    expect(subtotalRow1.getCell(1).text).toBe("Subtotal - Vencimento");
    expect(subtotalRow1.getCell(4).value).toBe(45);
    expect(subtotalRow1.getCell(4).numFmt).toBe("#,##0");

    const subtotalRow2 = ws!.getRow(9);
    expect(subtotalRow2.getCell(1).text).toBe("Subtotal - Avaria física");
    expect(subtotalRow2.getCell(4).value).toBe(55);
    expect(subtotalRow2.getCell(4).numFmt).toBe("#,##0");

    // Linha 10: Total geral por último (45 + 55 = 100)
    const totalRow = ws!.getRow(10);
    expect(totalRow.getCell(1).text).toContain("Total Geral");
    const cellTotalQtd = totalRow.getCell(4);
    expect(cellTotalQtd.value).toBe(100);
    expect(typeof cellTotalQtd.value).toBe("number");
    expect(cellTotalQtd.numFmt).toBe("#,##0");

    expect(ws!.rowCount).toBe(10);
  });

  it("deve gerar relatório de MOVIMENTACOES_PERIODO com extrato cronológico e rótulos legíveis", async () => {
    const linhas: LinhaRelatorioMovimentacoesPeriodo[] = [
      {
        dataHora: "2026-11-10T08:30:00.000Z",
        tipo: "ENTRADA",
        medicamento: "Omeprazol 20mg",
        lote: "OMP999",
        quantidade: 500,
        saldoResultante: 500,
        responsavel: "Farmacêutico João Silva",
      },
      {
        dataHora: "2026-11-12T14:15:00.000Z",
        tipo: "DISPENSACAO",
        medicamento: "Omeprazol 20mg",
        lote: "OMP999",
        quantidade: 30,
        saldoResultante: 470,
        responsavel: "Farmacêutica Maria Souza",
      },
    ];

    const entrada: EntradaGeradorPlanilhaEstoque<LinhaRelatorioMovimentacoesPeriodo> =
      {
        tipoRelatorio: "MOVIMENTACOES_PERIODO",
        cabecalho: cabecalhoPadrao,
        periodo: {
          dataInicio: "2026-11-01",
          dataFim: "2026-11-15",
        },
        linhas,
      };

    const buffer = await adapter.gerar(entrada);
    const wb = new Workbook();
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet("Movimentações");
    expect(ws).toBeDefined();

    // Colunas da tabela
    const headerRow = ws!.getRow(5);
    const colunasEsperadas = [
      "Data/Hora",
      "Tipo",
      "Medicamento",
      "Lote",
      "Quantidade",
      "Saldo Resultante",
      "Responsável",
    ];
    colunasEsperadas.forEach((nomeCol, idx) => {
      expect(headerRow.getCell(idx + 1).text).toBe(nomeCol);
    });

    // Conferir linha 1 com tipo legível
    const row1 = ws!.getRow(6);
    const cellDataHora = row1.getCell(1);
    expect(cellDataHora.value).toBeInstanceOf(Date);
    expect(cellDataHora.numFmt).toBe("dd/mm/yyyy hh:mm");

    expect(row1.getCell(2).value).toBe("Entrada por Recebimento");
    expect(row1.getCell(3).value).toBe("Omeprazol 20mg");
    expect(row1.getCell(5).value).toBe(500);
    expect(row1.getCell(5).numFmt).toBe("#,##0");
    expect(row1.getCell(6).value).toBe(500);
    expect(row1.getCell(6).numFmt).toBe("#,##0");
    expect(row1.getCell(7).value).toBe("Farmacêutico João Silva");

    // Linha 2 com tipo "Dispensação"
    const row2 = ws!.getRow(7);
    expect(row2.getCell(2).value).toBe("Dispensação");
  });

  it("deve converter dataHora '2026-11-10T08:30:00.000Z' para horário de Brasília (UTC-3), resultando em 05:30 do mesmo dia", async () => {
    const entrada: EntradaGeradorPlanilhaEstoque<LinhaRelatorioMovimentacoesPeriodo> =
      {
        tipoRelatorio: "MOVIMENTACOES_PERIODO",
        cabecalho: cabecalhoPadrao,
        linhas: [
          {
            dataHora: "2026-11-10T08:30:00.000Z",
            tipo: "AJUSTE_ENTRADA",
            medicamento: "Amoxicilina 500mg",
            lote: "L001",
            quantidade: 10,
            saldoResultante: 10,
            responsavel: "Farmacêutico",
          },
        ],
      };

    const buffer = await adapter.gerar(entrada);
    const wb = new Workbook();
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet("Movimentações");

    const cellDataHora = ws!.getRow(6).getCell(1);
    expect(cellDataHora.value).toBeInstanceOf(Date);
    const dateValue = cellDataHora.value as Date;

    // Em horário de Brasília (UTC-3), 08:30Z vira 05:30 do mesmo dia
    expect(dateValue.getUTCFullYear()).toBe(2026);
    expect(dateValue.getUTCMonth()).toBe(10); // Novembro
    expect(dateValue.getUTCDate()).toBe(10);
    expect(dateValue.getUTCHours()).toBe(5);
    expect(dateValue.getUTCMinutes()).toBe(30);
    expect(cellDataHora.numFmt).toBe("dd/mm/yyyy hh:mm");
    expect(ws!.getRow(6).getCell(2).value).toBe("Ajuste de Entrada");
  });
  it("deve rotular todos os tipos de movimentação aceitos pelo CHECK do banco", async () => {
    const tipos = [
      "ENTRADA_RECEBIMENTO",
      "ESTORNO_RECEBIMENTO",
      "SAIDA_DISPENSACAO",
      "ENTRADA_ESTORNO_DISPENSACAO",
      "AJUSTE_ENTRADA",
      "AJUSTE_SAIDA",
    ];
    const linhas: LinhaRelatorioMovimentacoesPeriodo[] = tipos.map((tipo, i) => ({
      dataHora: "2026-11-10T08:30:00.000Z",
      tipo,
      medicamento: "Amoxicilina 500mg",
      lote: `L${i}`,
      quantidade: 10,
      saldoResultante: 100,
      responsavel: "Maria",
    }));

    const buffer = await adapter.gerar({
      tipoRelatorio: "MOVIMENTACOES_PERIODO",
      cabecalho: cabecalhoPadrao,
      periodo: { dataInicio: "2026-11-01", dataFim: "2026-11-30" },
      linhas,
    });

    const wb = new Workbook();
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet("Movimentações");
    expect(ws).toBeDefined();

    const rotulos: string[] = [];
    ws!.eachRow((row, rowNumber) => {
      if (rowNumber >= 6) rotulos.push(String(row.getCell(2).value));
    });

    expect(rotulos).toEqual([
      "Entrada por Recebimento",
      "Estorno de Recebimento",
      "Dispensação",
      "Estorno de Dispensação",
      "Ajuste de Entrada",
      "Ajuste de Saída",
    ]);
  });
});
