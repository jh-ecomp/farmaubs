import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { HistoricoRecebimentoController } from "./historico-recebimento.controller";
import type { ListarHistoricoRecebimentoUseCase } from "../../application/use-cases/listar-historico-recebimento.use-case";
import type { ObterDetalhesRecebimentoUseCase } from "../../application/use-cases/obter-detalhes-recebimento.use-case";
import type { EstornarRecebimentoUseCase } from "../../application/use-cases/estornar-recebimento.use-case";
import { PerfilCodigo } from "@farmaubs/shared";
import {
  DocumentoJaEstornadoException,
  DocumentoNaoEncontradoException,
  SaldoInsuficienteEstornoException,
  UbsAcessoNegadoException,
} from "../../domain/errors/recebimento.errors";

describe("HistoricoRecebimentoController (RF008 / RF028)", () => {
  let controller: HistoricoRecebimentoController;
  let fakeListarUseCase: jest.Mocked<ListarHistoricoRecebimentoUseCase>;
  let fakeDetalhesUseCase: jest.Mocked<ObterDetalhesRecebimentoUseCase>;
  let fakeEstornarUseCase: jest.Mocked<EstornarRecebimentoUseCase>;

  const usuarioMock = {
    id: "user-123",
    email: "farmaceutico@ubs.gov.br",
    nomeCompleto: "Dr. Roberto",
    perfilCodigo: PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    municipioId: "mun-123",
    unidadeIds: ["ubs-456"],
    deveTrocarSenha: false,
  };

  beforeEach(() => {
    fakeListarUseCase = {
      execute: jest.fn().mockResolvedValue({
        itens: [],
        total: 0,
        pagina: 1,
        totalPaginas: 0,
      }),
    } as unknown as jest.Mocked<ListarHistoricoRecebimentoUseCase>;

    fakeDetalhesUseCase = {
      execute: jest.fn().mockResolvedValue({
        id: "doc-1",
        ubsId: "ubs-456",
        numeroDocumento: "NF-001",
        tipoDocumento: "GUIA_CAF",
        fornecedorOrigem: "CAF Central",
        dataRecebimento: new Date(),
        usuarioRecebedorId: "user-123",
        usuarioRecebedorNome: "Dr. Roberto",
        status: "CONCLUIDO",
        itens: [],
        totalItens: 0,
        totalUnidades: 0,
        podeEstornar: true,
      }),
    } as unknown as jest.Mocked<ObterDetalhesRecebimentoUseCase>;

    fakeEstornarUseCase = {
      execute: jest.fn().mockResolvedValue({
        id: "doc-1",
        numeroDocumento: "NF-001",
        status: "ESTORNADO",
        dataEstorno: new Date(),
        usuarioEstornoId: "user-123",
        motivoEstorno: "Lote registrado por engano",
        totalItensEstornados: 1,
        totalUnidadesEstornadas: 100,
      }),
    } as unknown as jest.Mocked<EstornarRecebimentoUseCase>;

    controller = new HistoricoRecebimentoController(
      fakeListarUseCase,
      fakeDetalhesUseCase,
      fakeEstornarUseCase,
    );
  });

  describe("GET /recebimento/historico", () => {
    it("deve chamar o use case com os parâmetros de consulta e contexto", async () => {
      await controller.listarHistorico(
        { periodo: "HOJE", pagina: 1, limite: 10 },
        usuarioMock,
      );

      expect(fakeListarUseCase.execute).toHaveBeenCalledWith(
        { periodo: "HOJE", pagina: 1, limite: 10 },
        {
          municipioId: "mun-123",
          unidadeIdsUsuario: ["ubs-456"],
        },
      );
    });

    it("deve mapear UbsAcessoNegadoException para ForbiddenException (403)", async () => {
      fakeListarUseCase.execute.mockRejectedValueOnce(
        new UbsAcessoNegadoException("ubs-invasora"),
      );

      await expect(
        controller.listarHistorico({ ubsId: "ubs-invasora" }, usuarioMock),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("GET /recebimento/entradas/:id", () => {
    it("deve retornar os detalhes da entrada com sucesso", async () => {
      const resultado = await controller.obterDetalhes("doc-1", usuarioMock);

      expect(resultado.id).toBe("doc-1");
      expect(fakeDetalhesUseCase.execute).toHaveBeenCalledWith("doc-1", {
        municipioId: "mun-123",
        unidadeIdsUsuario: ["ubs-456"],
      });
    });

    it("deve mapear DocumentoNaoEncontradoException para NotFoundException (404)", async () => {
      fakeDetalhesUseCase.execute.mockRejectedValueOnce(
        new DocumentoNaoEncontradoException("doc-inexistente"),
      );

      await expect(
        controller.obterDetalhes("doc-inexistente", usuarioMock),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("POST /recebimento/entradas/:id/estorno", () => {
    it("deve efetuar o estorno e retornar o resultado", async () => {
      const resultado = await controller.estornarRecebimento(
        "doc-1",
        { motivo: "Justificativa completa do cancelamento da carga" },
        usuarioMock,
      );

      expect(resultado.status).toBe("ESTORNADO");
      expect(fakeEstornarUseCase.execute).toHaveBeenCalledWith(
        "doc-1",
        "Justificativa completa do cancelamento da carga",
        {
          municipioId: "mun-123",
          usuarioId: "user-123",
          unidadeIdsUsuario: ["ubs-456"],
        },
      );
    });

    it("deve mapear DocumentoJaEstornadoException para ConflictException (409)", async () => {
      fakeEstornarUseCase.execute.mockRejectedValueOnce(
        new DocumentoJaEstornadoException("NF-001"),
      );

      await expect(
        controller.estornarRecebimento(
          "doc-1",
          { motivo: "Tentando estornar de novo" },
          usuarioMock,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it("deve mapear SaldoInsuficienteEstornoException para BadRequestException (400)", async () => {
      fakeEstornarUseCase.execute.mockRejectedValueOnce(
        new SaldoInsuficienteEstornoException("LOT-01", 10, 50),
      );

      await expect(
        controller.estornarRecebimento(
          "doc-1",
          { motivo: "Tentando estornar lote dispensado" },
          usuarioMock,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
