import { EditUserUseCase } from "./edit-user.use-case";
import type { RepositorioUsuarioPort } from "../../domain/ports/user.repository.port";
import type { AuditRepositoryPort } from "../../domain/ports/audit.repository.port";
import { TipoOperacaoAuditoria } from "@farmaubs/shared";
import {
  UsuarioEmailJaExisteException,
  UsuarioNaoEncontradoException,
} from "../../domain/errors/user-management.errors";
import type { UsuarioModeloDominio } from "../../domain/entities/user-registration.entity";

describe("EditUserUseCase", () => {
  let useCase: EditUserUseCase;
  let usuarioRepoMock: jest.Mocked<RepositorioUsuarioPort>;
  let auditRepoMock: jest.Mocked<AuditRepositoryPort>;

  const usuarioExistente: UsuarioModeloDominio = {
    id: "alvo-uuid-1",
    municipioId: "muni-uuid-1",
    nomeCompleto: "Nome Antigo",
    email: "antigo@farmaubs.gov.br",
    perfilId: "perfil-farmaceutico-uuid",
    ativo: true,
    deveTrocarSenha: false,
    tentativasLoginFalhas: 0,
    bloqueadoAte: null,
    senhaAtualizadaEm: null,
    ultimoLoginEm: null,
    criadoEm: new Date("2026-01-01"),
    atualizadoEm: new Date("2026-01-01"),
  };

  beforeEach(() => {
    usuarioRepoMock = {
      buscarPorId: jest.fn(),
      buscarPorEmail: jest.fn(),
      buscarUbsIds: jest.fn().mockResolvedValue(["ubs-1", "ubs-2"]),
      atualizarDados: jest.fn(),
      atualizarPerfilEUbs: jest.fn(),
      atualizarStatus: jest.fn(),
      atualizarSenhaProvisoria: jest.fn(),
      contarAdministradoresAtivos: jest.fn(),
      existePorEmail: jest.fn(),
      salvar: jest.fn(),
      listar: jest.fn(),
    } as unknown as jest.Mocked<RepositorioUsuarioPort>;

    auditRepoMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new EditUserUseCase(usuarioRepoMock, auditRepoMock);
  });

  it("deve atualizar nome e email com sucesso e gravar auditoria transacional", async () => {
    usuarioRepoMock.buscarPorId.mockResolvedValue(usuarioExistente);
    usuarioRepoMock.buscarPorEmail.mockResolvedValue(null);
    usuarioRepoMock.atualizarDados.mockResolvedValue({
      ...usuarioExistente,
      nomeCompleto: "Nome Novo",
      email: "novo@farmaubs.gov.br",
      atualizadoEm: new Date("2026-02-01"),
    });

    const resultado = await useCase.executar(
      "admin-executor-uuid",
      "alvo-uuid-1",
      {
        nomeCompleto: "Nome Novo",
        email: "novo@farmaubs.gov.br",
      },
    );

    expect(resultado.id).toBe("alvo-uuid-1");
    expect(resultado.nomeCompleto).toBe("Nome Novo");
    expect(resultado.email).toBe("novo@farmaubs.gov.br");
    expect(resultado.ubsIds).toEqual(["ubs-1", "ubs-2"]);

    expect(auditRepoMock.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioExecutorId: "admin-executor-uuid",
        usuarioAlvoId: "alvo-uuid-1",
        tipoOperacao: TipoOperacaoAuditoria.EDICAO_DADOS,
        detalhes: {
          antes: {
            nomeCompleto: "Nome Antigo",
            email: "antigo@farmaubs.gov.br",
          },
          depois: {
            nomeCompleto: "Nome Novo",
            email: "novo@farmaubs.gov.br",
          },
        },
      }),
    );
  });

  it("deve lançar UsuarioNaoEncontradoException quando o usuário alvo não existir", async () => {
    usuarioRepoMock.buscarPorId.mockResolvedValue(null);

    await expect(
      useCase.executar("admin-executor-uuid", "alvo-inexistente", {
        nomeCompleto: "Teste",
      }),
    ).rejects.toThrow(UsuarioNaoEncontradoException);

    expect(usuarioRepoMock.atualizarDados).not.toHaveBeenCalled();
    expect(auditRepoMock.registrar).not.toHaveBeenCalled();
  });

  it("deve lançar UsuarioEmailJaExisteException se novo e-mail pertencer a outro usuário", async () => {
    usuarioRepoMock.buscarPorId.mockResolvedValue(usuarioExistente);
    usuarioRepoMock.buscarPorEmail.mockResolvedValue({
      ...usuarioExistente,
      id: "outro-usuario-uuid",
      email: "conflito@farmaubs.gov.br",
    });

    await expect(
      useCase.executar("admin-executor-uuid", "alvo-uuid-1", {
        email: "conflito@farmaubs.gov.br",
      }),
    ).rejects.toThrow(UsuarioEmailJaExisteException);

    expect(usuarioRepoMock.atualizarDados).not.toHaveBeenCalled();
    expect(auditRepoMock.registrar).not.toHaveBeenCalled();
  });

  it("não deve lançar conflito se o e-mail informado for idêntico ao já cadastrado para o próprio usuário", async () => {
    usuarioRepoMock.buscarPorId.mockResolvedValue(usuarioExistente);
    usuarioRepoMock.atualizarDados.mockResolvedValue({
      ...usuarioExistente,
      nomeCompleto: "Nome Atualizado",
    });

    const resultado = await useCase.executar(
      "admin-executor-uuid",
      "alvo-uuid-1",
      {
        nomeCompleto: "Nome Atualizado",
        email: "antigo@farmaubs.gov.br",
      },
    );

    expect(usuarioRepoMock.buscarPorEmail).not.toHaveBeenCalled();
    expect(resultado.nomeCompleto).toBe("Nome Atualizado");
  });
});
