import { Test, TestingModule } from "@nestjs/testing";
import { EstoqueRelatoriosPgRepository } from "./estoque-relatorios-pg.repository";
import { TransactionContext } from "../../../../common/transaction/transaction-context.service";

describe("EstoqueRelatoriosPgRepository", () => {
  let repository: EstoqueRelatoriosPgRepository;
  let mockQuery: jest.Mock;

  beforeEach(async () => {
    mockQuery = jest.fn();
    const mockTransactionContext = {
      getManager: jest.fn().mockReturnValue({
        query: mockQuery,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstoqueRelatoriosPgRepository,
        {
          provide: TransactionContext,
          useValue: mockTransactionContext,
        },
      ],
    }).compile();

    repository = module.get<EstoqueRelatoriosPgRepository>(
      EstoqueRelatoriosPgRepository,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("obterCabecalhoUbs", () => {
    it("deve retornar os dados institucionais da UBS quando encontrada", async () => {
      mockQuery.mockResolvedValueOnce([
        {
          nomeUbs: "UBS Centro de Saúde",
          municipio: "Parnaíba",
        },
      ]);

      const result = await repository.obterCabecalhoUbs(
        "11111111-1111-1111-1111-111111111111",
      );

      expect(result).toEqual({
        nomeUbs: "UBS Centro de Saúde",
        municipio: "Parnaíba",
      });
      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("FROM public.unidades_saude u");
      // A coluna cnes não existe em unidades_saude (débito registrado no PR).
      expect(sql.toLowerCase()).not.toContain("cnes");
      expect(sql).toContain("JOIN public.municipios m ON m.id = u.municipio_id");
      expect(params).toEqual(["11111111-1111-1111-1111-111111111111"]);
    });

    it("deve retornar null quando a UBS não for encontrada", async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await repository.obterCabecalhoUbs(
        "11111111-1111-1111-1111-111111111111",
      );

      expect(result).toBeNull();
    });
  });

  describe("consultarSaldosAtuais", () => {
    it("deve consultar saldos atuais com filtros básicos", async () => {
      mockQuery.mockResolvedValueOnce([
        {
          medicamento: "Amoxicilina 500mg",
          principioAtivo: "Amoxicilina",
          fabricante: "EMS",
          lote: "LOTE123",
          validade: "2026-12-31",
          saldo: "150",
          status: "ATIVO",
        },
      ]);

      const linhas = await repository.consultarSaldosAtuais({
        ubsId: "11111111-1111-1111-1111-111111111111",
      });

      expect(linhas).toEqual([
        {
          medicamento: "Amoxicilina 500mg",
          principioAtivo: "Amoxicilina",
          fabricante: "EMS",
          lote: "LOTE123",
          validade: "2026-12-31",
          saldo: 150,
          status: "ATIVO",
        },
      ]);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("l.ubs_id = $1::uuid");
      expect(sql).toContain("l.status = 'ATIVO'");
      expect(sql).toContain("l.saldo_atual > 0");
      expect(params).toEqual(["11111111-1111-1111-1111-111111111111"]);
    });

    it("deve incluir filtros opcionais de princípio ativo, produto e categoria", async () => {
      mockQuery.mockResolvedValueOnce([]);

      await repository.consultarSaldosAtuais({
        ubsId: "11111111-1111-1111-1111-111111111111",
        principioAtivo: "Dipirona",
        produtoId: "22222222-2222-2222-2222-222222222222",
        categoria: "ANALGESICO",
      });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("p.principio_ativo ILIKE $2");
      expect(sql).toContain("p.id = $3::uuid");
      expect(sql).toContain("p.categoria = $4");
      expect(params).toEqual([
        "11111111-1111-1111-1111-111111111111",
        "%Dipirona%",
        "22222222-2222-2222-2222-222222222222",
        "ANALGESICO",
      ]);
    });
  });

  describe("consultarPerdasVencimento", () => {
    it("deve consultar perdas com intervalo e regra de dataFim inclusiva (+ 1 day)", async () => {
      mockQuery.mockResolvedValueOnce([
        {
          data: "2026-10-15",
          medicamento: "Paracetamol 750mg",
          lote: "LOTE999",
          quantidade: "50",
          motivo: "VENCIMENTO",
        },
      ]);

      const linhas = await repository.consultarPerdasVencimento({
        ubsId: "11111111-1111-1111-1111-111111111111",
        dataInicio: "2026-10-01",
        dataFim: "2026-10-31",
      });

      expect(linhas).toEqual([
        {
          data: "2026-10-15",
          medicamento: "Paracetamol 750mg",
          lote: "LOTE999",
          quantidade: 50,
          motivo: "VENCIMENTO",
        },
      ]);

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("m.tipo_movimentacao = 'AJUSTE_SAIDA'");
      expect(sql).toContain("m.motivo IN ('VENCIMENTO', 'AVARIA_FISICA')");
      expect(sql).toContain("m.created_at >= ($2::date)::timestamp AT TIME ZONE 'America/Fortaleza'");
      expect(sql).toContain("m.created_at < (($3::date) + interval '1 day')::timestamp AT TIME ZONE 'America/Fortaleza'");
      expect(params).toEqual([
        "11111111-1111-1111-1111-111111111111",
        "2026-10-01",
        "2026-10-31",
      ]);
    });
  });

  describe("consultarMovimentacoesPeriodo", () => {
    it("deve consultar movimentações e formatar dataHora para ISO", async () => {
      const dateIso = "2026-11-01T14:30:00.000Z";
      mockQuery.mockResolvedValueOnce([
        {
          dataHoraRaw: new Date(dateIso),
          tipo: "DISPENSACAO",
          medicamento: "Ibuprofeno 400mg",
          lote: "LOTE456",
          quantidade: "20",
          saldoResultante: "80",
          responsavel: "Farmacêutico João",
        },
      ]);

      const linhas = await repository.consultarMovimentacoesPeriodo({
        ubsId: "11111111-1111-1111-1111-111111111111",
        dataInicio: "2026-11-01",
        dataFim: "2026-11-30",
      });

      expect(linhas).toEqual([
        {
          dataHora: dateIso,
          tipo: "DISPENSACAO",
          medicamento: "Ibuprofeno 400mg",
          lote: "LOTE456",
          quantidade: 20,
          saldoResultante: 80,
          responsavel: "Farmacêutico João",
        },
      ]);
    });
  });

  describe("consultarDadosParaRelatorio", () => {
    it("deve despachar para o método correspondente", async () => {
      const spySaldos = jest
        .spyOn(repository, "consultarSaldosAtuais")
        .mockResolvedValueOnce([]);
      const spyPerdas = jest
        .spyOn(repository, "consultarPerdasVencimento")
        .mockResolvedValueOnce([]);
      const spyMov = jest
        .spyOn(repository, "consultarMovimentacoesPeriodo")
        .mockResolvedValueOnce([]);

      await repository.consultarDadosParaRelatorio("SALDOS_ATUAIS", {
        ubsId: "11111111-1111-1111-1111-111111111111",
      });
      await repository.consultarDadosParaRelatorio("PERDAS_VENCIMENTO", {
        ubsId: "11111111-1111-1111-1111-111111111111",
      });
      await repository.consultarDadosParaRelatorio("MOVIMENTACOES_PERIODO", {
        ubsId: "11111111-1111-1111-1111-111111111111",
      });

      expect(spySaldos).toHaveBeenCalledTimes(1);
      expect(spyPerdas).toHaveBeenCalledTimes(1);
      expect(spyMov).toHaveBeenCalledTimes(1);
    });
  });
});
