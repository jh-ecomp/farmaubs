import { Reflector } from "@nestjs/core";
import { NotFoundException } from "@nestjs/common";
import { PerfilCodigo } from "@farmaubs/shared";
import { DispensacaoCatalogoController } from "./dispensacao-catalogo.controller";
import { BuscarMedicamentosDispensacaoUseCase } from "../../application/use-cases/buscar-medicamentos-dispensacao.use-case";
import { ObterSugestaoLotesFefoUseCase } from "../../application/use-cases/obter-sugestao-lotes-fefo.use-case";
import { MedicamentoNaoEncontradoException } from "../../domain/errors/dispensacao-catalogo.errors";
import { ROLES_KEY } from "../../../../common/decorators/roles.decorator";

describe("DispensacaoCatalogoController (Camada C - REST e RBAC)", () => {
  let controller: DispensacaoCatalogoController;
  let buscarMedicamentosUseCaseMock: jest.Mocked<BuscarMedicamentosDispensacaoUseCase>;
  let obterSugestaoLotesFefoUseCaseMock: jest.Mocked<ObterSugestaoLotesFefoUseCase>;
  const reflector = new Reflector();

  beforeEach(() => {
    buscarMedicamentosUseCaseMock = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<BuscarMedicamentosDispensacaoUseCase>;

    obterSugestaoLotesFefoUseCaseMock = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ObterSugestaoLotesFefoUseCase>;

    controller = new DispensacaoCatalogoController(
      buscarMedicamentosUseCaseMock,
      obterSugestaoLotesFefoUseCaseMock,
    );
  });

  describe("Metadados RBAC (@Roles)", () => {
    it("GET /dispensacao/medicamentos deve permitir FARMACEUTICO_RESPONSAVEL, FARMACEUTICO_RESIDENTE, GERENTE e ADMINISTRADOR", () => {
      const roles = reflector.get<string[]>(
        ROLES_KEY,
        controller.buscarMedicamentos,
      );
      expect(roles).toEqual([
        PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
        PerfilCodigo.FARMACEUTICO_RESIDENTE,
        PerfilCodigo.GERENTE,
        PerfilCodigo.ADMINISTRADOR,
      ]);
    });

    it("GET /dispensacao/medicamentos/:id/lotes-fefo deve permitir FARMACEUTICO_RESPONSAVEL, FARMACEUTICO_RESIDENTE, GERENTE e ADMINISTRADOR", () => {
      const roles = reflector.get<string[]>(
        ROLES_KEY,
        controller.obterLotesFefo,
      );
      expect(roles).toEqual([
        PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
        PerfilCodigo.FARMACEUTICO_RESIDENTE,
        PerfilCodigo.GERENTE,
        PerfilCodigo.ADMINISTRADOR,
      ]);
    });
  });

  describe("GET /dispensacao/medicamentos", () => {
    it("deve delegar a busca textual repassando o termo e unidadeId da sessão", async () => {
      buscarMedicamentosUseCaseMock.execute.mockResolvedValue([]);
      const res = await controller.buscarMedicamentos({ termo: "amox" }, {
        unidadeId: "ubs-123",
      } as any);
      expect(res).toEqual([]);
      expect(buscarMedicamentosUseCaseMock.execute).toHaveBeenCalledWith(
        "amox",
        "ubs-123",
      );
    });
  });

  describe("GET /dispensacao/medicamentos/:id/lotes-fefo", () => {
    it("deve retornar a sugestão FEFO e lotes disponíveis", async () => {
      const esperado = {
        medicamento: {
          id: "0194e43e-a6fb-7389-9a74-94c039755ea1",
          principioAtivo: "Amoxicilina",
          apresentacao: "500mg",
          categoria: "ANTIMICROBIANO",
          antimicrobiano: true,
          requerDataReceita: true,
          saldoTotalUbs: 50,
        },
        loteSugerido: null,
        lotesDisponiveis: [],
      };
      obterSugestaoLotesFefoUseCaseMock.execute.mockResolvedValue(esperado);

      const res = await controller.obterLotesFefo(
        "0194e43e-a6fb-7389-9a74-94c039755ea1",
        { unidadeId: "ubs-123" } as any,
      );
      expect(res).toEqual(esperado);
      expect(obterSugestaoLotesFefoUseCaseMock.execute).toHaveBeenCalledWith(
        "0194e43e-a6fb-7389-9a74-94c039755ea1",
        "ubs-123",
      );
    });

    it("deve mapear MedicamentoNaoEncontradoException para NotFoundException (404)", async () => {
      obterSugestaoLotesFefoUseCaseMock.execute.mockRejectedValue(
        new MedicamentoNaoEncontradoException("id-inexistente"),
      );
      await expect(
        controller.obterLotesFefo("0194e43e-a6fb-7389-9a74-94c039755ea1"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
