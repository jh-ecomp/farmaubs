/**
 * [ADR-030 / ADR-032 / RF010 / RF012]: Definições de passos BDD (Gherkin em português) para o módulo de Dispensação.
 * Suporta tanto a Modalidade 1 (Teste de Sistema de Frontend com interceptação via page.route)
 * quanto a Modalidade 2 (Teste E2E Full-Stack contra servidor HTTP de API real).
 */
import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import AxeBuilder from "@axe-core/playwright";
import { PerfilCodigo } from "@farmaubs/shared";

const { Given, When, Then } = createBdd();

const USUARIO_FARMACEUTICO_MOCK = {
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

/**
 * [Modalidade 1 - Sistema Frontend]: Configura interceptação de rotas HTTP via page.route()
 * devolvendo contratos estritos do @farmaubs/shared.
 */
Given(
  "que as APIs da bancada de dispensação da UBS estão operacionais",
  async ({ page }) => {
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();

    await page.addInitScript(
      ({ user, exp }) => {
        localStorage.setItem("@FarmaUBS:usuario", JSON.stringify(user));
        localStorage.setItem("@FarmaUBS:expiresAt", exp);
        localStorage.setItem("@FarmaUBS:ttlSeconds", "3600");
        localStorage.setItem("@FarmaUBS:warningSeconds", "300");
      },
      { user: USUARIO_FARMACEUTICO_MOCK, exp: expiresAt },
    );

    await page.route("**/api/v1/acesso/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "X-Session-Expires-At": expiresAt },
        body: JSON.stringify({
          ...USUARIO_FARMACEUTICO_MOCK,
          expiresAt,
        }),
      });
    });

    await page.route("**/api/v1/dispensacao/pacientes*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route("**/api/v1/dispensacao/medicamentos?*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "01950000-0000-7000-8000-000000000101",
            principioAtivo: "Losartana Potássica",
            nomeComercial: "Losartana",
            apresentacao: "50mg Comprimido",
            categoria: "BASICO",
            antimicrobiano: false,
            saldoTotalUbs: 120,
          },
          {
            id: "01950000-0000-7000-8000-000000000102",
            principioAtivo: "Amoxicilina",
            nomeComercial: "Amoxicilina",
            apresentacao: "500mg Cápsula",
            categoria: "ANTIBIOTICO",
            antimicrobiano: true,
            saldoTotalUbs: 90,
          },
        ]),
      });
    });

    await page.route(
      "**/api/v1/dispensacao/medicamentos/*/lotes-fefo*",
      async (route) => {
        const reqUrl = route.request().url();
        const isAmoxicilina = reqUrl.includes("000000000102");
        if (isAmoxicilina) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              medicamento: {
                id: "01950000-0000-7000-8000-000000000102",
                principioAtivo: "Amoxicilina",
                apresentacao: "500mg Cápsula",
                categoria: "ANTIBIOTICO",
                antimicrobiano: true,
                saldoTotalUbs: 90,
              },
              loteSugerido: {
                id: "01950000-0000-7000-8000-000000000205",
                numeroLote: "LOT-AMX-2027",
                dataValidade: "2027-06-15",
                saldoDisponivel: 90,
                sugeridoFefo: true,
                diasParaVencimento: 180,
                alertaValidadeCurta: false,
                vencido: false,
              },
              lotesDisponiveis: [
                {
                  id: "01950000-0000-7000-8000-000000000205",
                  numeroLote: "LOT-AMX-2027",
                  dataValidade: "2027-06-15",
                  saldoDisponivel: 90,
                  sugeridoFefo: true,
                  diasParaVencimento: 180,
                  alertaValidadeCurta: false,
                  vencido: false,
                },
              ],
            }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            medicamento: {
              id: "01950000-0000-7000-8000-000000000101",
              principioAtivo: "Losartana Potássica",
              apresentacao: "50mg Comprimido",
              categoria: "BASICO",
              antimicrobiano: false,
              saldoTotalUbs: 120,
            },
            loteSugerido: {
              id: "01950000-0000-7000-8000-000000000201",
              numeroLote: "LOT-2026-FEFO-A",
              dataValidade: "2027-02-15",
              saldoDisponivel: 120,
              sugeridoFefo: true,
              diasParaVencimento: 90,
              alertaValidadeCurta: false,
              vencido: false,
            },
            lotesDisponiveis: [
              {
                id: "01950000-0000-7000-8000-000000000201",
                numeroLote: "LOT-2026-FEFO-A",
                dataValidade: "2027-02-15",
                saldoDisponivel: 120,
                sugeridoFefo: true,
                diasParaVencimento: 90,
                alertaValidadeCurta: false,
                vencido: false,
              },
            ],
          }),
        });
      },
    );

    const hojeIso = new Date().toISOString();
    await page.route(/\/api\/v1\/dispensacoes(\/.*|\?.*)?$/, async (route) => {
      const req = route.request();
      const url = req.url();

      if (url.includes("/exportar-xlsx")) {
        await route.fulfill({
          status: 200,
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          headers: {
            "Content-Disposition":
              'attachment; filename="dispensacoes_ubs_2026-10-01_2026-10-02.xlsx"',
          },
          body: Buffer.from("504b0304140000000800", "hex"),
        });
        return;
      }

      if (url.includes("/estorno") && req.method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            dispensacaoId: "disp-hist-1",
            status: "estornada",
            motivoEstorno: "Digitado item incorreto por engano na bancada",
            estornadoEm: new Date().toISOString(),
            lotesRestituidos: [],
          }),
        });
        return;
      }

      if (req.method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "disp-999",
            numeroAtendimento: "ATD-2026-0999",
            dataAtendimento: hojeIso,
            status: "concluida",
            paciente: {
              id: "pac-1",
              nomeCompleto: "Ana Paula Mendes",
              cpf: "12345678909",
              cns: "700001122334455",
            },
            dispensador: {
              id: USUARIO_FARMACEUTICO_MOCK.id,
              nomeCompleto: USUARIO_FARMACEUTICO_MOCK.nomeCompleto,
            },
            itens: [
              {
                itemId: "item-1",
                medicamentoId: "01950000-0000-7000-8000-000000000101",
                medicamentoNome: "Losartana Potássica - 50mg Comprimido",
                loteId: "01950000-0000-7000-8000-000000000201",
                numeroLote: "LOT-2026-FEFO-A",
                quantidadeDispensada: 1,
                saldoRestanteLote: 119,
              },
            ],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          itens: [
            {
              id: "disp-hist-1",
              numeroAtendimento: "ATD-2026-0001",
              dataAtendimento: hojeIso,
              status: "concluida",
              pacienteNome: "Maria Silva",
              pacienteCpf: "11122233344",
              pacienteCns: "700000000000001",
              dispensadorNome: USUARIO_FARMACEUTICO_MOCK.nomeCompleto,
              totalItens: 1,
              medicamentosResumo: "Losartana Potássica (30)",
            },
          ],
          totalItens: 1,
          pagina: 1,
          limite: 20,
          totalPaginas: 1,
          dataInicioEfetiva: hojeIso.slice(0, 10),
          dataFimEfetiva: hojeIso.slice(0, 10),
        }),
      });
    });
  },
);

