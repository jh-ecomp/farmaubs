/**
 * [ADR-030 / ADR-032 / AC-31]: Definições de passos BDD (Gherkin em português) para o módulo de Acesso e Autenticação.
 * Cobre Login, Cookie HttpOnly (sem token em localStorage), Timeout de Sessão (page.clock), RBAC, Troca de Senha e Gestão de Usuários.
 */
import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import AxeBuilder from "@axe-core/playwright";
import { PerfilCodigo } from "@farmaubs/shared";

const { Given, When, Then } = createBdd();

const USUARIO_FARMACEUTICO_AC = {
  id: "01950000-0000-7000-8000-000000000099",
  usuarioId: "01950000-0000-7000-8000-000000000099",
  nomeCompleto: "Dra. Maria das Graças (Farmacêutica UBS Centro)",
  nome: "Dra. Maria das Graças (Farmacêutica UBS Centro)",
  email: "farma.parnaiba@farmaubs.dev",
  perfilCodigo: PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
  perfil: [PerfilCodigo.FARMACEUTICO_RESPONSAVEL],
  municipioId: "01950000-0000-7000-8000-000000000010",
  municipio_id: "01950000-0000-7000-8000-000000000010",
  unidadeIds: ["01950000-0000-7000-8000-000000000001"],
  unidade_id: "01950000-0000-7000-8000-000000000001",
  deveTrocarSenha: false,
};

let requisicaoRenovarEnviada = false;

Given(
  "que as APIs de autenticação do módulo de acesso estão operacionais",
  async ({ page }) => {
    let sessaoAutenticada = false;
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();

    await page.route("**/api/v1/acesso/login", async (route) => {
      sessaoAutenticada = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Set-Cookie":
            "farmaubs_session=mock_session_token; HttpOnly; Path=/api/v1; SameSite=Lax",
          "X-Session-Expires-At": expiresAt,
        },
        body: JSON.stringify({
          usuario: USUARIO_FARMACEUTICO_AC,
          sessao: {
            expiresAt,
            ttlSeconds: 3600,
            warningSeconds: 300,
          },
          redirectUrl: "/dispensas",
        }),
      });
    });

    await page.route("**/api/v1/acesso/me", async (route) => {
      if (!sessaoAutenticada) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ message: "Sessão não iniciada." }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "X-Session-Expires-At": expiresAt },
        body: JSON.stringify({
          ...USUARIO_FARMACEUTICO_AC,
          expiresAt,
        }),
      });
    });

    await page.route("**/api/v1/dispensacoes*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          itens: [],
          totalItens: 0,
          pagina: 1,
          limite: 20,
          totalPaginas: 1,
          dataInicioEfetiva: "2026-11-19",
          dataFimEfetiva: "2026-11-20",
        }),
      });
    });
  },
);

Given(
  "que o usuário acessa a página pública {string}",
  async ({ page }, rota: string) => {
    await page.goto(rota);
    await expect(
      page.getByRole("heading", { name: /Acesso ao Sistema/i }),
    ).toBeVisible();
  },
);

When(
  "o usuário acessa a página pública {string}",
  async ({ page }, rota: string) => {
    await page.goto(rota);
    await expect(
      page.getByRole("heading", { name: /Acesso ao Sistema/i }),
    ).toBeVisible();
  },
);

When(
  "ele preenche o e-mail {string} e a senha {string} e aciona {string}",
  async ({ page }, email: string, senha: string, _botao: string) => {
    await page.getByLabel(/E-mail institucional/i).fill(email);
    await page.getByLabel(/^Senha$/i).fill(senha);
    await page.getByRole("button", { name: /Entrar no FarmaUBS/i }).click();
  },
);

Then(
  "ele deve ser redirecionado para a bancada operacional da UBS",
  async ({ page }) => {
    await expect(page).toHaveURL(/\/dispensas/);
    await expect(
      page.getByRole("heading", { name: /Dispensação de Medicamentos/i }).first(),
    ).toBeVisible();
  },
);

Then(
  "o {string} do navegador não deve conter a chave {string}",
  async ({ page }, _storageName: string, chaveProibida: string) => {
    const valorToken = await page.evaluate((k) => localStorage.getItem(k), chaveProibida);
    expect(valorToken).toBeNull();
  },
);

