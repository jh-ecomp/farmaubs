import { Given, When, Then, Before } from "@cucumber/cucumber";
import { expect, assert } from "chai";
import { CadastrarUsuarioUseCase } from "../../../src/modules/acesso/application/use-cases/register-user.use-case";
import {
  UsuarioEmailJaExisteException,
  PerfilNaoEncontradoException,
  UnidadeSaudeInvalidaException,
  DadosUsuarioInvalidosException,
} from "../../../src/modules/acesso/domain/errors/user-registration.errors";
import type { CadastrarUsuarioComando } from "@farmaubs/shared";

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

const perfilPadrao = {
  id: "33333333-3333-3333-3333-333333333333",
  codigo: "FARMACEUTICO_RESPONSAVEL",
  nome: "Farmacêutico Responsável",
  descricao: "Responsável técnico",
  ativo: true,
};

function setupCadastroContext(world: any) {
  world.resultado = null;
  world.erroCapturado = null;

  world.repositorioUsuarioMock = {
    buscarPorEmail: createSimpleMock().mockResolvedValue(null),
    existePorEmail: createSimpleMock().mockResolvedValue(false),
    listar: createSimpleMock(),
    salvar: createSimpleMock((dadosUsuario: any) =>
      Promise.resolve({
        id: "user-generated-uuid",
        municipioId: dadosUsuario.municipioId,
        nomeCompleto: dadosUsuario.nomeCompleto,
        email: dadosUsuario.email,
        perfilId: dadosUsuario.perfilId,
        ativo: dadosUsuario.ativo,
        deveTrocarSenha: dadosUsuario.deveTrocarSenha,
        tentativasLoginFalhas: dadosUsuario.tentativasLoginFalhas,
        bloqueadoAte: dadosUsuario.bloqueadoAte ?? null,
        senhaAtualizadaEm: dadosUsuario.senhaAtualizadaEm ?? null,
        ultimoLoginEm: null,
        criadoEm: new Date(),
        atualizadoEm: new Date(),
      })
    ),
  };

  world.repositorioPerfilMock = {
    buscarPorId: createSimpleMock().mockResolvedValue(null),
    buscarPorCodigoOuNome: createSimpleMock().mockResolvedValue(perfilPadrao),
  };

  world.geradorHashSenhaMock = {
    gerarHash: createSimpleMock().mockResolvedValue("$2b$12$mockedBcryptHashedPasswordResult"),
    comparar: createSimpleMock().mockResolvedValue(true),
  };

  world.repositorioUnidadeSaudeMock = {
    buscarIdsExistentes: createSimpleMock((ids: string[]) => Promise.resolve([...ids])),
  };

  world.servicoEmailMock = {
    enviarConfirmacaoCadastro: createSimpleMock().mockResolvedValue(undefined),
  };

  world.casoDeUso = new CadastrarUsuarioUseCase(
    world.repositorioUsuarioMock,
    world.repositorioPerfilMock,
    world.geradorHashSenhaMock,
    world.repositorioUnidadeSaudeMock,
    world.servicoEmailMock
  );
}

Before(function (this: any) {
  setupCadastroContext(this);
});

// ── Step Definitions ─────────────────────────────────────────────────────────

Given("que os repositórios e serviços de apoio estão operacionais", function (this: any) {
  setupCadastroContext(this);
});

Given("que o repositório de usuários não possui o e-mail {string}", function (this: any, _email: string) {
  this.repositorioUsuarioMock.existePorEmail.mockResolvedValue(false);
});

Given("que o perfil {string} existe e está ativo no catálogo", function (this: any, nome: string) {
  this.repositorioPerfilMock.buscarPorCodigoOuNome.mockResolvedValue({
    ...perfilPadrao,
    nome,
    ativo: true,
  });
});

Given("que as UBSs informadas existem no sistema", function (this: any) {
  this.repositorioUnidadeSaudeMock.buscarIdsExistentes = createSimpleMock((ids: string[]) => Promise.resolve([...ids]));
});

When("eu submeto o comando de cadastro com os seguintes dados:", async function (this: any, dataTable: any) {
  const hash = dataTable.rowsHash();
  const comando: CadastrarUsuarioComando = {
    municipioId: hash.municipioId,
    nomeCompleto: hash.nomeCompleto,
    email: hash.email,
    senha: hash.senha,
    perfil: hash.perfil,
    ubsIds: [hash.ubsIds],
  };

  try {
    this.resultado = await this.casoDeUso.executar(comando);
  } catch (err) {
    this.erroCapturado = err;
  }
});

Then("o usuário deve ser salvo com status ativo e troca de senha obrigatória", function (this: any) {
  expect(this.erroCapturado).to.be.null;
  expect(this.resultado).to.not.be.null;
  expect(this.resultado.ativo).to.be.true;
  expect(this.resultado.deveTrocarSenha).to.be.true;
});

Then("a senha deve ser transformada em hash bcrypt com custo mínimo 12", function (this: any) {
  expect(this.geradorHashSenhaMock.gerarHash.calls.length).to.be.greaterThan(0);
  expect(this.repositorioUsuarioMock.salvar.calls.length).to.be.greaterThan(0);
  const dadosSalvos = this.repositorioUsuarioMock.salvar.calls[0][0];
  expect(dadosSalvos.senhaHash).to.equal("$2b$12$mockedBcryptHashedPasswordResult");
});

