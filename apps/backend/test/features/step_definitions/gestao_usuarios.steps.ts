import { Given, When, Then, Before } from "@cucumber/cucumber";
import { expect } from "chai";
import { EditUserUseCase } from "../../../src/modules/acesso/application/use-cases/edit-user.use-case";
import { UpdateAssociationsUseCase } from "../../../src/modules/acesso/application/use-cases/update-associations.use-case";
import { ToggleUserStatusUseCase } from "../../../src/modules/acesso/application/use-cases/toggle-user-status.use-case";
import { SetTemporaryPasswordUseCase } from "../../../src/modules/acesso/application/use-cases/set-temporary-password.use-case";
import {
  AutoInativacaoBloqueadaException,
  IntegridadeTerritorialException,
  SenhaInvalidaException,
  UltimoAdministradorException,
  UsuarioEmailJaExisteException,
} from "../../../src/modules/acesso/domain/errors/user-management.errors";
import type {
  PerfilModeloDominio,
  UsuarioModeloDominio,
} from "../../../src/modules/acesso/domain/entities/user-registration.entity";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createSimpleMock<T extends (...args: any[]) => any>(impl?: T) {
  const calls: any[][] = [];
  let isAsync = false;
  let resolvedVal: any = undefined;
  const fn = (...args: any[]) => {
    calls.push(args);
    if (impl) return impl(...args);
    if (isAsync) return Promise.resolve(resolvedVal);
    return undefined;
  };
  fn.calls = calls;
  fn.mockResolvedValue = (val: any) => {
    isAsync = true;
    resolvedVal = val;
    return fn;
  };
  return fn;
}

const perfilFarmaceutico: PerfilModeloDominio = {
  id: "perfil-farm-uuid",
  codigo: "FARMACEUTICO",
  nome: "Farmacêutico",
  ativo: true,
};

