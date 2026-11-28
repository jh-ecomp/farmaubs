/**
 * [NF002 / NF003 / NF010 / ADR-030 / ADR-032 / RL-07]: Passos BDD Playwright para validação
 * de acabamento de produção: lang="pt-BR", document.title dinâmico, Sidebar responsiva em
 * 390x844 / 768x1024 / 1366x768, ocultação de módulos futuros e auditoria WCAG em /privacidade e /termos.
 */
import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import AxeBuilder from "@axe-core/playwright";

const { Given, When, Then } = createBdd();

Given(
  "que um visitante não autenticado acessa a tela {string}",
  async ({ page }, rota: string) => {
    await page.route("**/api/v1/acesso/me", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Não autorizado" }),
      });
    });

    await page.goto(rota);
    await expect(
      page.getByRole("heading", { name: /acesso ao sistema/i }),
    ).toBeVisible();
  },
);

Then(
  "o atributo {string} da tag {string} deve ser {string}",
  async ({ page }, attr: string, tag: string, esperado: string) => {
    await expect(page.locator(tag)).toHaveAttribute(attr, esperado);
  },
);

Then(
  "o título da aba do navegador deve conter {string} e {string}",
  async ({ page }, parte1: string, parte2: string) => {
    const title = await page.title();
    expect(title).toContain(parte1);
    expect(title).toContain(parte2);
  },
);

When(
  "o farmacêutico carregar {string} nos viewports responsivos e acionar o menu móvel",
  async ({ page }, rota: string) => {
    // 1. Desktop (1366x768): sidebar lateral visível, botão hambúrguer oculto
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(rota);
    await expect(page).toHaveTitle(/Dispensação.*\|\s*FarmaUBS/);
    await expect(page.locator('aside[aria-label="Lateral"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Abrir menu de navegação" }),
    ).toBeHidden();

    // 2. Mobile (390x844): sidebar recolhida, sem sobrepor main
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('aside[aria-label="Lateral"]')).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Abrir menu de navegação" }),
    ).toBeVisible();

    // 3. Tablet retrato (768x1024): cenário explícito do BDD da RL-07
    await page.setViewportSize({ width: 768, height: 1024 });
  },
);

Then(
  "a barra lateral não deve sobrepor o formulário em telas menores e o drawer deve abrir e fechar com acessibilidade",
  async ({ page }) => {
    const desktopAside = page.locator('aside[aria-label="Lateral"]');
    const openBtn = page.getByRole("button", {
      name: "Abrir menu de navegação",
    });

    await expect(desktopAside).toBeHidden();
    await expect(openBtn).toBeVisible();
    await expect(openBtn).toHaveAttribute("aria-expanded", "false");

    const mainBox = await page.locator("main").boundingBox();
    expect(mainBox).not.toBeNull();
    expect(mainBox!.x).toBe(0);

    await openBtn.click();
    await expect(openBtn).toHaveAttribute("aria-expanded", "true");
    const drawerDialog = page.locator("dialog#mobile-nav-drawer");
    await expect(drawerDialog).toBeVisible();
    await expect(
      drawerDialog.getByTestId("sidebar-contexto-institucional"),
    ).not.toHaveText(/SMS Parnaíba\/PI/);

    await page.keyboard.press("Escape");
    await expect(openBtn).toHaveAttribute("aria-expanded", "false");
  },
);

Then(
  "os módulos futuros em desenvolvimento não devem aparecer no menu de produção",
  async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const aside = page.locator('aside[aria-label="Lateral"]');
    await expect(aside).toBeVisible();

    await expect(aside.getByRole("link", { name: "Dispensas" })).toBeVisible();
    await expect(aside.getByRole("link", { name: "Indicadores" })).toHaveCount(0);
    await expect(aside.getByRole("link", { name: "Relatórios" })).toHaveCount(0);
    await expect(aside.getByRole("link", { name: "Parâmetros" })).toHaveCount(0);
  },
);

When(
  "ele navegar para {string} e {string}",
  async ({ page }, linkPrivacidade: string, _linkTermos: string) => {
    await page.getByRole("link", { name: linkPrivacidade }).click();
    await expect(page).toHaveURL(/\/privacidade$/);
  },
);

Then(
  "as páginas {string} e {string} devem exibir as diretrizes de LGPD e cookies HttpOnly sem redirecionar para login e sem violações críticas no axe-core",
  async ({ page }, rotaPriv: string, rotaTermos: string) => {
    expect(page.url()).toContain(rotaPriv);
    await expect(page).toHaveTitle(/Política de Privacidade\s*\|\s*FarmaUBS/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Política de Privacidade e Proteção de Dados/i,
      }),
    ).toBeVisible();
    await expect(page.getByText(/farmaubs_session/i)).toBeVisible();
    await expect(page.getByText(/HttpOnly/i).first()).toBeVisible();

    const axePrivacidade = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const criticasPrivacidade = axePrivacidade.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(criticasPrivacidade).toEqual([]);

    await page.getByRole("link", { name: "Termos de Uso" }).click();
    expect(page.url()).toContain(rotaTermos);
    await expect(page).toHaveTitle(/Termos de Uso\s*\|\s*FarmaUBS/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Termos de Uso do Sistema FarmaUBS/i,
      }),
    ).toBeVisible();

    const axeTermos = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const criticasTermos = axeTermos.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(criticasTermos).toEqual([]);
  },
);