Then("a senha em texto puro não deve ser retornada nem persistida", function (this: any) {
  expect((this.resultado as any).senha).to.be.undefined;
});

Then("o e-mail de confirmação de cadastro deve ser enviado para {string}", function (this: any, email: string) {
  expect(this.servicoEmailMock.enviarConfirmacaoCadastro.calls.length).to.be.greaterThan(0);
  expect(this.servicoEmailMock.enviarConfirmacaoCadastro.calls[0][0]).to.equal(email);
});

Given("que o perfil com ID {string} existe e está ativo", function (this: any, id: string) {
  this.repositorioPerfilMock.buscarPorCodigoOuNome.mockResolvedValue(null);
  this.repositorioPerfilMock.buscarPorId.mockResolvedValue({
    ...perfilPadrao,
    id,
    ativo: true,
  });
});

When("eu submeto o comando de cadastro informando o ID do perfil {string}", async function (this: any, id: string) {
  const comando: CadastrarUsuarioComando = {
    municipioId: "11111111-1111-1111-1111-111111111111",
    nomeCompleto: "Ana Souza",
    email: "ana.souza@farmaubs.local",
    senha: "SenhaForte@2026",
    perfil: id,
    ubsIds: ["22222222-2222-2222-2222-222222222222"],
  };
  try {
    this.resultado = await this.casoDeUso.executar(comando);
  } catch (err) {
    this.erroCapturado = err;
  }
});

Then("o usuário deve ser vinculado ao perfil com ID {string}", function (this: any, id: string) {
  expect(this.erroCapturado).to.be.null;
  expect(this.resultado.perfilId).to.equal(id);
});

Given("que o serviço de e-mail está indisponível ou falha", function (this: any) {
  this.servicoEmailMock.enviarConfirmacaoCadastro = createSimpleMock(() =>
    Promise.reject(new Error("SMTP timeout"))
  );
  this.casoDeUso = new CadastrarUsuarioUseCase(
    this.repositorioUsuarioMock,
    this.repositorioPerfilMock,
    this.geradorHashSenhaMock,
    this.repositorioUnidadeSaudeMock,
    this.servicoEmailMock
  );
});

When("eu submeto um comando de cadastro válido", async function (this: any) {
  const comando: CadastrarUsuarioComando = {
    municipioId: "11111111-1111-1111-1111-111111111111",
    nomeCompleto: "Ana Souza",
    email: "ana.souza@farmaubs.local",
    senha: "SenhaForte@2026",
    perfil: "Farmacêutico Responsável",
    ubsIds: ["22222222-2222-2222-2222-222222222222"],
  };
  try {
    this.resultado = await this.casoDeUso.executar(comando);
  } catch (err) {
    this.erroCapturado = err;
  }
});

Then("o usuário deve ser cadastrado com sucesso sem que a falha de e-mail interrompa o fluxo", function (this: any) {
  expect(this.erroCapturado).to.be.null;
  expect(this.resultado).to.not.be.null;
  expect(this.resultado.email).to.equal("ana.souza@farmaubs.local");
});

Given("que já existe um usuário cadastrado com o e-mail {string}", function (this: any, _email: string) {
  this.repositorioUsuarioMock.existePorEmail.mockResolvedValue(true);
});

When("eu submeto um comando de cadastro com o e-mail {string}", async function (this: any, email: string) {
  const comando: CadastrarUsuarioComando = {
    municipioId: "11111111-1111-1111-1111-111111111111",
    nomeCompleto: "Ana Souza",
    email,
    senha: "SenhaForte@2026",
    perfil: "Farmacêutico Responsável",
    ubsIds: ["22222222-2222-2222-2222-222222222222"],
  };
  try {
    this.resultado = await this.casoDeUso.executar(comando);
  } catch (err) {
    this.erroCapturado = err;
  }
});

Then("o cadastro deve ser rejeitado com erro indicando que o e-mail já existe", function (this: any) {
  expect(this.erroCapturado).to.be.instanceOf(UsuarioEmailJaExisteException);
});

Then("o usuário não deve ser persistido", function (this: any) {
  expect(this.repositorioUsuarioMock.salvar.calls.length).to.equal(0);
});

Then("a senha não deve ter hash gerado", function (this: any) {
  expect(this.geradorHashSenhaMock.gerarHash.calls.length).to.equal(0);
});

Then("nenhum e-mail de confirmação deve ser enviado", function (this: any) {
  expect(this.servicoEmailMock.enviarConfirmacaoCadastro.calls.length).to.equal(0);
});

Then("a unicidade deve ser validada após normalização em caixa baixa", function (this: any) {
  expect(this.repositorioUsuarioMock.existePorEmail.calls[0][0]).to.equal("ana.souza@farmaubs.local");
});

