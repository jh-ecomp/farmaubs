/**
 * [ADR-030 / ADR-032 / RE-05 a RE-09]: Definições de passos BDD (Gherkin em português) para o módulo de Recebimento de Medicamentos.
 * Suporta tanto a Modalidade 1 (Teste de Sistema de Frontend via page.route) quanto a Modalidade 2 (E2E Full-Stack).
 */
import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import AxeBuilder from "@axe-core/playwright";
import {
  PerfilCodigo,
  type CriarEntradaEstoqueRequest,
  type ItemResumoHistoricoRecebimento,
} from "@farmaubs/shared";

const { Given, When, Then } = createBdd();

const USUARIO_FARMACEUTICO_RE = {
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

let ultimoDownloadRecebimentoFilename = "";

Given(
  "que as APIs do módulo de recebimento de medicamentos da UBS estão operacionais",
  async ({ page }) => {
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const hojeIso = new Date().toISOString();

    const historicoMock: ItemResumoHistoricoRecebimento[] = [
      {
        id: "rec-hist-089",
        numeroDocumento: "GUIA-CAF-2026/089",
        tipoDocumento: "GUIA_CAF",
        fornecedorOrigem: "CAF Central - SMS Parnaíba",
        dataRecebimento: hojeIso,
        totalItens: 1,
        totalUnidades: 200,
        usuarioRecebedorNome: USUARIO_FARMACEUTICO_RE.nomeCompleto,
        status: "CONCLUIDO",
        podeEstornar: true,
      },
    ];

    await page.addInitScript(
      ({ user, exp }) => {
        localStorage.setItem("@FarmaUBS:usuario", JSON.stringify(user));
        localStorage.setItem("@FarmaUBS:expiresAt", exp);
        localStorage.setItem("@FarmaUBS:ttlSeconds", "3600");
        localStorage.setItem("@FarmaUBS:warningSeconds", "300");
      },
      { user: USUARIO_FARMACEUTICO_RE, exp: expiresAt },
    );

    await page.route("**/api/v1/acesso/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "X-Session-Expires-At": expiresAt },
        body: JSON.stringify({
          ...USUARIO_FARMACEUTICO_RE,
          expiresAt,
        }),
      });
    });

    await page.route("**/api/v1/catalogo/produtos/busca*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "01950000-0000-7000-8000-000000000105",
            nomeGenerico: "Dipirona Sódica",
            denominacaoGenerica: "Dipirona Sódica",
            principioAtivo: "Dipirona Sódica",
            concentracao: "500mg",
            formaFarmaceutica: "Comprimido",
            unidadeMedida: "Comprimido",
            codigoCatmat: "BR0267203",
            ativo: true,
          },
        ]),
      });
    });

    await page.route("**/api/v1/catalogo/fabricantes*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "01950000-0000-7000-8000-000000000401",
            razaoSocial: "Instituto de Tecnologia em Fármacos — Farmanguinhos",
            nomeFantasia: "Farmanguinhos",
            cnpj: "33781055000135",
            ativo: true,
          },
        ]),
      });
    });

    await page.route(
      "**/api/v1/recebimento/historico/exportar-xlsx*",
      async (route) => {
        const buffer = Buffer.from("504b0304140000000800", "hex");
        await route.fulfill({
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition":
              'attachment; filename="recebimentos_ubs_parnaiba.xlsx"',
          },
          body: buffer,
        });
      },
    );

    await page.route("**/api/v1/recebimento/historico*", async (route) => {
      if (route.request().url().includes("exportar-xlsx")) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          itens: historicoMock,
          total: historicoMock.length,
          pagina: 1,
          limite: 20,
          totalPaginas: 1,
        }),
      });
    });

    await page.route(
      "**/api/v1/recebimento/entradas/*/estorno",
      async (route) => {
        const body = route.request().postDataJSON() as { motivo?: string };
        historicoMock[0].status = "ESTORNADO";
        historicoMock[0].podeEstornar = false;

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: historicoMock[0].id,
            numeroDocumento: historicoMock[0].numeroDocumento,
            status: "ESTORNADO",
            motivoEstorno: body.motivo ?? "",
            dataEstorno: new Date().toISOString(),
            unidadesRevertidas: 200,
          }),
        });
      },
    );

    await page.route("**/api/v1/recebimento/entradas/*", async (route) => {
      if (route.request().url().includes("/estorno")) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "rec-hist-089",
          numeroDocumento: "GUIA-CAF-2026/089",
          tipoDocumento: "GUIA_CAF",
          fornecedorOrigem: "CAF Central - SMS Parnaíba",
          dataRecebimento: hojeIso,
          ubsNome: "UBS Centro — Parnaíba/PI",
          usuarioRecebedorNome: USUARIO_FARMACEUTICO_RE.nomeCompleto,
          status: historicoMock[0].status,
          totalItens: 1,
          totalUnidades: 200,
          itens: [
            {
              id: "item-1",
              produtoId: "01950000-0000-7000-8000-000000000105",
              produtoNome: "Dipirona Sódica",
              concentracao: "500mg",
              formaFarmaceutica: "Comprimido",
              fabricanteId: "01950000-0000-7000-8000-000000000401",
              fabricanteNome: "Farmanguinhos",
              loteId: "lote-dip-99",
              numeroLote: "LT-DIP-99",
              dataValidade: "2027-03-20",
              quantidadeRecebida: 200,
            },
          ],
        }),
      });
    });

    await page.route("**/api/v1/recebimento/entradas", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      const body = route.request().postDataJSON() as CriarEntradaEstoqueRequest;
      const totalUnidades = body.itens.reduce(
        (s, i) => s + i.quantidadeRecebida,
        0,
      );
      historicoMock.unshift({
        id: `rec-${Date.now()}`,
        numeroDocumento: body.numeroDocumento,
        tipoDocumento: body.tipoDocumento,
        fornecedorOrigem: body.fornecedorOrigem,
        dataRecebimento: hojeIso,
        totalItens: body.itens.length,
        totalUnidades,
        usuarioRecebedorNome: USUARIO_FARMACEUTICO_RE.nomeCompleto,
        status: "CONCLUIDO",
        podeEstornar: true,
      });

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          entradaId: `rec-${Date.now()}`,
          numeroDocumento: body.numeroDocumento,
          tipoDocumento: body.tipoDocumento,
          fornecedorOrigem: body.fornecedorOrigem,
          dataRecebimento: hojeIso,
          totalItensProcessados: body.itens.length,
          totalUnidadesAbastecidas: totalUnidades,
          lotesAtualizados: [],
          avisosValidadeCurta: [],
        }),
      });
    });
  },
);

