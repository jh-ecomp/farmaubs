import { UpdateAssociationsUseCase } from "./update-associations.use-case";
import type { RepositorioUsuarioPort } from "../../domain/ports/user.repository.port";
import type { RepositorioPerfilPort } from "../../domain/ports/profile.repository.port";
import type { RepositorioUnidadeSaudePort } from "../../domain/ports/health-unit.repository.port";
import type { AuditRepositoryPort } from "../../domain/ports/audit.repository.port";
import { TipoOperacaoAuditoria } from "@farmaubs/shared";
import {
  IntegridadeTerritorialException,
  PerfilNaoEncontradoException,
  UltimoAdministradorException,
  UnidadeSaudeInvalidaException,
  UsuarioNaoEncontradoException,
} from "../../domain/errors/user-management.errors";
import type {
  PerfilModeloDominio,
  UsuarioModeloDominio,
} from "../../domain/entities/user-registration.entity";

describe("UpdateAssociationsUseCase", () => {
  let useCase: UpdateAssociationsUseCase;
  let usuarioRepoMock: jest.Mocked<RepositorioUsuarioPort>;
  let profileRepoMock: jest.Mocked<RepositorioPerfilPort>;
  let healthUnitRepoMock: jest.Mocked<RepositorioUnidadeSaudePort>;
  let auditRepoMock: jest.Mocked<AuditRepositoryPort>;

  const perfilAdmin: PerfilModeloDominio = {
    id: "perfil-admin-uuid",
    codigo: "ADMINISTRADOR",
    nome: "Administrador",
    ativo: true,
  };

  const perfilFarmaceutico: PerfilModeloDominio = {
    id: "perfil-farmaceutico-uuid",
    codigo: "FARMACEUTICO",
    nome: "Farmacêutico",
    ativo: true,
  };

  const usuarioPadrao: UsuarioModeloDominio = {
    id: "user-alvo-uuid",
    municipioId: "muni-sp-uuid",
    nomeCompleto: "João Silva",
    email: "joao@farmaubs.gov.br",
    perfilId: perfilAdmin.id,
    ativo: true,
    deveTrocarSenha: false,
    tentativasLoginFalhas: 0,
    bloqueadoAte: null,
    senhaAtualizadaEm: null,
    ultimoLoginEm: null,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  };

  beforeEach(() => {
    usuarioRepoMock = {
      buscarPorId: jest.fn().mockResolvedValue(usuarioPadrao),
      buscarUbsIds: jest.fn().mockResolvedValue(["ubs-1"]),
      atualizarPerfilEUbs: jest.fn().mockResolvedValue(undefined),
      contarAdministradoresAtivos: jest.fn().mockResolvedValue(2),
      buscarPorEmail: jest.fn(),
      existePorEmail: jest.fn(),
      salvar: jest.fn(),
      listar: jest.fn(),
      atualizarDados: jest.fn(),
      atualizarStatus: jest.fn(),
      atualizarSenhaProvisoria: jest.fn(),
    } as unknown as jest.Mocked<RepositorioUsuarioPort>;

    profileRepoMock = {
      buscarPorId: jest.fn().mockImplementation((id: string) => {
        if (id === perfilAdmin.id) return Promise.resolve(perfilAdmin);
        if (id === perfilFarmaceutico.id)
          return Promise.resolve(perfilFarmaceutico);
        return Promise.resolve(null);
      }),
      buscarPorCodigoOuNome: jest.fn().mockResolvedValue(null),
    };

    healthUnitRepoMock = {
      buscarIdsExistentes: jest.fn().mockResolvedValue(["ubs-1", "ubs-2"]),
    };

    auditRepoMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new UpdateAssociationsUseCase(
      usuarioRepoMock,
      profileRepoMock,
      healthUnitRepoMock,
      auditRepoMock,
    );
  });

  it("deve atualizar perfil e UBSs com sucesso e registrar auditoria transacional", async () => {
    const comando = {
      perfilId: perfilFarmaceutico.id,
      ubsIds: ["ubs-1", "ubs-2"],
    };

    const resultado = await useCase.executar(
      "admin-executor-uuid",
      "user-alvo-uuid",
      comando,
    );

    expect(usuarioRepoMock.atualizarPerfilEUbs).toHaveBeenCalledWith(
      "user-alvo-uuid",
      perfilFarmaceutico.id,
      ["ubs-1", "ubs-2"],
    );

    expect(auditRepoMock.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioExecutorId: "admin-executor-uuid",
        usuarioAlvoId: "user-alvo-uuid",
        tipoOperacao: TipoOperacaoAuditoria.MUDANCA_PERFIL_UBSS,
        detalhes: {
          antes: {
            perfilId: perfilAdmin.id,
            ubsIds: ["ubs-1"],
          },
          depois: {
            perfilId: perfilFarmaceutico.id,
            ubsIds: ["ubs-1", "ubs-2"],
          },
        },
      }),
    );

    expect(resultado.ubsIds).toEqual(["ubs-1", "ubs-2"]);
  });

  it("deve lançar UsuarioNaoEncontradoException se o usuário alvo não existir", async () => {
    usuarioRepoMock.buscarPorId.mockResolvedValue(null);

    await expect(
      useCase.executar("admin-executor-uuid", "user-inexistente", {
        perfilId: perfilFarmaceutico.id,
        ubsIds: ["ubs-1"],
      }),
    ).rejects.toThrow(UsuarioNaoEncontradoException);
  });

  it("deve lançar UnidadeSaudeInvalidaException se a lista de UBSs estiver vazia", async () => {
    await expect(
      useCase.executar("admin-executor-uuid", "user-alvo-uuid", {
        perfilId: perfilFarmaceutico.id,
        ubsIds: [],
      }),
    ).rejects.toThrow(UnidadeSaudeInvalidaException);
  });

  it("deve lançar PerfilNaoEncontradoException se o perfil não existir", async () => {
    profileRepoMock.buscarPorId.mockResolvedValue(null);
    profileRepoMock.buscarPorCodigoOuNome.mockResolvedValue(null);

    await expect(
      useCase.executar("admin-executor-uuid", "user-alvo-uuid", {
        perfilId: "perfil-fantasma",
        ubsIds: ["ubs-1"],
      }),
    ).rejects.toThrow(PerfilNaoEncontradoException);
  });

  it("deve lançar IntegridadeTerritorialException se alguma UBS for de outro município", async () => {
    healthUnitRepoMock.buscarIdsExistentes.mockResolvedValue(["ubs-1"]); // ubs-alienigena não retornou

    await expect(
      useCase.executar("admin-executor-uuid", "user-alvo-uuid", {
        perfilId: perfilFarmaceutico.id,
        ubsIds: ["ubs-1", "ubs-alienigena"],
      }),
    ).rejects.toThrow(IntegridadeTerritorialException);

    expect(usuarioRepoMock.atualizarPerfilEUbs).not.toHaveBeenCalled();
  });

  it("deve lançar UltimoAdministradorException se tentar rebaixar o único administrador ativo", async () => {
    usuarioRepoMock.contarAdministradoresAtivos.mockResolvedValue(1); // Apenas 1 admin ativo!

    await expect(
      useCase.executar("admin-executor-uuid", "user-alvo-uuid", {
        perfilId: perfilFarmaceutico.id,
        ubsIds: ["ubs-1"],
      }),
    ).rejects.toThrow(UltimoAdministradorException);

    expect(usuarioRepoMock.atualizarPerfilEUbs).not.toHaveBeenCalled();
  });
});