Then(
  "a tela de acesso não deve apresentar violações críticas de acessibilidade WCAG 2.1 AA",
  async ({ page }) => {
    const resultadoAxe = await new AxeBuilder({ page })
      .include('[data-testid="pagina-dispensacao"]')
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(resultadoAxe.violations).toEqual([]);
  },
);

Given(
  "que o farmacêutico está autenticado com sessão ativa prestes a entrar na janela de aviso de 5 minutos",
  async ({ page }) => {
    requisicaoRenovarEnviada = false;
    await page.clock.install();

    // Define expiresAt para 4 minutos e 30 segundos no futuro (dentro da janela warningSeconds=300)
    const expiresEmBreve = new Date(Date.now() + 270 * 1000).toISOString();
    const expiresRenovado = new Date(Date.now() + 3600 * 1000).toISOString();

    await page.addInitScript(
      ({ user, exp }) => {
        localStorage.setItem("@FarmaUBS:usuario", JSON.stringify(user));
        localStorage.setItem("@FarmaUBS:expiresAt", exp);
        localStorage.setItem("@FarmaUBS:ttlSeconds", "3600");
        localStorage.setItem("@FarmaUBS:warningSeconds", "300");
      },
      { user: USUARIO_FARMACEUTICO_AC, exp: expiresEmBreve },
    );

    await page.route("**/api/v1/acesso/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "X-Session-Expires-At": expiresEmBreve },
        body: JSON.stringify({
          ...USUARIO_FARMACEUTICO_AC,
          expiresAt: expiresEmBreve,
        }),
      });
    });

    await page.route("**/api/v1/acesso/renovar", async (route) => {
      requisicaoRenovarEnviada = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "X-Session-Expires-At": expiresRenovado },
        body: JSON.stringify({
          expiresAt: expiresRenovado,
          ttlSeconds: 3600,
          warningSeconds: 300,
        }),
      });
    });

    await page.route("**/api/v1/dispensacoes*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          itens: [],
          totalItens: 0,
          pagina: 1,
          limite: 20,
          totalPaginas: 1,
          dataInicioEfetiva: "2026-11-19",
          dataFimEfetiva: "2026-11-20",
        }),
      });
    });

    await page.goto("/dispensas");
  },
);

When(
  "o relógio do navegador atingir a janela de aviso de inatividade",
  async ({ page }) => {
    await page.clock.runFor(2000);
  },
);

Then(
  "o modal de aviso de expiração de sessão deve ser exibido na tela",
  async ({ page }) => {
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Aviso de Inatividade/i);
  },
);

When(
  "o farmacêutico clicar em {string}",
  async ({ page }, textoBotao: string) => {
    await page
      .getByRole("button", { name: new RegExp(textoBotao, "i") })
      .click();
  },
);

Then(
  "a requisição POST para {string} deve ser enviada",
  async ({}, _rotaEsperada: string) => {
    expect(requisicaoRenovarEnviada).toBe(true);
  },
);

Then(
  "o modal de aviso deve ser fechado mantendo a sessão ativa",
  async ({ page }) => {
    await expect(page.getByRole("alertdialog")).toBeHidden();
  },
);

Given(
  "que o usuário autenticado possui perfil {string}",
  async ({ page }, perfilStr: string) => {
    const expiresAt = new Date(Date.now() + 3600_000).toISOString();
    const usuario = {
      ...USUARIO_FARMACEUTICO_AC,
      perfilCodigo: perfilStr,
      perfil: [perfilStr],
    };

    await page.addInitScript(
      ({ user, exp }) => {
        localStorage.setItem("@FarmaUBS:usuario", JSON.stringify(user));
        localStorage.setItem("@FarmaUBS:expiresAt", exp);
      },
      { user: usuario, exp: expiresAt },
    );

    await page.route("**/api/v1/acesso/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...usuario,
          expiresAt,
        }),
      });
    });
  },
);

When(
  "ele tentar navegar diretamente para a rota {string}",
  async ({ page }, rotaRestrita: string) => {
    await page.goto(rotaRestrita);
  },
);

Then(
  "a tela de {string} deve ser exibida bloqueando a operação",
  async ({ page }, tituloEsperado: string) => {
    await expect(
      page.getByRole("heading", { name: new RegExp(tituloEsperado, "i") }),
    ).toBeVisible();
  },
);

