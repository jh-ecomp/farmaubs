import { defineFeature, loadFeature } from "jest-cucumber";
import * as path from "path";
import { EditUserUseCase } from "./edit-user.use-case";
import { UpdateAssociationsUseCase } from "./update-associations.use-case";
import { ToggleUserStatusUseCase } from "./toggle-user-status.use-case";
import { SetTemporaryPasswordUseCase } from "./set-temporary-password.use-case";

import type { RepositorioUsuarioPort } from "../../domain/ports/user.repository.port";
import type { RepositorioPerfilPort } from "../../domain/ports/profile.repository.port";
import type { RepositorioUnidadeSaudePort } from "../../domain/ports/health-unit.repository.port";
import type { GeradorHashSenhaPort } from "../../domain/ports/password-hasher.port";
import type { ISessionRepository } from "../../domain/ports/session.repository.port";
import type { AuditRepositoryPort } from "../../domain/ports/audit.repository.port";
import { TipoOperacaoAuditoria } from "@farmaubs/shared";
import {
  AutoInativacaoBloqueadaException,
  IntegridadeTerritorialException,
  SenhaInvalidaException,
  UltimoAdministradorException,
  UsuarioEmailJaExisteException,
} from "../../domain/errors/user-management.errors";
import type {
  PerfilModeloDominio,
  UsuarioModeloDominio,
} from "../../domain/entities/user-registration.entity";

const feature = loadFeature(path.resolve(__dirname, "user-management.feature"));