Given(
  "que o farmacêutico autenticado acessou a tela de recebimentos da UBS",
  async ({ page }) => {
    await page.goto("/recebimento");
    await expect(
      page.getByRole("heading", {
        name: /Recebimento de Medicamentos e Abastecimento/i,
      }),
    ).toBeVisible();
  },
);

When(
  "navega pelo menu lateral para a bancada de {string}",
  async ({ page }, nomeMenu: string) => {
    await page
      .getByRole("link", { name: new RegExp(`^${nomeMenu}$`, "i") })
      .click();
    await expect(
      page.getByRole("heading", {
        name: /Recebimento de Medicamentos e Abastecimento/i,
      }),
    ).toBeVisible();
  },
);

When(
  "ele preencher a guia {string} com origem {string}",
  async ({ page }, numeroDoc: string, origem: string) => {
    await page.locator("#numeroDocumento").fill(numeroDoc);
    await page.locator("#fornecedorOrigem").selectOption(origem);
  },
);

When(
  "adicionar o medicamento {string} do fabricante {string} com lote {string}, validade curta em {int} dias e quantidade {int}",
  async (
    { page },
    nomeMed: string,
    nomeFab: string,
    numeroLote: string,
    diasValidade: number,
    qtd: number,
  ) => {
    const inputBusca = page.locator("#buscaMedicamentoCatalogo");
    await inputBusca.fill(nomeMed);

    const opcao = page
      .getByRole("option", { name: new RegExp(nomeMed, "i") })
      .first();
    await expect(opcao).toBeVisible();
    await opcao.click();

    await page
      .locator("#fabricanteLoteSelect")
      .selectOption({ label: nomeFab });
    await page.locator("#codigoLoteInput").fill(numeroLote);

    const dataVal = new Date();
    dataVal.setDate(dataVal.getDate() + diasValidade);
    const isoValidade = `${dataVal.getFullYear()}-${String(dataVal.getMonth() + 1).padStart(2, "0")}-${String(dataVal.getDate()).padStart(2, "0")}`;
    await page.locator("#dataValidadeInput").fill(isoValidade);

    await expect(
      page.getByText(/Atenção: lote com validade inferior a 6 meses/i),
    ).toBeVisible();

    await page.locator("#quantidadeRecebidaInput").fill(String(qtd));
    await page
      .getByRole("button", { name: /Adicionar Item à Guia/i })
      .click();
  },
);