Given("que o perfil {string} não existe no catálogo", function (this: any, _perfil: string) {
  this.repositorioPerfilMock.buscarPorCodigoOuNome.mockResolvedValue(null);
  this.repositorioPerfilMock.buscarPorId.mockResolvedValue(null);
});

When("eu submeto um comando de cadastro informando o perfil {string}", async function (this: any, perfil: string) {
  const comando: CadastrarUsuarioComando = {
    municipioId: "11111111-1111-1111-1111-111111111111",
    nomeCompleto: "Ana Souza",
    email: "ana.souza@farmaubs.local",
    senha: "SenhaForte@2026",
    perfil,
    ubsIds: ["22222222-2222-2222-2222-222222222222"],
  };
  try {
    this.resultado = await this.casoDeUso.executar(comando);
  } catch (err) {
    this.erroCapturado = err;
  }
});

Then("o cadastro deve ser rejeitado com erro de perfil não encontrado", function (this: any) {
  expect(this.erroCapturado).to.be.instanceOf(PerfilNaoEncontradoException);
});

Given("que o perfil {string} existe mas está inativo", function (this: any, nome: string) {
  this.repositorioPerfilMock.buscarPorCodigoOuNome.mockResolvedValue({
    ...perfilPadrao,
    nome,
    ativo: false,
  });
});

Then("o cadastro deve ser rejeitado com erro de perfil não encontrado ou inativo", function (this: any) {
  expect(this.erroCapturado).to.be.instanceOf(PerfilNaoEncontradoException);
});

When("eu submeto um comando com dados inválidos contendo {string} igual a {string}", async function (this: any, campo: string, valor: string) {
  const comandoValido: CadastrarUsuarioComando = {
    municipioId: "11111111-1111-1111-1111-111111111111",
    nomeCompleto: "Ana Souza",
    email: "ana.souza@farmaubs.local",
    senha: "SenhaForte@2026",
    perfil: "Farmacêutico Responsável",
    ubsIds: ["22222222-2222-2222-2222-222222222222"],
  };

  let comandoInvalido: any = { ...comandoValido };

  switch (campo) {
    case "comando":
      comandoInvalido = null;
      break;
    case "nomeCompleto":
      comandoInvalido.nomeCompleto = "    ";
      break;
    case "email":
      comandoInvalido.email = valor === "vazio" ? "" : "email-invalido";
      break;
    case "senha":
      comandoInvalido.senha = valor === "vazia" ? "" : "curta";
      break;
    case "perfil":
      comandoInvalido.perfil = "";
      break;
    case "ubsIds":
      comandoInvalido.ubsIds = [];
      break;
    case "municipioId":
      comandoInvalido.municipioId = "";
      break;
  }

  try {
    this.resultado = await this.casoDeUso.executar(comandoInvalido);
  } catch (err) {
    this.erroCapturado = err;
  }
});

Then("o cadastro deve ser rejeitado com erro de validação de dados", function (this: any) {
  expect(this.erroCapturado).to.be.instanceOf(DadosUsuarioInvalidosException);
});

Given("que uma das UBSs informadas não existe no sistema", function (this: any) {
  this.repositorioUnidadeSaudeMock.buscarIdsExistentes = createSimpleMock(() => Promise.resolve([]));
  this.casoDeUso = new CadastrarUsuarioUseCase(
    this.repositorioUsuarioMock,
    this.repositorioPerfilMock,
    this.geradorHashSenhaMock,
    this.repositorioUnidadeSaudeMock,
    this.servicoEmailMock
  );
});

When("eu submeto um comando de cadastro com uma UBS inexistente", async function (this: any) {
  const comando: CadastrarUsuarioComando = {
    municipioId: "11111111-1111-1111-1111-111111111111",
    nomeCompleto: "Ana Souza",
    email: "ana.souza@farmaubs.local",
    senha: "SenhaForte@2026",
    perfil: "Farmacêutico Responsável",
    ubsIds: ["ubs-inexistente"],
  };
  try {
    this.resultado = await this.casoDeUso.executar(comando);
  } catch (err) {
    this.erroCapturado = err;
  }
});

Then("o cadastro deve ser rejeitado com erro de unidade de saúde inválida", function (this: any) {
  expect(this.erroCapturado).to.be.instanceOf(UnidadeSaudeInvalidaException);
});

When("eu submeto o comando de cadastro informando IDs de UBS duplicados", async function (this: any) {
  const comando: CadastrarUsuarioComando = {
    municipioId: "11111111-1111-1111-1111-111111111111",
    nomeCompleto: "Ana Souza",
    email: "ana.souza@farmaubs.local",
    senha: "SenhaForte@2026",
    perfil: "Farmacêutico Responsável",
    ubsIds: [
      "22222222-2222-2222-2222-222222222222",
      "22222222-2222-2222-2222-222222222222",
    ],
  };
  try {
    this.resultado = await this.casoDeUso.executar(comando);
  } catch (err) {
    this.erroCapturado = err;
  }
});

Then("as UBSs associadas ao usuário salvo devem ser deduplicadas", function (this: any) {
  expect(this.erroCapturado).to.be.null;
  expect(this.repositorioUnidadeSaudeMock.buscarIdsExistentes.calls[0][0].length).to.equal(1);
});
