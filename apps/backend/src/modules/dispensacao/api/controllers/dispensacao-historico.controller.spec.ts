import { Reflector } from "@nestjs/core";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PerfilCodigo } from "@farmaubs/shared";
import { HistoricoDispensacaoController } from "./dispensacao-historico.controller";
import { ListarDispensacoesUseCase } from "../../application/use-cases/listar-dispensacoes.use-case";
import { ExportarDispensacoesXlsxUseCase } from "../../application/use-cases/exportar-dispensacoes-xlsx.use-case";
import { EstornarDispensacaoUseCase } from "../../application/use-cases/estornar-dispensacao.use-case";
import {
  DispensacaoJaEstornadaException,
  DispensacaoNaoEncontradaException,
  IntervaloDatasInvalidoException,
  MotivoEstornoInvalidoException,
} from "../../domain/errors/dispensacao.errors";
import { ROLES_KEY } from "../../../../common/decorators/roles.decorator";

describe("HistoricoDispensacaoController (Camada C - REST e RBAC)", () => {
  let controller: HistoricoDispensacaoController;
  let listarUseCaseMock: jest.Mocked<ListarDispensacoesUseCase>;
  let exportarUseCaseMock: jest.Mocked<ExportarDispensacoesXlsxUseCase>;
  let estornarUseCaseMock: jest.Mocked<EstornarDispensacaoUseCase>;
  const reflector = new Reflector();

  beforeEach(() => {
    listarUseCaseMock = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ListarDispensacoesUseCase>;

    exportarUseCaseMock = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ExportarDispensacoesXlsxUseCase>;

    estornarUseCaseMock = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<EstornarDispensacaoUseCase>;

    controller = new HistoricoDispensacaoController(
      listarUseCaseMock,
      exportarUseCaseMock,
      estornarUseCaseMock,
    );
  });

  describe("Metadados RBAC (@Roles)", () => {
    it("GET /dispensacoes e GET /dispensacoes/exportar-xlsx devem permitir FARMACEUTICO_RESPONSAVEL, FARMACEUTICO_RESIDENTE, GERENTE e ADMINISTRADOR", () => {
      const rolesListar = reflector.get<string[]>(ROLES_KEY, controller.listar);
      const rolesExportar = reflector.get<string[]>(
        ROLES_KEY,
        controller.exportarXlsx,
      );
      const esperado = [
        PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
        PerfilCodigo.FARMACEUTICO_RESIDENTE,
        PerfilCodigo.GERENTE,
        PerfilCodigo.ADMINISTRADOR,
      ];
      expect(rolesListar).toEqual(esperado);
      expect(rolesExportar).toEqual(esperado);
    });

    it("POST /dispensacoes/:id/estorno deve permitir apenas FARMACEUTICO_RESPONSAVEL, FARMACEUTICO_RESIDENTE e ADMINISTRADOR", () => {
      const rolesEstornar = reflector.get<string[]>(
        ROLES_KEY,
        controller.estornar,
      );
      expect(rolesEstornar).toEqual([
        PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
        PerfilCodigo.FARMACEUTICO_RESIDENTE,
        PerfilCodigo.ADMINISTRADOR,
      ]);
    });
  });

  describe("GET /dispensacoes", () => {
    it("deve listar dispensações repassando query e unidadeId", async () => {
      const esperado = {
        itens: [],
        totalItens: 0,
        pagina: 1,
        limite: 20,
        totalPaginas: 1,
        dataInicioEfetiva: "2026-10-20",
        dataFimEfetiva: "2026-10-21",
      };
      listarUseCaseMock.execute.mockResolvedValue(esperado);

      const res = await controller.listar({}, { unidadeId: "ubs-1" } as any);
      expect(res).toEqual(esperado);
      expect(listarUseCaseMock.execute).toHaveBeenCalledWith({}, "ubs-1");
    });

    it("deve mapear IntervaloDatasInvalidoException para BadRequestException (400)", async () => {
      listarUseCaseMock.execute.mockRejectedValue(
        new IntervaloDatasInvalidoException(),
      );
      await expect(controller.listar({})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe("GET /dispensacoes/exportar-xlsx", () => {
    it("deve configurar cabeçalhos Content-Type e Content-Disposition e retornar o Buffer", async () => {
      const buf = Buffer.from("PK-xlsx");
      exportarUseCaseMock.execute.mockResolvedValue({
        buffer: buf,
        nomeArquivo: "dispensacoes_ubs_ubs1_2026-10-20_2026-10-21.xlsx",
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        totalLinhas: 2,
      });

      const setHeader = jest.fn();
      const res = await controller.exportarXlsx(
        {},
        { unidadeId: "ubs-1" } as any,
        { setHeader } as any,
      );

      expect(res).toBe(buf);
      expect(setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      expect(setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        'attachment; filename="dispensacoes_ubs_ubs1_2026-10-20_2026-10-21.xlsx"',
      );
    });
  });

  describe("POST /dispensacoes/:id/estorno", () => {
    it("deve mapear exceções de estorno para 400, 404 e 409 adequadamente", async () => {
      estornarUseCaseMock.execute.mockRejectedValue(
        new MotivoEstornoInvalidoException(),
      );
      await expect(
        controller.estornar(
          "disp-1",
          { motivoEstorno: "curto" },
          { id: "user-1", unidadeId: "ubs-1" } as any,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      estornarUseCaseMock.execute.mockRejectedValue(
        new DispensacaoNaoEncontradaException("disp-1"),
      );
      await expect(
        controller.estornar(
          "disp-1",
          { motivoEstorno: "Motivo válido" },
          { id: "user-1", unidadeId: "ubs-1" } as any,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      estornarUseCaseMock.execute.mockRejectedValue(
        new DispensacaoJaEstornadaException("disp-1"),
      );
      await expect(
        controller.estornar(
          "disp-1",
          { motivoEstorno: "Motivo válido" },
          { id: "user-1", unidadeId: "ubs-1" } as any,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});

