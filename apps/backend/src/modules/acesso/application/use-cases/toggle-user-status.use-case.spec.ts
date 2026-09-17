import { ToggleUserStatusUseCase } from "./toggle-user-status.use-case";
import type { RepositorioUsuarioPort } from "../../domain/ports/user.repository.port";
import type { RepositorioPerfilPort } from "../../domain/ports/profile.repository.port";
import type { ISessionRepository } from "../../domain/ports/session.repository.port";
import type { AuditRepositoryPort } from "../../domain/ports/audit.repository.port";
import { TipoOperacaoAuditoria } from "@farmaubs/shared";
import {
  AutoInativacaoBloqueadaException,
  UltimoAdministradorException,
  UsuarioNaoEncontradoException,
} from "../../domain/errors/user-management.errors";
import type {
  PerfilModeloDominio,
  UsuarioModeloDominio,
} from "../../domain/entities/user-registration.entity";

describe("ToggleUserStatusUseCase", () => {
  let useCase: ToggleUserStatusUseCase;
  let usuarioRepoMock: jest.Mocked<RepositorioUsuarioPort>;
  let profileRepoMock: jest.Mocked<RepositorioPerfilPort>;
  let sessionRepoMock: jest.Mocked<ISessionRepository>;
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

  const usuarioComum: UsuarioModeloDominio = {
    id: "user-farmaceutico-uuid",
    municipioId: "muni-uuid",
    nomeCompleto: "Farmacêutico Teste",
    email: "farm@farmaubs.gov.br",
    perfilId: perfilFarmaceutico.id,
    ativo: true,
    deveTrocarSenha: false,
    tentativasLoginFalhas: 0,
    bloqueadoAte: null,
    senhaAtualizadaEm: null,
    ultimoLoginEm: null,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  };

  const usuarioAdmin: UsuarioModeloDominio = {
    id: "user-admin-alvo-uuid",
    municipioId: "muni-uuid",
    nomeCompleto: "Admin Alvo Teste",
    email: "admin2@farmaubs.gov.br",
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
      buscarPorId: jest.fn().mockResolvedValue(usuarioComum),
      buscarUbsIds: jest.fn().mockResolvedValue(["ubs-1"]),
      atualizarStatus: jest
        .fn()
        .mockImplementation((id: string, ativo: boolean) =>
          Promise.resolve({
            ...usuarioComum,
            id,
            ativo,
          }),
        ),
      contarAdministradoresAtivos: jest.fn().mockResolvedValue(2),
      buscarPorEmail: jest.fn(),
      existePorEmail: jest.fn(),
      salvar: jest.fn(),
      listar: jest.fn(),
      atualizarDados: jest.fn(),
      atualizarPerfilEUbs: jest.fn(),
      atualizarSenhaProvisoria: jest.fn(),
    } as unknown as jest.Mocked<RepositorioUsuarioPort>;

    profileRepoMock = {
      buscarPorId: jest.fn().mockImplementation((id: string) => {
        if (id === perfilAdmin.id) return Promise.resolve(perfilAdmin);
        return Promise.resolve(perfilFarmaceutico);
      }),
      buscarPorCodigoOuNome: jest.fn(),
    };

    sessionRepoMock = {
      revogarTodas: jest.fn().mockResolvedValue(undefined),
      revogar: jest.fn(),
      buscarPorTokenHash: jest.fn(),
      renovarAtividade: jest.fn(),
    };

    auditRepoMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new ToggleUserStatusUseCase(
      usuarioRepoMock,
      profileRepoMock,
      sessionRepoMock,
      auditRepoMock,
    );
  });

  it("deve inativar usuário comum com sucesso, revogando todas as sessões e registrando auditoria", async () => {
    const resultado = await useCase.executar(
      "admin-executor-uuid",
      "user-farmaceutico-uuid",
      { ativo: false },
    );

    expect(resultado.ativo).toBe(false);
    expect(usuarioRepoMock.atualizarStatus).toHaveBeenCalledWith(
      "user-farmaceutico-uuid",
      false,
    );
    expect(sessionRepoMock.revogarTodas).toHaveBeenCalledWith(
      "user-farmaceutico-uuid",
    );
    expect(auditRepoMock.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioExecutorId: "admin-executor-uuid",
        usuarioAlvoId: "user-farmaceutico-uuid",
        tipoOperacao: TipoOperacaoAuditoria.INATIVACAO,
        detalhes: {
          statusAnterior: true,
          statusNovo: false,
        },
      }),
    );
  });

  it("deve reativar usuário com sucesso sem revogar sessões e registrando auditoria", async () => {
    usuarioRepoMock.buscarPorId.mockResolvedValue({
      ...usuarioComum,
      ativo: false,
    });

    const resultado = await useCase.executar(
      "admin-executor-uuid",
      "user-farmaceutico-uuid",
      { ativo: true },
    );

    expect(resultado.ativo).toBe(true);
    expect(sessionRepoMock.revogarTodas).not.toHaveBeenCalled();
    expect(auditRepoMock.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoOperacao: TipoOperacaoAuditoria.REATIVACAO,
        detalhes: {
          statusAnterior: false,
          statusNovo: true,
        },
      }),
    );
  });

  it("deve bloquear auto-inativação do próprio usuário logado", async () => {
    await expect(
      useCase.executar("mesmo-uuid", "mesmo-uuid", { ativo: false }),
    ).rejects.toThrow(AutoInativacaoBloqueadaException);

    expect(usuarioRepoMock.atualizarStatus).not.toHaveBeenCalled();
    expect(sessionRepoMock.revogarTodas).not.toHaveBeenCalled();
  });

  it("deve bloquear inativação do único administrador ativo", async () => {
    usuarioRepoMock.buscarPorId.mockResolvedValue(usuarioAdmin);
    usuarioRepoMock.contarAdministradoresAtivos.mockResolvedValue(1);

    await expect(
      useCase.executar("admin-executor-uuid", "user-admin-alvo-uuid", {
        ativo: false,
      }),
    ).rejects.toThrow(UltimoAdministradorException);

    expect(usuarioRepoMock.atualizarStatus).not.toHaveBeenCalled();
    expect(sessionRepoMock.revogarTodas).not.toHaveBeenCalled();
  });

  it("deve permitir inativar administrador se houver mais de um administrador ativo", async () => {
    usuarioRepoMock.buscarPorId.mockResolvedValue(usuarioAdmin);
    usuarioRepoMock.contarAdministradoresAtivos.mockResolvedValue(2);

    const resultado = await useCase.executar(
      "admin-executor-uuid",
      "user-admin-alvo-uuid",
      { ativo: false },
    );

    expect(resultado.ativo).toBe(false);
    expect(sessionRepoMock.revogarTodas).toHaveBeenCalledWith(
      "user-admin-alvo-uuid",
    );
  });

  it("deve lançar UsuarioNaoEncontradoException se o usuário alvo não existir", async () => {
    usuarioRepoMock.buscarPorId.mockResolvedValue(null);

    await expect(
      useCase.executar("admin-executor-uuid", "user-inexistente", {
        ativo: false,
      }),
    ).rejects.toThrow(UsuarioNaoEncontradoException);
  });
});
