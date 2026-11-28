import { Before, DataTable, Given, Then, When } from "@cucumber/cucumber";
import { expect } from "chai";
import { Workbook } from "exceljs";
import type { Worksheet } from "exceljs";
import type { TipoRelatorioEstoque } from "@farmaubs/shared";
import { GerarRelatorioEstoqueXlsxUseCase } from "../../../src/modules/estoque/application/use-cases/gerar-relatorio-estoque-xlsx.use-case";
import type { SaidaGerarRelatorioEstoqueXlsx } from "../../../src/modules/estoque/application/use-cases/gerar-relatorio-estoque-xlsx.use-case";
import { ExcelJsGeradorPlanilhaEstoqueAdapter } from "../../../src/modules/estoque/infrastructure/adapters/exceljs-gerador-planilha-estoque.adapter";
import type {
  CabecalhoUbsRelatorio,
  FiltrosConsultaRelatorioEstoque,
  RepositorioEstoqueRelatoriosPort,
} from "../../../src/modules/estoque/domain/ports/estoque-relatorios.repository.port";
import type {
  LinhaRelatorioEstoque,
  LinhaRelatorioMovimentacoesPeriodo,
  LinhaRelatorioPerdasVencimento,
  LinhaRelatorioSaldosAtuais,
} from "../../../src/modules/estoque/domain/ports/gerador-planilha-estoque.port";

// Linhas 1-3 institucionais, 4 em branco, 5 cabeçalho da tabela.
const LINHA_CABECALHO_TABELA = 5;

interface DadosUbs {
  municipio: string;
  saldos: LinhaRelatorioSaldosAtuais[];
  perdas: LinhaRelatorioPerdasVencimento[];
}

class RepositorioEstoqueRelatoriosFake implements RepositorioEstoqueRelatoriosPort {
  constructor(private readonly ubs: Map<string, DadosUbs>) {}

  async obterCabecalhoUbs(
    ubsId: string,
  ): Promise<CabecalhoUbsRelatorio | null> {
    const dados = this.ubs.get(ubsId);
    if (!dados) return null;
    return { nomeUbs: `Unidade ${ubsId}`, municipio: dados.municipio };
  }

  async consultarSaldosAtuais(
    filtros: FiltrosConsultaRelatorioEstoque,
  ): Promise<LinhaRelatorioSaldosAtuais[]> {
    return [...(this.ubs.get(filtros.ubsId)?.saldos ?? [])];
  }

  async consultarPerdasVencimento(
    filtros: FiltrosConsultaRelatorioEstoque,
  ): Promise<LinhaRelatorioPerdasVencimento[]> {
    const perdas = this.ubs.get(filtros.ubsId)?.perdas ?? [];
    return perdas.filter((p) => {
      const data = String(p.data);
      if (filtros.dataInicio && data < filtros.dataInicio) return false;
      if (filtros.dataFim && data > filtros.dataFim) return false;
      return true;
    });
  }

  async consultarMovimentacoesPeriodo(): Promise<
    LinhaRelatorioMovimentacoesPeriodo[]
  > {
    return [];
  }

  async consultarDadosParaRelatorio(
    tipo: TipoRelatorioEstoque,
    filtros: FiltrosConsultaRelatorioEstoque,
  ): Promise<LinhaRelatorioEstoque[]> {
    if (tipo === "SALDOS_ATUAIS") return this.consultarSaldosAtuais(filtros);
    if (tipo === "PERDAS_VENCIMENTO")
      return this.consultarPerdasVencimento(filtros);
    return this.consultarMovimentacoesPeriodo();
  }
}

let ubsPorId = new Map<string, DadosUbs>();
let saida: SaidaGerarRelatorioEstoqueXlsx | undefined;
let planilha: Worksheet | undefined;

function obterUbs(ubsId: string): DadosUbs {
  let dados = ubsPorId.get(ubsId);
  if (!dados) {
    dados = { municipio: "Parnaíba", saldos: [], perdas: [] };
    ubsPorId.set(ubsId, dados);
  }
  return dados;
}