Given(
  "que o farmacêutico autenticado acessa a tela principal de dispensação",
  async ({ page }) => {
    await page.goto("/dispensacao");
    await expect(page.getByTestId("pagina-dispensacao")).toBeVisible();
  },
);

Given(
  "que o farmacêutico autenticado acessa a aba de histórico de dispensações",
  async ({ page }) => {
    await page.goto("/dispensacao");
    await page
      .getByRole("tab", { name: /Histórico de Atendimentos/i })
      .click();
    await expect(
      page.getByTestId("painel-historico-dispensacoes"),
    ).toBeVisible();
  },
);

/**
 * [Modalidade 2 - E2E Full-Stack]: Reinicia o estado do servidor HTTP de backend antes do cenário.
 */
Given(
  "que o servidor de backend está com o estoque inicial da UBS de Parnaíba carregado",
  async ({ request }) => {
    const res = await request.post("http://127.0.0.1:3000/api/v1/test/reset");
    expect(res.ok()).toBeTruthy();
  },
);

When(
  "o farmacêutico realiza login com o e-mail {string} e senha {string}",
  async ({ page }, email: string, senha: string) => {
    await page.goto("/login");
    await page.getByLabel(/E-mail institucional/i).fill(email);
    await page.getByLabel(/^Senha$/i).fill(senha);
    await page.getByRole("button", { name: /Entrar no FarmaUBS/i }).click();
  },
);