defineFeature(feature, (test) => {
  let editUserUseCase: EditUserUseCase;
  let updateAssociationsUseCase: UpdateAssociationsUseCase;
  let toggleUserStatusUseCase: ToggleUserStatusUseCase;
  let setTemporaryPasswordUseCase: SetTemporaryPasswordUseCase;

  let usuarioRepoMock: jest.Mocked<RepositorioUsuarioPort>;
  let profileRepoMock: jest.Mocked<RepositorioPerfilPort>;
  let healthUnitRepoMock: jest.Mocked<RepositorioUnidadeSaudePort>;
  let passwordHasherMock: jest.Mocked<GeradorHashSenhaPort>;
  let sessionRepoMock: jest.Mocked<ISessionRepository>;
  let auditRepoMock: jest.Mocked<AuditRepositoryPort>;

  let erroCapturado: any;
  let resultadoOperacao: any;

  const perfilFarmaceutico: PerfilModeloDominio = {
    id: "perfil-farm-uuid",
    codigo: "FARMACEUTICO",
    nome: "Farmacêutico",
    ativo: true,
  };

  const perfilGestor: PerfilModeloDominio = {
    id: "perfil-gestor-uuid",
    codigo: "GESTOR",
    nome: "Gestor",
    ativo: true,
  };

  const perfilAdmin: PerfilModeloDominio = {
    id: "perfil-admin-uuid",
    codigo: "ADMINISTRADOR",
    nome: "Administrador",
    ativo: true,
  };

  const usuarioPadrao: UsuarioModeloDominio = {
    id: "user-1",
    municipioId: "muni-parnaiba-uuid",
    nomeCompleto: "João Silva",
    email: "joao@ubs.gov.br",
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

  beforeEach(() => {
    erroCapturado = null;
    resultadoOperacao = null;

    usuarioRepoMock = {
      buscarPorId: jest.fn().mockResolvedValue(usuarioPadrao),
      buscarPorEmail: jest.fn().mockResolvedValue(null),
      buscarUbsIds: jest.fn().mockResolvedValue(["ubs-central-uuid"]),
      atualizarDados: jest.fn().mockImplementation((id, dados) =>
        Promise.resolve({
          ...usuarioPadrao,
          ...dados,
          atualizadoEm: new Date(),
        }),
      ),
      atualizarPerfilEUbs: jest.fn().mockResolvedValue(undefined),
      atualizarStatus: jest.fn().mockImplementation((id, ativo) =>
        Promise.resolve({
          ...usuarioPadrao,
          ativo,
          atualizadoEm: new Date(),
        }),
      ),
      atualizarSenhaProvisoria: jest.fn().mockResolvedValue(undefined),
      contarAdministradoresAtivos: jest.fn().mockResolvedValue(2),
      existePorEmail: jest.fn().mockResolvedValue(false),
      salvar: jest.fn(),
      listar: jest.fn(),
    } as unknown as jest.Mocked<RepositorioUsuarioPort>;

    profileRepoMock = {
      buscarPorId: jest.fn().mockImplementation((id) => {
        if (id === perfilGestor.id || id === "GESTOR")
          return Promise.resolve(perfilGestor);
        if (id === perfilAdmin.id || id === "ADMINISTRADOR")
          return Promise.resolve(perfilAdmin);
        return Promise.resolve(perfilFarmaceutico);
      }),
      buscarPorCodigoOuNome: jest.fn().mockImplementation((codigo) => {
        if (codigo === "GESTOR") return Promise.resolve(perfilGestor);
        if (codigo === "ADMINISTRADOR") return Promise.resolve(perfilAdmin);
        return Promise.resolve(perfilFarmaceutico);
      }),
    };

    healthUnitRepoMock = {
      buscarIdsExistentes: jest.fn().mockImplementation((ids: string[]) => {
        return Promise.resolve(ids);
      }),
    };

    passwordHasherMock = {
      gerarHash: jest.fn().mockResolvedValue("$2b$12$hashedPasswordCusto12"),
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

    editUserUseCase = new EditUserUseCase(usuarioRepoMock, auditRepoMock);
    updateAssociationsUseCase = new UpdateAssociationsUseCase(
      usuarioRepoMock,
      profileRepoMock,
      healthUnitRepoMock,
      auditRepoMock,
    );
    toggleUserStatusUseCase = new ToggleUserStatusUseCase(
      usuarioRepoMock,
      profileRepoMock,
      sessionRepoMock,
      auditRepoMock,
    );
    setTemporaryPasswordUseCase = new SetTemporaryPasswordUseCase(
      usuarioRepoMock,
      passwordHasherMock,
      sessionRepoMock,
      auditRepoMock,
    );
  });

  // Cenário 1
  test("Edição de dados cadastrais com sucesso", ({
    given,
    when,
    then,
    and,
  }) => {
    given(/^que existe um usuário cadastrado com e-mail "(.*)"$/, (email) => {
      usuarioRepoMock.buscarPorId.mockResolvedValue({
        ...usuarioPadrao,
        email,
      });
    });

    when(
      /^o Administrador atualiza o nome para "(.*)" e o e-mail para "(.*)"$/,
      async (nome, email) => {
        resultadoOperacao = await editUserUseCase.executar(
          "admin-uuid",
          "user-1",
          {
            nomeCompleto: nome,
            email,
          },
        );
      },
    );

    then("os novos dados devem ser persistidos", () => {
      expect(usuarioRepoMock.atualizarDados).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          nomeCompleto: "João Silva Santos",
          email: "joao.santos@ubs.gov.br",
        }),
      );
      expect(resultadoOperacao.nomeCompleto).toBe("João Silva Santos");
      expect(resultadoOperacao.email).toBe("joao.santos@ubs.gov.br");
    });

    and(/^um evento de auditoria "(.*)" deve ser registrado$/, (tipo) => {
      expect(auditRepoMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoOperacao: tipo,
        }),
      );
    });
  });

  // Cenário 2
  test("Rejeição de alteração de e-mail para endereço já existente", ({
    given,
    and,
    when,
    then,
  }) => {
    given(/^que existe um usuário com e-mail "(.*)"$/, (email) => {
      usuarioRepoMock.buscarPorId.mockResolvedValue({
        ...usuarioPadrao,
        id: "user-maria",
        email,
      });
    });

    and(/^outro usuário com e-mail "(.*)"$/, (email) => {
      usuarioRepoMock.buscarPorEmail.mockResolvedValue({
        ...usuarioPadrao,
        id: "outro-usuario",
        email,
      });
    });

    when(
      /^o Administrador tenta alterar o e-mail de "(.*)" para "(.*)"$/,
      async (_origem, destino) => {
        try {
          await editUserUseCase.executar("admin-uuid", "user-maria", {
            email: destino,
          });
        } catch (err) {
          erroCapturado = err;
        }
      },
    );

    then("a operação deve ser rejeitada por conflito de e-mail", () => {
      expect(erroCapturado).toBeInstanceOf(UsuarioEmailJaExisteException);
      expect(usuarioRepoMock.atualizarDados).not.toHaveBeenCalled();
    });
  });

  // Cenário 3
  test("Atualização atômica de perfil e associações de UBSs", ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      /^que existe um usuário vinculado à UBS "(.*)" com perfil "(.*)"$/,
      (_ubs, _perfil) => {
        usuarioRepoMock.buscarPorId.mockResolvedValue(usuarioPadrao);
      },
    );

    when(
      /^o Administrador altera o perfil para "(.*)" e vincula às UBSs "(.*)" e "(.*)"$/,
      async (novoPerfil, ubs1, ubs2) => {
        resultadoOperacao = await updateAssociationsUseCase.executar(
          "admin-uuid",
          "user-1",
          {
            perfilId: novoPerfil,
            ubsIds: [ubs1, ubs2],
          },
        );
      },
    );

    then("as novas associações devem ser sincronizadas", () => {
      expect(usuarioRepoMock.atualizarPerfilEUbs).toHaveBeenCalledWith(
        "user-1",
        perfilGestor.id,
        ["UBS Central", "UBS Norte"],
      );
    });

    and(/^um evento de auditoria "(.*)" deve ser registrado$/, (tipo) => {
      expect(auditRepoMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoOperacao: tipo,
        }),
      );
    });
  });

  // Cenário 4
  test("Rejeição de vínculo a UBS de outro município", ({
    given,
    when,
    then,
  }) => {
    given(
      /^que existe um usuário pertencente ao município "(.*)"$/,
      (_muni) => {
        usuarioRepoMock.buscarPorId.mockResolvedValue(usuarioPadrao);
      },
    );

    when(
      /^o Administrador tenta vincular o usuário a uma UBS do município "(.*)"$/,
      async (_muniAlien) => {
        healthUnitRepoMock.buscarIdsExistentes.mockResolvedValue([]); // UBS não existe no município
        try {
          await updateAssociationsUseCase.executar("admin-uuid", "user-1", {
            perfilId: perfilFarmaceutico.id,
            ubsIds: ["ubs-teresina-uuid"],
          });
        } catch (err) {
          erroCapturado = err;
        }
      },
    );

    then(
      "a operação deve ser rejeitada por violação de integridade territorial",
      () => {
        expect(erroCapturado).toBeInstanceOf(IntegridadeTerritorialException);
        expect(usuarioRepoMock.atualizarPerfilEUbs).not.toHaveBeenCalled();
      },
    );
  });

  // Cenário 5
  test("Inativação de usuário com revogação imediata de sessões", ({
    given,
    when,
    then,
    and,
  }) => {
    given("que existe um usuário ativo com sessões ativas no sistema", () => {
      usuarioRepoMock.buscarPorId.mockResolvedValue({
        ...usuarioPadrao,
        ativo: true,
      });
    });

    when("o Administrador inativa a conta do usuário", async () => {
      resultadoOperacao = await toggleUserStatusUseCase.executar(
        "admin-uuid",
        "user-1",
        { ativo: false },
      );
    });

    then("o status do usuário deve ser alterado para inativo", () => {
      expect(usuarioRepoMock.atualizarStatus).toHaveBeenCalledWith(
        "user-1",
        false,
      );
      expect(resultadoOperacao.ativo).toBe(false);
    });

    and(
      "todas as suas sessões ativas devem ser revogadas imediatamente",
      () => {
        expect(sessionRepoMock.revogarTodas).toHaveBeenCalledWith("user-1");
      },
    );

    and(/^um evento de auditoria "(.*)" deve ser registrado$/, (tipo) => {
      expect(auditRepoMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoOperacao: tipo,
        }),
      );
    });
  });

  // Cenário 6
  test("Bloqueio de auto-inativação pelo administrador", ({
    given,
    when,
    then,
  }) => {
    given(/^que o Administrador está logado com ID "(.*)"$/, (_adminId) => {
      // Mock do usuário logado
      usuarioRepoMock.buscarPorId.mockResolvedValue({
        ...usuarioPadrao,
        id: "admin-1",
      });
    });

    when(/^ele tenta inativar a própria conta "(.*)"$/, async (alvoId) => {
      try {
        await toggleUserStatusUseCase.executar("admin-1", alvoId, {
          ativo: false,
        });
      } catch (err) {
        erroCapturado = err;
      }
    });

    then("a operação deve ser bloqueada", () => {
      expect(erroCapturado).toBeInstanceOf(AutoInativacaoBloqueadaException);
      expect(usuarioRepoMock.atualizarStatus).not.toHaveBeenCalled();
    });
  });

  // Cenário 7
  test("Trava do último administrador ativo", ({ given, when, then }) => {
    given("que existe apenas um administrador ativo no sistema", () => {
      usuarioRepoMock.buscarPorId.mockResolvedValue({
        ...usuarioPadrao,
        id: "ultimo-admin",
        perfilId: perfilAdmin.id,
      });
      usuarioRepoMock.contarAdministradoresAtivos.mockResolvedValue(1);
    });

    when("é feita uma tentativa de inativar esse administrador", async () => {
      try {
        await toggleUserStatusUseCase.executar(
          "outro-executor",
          "ultimo-admin",
          {
            ativo: false,
          },
        );
      } catch (err) {
        erroCapturado = err;
      }
    });

    then("a operação deve ser rejeitada por ser o último administrador", () => {
      expect(erroCapturado).toBeInstanceOf(UltimoAdministradorException);
      expect(usuarioRepoMock.atualizarStatus).not.toHaveBeenCalled();
    });
  });

  // Cenário 8
  test("Redefinição de senha provisória com reset de bloqueios", ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      "que existe um usuário com conta bloqueada após tentativas falhas",
      () => {
        usuarioRepoMock.buscarPorId.mockResolvedValue({
          ...usuarioPadrao,
          tentativasLoginFalhas: 5,
          bloqueadoAte: new Date(),
        });
      },
    );

    when(
      /^o Administrador define uma nova senha provisória "(.*)"$/,
      async (senha) => {
        await setTemporaryPasswordUseCase.executar("admin-uuid", "user-1", {
          senhaProvisoria: senha,
        });
      },
    );

    then("a nova senha deve ser hasheada com BCrypt custo 12", () => {
      expect(passwordHasherMock.gerarHash).toHaveBeenCalledWith(
        "SenhaForte#2026",
      );
      expect(usuarioRepoMock.atualizarSenhaProvisoria).toHaveBeenCalledWith(
        "user-1",
        "$2b$12$hashedPasswordCusto12",
      );
    });

    and("a flag deve_trocar_senha deve ser marcada como verdadeira", () => {
      expect(usuarioRepoMock.atualizarSenhaProvisoria).toHaveBeenCalled();
    });

    and("o bloqueio da conta deve ser removido", () => {
      expect(usuarioRepoMock.atualizarSenhaProvisoria).toHaveBeenCalled();
    });

    and("todas as sessões ativas do usuário devem ser revogadas", () => {
      expect(sessionRepoMock.revogarTodas).toHaveBeenCalledWith("user-1");
    });

    and(/^um evento de auditoria "(.*)" deve ser registrado$/, (tipo) => {
      expect(auditRepoMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoOperacao: tipo,
        }),
      );
    });
  });

  // Cenário 9
  test("Rejeição de senha provisória fraca", ({ given, when, then }) => {
    given("que existe um usuário cadastrado no sistema", () => {
      usuarioRepoMock.buscarPorId.mockResolvedValue(usuarioPadrao);
    });

    when(
      /^o Administrador tenta definir a senha provisória "(.*)"$/,
      async (senhaFraca) => {
        try {
          await setTemporaryPasswordUseCase.executar("admin-uuid", "user-1", {
            senhaProvisoria: senhaFraca,
          });
        } catch (err) {
          erroCapturado = err;
        }
      },
    );

    then(
      "a operação deve ser rejeitada por não atender aos requisitos de complexidade",
      () => {
        expect(erroCapturado).toBeInstanceOf(SenhaInvalidaException);
        expect(passwordHasherMock.gerarHash).not.toHaveBeenCalled();
        expect(usuarioRepoMock.atualizarSenhaProvisoria).not.toHaveBeenCalled();
      },
    );
  });
});
