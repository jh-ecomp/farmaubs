import { Reflector } from "@nestjs/core";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { PerfilCodigo } from "@farmaubs/shared";
import { PacienteController } from "./paciente.controller";
import { CadastrarPacienteUseCase } from "../../application/use-cases/cadastrar-paciente.use-case";
import { BuscarPacientesUseCase } from "../../application/use-cases/buscar-pacientes.use-case";
import { ConsultarHistoricoPacienteUseCase } from "../../application/use-cases/consultar-historico-paciente.use-case";
import { TenantContextService } from "../../../../common/tenant/tenant-context.service";
import {
  CnsInvalidoException,
  CpfInvalidoException,
  DadosPacienteInvalidosException,
  PacienteJaCadastradoException,
  PacienteNaoEncontradoException,
} from "../../domain/errors/paciente.errors";
import { ROLES_KEY } from "../../../../common/decorators/roles.decorator";

describe("PacienteController (Camada C - REST e RBAC)", () => {
  let controller: PacienteController;
  let cadastrarUseCaseMock: jest.Mocked<CadastrarPacienteUseCase>;
  let buscarUseCaseMock: jest.Mocked<BuscarPacientesUseCase>;
  let consultarHistoricoUseCaseMock: jest.Mocked<ConsultarHistoricoPacienteUseCase>;
  let tenantContextMock: jest.Mocked<TenantContextService>;
  const reflector = new Reflector();

  const municipioIdMock = "0194e43e-a6fb-7389-9a74-94c039755ef0";

  beforeEach(() => {
    cadastrarUseCaseMock = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<CadastrarPacienteUseCase>;

    buscarUseCaseMock = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<BuscarPacientesUseCase>;

    consultarHistoricoUseCaseMock = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ConsultarHistoricoPacienteUseCase>;

    tenantContextMock = {
      getMunicipioId: jest.fn().mockReturnValue(municipioIdMock),
    } as unknown as jest.Mocked<TenantContextService>;

    controller = new PacienteController(
      cadastrarUseCaseMock,
      buscarUseCaseMock,
      consultarHistoricoUseCaseMock,
      tenantContextMock,
    );
  });

  describe("Metadados RBAC (@Roles)", () => {
    it("POST /dispensacao/pacientes deve permitir FARMACEUTICO_RESPONSAVEL, FARMACEUTICO_RESIDENTE e ADMINISTRADOR", () => {
      const roles = reflector.get<string[]>(ROLES_KEY, controller.cadastrar);
      expect(roles).toEqual([
        PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
        PerfilCodigo.FARMACEUTICO_RESIDENTE,
        PerfilCodigo.ADMINISTRADOR,
      ]);
    });

    it("GET /dispensacao/pacientes deve permitir FARMACEUTICO_RESPONSAVEL, FARMACEUTICO_RESIDENTE, GERENTE e ADMINISTRADOR", () => {
      const roles = reflector.get<string[]>(ROLES_KEY, controller.buscar);
      expect(roles).toEqual([
        PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
        PerfilCodigo.FARMACEUTICO_RESIDENTE,
        PerfilCodigo.GERENTE,
        PerfilCodigo.ADMINISTRADOR,
      ]);
    });

    it("GET /dispensacao/pacientes/:id/historico deve permitir FARMACEUTICO_RESPONSAVEL, FARMACEUTICO_RESIDENTE, GERENTE e ADMINISTRADOR", () => {
      const roles = reflector.get<string[]>(ROLES_KEY, controller.consultarHistorico);
      expect(roles).toEqual([
        PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
        PerfilCodigo.FARMACEUTICO_RESIDENTE,
        PerfilCodigo.GERENTE,
        PerfilCodigo.ADMINISTRADOR,
      ]);
    });
  });

  describe("POST /dispensacao/pacientes", () => {
    const dtoMock = {
      cns: "123456789012345",
      cpf: "12345678909",
      nomeCompleto: "Maria Souza",
      dataNascimento: "1985-04-12",
    };

    it("deve cadastrar paciente com sucesso", async () => {
      const esperado = {
        id: "paciente-uuid",
        municipioId: municipioIdMock,
        ...dtoMock,
        ativo: true,
        criadoEm: new Date(),
      };
      cadastrarUseCaseMock.execute.mockResolvedValue(esperado);

      const res = await controller.cadastrar(dtoMock, {
        userId: "user-1",
        municipioId: municipioIdMock,
        roles: [PerfilCodigo.FARMACEUTICO_RESPONSAVEL],
      } as any);

      expect(res).toEqual(esperado);
      expect(cadastrarUseCaseMock.execute).toHaveBeenCalledWith(dtoMock, municipioIdMock);
    });

    it("deve lançar BadRequestException se municipioId não for resolvido", async () => {
      tenantContextMock.getMunicipioId.mockReturnValue(null);
      await expect(controller.cadastrar(dtoMock, undefined)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("deve mapear erros de validação clínica para BadRequestException", async () => {
      cadastrarUseCaseMock.execute.mockRejectedValue(new CpfInvalidoException("CPF inválido"));
      await expect(
        controller.cadastrar(dtoMock, { municipioId: municipioIdMock } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      cadastrarUseCaseMock.execute.mockRejectedValue(new CnsInvalidoException("CNS inválido"));
      await expect(
        controller.cadastrar(dtoMock, { municipioId: municipioIdMock } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      cadastrarUseCaseMock.execute.mockRejectedValue(
        new DadosPacienteInvalidosException("Dados inválidos"),
      );
      await expect(
        controller.cadastrar(dtoMock, { municipioId: municipioIdMock } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("deve mapear PacienteJaCadastradoException para ConflictException (409)", async () => {
      cadastrarUseCaseMock.execute.mockRejectedValue(
        new PacienteJaCadastradoException("Paciente já cadastrado"),
      );
      await expect(
        controller.cadastrar(dtoMock, { municipioId: municipioIdMock } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("GET /dispensacao/pacientes", () => {
    it("deve delegar busca para o caso de uso", async () => {
      buscarUseCaseMock.execute.mockResolvedValue([]);
      const res = await controller.buscar({ termo: "Maria" });
      expect(res).toEqual([]);
      expect(buscarUseCaseMock.execute).toHaveBeenCalledWith("Maria");
    });
  });

  describe("GET /dispensacao/pacientes/:id/historico", () => {
    it("deve retornar histórico retornado pelo caso de uso", async () => {
      const historicoMock = {
        paciente: {
          id: "paciente-1",
          municipioId: municipioIdMock,
          cns: "123456789012345",
          cpf: "12345678909",
          nomeCompleto: "Maria Souza",
          dataNascimento: "1985-04-12",
          ativo: true,
          criadoEm: new Date(),
        },
        itensConsumo: [],
      };
      consultarHistoricoUseCaseMock.execute.mockResolvedValue(historicoMock);

      const res = await controller.consultarHistorico("0194e43e-a6fb-7389-9a74-94c039755ef0");
      expect(res).toEqual(historicoMock);
    });

    it("deve mapear PacienteNaoEncontradoException para NotFoundException (404)", async () => {
      consultarHistoricoUseCaseMock.execute.mockRejectedValue(
        new PacienteNaoEncontradoException("paciente-inexistente"),
      );
      await expect(
        controller.consultarHistorico("0194e43e-a6fb-7389-9a74-94c039755ef0"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