Then(
  "o alerta visual de validade curta deve ser exibido na lista provisória da guia",
  async ({ page }) => {
    await expect(page.getByText(/Validade curta/i).first()).toBeVisible();
  },
);

Then(
  "a tela de recebimento não deve apresentar violações críticas de acessibilidade WCAG 2.1 AA",
  async ({ page }) => {
    const resultadoAxe = await new AxeBuilder({ page })
      .include('[data-testid="pagina-recebimento"]')
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(resultadoAxe.violations).toEqual([]);
  },
);

When(
  "ele clicar em {string} e confirmar em {string}",
  async ({ page }, btnAbrirModal: string, btnConfirmarModal: string) => {
    await page
      .getByRole("button", { name: new RegExp(btnAbrirModal, "i") })
      .click();
    await page
      .getByRole("button", { name: new RegExp(btnConfirmarModal, "i") })
      .click();
  },
);

Then(
  "a entrada de recebimento deve ser gravada com sucesso exibindo a notificação de abastecimento",
  async ({ page }) => {
    await expect(
      page.getByText(/Entrada registrada! O estoque da UBS foi abastecido com sucesso/i),
    ).toBeVisible();
  },
);

Given(
  "que o farmacêutico autenticado acessou a aba de histórico de recebimentos filtrada em {string}",
  async ({ page }, _atalho: string) => {
    await page.goto("/recebimento");
    await page
      .getByRole("tab", { name: /Últimos Recebimentos/i })
      .click();
    await expect(page.getByText("GUIA-CAF-2026/089")).toBeVisible();
  },
);

When(
  "ele clicar em {string} na guia {string} e o navegador entrar em modo de impressão \\({string}\\)",
  async ({ page }, _acao: string, _guia: string, _mediaStr: string) => {
    await page
      .getByRole("button", { name: /Comprovante/i })
      .first()
      .click();
    await expect(page.locator("#termoRecebimentoPrintArea")).toBeVisible();
    await page.emulateMedia({ media: "print" });
  },
);

Then(
  "a área oficial {string} deve estar visível no modo de impressão",
  async ({ page }, seletorArea: string) => {
    const area = page.locator(seletorArea);
    await expect(area).toBeVisible();
    const visibility = await area.evaluate(
      (el) => window.getComputedStyle(el).visibility,
    );
    expect(visibility).toBe("visible");
  },
);

When(
  "ele voltar ao modo de tela, fechar o modal de comprovante e clicar em {string} no histórico de recebimentos",
  async ({ page }, _btnExportar: string) => {
    await page.emulateMedia({ media: "screen" });
    await page.getByRole("button", { name: /Fechar comprovante/i }).click();

    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: /Exportar planilha|\.xlsx/i })
      .first()
      .click();
    const download = await downloadPromise;
    ultimoDownloadRecebimentoFilename = download.suggestedFilename();
  },
);

Then(
  "o arquivo Excel {string} de recebimentos deve ser baixado nativamente pelo navegador",
  async ({}, extensao: string) => {
    expect(ultimoDownloadRecebimentoFilename.toLowerCase()).toContain(
      extensao.toLowerCase(),
    );
  },
);

When(
  "ele acionar {string} na guia {string}",
  async ({ page }, _acao: string, _guia: string) => {
    await page
      .getByRole("button", { name: /Estornar/i })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: /Estornar Guia de Recebimento/i }),
    ).toBeVisible();
  },
);

When(
  "preencher a justificativa de estorno de recebimento {string} e confirmar",
  async ({ page }, motivo: string) => {
    await page.locator("#motivoEstornoRecebimento").fill(motivo);
    await page
      .getByRole("button", { name: /Confirmar Estorno/i })
      .click();
  },
);

Then(
  "a guia {string} deve passar a exibir o status {string}",
  async ({ page }, _guia: string, statusEsperado: string) => {
    await expect(
      page.locator("table").getByText(statusEsperado).first(),
    ).toBeVisible();
  },
);

Then(
  "a guia {string} deve constar na tabela de histórico de recebimentos como {string}",
  async ({ page }, numeroGuia: string, statusEsperado: string) => {
    await expect(page.locator("table").getByText(numeroGuia)).toBeVisible();
    await expect(
      page.locator("table").getByText(statusEsperado).first(),
    ).toBeVisible();
  },
);
