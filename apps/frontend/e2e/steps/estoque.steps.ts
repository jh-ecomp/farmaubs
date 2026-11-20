/**
 * [ADR-030 / ADR-032 / ES-06 a ES-11]: Definições de passos BDD (Gherkin em português) para o módulo de Controle de Estoque.
 * Suporta tanto a Modalidade 1 (Teste de Sistema de Frontend via page.route) quanto a Modalidade 2 (E2E Full-Stack).
 */
import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import AxeBuilder from "@axe-core/playwright";
import {
  PerfilCodigo,
  type MedicamentoSaldoItemDto,
  type MovimentacaoLoteItemDto,
  type RegistrarAjusteLoteInputDto,
} from "@farmaubs/shared";

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

let ultimoDownloadEstoqueFilename = "";

Given(
  "que as APIs do módulo de controle de estoque da UBS estão operacionais",
  async ({ page }) => {
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const mesCorrentePrefix = new Date().toISOString().slice(0, 7);

    const saldosMock: MedicamentoSaldoItemDto[] = [
      {
        produtoId: "01950000-0000-7000-8000-000000000101",
        nome: "Losartana Potássica 50mg",
        principioAtivo: "Losartana Potássica",
        formaFarmaceutica: "Comprimido",
        concentracao: "50mg",
        unidadeMedida: "comp",
        categoria: "ANTI-HIPERTENSIVO",
        saldoTotal: 150,
        statusEstoque: "REGULAR",
        lotes: [
          {
            id: "01950000-0000-7000-8000-000000000201",
            numeroLote: "LT-LOS-01",
            fabricanteId: "fab-1",
            fabricanteNome: "Farmanguinhos / Fiocruz",
            dataValidade: `${mesCorrentePrefix}-28`,
            saldoAtual: 50,
            statusValidade: "MES_CORRENTE",
          },
          {
            id: "01950000-0000-7000-8000-000000000202",
            numeroLote: "LT-LOS-02",
            fabricanteId: "fab-2",
            fabricanteNome: "EMS",
            dataValidade: "2027-10-20",
            saldoAtual: 100,
            statusValidade: "REGULAR",
          },
        ],
      },
      {
        produtoId: "01950000-0000-7000-8000-000000000102",
        nome: "Amoxicilina 500mg",
        principioAtivo: "Amoxicilina",
        formaFarmaceutica: "Cápsula",
        concentracao: "500mg",
        unidadeMedida: "caps",
        categoria: "ANTIBIOTICO",
        saldoTotal: 15,
        statusEstoque: "BAIXO_ESTOQUE",
        lotes: [
          {
            id: "01950000-0000-7000-8000-000000000203",
            numeroLote: "LT-AMX-01",
            fabricanteId: "fab-3",
            fabricanteNome: "Medley",
            dataValidade: "2027-06-15",
            saldoAtual: 15,
            statusValidade: "REGULAR",
          },
        ],
      },
    ];

    const movimentacoesMock: Record<string, MovimentacaoLoteItemDto[]> = {
      "01950000-0000-7000-8000-000000000201": [
        {
          id: "mov-init-1",
          dataHora: new Date().toISOString(),
          tipoMovimentacao: "ENTRADA_RECEBIMENTO",
          operacao: "+",
          quantidade: 50,
          saldoResultante: 50,
          documentoReferencia: "CAF-2026-0901",
          usuarioResponsavel: {
            id: USUARIO_FARMACEUTICO_MOCK.id,
            nome: USUARIO_FARMACEUTICO_MOCK.nomeCompleto,
          },
        },
      ],
    };

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

    await page.route("**/api/v1/estoque/metricas*", async (route) => {
      const todosLotes = saldosMock.flatMap((m) => m.lotes);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totalMedicamentosAtivos: saldosMock.length,
          totalUnidadesFisicas: todosLotes.reduce(
            (s, l) => s + l.saldoAtual,
            0,
          ),
          itensRiscoRuptura: saldosMock.filter(
            (m) => m.statusEstoque === "BAIXO_ESTOQUE",
          ).length,
          lotesValidadeMesAtual: todosLotes.filter(
            (l) => l.statusValidade === "MES_CORRENTE",
          ).length,
          lotesValidadeCurta90d: todosLotes.filter(
            (l) =>
              l.statusValidade === "MES_CORRENTE" ||
              l.statusValidade === "CURTA_90D",
          ).length,
          lotesVencidos: 0,
          calculadoEm: new Date().toISOString(),
        }),
      });
    });

    await page.route("**/api/v1/estoque/saldos*", async (route) => {
      const url = new URL(route.request().url());
      const filtroValidade = url.searchParams.get("filtroValidade") ?? "TODOS";
      const statusEstoque = url.searchParams.get("statusEstoque") ?? "TODOS";
      const termo = (url.searchParams.get("termo") ?? "").toLowerCase();

      const filtrados = saldosMock.filter((m) => {
        if (
          termo &&
          !m.nome.toLowerCase().includes(termo) &&
          !m.principioAtivo.toLowerCase().includes(termo)
        ) {
          return false;
        }
        if (statusEstoque !== "TODOS" && m.statusEstoque !== statusEstoque) {
          return false;
        }
        if (
          filtroValidade === "MES_CORRENTE" &&
          !m.lotes.some((l) => l.statusValidade === "MES_CORRENTE")
        ) {
          return false;
        }
        return true;
      });

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          itens: filtrados,
          total: filtrados.length,
          pagina: 1,
          itensPorPagina: 15,
          totalPaginas: 1,
        }),
      });
    });

    await page.route("**/api/v1/estoque/lotes/*/ajustes", async (route) => {
      const url = new URL(route.request().url());
      const match = url.pathname.match(/\/lotes\/([^/]+)\/ajustes$/);
      const loteId = match?.[1] ?? "";
      const body = route.request().postDataJSON() as RegistrarAjusteLoteInputDto;

      let saldoAnterior = 50;
      let saldoAtualizado = 48;

      for (const med of saldosMock) {
        const lote = med.lotes.find((l) => l.id === loteId);
        if (lote) {
          saldoAnterior = lote.saldoAtual;
          saldoAtualizado =
            body.tipoOperacao === "ENTRADA"
              ? saldoAnterior + body.quantidade
              : saldoAnterior - body.quantidade;
          lote.saldoAtual = saldoAtualizado;
          med.saldoTotal = med.lotes.reduce((s, l) => s + l.saldoAtual, 0);
        }
      }

      if (!movimentacoesMock[loteId]) {
        movimentacoesMock[loteId] = [];
      }
      movimentacoesMock[loteId].unshift({
        id: `mov-${Date.now()}`,
        dataHora: new Date().toISOString(),
        tipoMovimentacao:
          body.tipoOperacao === "ENTRADA" ? "AJUSTE_ENTRADA" : "AJUSTE_SAIDA",
        operacao: body.tipoOperacao === "ENTRADA" ? "+" : "-",
        quantidade: body.quantidade,
        saldoResultante: saldoAtualizado,
        motivo: body.motivo,
        justificativa: body.justificativa,
        usuarioResponsavel: {
          id: USUARIO_FARMACEUTICO_MOCK.id,
          nome: USUARIO_FARMACEUTICO_MOCK.nomeCompleto,
        },
      });

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          movimentacaoId: `mov-${Date.now()}`,
          loteId,
          tipoOperacao: body.tipoOperacao,
          quantidadeAjustada: body.quantidade,
          saldoAnterior,
          saldoAtualizado,
          motivo: body.motivo,
          justificativa: body.justificativa,
          realizadoPor: {
            id: USUARIO_FARMACEUTICO_MOCK.id,
            nome: USUARIO_FARMACEUTICO_MOCK.nomeCompleto,
          },
          dataHora: new Date().toISOString(),
        }),
      });
    });

    await page.route(
      "**/api/v1/estoque/lotes/*/rastreabilidade",
      async (route) => {
        const url = new URL(route.request().url());
        const match = url.pathname.match(/\/lotes\/([^/]+)\/rastreabilidade$/);
        const loteId = match?.[1] ?? "";
        const med = saldosMock[0];
        const lote =
          med.lotes.find((l) => l.id === loteId) ?? med.lotes[0];

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            lote: {
              id: lote.id,
              numeroLote: lote.numeroLote,
              dataValidade: lote.dataValidade,
              dataCadastro: "2026-09-01T10:00:00.000Z",
              saldoAtual: lote.saldoAtual,
              saldoInicial: 50,
              fabricanteNome: lote.fabricanteNome,
            },
            medicamento: {
              id: med.produtoId,
              nome: med.nome,
              principioAtivo: med.principioAtivo,
              apresentacao: `${med.concentracao} ${med.formaFarmaceutica}`,
            },
            movimentacoes: movimentacoesMock[lote.id] ?? [],
          }),
        });
      },
    );

    await page.route(
      "**/api/v1/estoque/relatorios/exportar-xlsx*",
      async (route) => {
        const url = new URL(route.request().url());
        const tipo =
          url.searchParams.get("tipoRelatorio") ?? "PERDAS_VENCIMENTO";
        const buffer = Buffer.from("504b0304140000000800", "hex");

        await route.fulfill({
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="relatorio_estoque_${tipo}.xlsx"`,
          },
          body: buffer,
        });
      },
    );
  },
);

Given(
  "que o farmacêutico autenticado acessa o painel de Controle de Estoque da UBS",
  async ({ page }) => {
    await page.goto("/estoque");
    await expect(
      page.getByRole("heading", { name: /Posição do Estoque Atual/i }),
    ).toBeVisible();
  },
);

When(
  "navega pelo menu lateral para o módulo de {string}",
  async ({ page }, nomeMenu: string) => {
    await page
      .getByRole("link", { name: new RegExp(`^${nomeMenu}$`, "i") })
      .click();
    await expect(
      page.getByRole("heading", { name: /Posição do Estoque Atual/i }),
    ).toBeVisible();
  },
);

When(
  "ele clicar no cartão {string}",
  async ({ page }, tituloCard: string) => {
    if (tituloCard.toLowerCase().includes("vencendo no mês")) {
      await page.getByTestId("card-validade-mes").click();
    } else {
      await page.getByTestId("card-risco-ruptura").click();
    }
  },
);

When(
  "expandir a linha do medicamento {string} na tabela de saldos",
  async ({ page }, nomeMed: string) => {
    await page
      .getByRole("button", { name: new RegExp(`Expandir lotes de ${nomeMed}`, "i") })
      .click();
  },
);

Given(
  "que o farmacêutico expandiu os lotes do medicamento {string}",
  async ({ page }, nomeMed: string) => {
    await page
      .getByRole("button", { name: new RegExp(`Expandir lotes de ${nomeMed}`, "i") })
      .click();
  },
);

Then(
  "o lote {string} deve exibir o badge de validade na cor laranja",
  async ({ page }, numeroLote: string) => {
    const badge = page.getByTestId(`badge-validade-${numeroLote}`);
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute("data-cor-badge", "laranja");
  },
);

Then(
  "a tela de estoque não deve apresentar violações de contraste ou acessibilidade WCAG 2.1 AA",
  async ({ page }) => {
    const resultadoAxe = await new AxeBuilder({ page })
      .include('[data-testid="pagina-estoque"]')
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(resultadoAxe.violations).toEqual([]);
  },
);

When(
  "ele acionar {string} no lote {string}",
  async ({ page }, _acao: string, numeroLote: string) => {
    await page.getByTestId(`btn-ajuste-lote-${numeroLote}`).click();
    await expect(page.getByTestId("modal-ajuste-estoque")).toBeVisible();
  },
);

When(
  "selecionar o motivo {string} e digitar a justificativa curta {string}",
  async ({ page }, _motivo: string, textoCurto: string) => {
    await page.getByTestId("select-motivo-ajuste").selectOption("OUTRO");
    await page.getByTestId("textarea-justificativa-ajuste").fill(textoCurto);
  },
);

Then(
  "o botão {string} deve permanecer desabilitado com aviso de mínimo de 20 caracteres",
  async ({ page }, _nomeBotao: string) => {
    await expect(page.getByTestId("btn-confirmar-ajuste")).toBeDisabled();
    await expect(page.getByTestId("aviso-justificativa-ajuste")).toContainText(
      "O motivo 'Outro' exige justificativa detalhada com no mínimo 20 caracteres",
    );
  },
);

When(
  "ele registrar saída de {int} unidades por {string} com justificativa válida e confirmar",
  async ({ page }, qtd: number, _motivoRotulo: string) => {
    await page.getByTestId("btn-operacao-saida").click();
    await page.getByTestId("input-quantidade-ajuste").fill(String(qtd));
    await page.getByTestId("select-motivo-ajuste").selectOption("AVARIA_FISICA");
    await page
      .getByTestId("textarea-justificativa-ajuste")
      .fill("Frasco quebrou durante manuseio na bancada da farmácia");
    await page.getByTestId("btn-confirmar-ajuste").click();
    await expect(page.getByTestId("modal-ajuste-estoque")).toBeHidden();
  },
);

When(
  "registrar saída de {int} unidades por {string} com justificativa válida e confirmar",
  async ({ page }, qtd: number, _motivoRotulo: string) => {
    await page.getByTestId("btn-operacao-saida").click();
    await page.getByTestId("input-quantidade-ajuste").fill(String(qtd));
    await page.getByTestId("select-motivo-ajuste").selectOption("AVARIA_FISICA");
    await page
      .getByTestId("textarea-justificativa-ajuste")
      .fill("Frasco quebrou durante manuseio na bancada da farmácia");
    await page.getByTestId("btn-confirmar-ajuste").click();
    await expect(page.getByTestId("modal-ajuste-estoque")).toBeHidden();
  },
);

Then(
  "o saldo do lote {string} na tabela deve ser atualizado para {string} unidades",
  async ({ page }, numeroLote: string, saldoEsperado: string) => {
    await expect(page.getByTestId(`saldo-lote-${numeroLote}`)).toContainText(
      saldoEsperado,
    );
  },
);

Then(
  "ao abrir a {string} do lote {string}, o ajuste recém-realizado deve constar no topo da linha do tempo",
  async ({ page }, _nomeModal: string, numeroLote: string) => {
    await page.getByTestId(`btn-rastreabilidade-lote-${numeroLote}`).click();
    const modal = page.getByTestId("modal-ficha-rastreabilidade");
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("Ajuste Manual (-)");
    await expect(modal).toContainText(
      "Frasco quebrou durante manuseio na bancada da farmácia",
    );
  },
);

When("ele abrir o modal {string}", async ({ page }, _botaoTexto: string) => {
  await page.getByTestId("btn-abrir-exportar-relatorios").click();
  await expect(
    page.getByTestId("modal-exportar-relatorios-estoque"),
  ).toBeVisible();
});

When(
  "selecionar {string} preenchendo Data Início {string} e Data Fim {string}",
  async ({ page }, _atalho: string, inicio: string, fim: string) => {
    await page.getByTestId("btn-atalho-periodo-PERSONALIZADO").click();
    await page.getByTestId("input-relatorio-data-inicio").fill(inicio);
    await page.getByTestId("input-relatorio-data-fim").fill(fim);
  },
);

Then(
  "uma mensagem de erro deve informar que a data final não pode ser anterior à data inicial e o botão de download deve ficar desabilitado",
  async ({ page }) => {
    await expect(
      page.getByTestId("erro-intervalo-datas-relatorio"),
    ).toContainText("A data final não pode ser anterior à data inicial");
    await expect(page.getByTestId("btn-baixar-planilha-excel")).toBeDisabled();
  },
);

When(
  "ele selecionar o relatório de {string} no atalho {string} e clicar em {string}",
  async ({ page }, _tipoRotulo: string, _atalhoRotulo: string, _btn: string) => {
    await page
      .getByTestId("select-tipo-relatorio-estoque")
      .selectOption("PERDAS_VENCIMENTO");
    await page.getByTestId("btn-atalho-periodo-MES_ANTERIOR").click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("btn-baixar-planilha-excel").click();
    const download = await downloadPromise;
    ultimoDownloadEstoqueFilename = download.suggestedFilename();
  },
);

When(
  "ele fechar a ficha de rastreabilidade, abrir o modal {string}, selecionar {string} e baixar a planilha",
  async ({ page }, _modalExportar: string, _tipoRelatorio: string) => {
    await page.getByTestId("btn-concluir-rastreabilidade").click();
    await expect(page.getByTestId("modal-ficha-rastreabilidade")).toBeHidden();

    await page.getByTestId("btn-abrir-exportar-relatorios").click();
    await page
      .getByTestId("select-tipo-relatorio-estoque")
      .selectOption("PERDAS_VENCIMENTO");
    await page.getByTestId("btn-atalho-periodo-MES_ANTERIOR").click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("btn-baixar-planilha-excel").click();
    const download = await downloadPromise;
    ultimoDownloadEstoqueFilename = download.suggestedFilename();
  },
);

Then(
  "o arquivo Excel {string} de estoque deve ser baixado nativamente pelo navegador",
  async ({}, extensao: string) => {
    expect(ultimoDownloadEstoqueFilename.toLowerCase()).toContain(
      extensao.toLowerCase(),
    );
  },
);

Then(
  "uma notificação de sucesso deve confirmar {string}",
  async ({ page }, textoToast: string) => {
    await expect(page.getByTestId("toast-estoque-sucesso")).toContainText(
      textoToast,
    );
  },
);