Then(
  "ele deve ser redirecionado para a bancada de {string}",
  async ({ page }, tituloEsperado: string) => {
    await expect(
      page.getByRole("heading", { name: new RegExp(tituloEsperado, "i") }).first(),
    ).toBeVisible();
  },
);

/**
 * Preenche os 4 dados obrigatórios do paciente na tela de dispensação.
 */
async function preencherDadosObrigatoriosPaciente(page: import("@playwright/test").Page) {
  await page.getByLabel(/CPF/i).fill("12345678909");
  await page.getByLabel(/Cartão Nacional de Saúde/i).fill("700001122334455");
  await page.getByLabel(/Nome Completo/i).fill("Ana Paula Mendes");
  await page.getByLabel(/Data de Nascimento/i).fill("10041985");
}

Given(
  "que o farmacêutico preenche os 4 dados obrigatórios do paciente",
  async ({ page }) => {
    await preencherDadosObrigatoriosPaciente(page);
  },
);

When(
  "o farmacêutico preenche os {int} dados obrigatórios do paciente",
  async ({ page }, qtd: number) => {
    expect(qtd).toBe(4);
    await preencherDadosObrigatoriosPaciente(page);
  },
);

Given(
  "adiciona 1 medicamento válido com lote FEFO ao carrinho",
  async ({ page }) => {
    const combobox = page.getByRole("combobox");
    await combobox.fill("losartana");

    const opcao = page.getByRole("option", {
      name: /Losartana Potássica - 50mg Comprimido/i,
    });
    await expect(opcao).toBeVisible();
    await opcao.click();

    const botaoAdicionar = page.getByRole("button", {
      name: /Adicionar ao Atendimento/i,
    });
    await expect(botaoAdicionar).toBeEnabled();
    await botaoAdicionar.click();
  },
);

When("todos os critérios estiverem válidos", async ({ page }) => {
  await expect(
    page.getByRole("button", { name: /Finalizar Atendimento/i }),
  ).toBeVisible();
});

Then(
  "o botão {string} deve se tornar clicável",
  async ({ page }, nomeBotao: string) => {
    const botao = page.getByRole("button", {
      name: new RegExp(nomeBotao, "i"),
    });
    await expect(botao).toBeEnabled();
  },
);

Then(
  "a tela de dispensação não deve apresentar violações críticas de acessibilidade WCAG 2.1 AA",
  async ({ page }) => {
    const resultadoAxe = await new AxeBuilder({ page })
      .include('[data-testid="pagina-dispensacao"]')
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(resultadoAxe.violations).toEqual([]);
  },
);

When("o farmacêutico clica em {string}", async ({ page }, nomeBotao: string) => {
  await page.getByRole("button", { name: new RegExp(nomeBotao, "i") }).click();
});

Then(
  "o modal de confirmação deve listar os dados do paciente e o resumo dos itens",
  async ({ page }) => {
    const modal = page.getByTestId("modal-confirmacao-dispensacao");
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("Ana Paula Mendes");
    await expect(modal).toContainText("LOT-2026-FEFO-A");
  },
);

When(
  "o farmacêutico clica em {string} e a API responde com 201 Created",
  async ({ page }, nomeBotao: string) => {
    await page
      .getByRole("button", { name: new RegExp(nomeBotao, "i") })
      .click();
  },
);

When(
  "confirma a baixa clicando em {string}",
  async ({ page }, nomeBotao: string) => {
    const modal = page.getByTestId("modal-confirmacao-dispensacao");
    await expect(modal).toBeVisible();
    await page
      .getByRole("button", { name: new RegExp(nomeBotao, "i") })
      .click();
  },
);

Then(
  "uma mensagem de sucesso do atendimento deve ser exibida",
  async ({ page }) => {
    const toast = page.getByTestId("toast-dispensacao");
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/Atendimento #ATD-2026-0\d+ finalizado com sucesso!/i);
  },
);

Then(
  "os campos de paciente e o carrinho da receita devem ser resetados para novo atendimento",
  async ({ page }) => {
    await expect(page.getByLabel(/Nome Completo/i)).toHaveValue("");
    await expect(
      page.getByText(/Nenhum medicamento adicionado à receita/i),
    ).toBeVisible();
  },
);

When("a tela de histórico terminar de carregar", async ({ page }) => {
  await expect(
    page.getByRole("table", { name: /Tabela de Histórico de Dispensações/i }),
  ).toBeVisible();
});

