import {
  GerarRelatorioEstoqueXlsxUseCase,
  type EntradaGerarRelatorioEstoqueXlsx,
} from "./gerar-relatorio-estoque-xlsx.use-case";
import type { RepositorioEstoqueRelatoriosPort } from "../../domain/ports/estoque-relatorios.repository.port";
import type { GeradorPlanilhaEstoquePort } from "../../domain/ports/gerador-planilha-estoque.port";
import {
  IntervaloDatasRelatorioInvalidoException,
  UbsNaoEncontradaRelatorioException,
} from "../../domain/errors/estoque-relatorios.errors";

describe("GerarRelatorioEstoqueXlsxUseCase", () => {
  let useCase: GerarRelatorioEstoqueXlsxUseCase;
  let mockRepositorio: jest.Mocked<RepositorioEstoqueRelatoriosPort>;
  let mockGerador: jest.Mocked<GeradorPlanilhaEstoquePort>;

  beforeEach(() => {
    mockRepositorio = {
      obterCabecalhoUbs: jest.fn(),
      consultarSaldosAtuais: jest.fn(),
      consultarPerdasVencimento: jest.fn(),
      consultarMovimentacoesPeriodo: jest.fn(),
      consultarDadosParaRelatorio: jest.fn(),
    };

    mockGerador = {
      gerar: jest.fn(),
    };

    useCase = new GerarRelatorioEstoqueXlsxUseCase(
      mockRepositorio,
      mockGerador,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("deve lançar UbsNaoEncontradaRelatorioException se a UBS não existir", async () => {
    mockRepositorio.obterCabecalhoUbs.mockResolvedValueOnce(null);

    const entrada: EntradaGerarRelatorioEstoqueXlsx = {
      tipoRelatorio: "SALDOS_ATUAIS",
      ubsId: "ubs-inexistente",
    };

    await expect(useCase.execute(entrada)).rejects.toThrow(
      UbsNaoEncontradaRelatorioException,
    );
    expect(mockRepositorio.obterCabecalhoUbs).toHaveBeenCalledWith(
      "ubs-inexistente",
    );
  });

  it("deve lançar IntervaloDatasRelatorioInvalidoException se dataFim for menor que dataInicio", async () => {
    mockRepositorio.obterCabecalhoUbs.mockResolvedValueOnce({
      nomeUbs: "UBS Centro",
      municipio: "Parnaíba",
    });

    const entrada: EntradaGerarRelatorioEstoqueXlsx = {
      tipoRelatorio: "MOVIMENTACOES_PERIODO",
      ubsId: "ubs-1",
      dataInicio: "2026-11-20",
      dataFim: "2026-11-10",
    };

    await expect(useCase.execute(entrada)).rejects.toThrow(
      IntervaloDatasRelatorioInvalidoException,
    );
  });

  it("deve lançar IntervaloDatasRelatorioInvalidoException se intervalo > 365 dias", async () => {
    mockRepositorio.obterCabecalhoUbs.mockResolvedValueOnce({
      nomeUbs: "UBS Centro",
      municipio: "Parnaíba",
    });

    const entrada: EntradaGerarRelatorioEstoqueXlsx = {
      tipoRelatorio: "PERDAS_VENCIMENTO",
      ubsId: "ubs-1",
      dataInicio: "2025-01-01",
      dataFim: "2026-02-01",
    };

    await expect(useCase.execute(entrada)).rejects.toThrow(
      IntervaloDatasRelatorioInvalidoException,
    );
  });

  it("deve gerar relatório de SALDOS_ATUAIS calculando o status real de validade dos lotes", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-15T12:00:00Z"));

    try {
      mockRepositorio.obterCabecalhoUbs.mockResolvedValueOnce({
        nomeUbs: "UBS São Vicente",
        cnes: "1234567",
        municipio: "Parnaíba",
      });

      const fakeLinhas = [
        {
          medicamento: "Dipirona 500mg",
          lote: "L01",
          validade: "2027-06-01",
          saldo: 100,
          status: "ATIVO",
        },
        {
          medicamento: "Losartana 50mg",
          lote: "L02",
          validade: "2026-05-01",
          saldo: 25,
          status: "ATIVO",
        },
      ];
      mockRepositorio.consultarDadosParaRelatorio.mockResolvedValueOnce(
        fakeLinhas,
      );

      const fakeBuffer = Buffer.from("excel-binary");
      mockGerador.gerar.mockResolvedValueOnce(fakeBuffer);

      const resultado = await useCase.execute({
        tipoRelatorio: "SALDOS_ATUAIS",
        ubsId: "ubs-1",
      });

      expect(resultado.buffer).toEqual(fakeBuffer);
      expect(resultado.contentType).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      expect(resultado.nomeArquivo).toBe(
        "relatorio_estoque_SALDOS_ATUAIS_ubs-1_2026-11-15.xlsx",
      );

      expect(mockGerador.gerar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoRelatorio: "SALDOS_ATUAIS",
          cabecalho: expect.objectContaining({
            nomeUbs: "UBS São Vicente",
            cnes: "1234567",
            municipio: "Parnaíba",
          }),
          periodo: undefined,
          linhas: [
            expect.objectContaining({ lote: "L01", status: "REGULAR" }),
            expect.objectContaining({ lote: "L02", status: "VENCIDO" }),
          ],
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("deve gerar relatório de MOVIMENTACOES_PERIODO com período padrão de 30 dias se omitido", async () => {
    mockRepositorio.obterCabecalhoUbs.mockResolvedValueOnce({
      nomeUbs: "UBS Centro",
      municipio: "Parnaíba",
    });

    mockRepositorio.consultarDadosParaRelatorio.mockResolvedValueOnce([]);
    mockGerador.gerar.mockResolvedValueOnce(Buffer.from("excel-buffer"));

    const resultado = await useCase.execute({
      tipoRelatorio: "MOVIMENTACOES_PERIODO",
      ubsId: "ubs-1",
    });

    expect(resultado.buffer).toBeDefined();
    expect(resultado.nomeArquivo).toMatch(
      /^relatorio_estoque_MOVIMENTACOES_PERIODO_ubs-1_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.xlsx$/,
    );
    expect(mockRepositorio.consultarDadosParaRelatorio).toHaveBeenCalledTimes(1);
    const callArgs = mockRepositorio.consultarDadosParaRelatorio.mock.calls[0];
    expect(callArgs[0]).toBe("MOVIMENTACOES_PERIODO");
    expect(callArgs[1].dataInicio).toBeDefined();
    expect(callArgs[1].dataFim).toBeDefined();
  });

  it("deve lançar IntervaloDatasRelatorioInvalidoException para data inexistente (2026-02-31)", async () => {
    mockRepositorio.obterCabecalhoUbs.mockResolvedValueOnce({
      nomeUbs: "UBS Centro",
      municipio: "Parnaíba",
    });

    await expect(
      useCase.execute({
        tipoRelatorio: "PERDAS_VENCIMENTO",
        ubsId: "ubs-1",
        dataInicio: "2026-02-31",
        dataFim: "2026-03-10",
      }),
    ).rejects.toBeInstanceOf(IntervaloDatasRelatorioInvalidoException);
    expect(mockRepositorio.consultarDadosParaRelatorio).not.toHaveBeenCalled();
  });

  describe("fuso horário da UBS (America/Fortaleza)", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-10-31T02:30:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("deve usar a data local (e não UTC) no nome do arquivo de SALDOS_ATUAIS", async () => {
      mockRepositorio.obterCabecalhoUbs.mockResolvedValueOnce({
        nomeUbs: "UBS Centro",
        municipio: "Parnaíba",
      });
      mockRepositorio.consultarDadosParaRelatorio.mockResolvedValueOnce([]);
      mockGerador.gerar.mockResolvedValueOnce(Buffer.from("excel-buffer"));

      const resultado = await useCase.execute({
        tipoRelatorio: "SALDOS_ATUAIS",
        ubsId: "ubs-1",
      });

      expect(resultado.nomeArquivo).toBe(
        "relatorio_estoque_SALDOS_ATUAIS_ubs-1_2026-10-30.xlsx",
      );
    });

    it("deve calcular o período padrão de 30 dias no fuso local", async () => {
      mockRepositorio.obterCabecalhoUbs.mockResolvedValueOnce({
        nomeUbs: "UBS Centro",
        municipio: "Parnaíba",
      });
      mockRepositorio.consultarDadosParaRelatorio.mockResolvedValueOnce([]);
      mockGerador.gerar.mockResolvedValueOnce(Buffer.from("excel-buffer"));

      await useCase.execute({
        tipoRelatorio: "MOVIMENTACOES_PERIODO",
        ubsId: "ubs-1",
      });

      const filtros =
        mockRepositorio.consultarDadosParaRelatorio.mock.calls[0][1];
      expect(filtros.dataFim).toBe("2026-10-30");
      expect(filtros.dataInicio).toBe("2026-09-30");
    });
  });
});
