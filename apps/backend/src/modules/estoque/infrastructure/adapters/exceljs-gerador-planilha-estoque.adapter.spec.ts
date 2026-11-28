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

  it("deve gerar relatório de SALDOS_ATUAIS com cabeçalho institucional, status legível e tipos formatados", async () => {
    const linhas: LinhaRelatorioSaldosAtuais[] = [
      {
        medicamento: "Amoxicilina 500mg",
        principioAtivo: "Amoxicilina",
        fabricante: "EMS",
        lote: "LOTE123",
        validade: "2027-05-15",
        saldo: 350,
        status: "REGULAR",
      },
      {
        medicamento: "Dipirona 500mg/mL",
        principioAtivo: "Dipirona Monoidratada",
        fabricante: "Medley",
        lote: "LOTE456",
        validade: "2026-05-01",
        saldo: 120,
        status: "VENCIDO",
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

    const r1 = ws!.getRow(1).getCell(1).text;
    const r2 = ws!.getRow(2).getCell(1).text;
    const r3 = ws!.getRow(3).getCell(1).text;

    expect(r1).toContain("Parnaíba");
    expect(r2).toContain("UBS São Judas Tadeu");
    expect(r2).toContain("1234567");
    expect(r3).toContain("19/11/2026");

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

    const primeiraLinha = ws!.getRow(6);
    expect(primeiraLinha.getCell(1).value).toBe("Amoxicilina 500mg");
    expect(primeiraLinha.getCell(4).value).toBe("LOTE123");
    expect(primeiraLinha.getCell(7).value).toBe("Regular");

    const segundaLinha = ws!.getRow(7);
    expect(segundaLinha.getCell(7).value).toBe("Vencido");

    const cellValidade = primeiraLinha.getCell(5);
    expect(cellValidade.value).toBeInstanceOf(Date);
    const dataValidade = cellValidade.value as Date;
    expect(dataValidade.getUTCFullYear()).toBe(2027);
    expect(dataValidade.getUTCMonth()).toBe(4);
    expect(dataValidade.getUTCDate()).toBe(15);
    expect(cellValidade.numFmt).toBe("dd/mm/yyyy");

    const cellSaldo = primeiraLinha.getCell(6);
    expect(cellSaldo.value).toBe(350);
    expect(typeof cellSaldo.value).toBe("number");
    expect(cellSaldo.numFmt).toBe("#,##0");

    expect(ws!.views[0]).toMatchObject({
      state: "frozen",
      ySplit: 5,
    });
  });

  it("deve gerar relatório de PERDAS_VENCIMENTO contemplando todos os motivos de perda com subtotais e total geral", async () => {
    const linhas: LinhaRelatorioPerdasVencimento[] = [
      {
        data: "2026-10-10",
        medicamento: "Paracetamol 500mg",
        lote: "PRC001",
        quantidade: 45,
        motivo: "VENCIMENTO",
      },
      {
        data: "2026-10-20",
        medicamento: "Ibuprofeno 400mg",
        lote: "IBU002",
        quantidade: 55,
        motivo: "AVARIA_FISICA",
      },
      {
        data: "2026-10-25",
        medicamento: "Losartana 50mg",
        lote: "LOS003",
        quantidade: 15,
        motivo: "EXTRAVIO",
      },
      {
        data: "2026-10-28",
        medicamento: "Metformina 850mg",
        lote: "MET004",
        quantidade: 10,
        motivo: "RECOLHIMENTO_SANITARIO",
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

    const ws = wb.getWorksheet("Perdas (Vencimento e Avaria)");
    expect(ws).toBeDefined();

    const r3 = ws!.getRow(3).getCell(1).text;
    expect(r3).toContain("01/10/2026");
    expect(r3).toContain("31/10/2026");

    expect(ws!.getRow(6).getCell(5).value).toBe("Vencimento");
    expect(ws!.getRow(7).getCell(5).value).toBe("Avaria física");
    expect(ws!.getRow(8).getCell(5).value).toBe("Extravio");
    expect(ws!.getRow(9).getCell(5).value).toBe("Recolhimento sanitário");

    expect(ws!.getRow(10).getCell(1).text).toBe("Subtotal - Vencimento");
    expect(ws!.getRow(10).getCell(4).value).toBe(45);
    expect(ws!.getRow(11).getCell(1).text).toBe("Subtotal - Avaria física");
    expect(ws!.getRow(11).getCell(4).value).toBe(55);
    expect(ws!.getRow(12).getCell(1).text).toBe("Subtotal - Extravio");
    expect(ws!.getRow(12).getCell(4).value).toBe(15);
    expect(ws!.getRow(13).getCell(1).text).toBe(
      "Subtotal - Recolhimento sanitário",
    );
    expect(ws!.getRow(13).getCell(4).value).toBe(10);

    const totalRow = ws!.getRow(14);
    expect(totalRow.getCell(1).text).toBe("Total Geral");
    expect(totalRow.getCell(4).value).toBe(125);
    expect(totalRow.getCell(4).numFmt).toBe("#,##0");
  });

  it("deve neutralizar Formula Injection (CWE-1236) prefixando apóstrofo em células iniciadas por =, +, - ou @", async () => {
    const buffer = await adapter.gerar({
      tipoRelatorio: "SALDOS_ATUAIS",
      cabecalho: cabecalhoPadrao,
      linhas: [
        {
          medicamento: "=CMD|' /C calc'!A0",
          principioAtivo: "+2+3",
          fabricante: "@SUM(A1:A2)",
          lote: "-LOTE-99",
          validade: "2027-01-01",
          saldo: 10,
          status: "REGULAR",
        },
      ],
    });

    const wb = new Workbook();
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet("Saldos Atuais")!;
    const row = ws.getRow(6);

    expect(row.getCell(1).value).toBe("'=CMD|' /C calc'!A0");
    expect(row.getCell(2).value).toBe("'+2+3");
    expect(row.getCell(3).value).toBe("'@SUM(A1:A2)");
    expect(row.getCell(4).value).toBe("'-LOTE-99");
    expect(row.getCell(6).value).toBe(10);
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

    const buffer = await adapter.gerar({
      tipoRelatorio: "MOVIMENTACOES_PERIODO",
      cabecalho: cabecalhoPadrao,
      periodo: {
        dataInicio: "2026-11-01",
        dataFim: "2026-11-15",
      },
      linhas,
    });
    const wb = new Workbook();
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet("Movimentações");
    expect(ws).toBeDefined();

    const row1 = ws!.getRow(6);
    expect(row1.getCell(1).value).toBeInstanceOf(Date);
    expect(row1.getCell(1).numFmt).toBe("dd/mm/yyyy hh:mm");
    expect(row1.getCell(2).value).toBe("Entrada por Recebimento");
    expect(row1.getCell(3).value).toBe("Omeprazol 20mg");
    expect(row1.getCell(5).value).toBe(500);
    expect(row1.getCell(6).value).toBe(500);
    expect(row1.getCell(7).value).toBe("Farmacêutico João Silva");

    expect(ws!.getRow(7).getCell(2).value).toBe("Dispensação");
  });

  it("deve converter dataHora '2026-11-10T08:30:00.000Z' para horário de Fortaleza (UTC-3), resultando em 05:30", async () => {
    const buffer = await adapter.gerar({
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
    });
    const wb = new Workbook();
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet("Movimentações");

    const cellDataHora = ws!.getRow(6).getCell(1);
    const dateValue = cellDataHora.value as Date;

    expect(dateValue.getUTCFullYear()).toBe(2026);
    expect(dateValue.getUTCMonth()).toBe(10);
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
    const linhas: LinhaRelatorioMovimentacoesPeriodo[] = tipos.map(
      (tipo, i) => ({
        dataHora: "2026-11-10T08:30:00.000Z",
        tipo,
        medicamento: "Amoxicilina 500mg",
        lote: `L${i}`,
        quantidade: 10,
        saldoResultante: 100,
        responsavel: "Maria",
      }),
    );

    const buffer = await adapter.gerar({
      tipoRelatorio: "MOVIMENTACOES_PERIODO",
      cabecalho: cabecalhoPadrao,
      periodo: { dataInicio: "2026-11-01", dataFim: "2026-11-30" },
      linhas,
    });

    const wb = new Workbook();
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet("Movimentações")!;

    const rotulos: string[] = [];
    ws.eachRow((row, rowNumber) => {
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