Then(
  "o seletor de período deve estar ativo no atalho {string}",
  async ({ page }, nomeAtalho: string) => {
    const botaoAtalho = page.getByRole("button", {
      name: new RegExp(`^${nomeAtalho}$`, "i"),
    });
    await expect(botaoAtalho).toHaveAttribute("aria-pressed", "true");
  },
);

Then(
  "a tabela deve exibir as dispensações ocorridas nesse intervalo",
  async ({ page }) => {
    await expect(page.getByText("Maria Silva")).toBeVisible();
  },
);

When(
  "o farmacêutico clicar no botão {string}",
  async ({ page }, nomeBotao: string) => {
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: new RegExp(nomeBotao, "i") })
      .click();
    const download = await downloadPromise;
    (page as unknown as { _ultimoDownloadNome?: string })._ultimoDownloadNome =
      download.suggestedFilename();
  },
);

Then(
  "o arquivo Excel {string} deve ser baixado nativamente pelo navegador",
  async ({ page }, extensao: string) => {
    const nome =
      (page as unknown as { _ultimoDownloadNome?: string })
        ._ultimoDownloadNome ?? "";
    expect(nome.endsWith(extensao)).toBe(true);
  },
);

Given(
  "que o farmacêutico clica em {string} para um atendimento com status {string}",
  async ({ page }, acao: string, statusAtual: string) => {
    const tabela = page.getByRole("table", {
      name: /Tabela de Histórico de Dispensações/i,
    });
    await expect(tabela).toBeVisible();
    await expect(tabela).toContainText(statusAtual);
    await page
      .getByRole("button", { name: new RegExp(`^${acao}$`, "i") })
      .first()
      .click();
    await expect(page.getByTestId("modal-estorno-dispensacao")).toBeVisible();
  },
);

When(
  "preencher o motivo com {string} e confirmar",
  async ({ page }, motivo: string) => {
    await page.getByLabel(/Justificativa \/ Motivo do Estorno/i).fill(motivo);
    await page
      .getByRole("button", { name: /Confirmar Estorno/i })
      .click();
  },
);

Then(
  "o status da linha na tabela deve mudar para {string}",
  async ({ page }, novoStatus: string) => {
    await expect(
      page.getByTestId("status-atendimento-disp-hist-1"),
    ).toHaveText(novoStatus);
  },
);

When(
  "o farmacêutico alterna para a aba {string}",
  async ({ page }, nomeAba: string) => {
    await page.getByRole("tab", { name: new RegExp(nomeAba, "i") }).click();
  },
);

Then(
  "o novo atendimento do paciente {string} deve constar na tabela como {string}",
  async ({ page }, nomePaciente: string, statusEsperado: string) => {
    const tabela = page.getByRole("table", {
      name: /Tabela de Histórico de Dispensações/i,
    });
    await expect(tabela).toBeVisible();
    await expect(tabela).toContainText(nomePaciente);
    await expect(tabela).toContainText(statusEsperado);
  },
);

When(
  "ele adiciona o antimicrobiano {string} ao carrinho",
  async ({ page }, rotuloMed: string) => {
    const combobox = page.getByRole("combobox");
    await combobox.fill("amoxicilina");

    const opcao = page.getByRole("option", {
      name: new RegExp(rotuloMed.split(" - ")[0], "i"),
    });
    await expect(opcao).toBeVisible();
    await opcao.click();

    const botaoAdicionar = page.getByRole("button", {
      name: /Adicionar ao Atendimento/i,
    });
    await expect(botaoAdicionar).toBeEnabled();
    await botaoAdicionar.click();
  },
);

When(
  "informa uma data de emissão da receita médica anterior a 10 dias",
  async ({ page }) => {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    const isoVencida = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    await page.locator("#data-emissao-receita-input").fill(isoVencida);
  },
);

Then(
  "deve ser exibido o alerta de receita de antimicrobiano fora da validade legal",
  async ({ page }) => {
    await expect(page.getByTestId("erro-receita-expirada")).toBeVisible();
  },
);

Then(
  "o botão {string} deve permanecer desabilitado",
  async ({ page }, nomeBotao: string) => {
    await expect(
      page.getByRole("button", { name: new RegExp(nomeBotao, "i") }),
    ).toBeDisabled();
  },
);

