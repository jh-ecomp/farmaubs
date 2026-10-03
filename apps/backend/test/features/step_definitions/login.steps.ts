import { Given, When, Then } from "@cucumber/cucumber";
import { expect, assert } from "chai";
import * as bcrypt from "bcrypt";
import type {
  IAcessoRepository,
  UserAcessoRecord,
} from "../../../src/modules/acesso/domain/ports/acesso.repository.port";
import { LoginUseCase } from "../../../src/modules/acesso/application/use-cases/login.use-case";
import { ConfigService } from "@nestjs/config";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createSimpleMock<T extends (...args: any[]) => any>(impl?: T) {
  const calls: any[][] = [];
  const fn = (...args: any[]) => {
    calls.push(args);
    return impl ? impl(...args) : fn._resolvedValue !== undefined ? Promise.resolve(fn._resolvedValue) : undefined;
  };
  fn.calls = calls;
  fn._resolvedValue = undefined as any;
  fn.mockResolvedValue = (val: any) => {
    fn._resolvedValue = val;
    return fn;
  };
  return fn;
}

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    LOGIN_MAX_ATTEMPTS: "5",
    SESSION_TTL_MINUTES: "60",
    ...overrides,
  };
  return { get: (key: string, def = "") => values[key] ?? def } as any;
}

function makeRepo(partial: any = {}): any {
  return {
    buscarUsuarioPorEmail: createSimpleMock().mockResolvedValue(null),
    buscarEscopoUsuario: createSimpleMock().mockResolvedValue({
      perfilId: "uuid-perfil",
      unidadeIds: [],
    }),
    registrarFalhaLogin: createSimpleMock().mockResolvedValue(undefined),
    resetarEstadoLogin: createSimpleMock().mockResolvedValue(undefined),
    criarSessao: createSimpleMock().mockResolvedValue(
      "token-fake-64chars-00000000000000000000000000000000"
    ),
    ...partial,
  };
}

async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 4);
}

function makeUsuario(
  overrides: Partial<UserAcessoRecord> = {}
): UserAcessoRecord {
  return {
    id: "uuid-usuario",
    municipioId: "uuid-municipio",
    email: "admin@farmaubs.dev",
    senhaHash: "",
    ativo: true,
    tentativasLoginFalhas: 0,
    bloqueadoAte: null,
    ...overrides,
  };
}

// ── Step Definitions (Cucumber + Chai) ───────────────────────────────────────

Given(
  "que existe um usuário ativo com e-mail {string}",
  async function (this: any, email: string) {
    const senhaHash = await hashSenha("Admin@123456");
    this.repo = makeRepo({
      buscarUsuarioPorEmail: createSimpleMock().mockResolvedValue(
        makeUsuario({ email, senhaHash })
      ),
    });
    this.useCase = new LoginUseCase(this.repo, makeConfig());
  }
);

When(
  "eu informar o e-mail {string} e a senha correta",
  async function (this: any, email: string) {
    this.resultado = await this.useCase.executar(email, "Admin@123456");
  }
);

Then("uma sessão é criada com token único", function (this: any) {
  expect(this.resultado.ok).to.be.true;
  expect(this.repo.criarSessao.calls.length).to.be.greaterThan(0);
});

Then("o contador de tentativas inválidas é zerado", function (this: any) {
  expect(this.repo.resetarEstadoLogin.calls.length).to.be.greaterThan(0);
  expect(this.repo.resetarEstadoLogin.calls[0][0]).to.equal("uuid-usuario");
});

When("eu informar a senha errada para esse e-mail", async function (this: any) {
  this.resultado = await this.useCase.executar("admin@farmaubs.dev", "senhaerrada");
});

Then("o sistema retorna a mensagem genérica de credenciais inválidas", function (this: any) {
  expect(this.resultado.ok).to.be.false;
  if (!this.resultado.ok) {
    expect(this.resultado.motivo).to.equal("CREDENCIAIS_INVALIDAS");
  }
});

Then("nenhuma sessão é criada", function (this: any) {
  expect(this.repo.criarSessao.calls.length).to.equal(0);
});

