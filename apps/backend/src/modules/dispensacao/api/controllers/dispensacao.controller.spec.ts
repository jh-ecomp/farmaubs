import { Reflector } from "@nestjs/core";
import { BadRequestException } from "@nestjs/common";
import { PerfilCodigo } from "@farmaubs/shared";
import { DispensacaoController } from "./dispensacao.controller";
import { EfetivarDispensacaoUseCase } from "../../application/use-cases/efetivar-dispensacao.use-case";
import { TenantContextService } from "../../../../common/tenant/tenant-context.service";
import {
  ReceitaAntimicrobianoVencidaException,
  SaldoInsuficienteLoteException,
} from "../../domain/errors/dispensacao.errors";
import { ROLES_KEY } from "../../../../common/decorators/roles.decorator";

describe("DispensacaoController (Camada C - REST e RBAC)", () => {
  let controller: DispensacaoController;
  let efetivarUseCaseMock: jest.Mocked<EfetivarDispensacaoUseCase>;
  let tenantContextMock: jest.Mocked<TenantContextService>;
  const reflector = new Reflector();

  const municipioIdMock = "0194e43e-a6fb-7389-9a74-94c039755ef0";

  beforeEach(() => {
    efetivarUseCaseMock = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<EfetivarDispensacaoUseCase>;

    tenantContextMock = {
      getMunicipioId: jest.fn().mockReturnValue(municipioIdMock),
    } as unknown as jest.Mocked<TenantContextService>;

    controller = new DispensacaoController(
      efetivarUseCaseMock,
      tenantContextMock,
    );
  });

  describe("Metadados RBAC (@Roles)", () => {
    it("POST /dispensacoes deve permitir FARMACEUTICO_RESPONSAVEL, FARMACEUTICO_RESIDENTE e ADMINISTRADOR", () => {
      const roles = reflector.get<string[]>(ROLES_KEY, controller.efetivar);
      expect(roles).toEqual([
        PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
        PerfilCodigo.FARMACEUTICO_RESIDENTE,
        PerfilCodigo.ADMINISTRADOR,
      ]);
    });
  });

  describe("POST /dispensacoes", () => {
    const dtoMock = {
      paciente: {
        cns: "123456789012345",
        cpf: "12345678909",
        nomeCompleto: "Carlos Silva",
        dataNascimento: "1990-01-01",
      },
      itens: [
        {
          medicamentoId: "0194e43e-a6fb-7389-9a74-94c039755ea1",
          loteId: "0194e43e-a6fb-7389-9a74-94c039755eb1",
          quantidadeDispensada: 20,
        },
      ],
    };

    it("deve efetivar a dispensação extraindo escopo do usuário autenticado", async () => {
      const esperado = {
        id: "disp-1",
        numeroAtendimento: "DISP-1",
        dataAtendimento: new Date(),
        status: "concluida" as const,
        paciente: {
          id: "pac-1",
          nomeCompleto: "Carlos Silva",
          cpf: "12345678909",
          cns: "123456789012345",
        },
        dispensador: {
          id: "user-1",
          nomeCompleto: "Farmacêutico",
        },
        itens: [],
      };
      efetivarUseCaseMock.execute.mockResolvedValue(esperado);

      const res = await controller.efetivar(dtoMock, {
        id: "user-1",
        municipioId: municipioIdMock,
        unidadeId: "ubs-1",
      } as any);

      expect(res).toEqual(esperado);
      expect(efetivarUseCaseMock.execute).toHaveBeenCalledWith(dtoMock, {
        municipioId: municipioIdMock,
        unidadeId: "ubs-1",
        dispensadorId: "user-1",
        dispensadorNome: undefined,
      });
    });

    it("deve mapear ReceitaAntimicrobianoVencidaException e SaldoInsuficienteLoteException para BadRequestException (400)", async () => {
      efetivarUseCaseMock.execute.mockRejectedValue(
        new ReceitaAntimicrobianoVencidaException(),
      );
      await expect(
        controller.efetivar(dtoMock, {
          id: "user-1",
          municipioId: municipioIdMock,
          unidadeId: "ubs-1",
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      efetivarUseCaseMock.execute.mockRejectedValue(
        new SaldoInsuficienteLoteException("LOT-01", 10, 15),
      );
      await expect(
        controller.efetivar(dtoMock, {
          id: "user-1",
          municipioId: municipioIdMock,
          unidadeId: "ubs-1",
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