const perfilGerente: PerfilModeloDominio = {
  id: "perfil-gerente-uuid",
  codigo: "GERENTE",
  nome: "Gerente",
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

function setupGestaoContext(world: any) {
  world.erroCapturado = null;
  world.resultadoOperacao = null;
  world.usuarioAlvoId = "user-1";

  world.usuarioRepoMock = {
    buscarPorId: createSimpleMock().mockResolvedValue(usuarioPadrao),
    buscarPorEmail: createSimpleMock().mockResolvedValue(null),
    buscarUbsIds: createSimpleMock().mockResolvedValue(["ubs-central-uuid"]),
    atualizarDados: createSimpleMock((id: string, dados: any) =>
      Promise.resolve({
        ...usuarioPadrao,
        ...dados,
        atualizadoEm: new Date(),
      })
    ),
    atualizarPerfilEUbs: createSimpleMock().mockResolvedValue(undefined),
    atualizarStatus: createSimpleMock((id: string, ativo: boolean) =>
      Promise.resolve({
        ...usuarioPadrao,
        ativo,
        atualizadoEm: new Date(),
      })
    ),
    atualizarSenhaProvisoria: createSimpleMock().mockResolvedValue(undefined),
    contarAdministradoresAtivos: createSimpleMock().mockResolvedValue(2),
    existePorEmail: createSimpleMock().mockResolvedValue(false),
    salvar: createSimpleMock(),
    listar: createSimpleMock(),
  };

  world.profileRepoMock = {
    buscarPorId: createSimpleMock((id: string) => {
      if (id === perfilGerente.id || id === "GERENTE") return Promise.resolve(perfilGerente);
      if (id === perfilAdmin.id || id === "ADMINISTRADOR") return Promise.resolve(perfilAdmin);
      return Promise.resolve(perfilFarmaceutico);
    }),
    buscarPorCodigoOuNome: createSimpleMock((codigo: string) => {
      if (codigo === "GERENTE") return Promise.resolve(perfilGerente);
      if (codigo === "ADMINISTRADOR") return Promise.resolve(perfilAdmin);
      return Promise.resolve(perfilFarmaceutico);
    }),
  };

  world.healthUnitRepoMock = {
    buscarIdsExistentes: createSimpleMock((ids: string[]) => Promise.resolve(ids)),
  };

  world.passwordHasherMock = {
    gerarHash: createSimpleMock().mockResolvedValue("$2b$12$hashedPasswordCusto12"),
    comparar: createSimpleMock(),
  };

  world.sessionRepoMock = {
    revogarTodas: createSimpleMock().mockResolvedValue(undefined),
    revogar: createSimpleMock(),
    buscarPorTokenHash: createSimpleMock(),
    renovarAtividade: createSimpleMock(),
  };

  world.auditRepoMock = {
    registrar: createSimpleMock().mockResolvedValue(undefined),
  };

  world.editUserUseCase = new EditUserUseCase(world.usuarioRepoMock, world.auditRepoMock);
  world.updateAssociationsUseCase = new UpdateAssociationsUseCase(
    world.usuarioRepoMock,
    world.profileRepoMock,
    world.healthUnitRepoMock,
    world.auditRepoMock
  );
  world.toggleUserStatusUseCase = new ToggleUserStatusUseCase(
    world.usuarioRepoMock,
    world.profileRepoMock,
    world.sessionRepoMock,
    world.auditRepoMock
  );
  world.setTemporaryPasswordUseCase = new SetTemporaryPasswordUseCase(
    world.usuarioRepoMock,
    world.passwordHasherMock,
    world.sessionRepoMock,
    world.auditRepoMock
  );
}

Before(function (this: any) {
  setupGestaoContext(this);
});

// ── Step Definitions ─────────────────────────────────────────────────────────

Given("que existe um usuário cadastrado com e-mail {string}", function (this: any, email: string) {
  this.usuarioRepoMock.buscarPorId.mockResolvedValue({
    ...usuarioPadrao,
    id: "user-1",
    email,
  });
});

When(
  "o Administrador atualiza o nome para {string} e o e-mail para {string}",
  async function (this: any, nome: string, email: string) {
    try {
      this.resultadoOperacao = await this.editUserUseCase.executar("admin-uuid", "user-1", {
        nomeCompleto: nome,
        email,
      });
    } catch (err) {
      this.erroCapturado = err;
    }
  }
);

Then("os novos dados devem ser persistidos", function (this: any) {
  expect(this.erroCapturado).to.be.null;
  expect(this.usuarioRepoMock.atualizarDados.calls.length).to.be.greaterThan(0);
  expect(this.resultadoOperacao.nomeCompleto).to.equal("João Silva Santos");
  expect(this.resultadoOperacao.email).to.equal("joao.santos@ubs.gov.br");
});

Then("um evento de auditoria {string} deve ser registrado", function (this: any, tipo: string) {
  expect(this.auditRepoMock.registrar.calls.length).to.be.greaterThan(0);
  const auditCall = this.auditRepoMock.registrar.calls[0][0];
  expect(auditCall.tipoOperacao).to.equal(tipo);
});

Given("que existe um usuário com e-mail {string}", function (this: any, email: string) {
  this.usuarioAlvoId = "user-maria";
  this.usuarioRepoMock.buscarPorId.mockResolvedValue({
    ...usuarioPadrao,
    id: "user-maria",
    email,
  });
});

Given("outro usuário com e-mail {string}", function (this: any, emailConflito: string) {
  this.usuarioRepoMock.buscarPorEmail.mockResolvedValue({
    ...usuarioPadrao,
    id: "outro-usuario",
    email: emailConflito,
  });
});

When(
  "o Administrador tenta alterar o e-mail de {string} para {string}",
  async function (this: any, _de: string, para: string) {
    try {
      this.resultadoOperacao = await this.editUserUseCase.executar("admin-uuid", this.usuarioAlvoId, {
        email: para,
      });
    } catch (err) {
      this.erroCapturado = err;
    }
  }
);

Then("a operação deve ser rejeitada por conflito de e-mail", function (this: any) {
  expect(this.erroCapturado).to.be.instanceOf(UsuarioEmailJaExisteException);
});

Given(
  "que existe um usuário vinculado à UBS {string} com perfil {string}",
  function (this: any, _ubs: string, _perfil: string) {
    this.usuarioRepoMock.buscarPorId.mockResolvedValue({
      ...usuarioPadrao,
      perfilId: perfilFarmaceutico.id,
    });
  }
);

When(
  "o Administrador altera o perfil para {string} e vincula às UBSs {string} e {string}",
  async function (this: any, perfil: string, ubs1: string, ubs2: string) {
    try {
      this.resultadoOperacao = await this.updateAssociationsUseCase.executar("admin-uuid", "user-1", {
        perfilId: perfil,
        ubsIds: [ubs1, ubs2],
      });
    } catch (err) {
      this.erroCapturado = err;
    }
  }
);

Then("as novas associações devem ser sincronizadas", function (this: any) {
  expect(this.erroCapturado).to.be.null;
  expect(this.usuarioRepoMock.atualizarPerfilEUbs.calls.length).to.be.greaterThan(0);
});

Given("que existe um usuário pertencente ao município {string}", function (this: any, _muni: string) {
  this.usuarioRepoMock.buscarPorId.mockResolvedValue({
    ...usuarioPadrao,
    municipioId: "muni-parnaiba-uuid",
  });
});

When(
  "o Administrador tenta vincular o usuário a uma UBS do município {string}",
  async function (this: any, _muni: string) {
    this.healthUnitRepoMock.buscarIdsExistentes = createSimpleMock().mockResolvedValue([]);
    try {
      this.resultadoOperacao = await this.updateAssociationsUseCase.executar("admin-uuid", "user-1", {
        perfilId: perfilFarmaceutico.id,
        ubsIds: ["ubs-teresina-uuid"],
      });
    } catch (err) {
      this.erroCapturado = err;
    }
  }
);

Then("a operação deve ser rejeitada por violação de integridade territorial", function (this: any) {
  expect(this.erroCapturado).to.be.instanceOf(IntegridadeTerritorialException);
});

Given("que existe um usuário ativo com sessões ativas no sistema", function (this: any) {
  this.usuarioRepoMock.buscarPorId.mockResolvedValue({
    ...usuarioPadrao,
    ativo: true,
  });
});

When("o Administrador inativa a conta do usuário", async function (this: any) {
  try {
    this.resultadoOperacao = await this.toggleUserStatusUseCase.executar("admin-uuid", "user-1", {
      ativo: false,
    });
  } catch (err) {
    this.erroCapturado = err;
  }
});

Then("o status do usuário deve ser alterado para inativo", function (this: any) {
  expect(this.erroCapturado).to.be.null;
  expect(this.usuarioRepoMock.atualizarStatus.calls.length).to.be.greaterThan(0);
  expect(this.resultadoOperacao.ativo).to.be.false;
});

Then("todas as suas sessões ativas devem ser revogadas imediatamente", function (this: any) {
  expect(this.sessionRepoMock.revogarTodas.calls.length).to.be.greaterThan(0);
});

Given("que o Administrador está logado com ID {string}", function (this: any, id: string) {
  this.adminLogadoId = id;
  this.usuarioRepoMock.buscarPorId.mockResolvedValue({
    ...usuarioPadrao,
    id,
  });
});

When("ele tenta inativar a própria conta {string}", async function (this: any, id: string) {
  try {
    this.resultadoOperacao = await this.toggleUserStatusUseCase.executar(this.adminLogadoId, id, {
      ativo: false,
    });
  } catch (err) {
    this.erroCapturado = err;
  }
});

Then("a operação deve ser bloqueada", function (this: any) {
  expect(this.erroCapturado).to.be.instanceOf(AutoInativacaoBloqueadaException);
});

Given("que existe apenas um administrador ativo no sistema", function (this: any) {
  this.usuarioRepoMock.contarAdministradoresAtivos.mockResolvedValue(1);
  this.usuarioRepoMock.buscarPorId.mockResolvedValue({
    ...usuarioPadrao,
    id: "admin-alvo",
    perfilId: perfilAdmin.id,
  });
});

When("é feita uma tentativa de inativar esse administrador", async function (this: any) {
  try {
    this.resultadoOperacao = await this.toggleUserStatusUseCase.executar("admin-outro", "admin-alvo", {
      ativo: false,
    });
  } catch (err) {
    this.erroCapturado = err;
  }
});

Then("a operação deve ser rejeitada por ser o último administrador", function (this: any) {
  expect(this.erroCapturado).to.be.instanceOf(UltimoAdministradorException);
});

Given("que existe um usuário com conta bloqueada após tentativas falhas", function (this: any) {
  this.usuarioRepoMock.buscarPorId.mockResolvedValue({
    ...usuarioPadrao,
    tentativasLoginFalhas: 5,
    bloqueadoAte: new Date(),
  });
});

When("o Administrador define uma nova senha provisória {string}", async function (this: any, senha: string) {
  try {
    this.resultadoOperacao = await this.setTemporaryPasswordUseCase.executar("admin-uuid", "user-1", {
      senhaProvisoria: senha,
    });
  } catch (err) {
    this.erroCapturado = err;
  }
});

Then("a nova senha deve ser hasheada com BCrypt custo 12", function (this: any) {
  expect(this.passwordHasherMock.gerarHash.calls.length).to.be.greaterThan(0);
});

Then("a flag deve_trocar_senha deve ser marcada como verdadeira", function (this: any) {
  expect(this.usuarioRepoMock.atualizarSenhaProvisoria.calls.length).to.be.greaterThan(0);
});

Then("o bloqueio da conta deve ser removido", function (this: any) {
  expect(this.usuarioRepoMock.atualizarSenhaProvisoria.calls.length).to.be.greaterThan(0);
});

Then("todas as sessões ativas do usuário devem ser revogadas", function (this: any) {
  expect(this.sessionRepoMock.revogarTodas.calls.length).to.be.greaterThan(0);
});

Given("que existe um usuário cadastrado no sistema", function (this: any) {
  this.usuarioRepoMock.buscarPorId.mockResolvedValue(usuarioPadrao);
});

When("o Administrador tenta definir a senha provisória {string}", async function (this: any, senha: string) {
  try {
    this.resultadoOperacao = await this.setTemporaryPasswordUseCase.executar("admin-uuid", "user-1", {
      senhaProvisoria: senha,
    });
  } catch (err) {
    this.erroCapturado = err;
  }
});

Then("a operação deve ser rejeitada por não atender aos requisitos de complexidade", function (this: any) {
  expect(this.erroCapturado).to.be.instanceOf(SenhaInvalidaException);
});