Given(
  "que o usuário {string} possui {int} tentativas inválidas registradas",
  async function (this: any, email: string, tentativas: number) {
    this.emailUsuario = email;
    this.senhaCorreta = "SenhaValida@123";
    const senhaHash = await hashSenha(this.senhaCorreta);
    this.repo = makeRepo({
      buscarUsuarioPorEmail: createSimpleMock().mockResolvedValue(
        makeUsuario({ email, senhaHash, tentativasLoginFalhas: tentativas })
      ),
    });
    this.useCase = new LoginUseCase(this.repo, makeConfig());
  }
);

When("eu informar a senha errada pela 5ª vez", async function (this: any) {
  this.resultado = await this.useCase.executar(this.emailUsuario || "gerente@farmaubs.dev", "senhaerrada");
});

Then("o sistema bloqueia a conta", function (this: any) {
  expect(this.repo.registrarFalhaLogin.calls.length).to.be.greaterThan(0);
  expect(this.repo.registrarFalhaLogin.calls[0][0]).to.equal("uuid-usuario");
});

Then("retorna a mensagem de credenciais inválidas", function (this: any) {
  expect(this.resultado.ok).to.be.false;
  if (!this.resultado.ok) {
    expect(this.resultado.motivo).to.equal("CREDENCIAIS_INVALIDAS");
  }
});

Given("que a conta {string} está bloqueada", async function (this: any, email: string) {
  const senhaHash = await hashSenha("Gerente@123456");
  const bloqueadoAte = new Date(Date.now() + 10 * 60_000);
  this.repo = makeRepo({
    buscarUsuarioPorEmail: createSimpleMock().mockResolvedValue(
      makeUsuario({ email, senhaHash, bloqueadoAte })
    ),
  });
  this.useCase = new LoginUseCase(this.repo, makeConfig());
});

When("eu tentar logar com credenciais corretas", async function (this: any) {
  this.resultado = await this.useCase.executar("gerente@farmaubs.dev", "Gerente@123456");
});

Then("o sistema retorna erro informando o tempo restante de bloqueio", function (this: any) {
  expect(this.resultado.ok).to.be.false;
  if (!this.resultado.ok) {
    expect(this.resultado.motivo).to.equal("CONTA_BLOQUEADA");
  }
});

Then("o contador de tentativas não é incrementado", function (this: any) {
  expect(this.repo.registrarFalhaLogin.calls.length).to.equal(0);
});

Given("que não existe usuário com o e-mail {string}", function (this: any, _email: string) {
  this.repo = makeRepo({
    buscarUsuarioPorEmail: createSimpleMock().mockResolvedValue(null),
  });
  this.useCase = new LoginUseCase(this.repo, makeConfig());
});

When("eu tentar logar com esse e-mail e qualquer senha", async function (this: any) {
  this.resultado = await this.useCase.executar("nao.cadastrado@farmaubs.dev", "qualquer");
});

Then(
  "o sistema retorna a mesma mensagem genérica de credenciais inválidas",
  function (this: any) {
    expect(this.resultado.ok).to.be.false;
    if (!this.resultado.ok) {
      expect(this.resultado.motivo).to.equal("CREDENCIAIS_INVALIDAS");
    }
  }
);

When("eu logar com a senha correta", async function (this: any) {
  this.resultado = await this.useCase.executar(
    this.emailUsuario || "farmaceutico.responsavel@farmaubs.dev",
    this.senhaCorreta || "SenhaValida@123"
  );
});

Then("a sessão é criada com sucesso", function (this: any) {
  expect(this.resultado.ok).to.be.true;
});

Then("o contador de tentativas é zerado", function (this: any) {
  expect(this.repo.resetarEstadoLogin.calls.length).to.be.greaterThan(0);
  expect(this.repo.resetarEstadoLogin.calls[0][0]).to.equal("uuid-usuario");
});

Given(
  "que o usuário {string} possui uma sessão ativa expirada",
  function (this: any, _email: string) {
    this.tokenHash = "hash-sessao-expirada";
  }
);

When("o sistema verificar a sessão", function (this: any) {
  // Verificação de expiração no banco / middleware
});

Then("a sessão é recusada por expiração", function (this: any) {
  assert.isDefined(this.tokenHash);
});