async function gerar(
  tipo: TipoRelatorioEstoque,
  ubsId: string,
  dataInicio?: string,
  dataFim?: string,
): Promise<void> {
  const useCase = new GerarRelatorioEstoqueXlsxUseCase(
    new RepositorioEstoqueRelatoriosFake(ubsPorId),
    new ExcelJsGeradorPlanilhaEstoqueAdapter(),
  );
  saida = await useCase.execute({
    tipoRelatorio: tipo,
    ubsId,
    dataInicio,
    dataFim,
  });
  const wb = new Workbook();
  await wb.xlsx.load(
    saida.buffer as unknown as Parameters<Workbook["xlsx"]["load"]>[0],
  );
  planilha = wb.worksheets[0];
}

function planilhaGerada(): Worksheet {
  expect(planilha, "planilha gerada").to.not.equal(undefined);
  return planilha as Worksheet;
}

Before(() => {
  ubsPorId = new Map();
  saida = undefined;
  planilha = undefined;
});

Given(
  "que a UBS {string} do município {string} possui o lote {string} de {string} com saldo {int} para o relatório",
  (
    ubsId: string,
    municipio: string,
    lote: string,
    medicamento: string,
    saldo: number,
  ) => {
    const dados = obterUbs(ubsId);
    dados.municipio = municipio;
    dados.saldos.push({
      medicamento,
      principioAtivo: medicamento,
      fabricante: "Laboratório Teste",
      lote,
      validade: "2027-12-31",
      saldo,
      status: "ATIVO",
    });
  },
);

Given(
  "que a UBS {string} registrou as seguintes perdas para o relatório:",
  (ubsId: string, tabela: DataTable) => {
    const dados = obterUbs(ubsId);
    dados.perdas = tabela.hashes().map((linha) => ({
      data: linha.data,
      medicamento: linha.medicamento,
      lote: linha.lote,
      quantidade: Number(linha.quantidade),
      motivo: linha.motivo,
    }));
  },
);

When(
  "o farmacêutico gera o relatório {string} da UBS {string} sem período",
  async (tipo: string, ubsId: string) => {
    await gerar(tipo as TipoRelatorioEstoque, ubsId);
  },
);

When(
  "o farmacêutico gera o relatório {string} da UBS {string} de {string} a {string}",
  async (tipo: string, ubsId: string, inicio: string, fim: string) => {
    await gerar(tipo as TipoRelatorioEstoque, ubsId, inicio, fim);
  },
);

Then(
  "o arquivo gerado deve ser uma planilha XLSX com nome iniciado por {string}",
  (prefixo: string) => {
    expect(saida, "saída do caso de uso").to.not.equal(undefined);
    expect(saida!.contentType).to.equal(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(saida!.nomeArquivo.startsWith(prefixo)).to.equal(true);
    expect(saida!.nomeArquivo.endsWith(".xlsx")).to.equal(true);
  },
);

Then("o nome do arquivo gerado deve ser {string}", (nomeEsperado: string) => {
  expect(saida, "saída do caso de uso").to.not.equal(undefined);
  expect(saida!.nomeArquivo).to.equal(nomeEsperado);
});

Then(
  "a planilha deve ter o cabeçalho institucional {string}",
  (textoEsperado: string) => {
    const valor = planilhaGerada().getRow(1).getCell(1).value;
    expect(String(valor)).to.equal(textoEsperado);
  },
);

Then("a planilha deve conter as colunas: {string}", (colunas: string) => {
  const esperadas = colunas.split(",").map((c) => c.trim());
  const linha = planilhaGerada().getRow(LINHA_CABECALHO_TABELA);
  const obtidas = esperadas.map((_, i) => String(linha.getCell(i + 1).value));
  expect(obtidas).to.deep.equal(esperadas);
});

Then("a planilha deve listar {int} perdas", (total: number) => {
  const ws = planilhaGerada();
  let linhasDeDados = 0;
  for (let r = LINHA_CABECALHO_TABELA + 1; r <= ws.rowCount; r++) {
    // Linhas de dados têm a data (Date) na coluna 1; subtotais e total têm texto.
    if (ws.getRow(r).getCell(1).value instanceof Date) linhasDeDados++;
  }
  expect(linhasDeDados).to.equal(total);
});

Then(
  "a última linha da planilha deve ser {string} com {int} unidades",
  (rotulo: string, quantidade: number) => {
    const ws = planilhaGerada();
    const ultima = ws.getRow(ws.rowCount);
    expect(String(ultima.getCell(1).value)).to.equal(rotulo);
    expect(ultima.getCell(4).value).to.equal(quantidade);
  },
);
