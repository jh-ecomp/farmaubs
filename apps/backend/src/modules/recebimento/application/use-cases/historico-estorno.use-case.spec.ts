import { ListarHistoricoRecebimentoUseCase } from "./listar-historico-recebimento.use-case";
import { ObterDetalhesRecebimentoUseCase } from "./obter-detalhes-recebimento.use-case";
import { EstornarRecebimentoUseCase } from "./estornar-recebimento.use-case";
import type { HistoricoRecebimentoRepositoryPort } from "../../domain/ports/historico-recebimento.repository.port";
import {
  DocumentoEntradaInvalidoException,
  DocumentoJaEstornadoException,
  DocumentoNaoEncontradoException,
  SaldoInsuficienteEstornoException,
  UbsAcessoNegadoException,
} from "../../domain/errors/recebimento.errors";

describe("Histórico de Recebimentos e Estorno (RF008 / RF028 / ADR-017)", () => {
  let fakeRepo: jest.Mocked<HistoricoRecebimentoRepositoryPort>;
  let listarUseCase: ListarHistoricoRecebimentoUseCase;
  let detalhesUseCase: ObterDetalhesRecebimentoUseCase;
  let estornarUseCase: EstornarRecebimentoUseCase;

  const contextoPadrao = {
    municipioId: "mun-123",
    usuarioId: "user-farm-1",
    unidadeIdsUsuario: ["ubs-central", "ubs-norte"],
  };

  const documentoDetalheMock = {
    id: "doc-1",
    ubsId: "ubs-central",
    numeroDocumento: "NF-5555",
    tipoDocumento: "NOTA_FISCAL",
    fornecedorOrigem: "Distribuidora Beta",
    dataRecebimento: new Date("2026-10-21T09:00:00Z"),
    usuarioRecebedorId: "user-farm-1",
    usuarioRecebedorNome: "Farmacêutico Teste",
    status: "CONCLUIDO" as const,
    itens: [
      {
        id: "item-1",
        produtoId: "prod-1",
        produtoNome: "Dipirona 500mg",
        formaFarmaceutica: "Comprimido",
        concentracao: "500mg",
        fabricanteId: "fab-1",
        fabricanteNome: "EMS",
        loteId: "lote-1",
        numeroLote: "LOT-DIP-01",
        dataValidade: "2027-10-01",
        quantidadeRecebida: 200,
        saldoAtualLote: 200,
      },
    ],
    totalItens: 1,
    totalUnidades: 200,
    podeEstornar: true,
  };

  beforeEach(() => {
    fakeRepo = {
      listarHistorico: jest.fn().mockResolvedValue({
        itens: [
          {
            id: "doc-1",
            numeroDocumento: "NF-5555",
            tipoDocumento: "NOTA_FISCAL",
            fornecedorOrigem: "Distribuidora Beta",
            dataRecebimento: "2026-10-21T09:00:00Z",
            usuarioRecebedorNome: "Farmacêutico Teste",
            totalItens: 1,
            totalUnidades: 200,
            status: "CONCLUIDO",
            podeEstornar: true,
          },
        ],
        total: 1,
        pagina: 1,
        totalPaginas: 1,
      }),
      obterDetalhesPorId: jest.fn().mockResolvedValue(documentoDetalheMock),
      executarEstornoAtomico: jest.fn().mockResolvedValue({
        id: "doc-1",
        numeroDocumento: "NF-5555",
        status: "ESTORNADO",
        dataEstorno: new Date(),
        usuarioEstornoId: "user-farm-1",
        motivoEstorno: "Erro de digitação do lote",
        totalItensEstornados: 1,
        totalUnidadesEstornadas: 200,
      }),
    };

    listarUseCase = new ListarHistoricoRecebimentoUseCase(fakeRepo);
    detalhesUseCase = new ObterDetalhesRecebimentoUseCase(fakeRepo);
    estornarUseCase = new EstornarRecebimentoUseCase(fakeRepo);
  });

  describe("ListarHistoricoRecebimentoUseCase", () => {
    it("deve listar histórico paginado com sucesso", async () => {
      const resultado = await listarUseCase.execute(
        { periodo: "ULTIMOS_7_DIAS", pagina: 1, limite: 20 },
        contextoPadrao,
      );

      expect(resultado.total).toBe(1);
      expect(resultado.itens[0].numeroDocumento).toBe("NF-5555");
      expect(fakeRepo.listarHistorico).toHaveBeenCalledWith(
        { periodo: "ULTIMOS_7_DIAS", pagina: 1, limite: 20 },
        "mun-123",
        ["ubs-central", "ubs-norte"],
      );
    });

    it("deve lançar UbsAcessoNegadoException se a UBS filtrada não pertencer ao usuário", async () => {
      await expect(
        listarUseCase.execute({ ubsId: "ubs-estranha" }, contextoPadrao),
      ).rejects.toThrow(UbsAcessoNegadoException);
    });
  });

  describe("ObterDetalhesRecebimentoUseCase", () => {
    it("deve retornar detalhes e itens completos para conferência ou termo", async () => {
      const resultado = await detalhesUseCase.execute("doc-1", contextoPadrao);

      expect(resultado.id).toBe("doc-1");
      expect(resultado.itens).toHaveLength(1);
      expect(resultado.itens[0].numeroLote).toBe("LOT-DIP-01");
    });

    it("deve lançar DocumentoNaoEncontradoException se o documento não existir", async () => {
      fakeRepo.obterDetalhesPorId.mockResolvedValueOnce(null);

      await expect(
        detalhesUseCase.execute("doc-inexistente", contextoPadrao),
      ).rejects.toThrow(DocumentoNaoEncontradoException);
    });

    it("deve lançar UbsAcessoNegadoException se o documento for de uma UBS fora do escopo", async () => {
      fakeRepo.obterDetalhesPorId.mockResolvedValueOnce({
        ...documentoDetalheMock,
        ubsId: "ubs-estranha",
      });

      await expect(
        detalhesUseCase.execute("doc-1", contextoPadrao),
      ).rejects.toThrow(UbsAcessoNegadoException);
    });
  });

  describe("EstornarRecebimentoUseCase", () => {
    it("deve exigir justificativa de estorno com no mínimo 10 caracteres", async () => {
      await expect(
        estornarUseCase.execute("doc-1", "Curto", contextoPadrao),
      ).rejects.toThrow(DocumentoEntradaInvalidoException);
    });

    it("deve rejeitar estorno de documento que já está estornado (RF008)", async () => {
      fakeRepo.obterDetalhesPorId.mockResolvedValueOnce({
        ...documentoDetalheMock,
        status: "ESTORNADO",
      });

      await expect(
        estornarUseCase.execute(
          "doc-1",
          "Justificativa válida com mais de 10 caracteres",
          contextoPadrao,
        ),
      ).rejects.toThrow(DocumentoJaEstornadoException);
    });

    it("deve propagar SaldoInsuficienteEstornoException se o lote já teve unidades dispensadas", async () => {
      fakeRepo.executarEstornoAtomico.mockRejectedValueOnce(
        new SaldoInsuficienteEstornoException("LOT-DIP-01", 50, 200),
      );

      await expect(
        estornarUseCase.execute(
          "doc-1",
          "Cancelamento da nota de recebimento",
          contextoPadrao,
        ),
      ).rejects.toThrow(SaldoInsuficienteEstornoException);
    });

    it("deve estornar o documento com sucesso e registrar motivo e livro-razão", async () => {
      const resultado = await estornarUseCase.execute(
        "doc-1",
        "Recebimento cancelado por divergência física no lote",
        contextoPadrao,
      );

      expect(resultado.status).toBe("ESTORNADO");
      expect(resultado.totalItensEstornados).toBe(1);
      expect(resultado.totalUnidadesEstornadas).toBe(200);
      expect(fakeRepo.executarEstornoAtomico).toHaveBeenCalledWith({
        documentoId: "doc-1",
        motivo: "Recebimento cancelado por divergência física no lote",
        usuarioId: "user-farm-1",
        municipioId: "mun-123",
      });
    });
  });
});
