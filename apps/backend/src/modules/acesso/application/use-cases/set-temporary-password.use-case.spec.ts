import { SetTemporaryPasswordUseCase } from "./set-temporary-password.use-case";
import type { RepositorioUsuarioPort } from "../../domain/ports/user.repository.port";
import type { GeradorHashSenhaPort } from "../../domain/ports/password-hasher.port";
import type { ISessionRepository } from "../../domain/ports/session.repository.port";
import type { AuditRepositoryPort } from "../../domain/ports/audit.repository.port";
import { TipoOperacaoAuditoria } from "@farmaubs/shared";
import {
  SenhaInvalidaException,
  UsuarioNaoEncontradoException,
} from "../../domain/errors/user-management.errors";
import type { UsuarioModeloDominio } from "../../domain/entities/user-registration.entity";

describe("SetTemporaryPasswordUseCase", () => {
  let useCase: SetTemporaryPasswordUseCase;
  let usuarioRepoMock: jest.Mocked<RepositorioUsuarioPort>;
  let passwordHasherMock: jest.Mocked<GeradorHashSenhaPort>;
  let sessionRepoMock: jest.Mocked<ISessionRepository>;
  let auditRepoMock: jest.Mocked<AuditRepositoryPort>;

  const usuarioPadrao: UsuarioModeloDominio = {
    id: "user-alvo-uuid",
    municipioId: "muni-uuid",
    nomeCompleto: "Maria Santos",
    email: "maria@farmaubs.gov.br",
    perfilId: "perfil-farm-uuid",
    ativo: true,
    deveTrocarSenha: false,
    tentativasLoginFalhas: 3,
    bloqueadoAte: new Date(),
    senhaAtualizadaEm: null,
    ultimoLoginEm: null,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  };

  beforeEach(() => {
    usuarioRepoMock = {
      buscarPorId: jest.fn().mockResolvedValue(usuarioPadrao),
      atualizarSenhaProvisoria: jest.fn().mockResolvedValue(undefined),
      buscarUbsIds: jest.fn(),
      atualizarStatus: jest.fn(),
      contarAdministradoresAtivos: jest.fn(),
      buscarPorEmail: jest.fn(),
      existePorEmail: jest.fn(),
      salvar: jest.fn(),
      listar: jest.fn(),
      atualizarDados: jest.fn(),
      atualizarPerfilEUbs: jest.fn(),
    } as unknown as jest.Mocked<RepositorioUsuarioPort>;

    passwordHasherMock = {
      gerarHash: jest
        .fn()
        .mockResolvedValue("$2b$12$hashedPasswordMockedValue"),
      comparar: jest.fn(),
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

    useCase = new SetTemporaryPasswordUseCase(
      usuarioRepoMock,
      passwordHasherMock,
      sessionRepoMock,
      auditRepoMock,
    );
  });

  it("deve redefinir senha provisória com sucesso quando a senha atende à complexidade", async () => {
    await useCase.executar("admin-executor-uuid", "user-alvo-uuid", {
      senhaProvisoria: "SenhaForte#2026",
    });

    expect(passwordHasherMock.gerarHash).toHaveBeenCalledWith(
      "SenhaForte#2026",
    );
    expect(usuarioRepoMock.atualizarSenhaProvisoria).toHaveBeenCalledWith(
      "user-alvo-uuid",
      "$2b$12$hashedPasswordMockedValue",
    );
    expect(sessionRepoMock.revogarTodas).toHaveBeenCalledWith("user-alvo-uuid");
    expect(auditRepoMock.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioExecutorId: "admin-executor-uuid",
        usuarioAlvoId: "user-alvo-uuid",
        tipoOperacao: TipoOperacaoAuditoria.REDEFINICAO_SENHA_PROVISORIA,
        detalhes: {
          deveTrocarSenha: true,
          tentativasResetadas: true,
          sessoesRevogadas: true,
        },
      }),
    );
  });

  it("deve gerar senha forte aleatória e redefinir com sucesso se não for informada no comando", async () => {
    await useCase.executar("admin-executor-uuid", "user-alvo-uuid");

    expect(passwordHasherMock.gerarHash).toHaveBeenCalledWith(
      expect.stringMatching(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$/,
      ),
    );
    expect(usuarioRepoMock.atualizarSenhaProvisoria).toHaveBeenCalled();
    expect(sessionRepoMock.revogarTodas).toHaveBeenCalledWith("user-alvo-uuid");
  });

  it("deve lançar SenhaInvalidaException para senha com menos de 8 caracteres", async () => {
    await expect(
      useCase.executar("admin-executor-uuid", "user-alvo-uuid", {
        senhaProvisoria: "Aa1!abc", // 7 chars
      }),
    ).rejects.toThrow(SenhaInvalidaException);

    expect(passwordHasherMock.gerarHash).not.toHaveBeenCalled();
    expect(sessionRepoMock.revogarTodas).not.toHaveBeenCalled();
  });

  it("deve lançar SenhaInvalidaException para senha sem letra maiúscula", async () => {
    await expect(
      useCase.executar("admin-executor-uuid", "user-alvo-uuid", {
        senhaProvisoria: "senha123#forte",
      }),
    ).rejects.toThrow(SenhaInvalidaException);
  });

  it("deve lançar SenhaInvalidaException para senha sem número", async () => {
    await expect(
      useCase.executar("admin-executor-uuid", "user-alvo-uuid", {
        senhaProvisoria: "SenhaForte#SemNum",
      }),
    ).rejects.toThrow(SenhaInvalidaException);
  });

  it("deve lançar SenhaInvalidaException para senha sem caractere especial", async () => {
    await expect(
      useCase.executar("admin-executor-uuid", "user-alvo-uuid", {
        senhaProvisoria: "SenhaForte1234",
      }),
    ).rejects.toThrow(SenhaInvalidaException);
  });

  it("deve lançar UsuarioNaoEncontradoException se o usuário alvo não existir", async () => {
    usuarioRepoMock.buscarPorId.mockResolvedValue(null);

    await expect(
      useCase.executar("admin-executor-uuid", "user-inexistente", {
        senhaProvisoria: "SenhaForte#2026",
      }),
    ).rejects.toThrow(UsuarioNaoEncontradoException);

    expect(passwordHasherMock.gerarHash).not.toHaveBeenCalled();
  });
});