Given(
  "que o usuário autenticado possui a flag {string} ativa no primeiro acesso",
  async ({ page }, _flag: string) => {
    const expiresAt = new Date(Date.now() + 3600_000).toISOString();
    const usuarioProvisorio = {
      ...USUARIO_FARMACEUTICO_AC,
      deveTrocarSenha: true,
    };

    await page.addInitScript(
      ({ user, exp }) => {
        localStorage.setItem("@FarmaUBS:usuario", JSON.stringify(user));
        localStorage.setItem("@FarmaUBS:expiresAt", exp);
      },
      { user: usuarioProvisorio, exp: expiresAt },
    );

    await page.route("**/api/v1/acesso/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...usuarioProvisorio,
          expiresAt,
        }),
      });
    });

    await page.route("**/api/v1/acesso/trocar-senha", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          mensagem: "Senha alterada com sucesso!",
        }),
      });
    });

    await page.route("**/api/v1/dispensacoes*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          itens: [],
          totalItens: 0,
          pagina: 1,
          limite: 20,
          totalPaginas: 1,
          dataInicioEfetiva: "2026-11-19",
          dataFimEfetiva: "2026-11-20",
        }),
      });
    });
  },
);

When(
  "ele acessar a tela {string} e preencher a senha atual {string} e a nova senha forte {string}",
  async ({ page }, rota: string, _senhaAtual: string, novaSenha: string) => {
    await page.goto(rota);
    await page.locator("#novaSenha").fill(novaSenha);
    await page.locator("#confirmacaoSenha").fill(novaSenha);
  },
);

When(
  "confirmar a alteração clicando em {string}",
  async ({ page }, _botaoTexto: string) => {
    await page
      .getByRole("button", { name: /Confirmar Nova Senha/i })
      .click();
  },
);

Then(
  "o sistema deve confirmar a atualização da senha e liberar o acesso à bancada da UBS",
  async ({ page }) => {
    await expect(
      page
        .getByText(
          /Senha redefinida com sucesso|Bem-vindo\(a\)|Dispensação de Medicamentos/i,
        )
        .first(),
    ).toBeVisible();
  },
);

Given(
  "que o usuário autenticado possui perfil {string} e as APIs administrativas estão operacionais",
  async ({ page }, _perfil: string) => {
    const expiresAt = new Date(Date.now() + 3600_000).toISOString();
    const adminUser = {
      ...USUARIO_FARMACEUTICO_AC,
      nomeCompleto: "Administrador Geral",
      email: "admin@farmaubs.dev",
      perfilCodigo: PerfilCodigo.ADMINISTRADOR,
      perfil: [PerfilCodigo.ADMINISTRADOR],
    };

    await page.addInitScript(
      ({ user, exp }) => {
        localStorage.setItem("@FarmaUBS:usuario", JSON.stringify(user));
        localStorage.setItem("@FarmaUBS:expiresAt", exp);
      },
      { user: adminUser, exp: expiresAt },
    );

    await page.route("**/api/v1/acesso/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...adminUser,
          expiresAt,
        }),
      });
    });

    await page.route("**/api/v1/administracao/municipios*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "01950000-0000-7000-8000-000000000010",
            nome: "Parnaíba",
            uf: "PI",
            codigoIbge: "2207702",
            ativo: true,
          },
        ]),
      });
    });

    await page.route("**/api/v1/usuarios*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: USUARIO_FARMACEUTICO_AC.id,
              nomeCompleto: "Dra. Maria das Graças",
              email: "farma.parnaiba@farmaubs.dev",
              cpf: "11122233344",
              perfilCodigo: PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
              perfilNome: "Farmacêutico Responsável",
              municipioId: "01950000-0000-7000-8000-000000000010",
              municipioNome: "Parnaíba",
              unidades: [{ id: "u-1", nome: "UBS Centro" }],
              ativo: true,
              criadoEm: "2026-10-01T10:00:00.000Z",
            },
          ],
          meta: {
            total: 1,
            page: 1,
            limit: 10,
            totalPages: 1,
          },
        }),
      });
    });
  },
);

When("ele acessar o painel {string}", async ({ page }, rota: string) => {
  await page.goto(rota);
});

Then(
  "a listagem de usuários cadastrados deve exibir {string}",
  async ({ page }, nomeEsperado: string) => {
    await expect(page.getByText(nomeEsperado).first()).toBeVisible();
  },
);
