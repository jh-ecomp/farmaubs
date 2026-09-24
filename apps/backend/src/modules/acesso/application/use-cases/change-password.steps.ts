import { defineFeature, loadFeature } from "jest-cucumber";
import * as path from "path";
import { ChangePasswordUseCase } from "./change-password.use-case";
import type { RepositorioUsuarioPort } from "../../domain/ports/user.repository.port";
import type { GeradorHashSenhaPort } from "../../domain/ports/password-hasher.port";
import type { AuditRepositoryPort } from "../../domain/ports/audit.repository.port";
import {
  ConfirmacaoSenhaDivergenteException,
  NovaSenhaNaoPodeSerIgualProvisoriaException,
  SenhaFracaException,
} from "../../domain/errors/password.errors";
import type { UsuarioModeloDominio } from "../../domain/entities/user-registration.entity";
import type { TrocarSenhaResultado } from "@farmaubs/shared";

const feature = loadFeature(path.resolve(__dirname, "change-password.feature"));

defineFeature(feature, (test) => {
  let useCase: ChangePasswordUseCase;
  let usuarioRepoMock: jest.Mocked<RepositorioUsuarioPort>;
  let passwordHasherMock: jest.Mocked<GeradorHashSenhaPort>;
  let auditRepoMock: jest.Mocked<AuditRepositoryPort>;

  let erroCapturado: any;
  let resultadoCapturado: TrocarSenhaResultado | undefined;
  let deveTrocarSenhaEstado: boolean;

  const usuarioPadrao: UsuarioModeloDominio = {
    id: "user-lucas-uuid",
    municipioId: "muni-uuid",
    nomeCompleto: "Lucas Mendes",
    email: "lucas@farmaubs.gov.br",
    perfilId: "perfil-farm-uuid",
    ativo: true,
    deveTrocarSenha: true,
    tentativasLoginFalhas: 0,
    bloqueadoAte: null,
    senhaAtualizadaEm: null,
    ultimoLoginEm: null,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  };

  beforeEach(() => {
    erroCapturado = null;
    resultadoCapturado = undefined;
    deveTrocarSenhaEstado = true;

    usuarioRepoMock = {
      buscarPorId: jest.fn().mockResolvedValue(usuarioPadrao),
      buscarSenhaHashPorId: jest.fn().mockResolvedValue("$2b$12$provHashMockedValue"),
      concluirTrocaDeSenha: jest
        .fn()
        .mockImplementation((_id, _hash, _data) => {
          deveTrocarSenhaEstado = false;
          return Promise.resolve();
        }),
      atualizarSenhaProvisoria: jest.fn(),
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
        .mockResolvedValue("$2b$12$hashedNovaSenhaSegura2026"),
      comparar: jest.fn().mockResolvedValue(false),
    };

    auditRepoMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new ChangePasswordUseCase(
      usuarioRepoMock,
      passwordHasherMock,
      auditRepoMock,
    );
  });

  test("Farmacêutico troca a senha provisória por nova senha válida", ({
    given,
    and,
    when,
    then,
  }) => {
    given(
      /^que o usuário "(.*)" possui deve_trocar_senha como verdadeiro$/,
      (_nome) => {
        deveTrocarSenhaEstado = true;
      },
    );

    and("está autenticado com sua sessão provisória", () => {
      // Sessão provisória válida
    });

    when(
      /^ele submeter a nova senha "(.*)" com confirmação idêntica$/,
      async (novaSenha) => {
        resultadoCapturado = await useCase.executar({
          usuarioId: usuarioPadrao.id,
          novaSenha,
          confirmacaoSenha: novaSenha,
        });
      },
    );

    then("o hash da senha é atualizado no repositório", () => {
      expect(usuarioRepoMock.concluirTrocaDeSenha).toHaveBeenCalledWith(
        usuarioPadrao.id,
        "$2b$12$hashedNovaSenhaSegura2026",
        expect.any(Date),
      );
    });

    and("o campo deve_trocar_senha passa a ser falso", () => {
      expect(deveTrocarSenhaEstado).toBe(false);
    });

    and("a data de senha_atualizada_em é registrada", () => {
      expect(usuarioRepoMock.concluirTrocaDeSenha).toHaveBeenCalledWith(
        usuarioPadrao.id,
        expect.any(String),
        expect.any(Date),
      );
    });

    and(
      /^o sistema retorna sucesso com a mensagem "(.*)"$/,
      (mensagemEsperada) => {
        expect(resultadoCapturado).toEqual({
          sucesso: true,
          mensagem: mensagemEsperada,
        });
      },
    );
  });

  test("Tentativa de reutilizar a senha provisória como nova senha", ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      /^que o usuário está autenticado com a senha provisória "(.*)"$/,
      (_prov) => {
        passwordHasherMock.comparar.mockResolvedValue(true);
      },
    );

    when(
      /^ele tentar definir "(.*)" como sua nova senha$/,
      async (mesmaSenha) => {
        try {
          await useCase.executar({
            usuarioId: usuarioPadrao.id,
            novaSenha: mesmaSenha,
            confirmacaoSenha: mesmaSenha,
          });
        } catch (err) {
          erroCapturado = err;
        }
      },
    );

    then(/^o sistema deve lançar a exceção "(.*)"$/, (nomeExcecao) => {
      expect(erroCapturado).toBeInstanceOf(
        NovaSenhaNaoPodeSerIgualProvisoriaException,
      );
      expect(erroCapturado.name).toBe(nomeExcecao);
    });

    and("o campo deve_trocar_senha permanece verdadeiro", () => {
      expect(deveTrocarSenhaEstado).toBe(true);
      expect(usuarioRepoMock.concluirTrocaDeSenha).not.toHaveBeenCalled();
    });
  });

  test("Senha com confirmação divergente", ({ given, when, then }) => {
    given("que o usuário tenta trocar a senha", () => {
      // setup
    });

    when(
      /^ele informa "(.*)" e confirmação "(.*)"$/,
      async (novaSenha, confirmacao) => {
        try {
          await useCase.executar({
            usuarioId: usuarioPadrao.id,
            novaSenha,
            confirmacaoSenha: confirmacao,
          });
        } catch (err) {
          erroCapturado = err;
        }
      },
    );

    then(
      "o sistema deve lançar erro de confirmação de senha divergente",
      () => {
        expect(erroCapturado).toBeInstanceOf(
          ConfirmacaoSenhaDivergenteException,
        );
        expect(usuarioRepoMock.concluirTrocaDeSenha).not.toHaveBeenCalled();
      },
    );
  });

  test("Tentativa de cadastrar senha fraca", ({ given, when, then }) => {
    given("que o usuário tenta trocar a senha", () => {
      // setup
    });

    when(
      /^ele informa a senha fraca "(.*)" com confirmação "(.*)"$/,
      async (senhaFraca, confirmacao) => {
        try {
          await useCase.executar({
            usuarioId: usuarioPadrao.id,
            novaSenha: senhaFraca,
            confirmacaoSenha: confirmacao,
          });
        } catch (err) {
          erroCapturado = err;
        }
      },
    );

    then("o sistema deve lançar a exceção de senha fraca", () => {
      expect(erroCapturado).toBeInstanceOf(SenhaFracaException);
      expect(usuarioRepoMock.concluirTrocaDeSenha).not.toHaveBeenCalled();
    });
  });
});
