/**
 * [ADR-030 / ADR-032]: Configuração do Playwright + playwright-bdd para o FarmaUBS.
 * Suporta dois projetos (modalidades):
 * 1. "sistema-frontend": Teste de Sistema da Camada D (API mockada via page.route, sem backend/banco).
 * 2. "e2e-fullstack": Teste E2E Full-Stack (Frontend Vite + Servidor HTTP de API em tempo real).
 */
import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

const bddDirSistema = defineBddConfig({
  outputDir: ".features-gen/sistema",
  features: "e2e/features/sistema/**/*.feature",
  steps: "e2e/steps/**/*.steps.ts",
});

const bddDirFullstack = defineBddConfig({
  outputDir: ".features-gen/fullstack",
  features: "e2e/features/fullstack/**/*.feature",
  steps: "e2e/steps/**/*.steps.ts",
});

const isFullstackRun = process.env.PW_MODE === "fullstack";

export default defineConfig({
  outputDir: isFullstackRun
    ? "test-results/fullstack"
    : "test-results/sistema",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "pt-BR",
  },
  projects: [
    {
      name: "sistema-frontend",
      testDir: bddDirSistema,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "e2e-fullstack",
      testDir: bddDirFullstack,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: isFullstackRun
    ? [
        {
          command: "node --import tsx e2e/support/e2e-api-server.ts",
          port: 3000,
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
        {
          command: "pnpm exec vite --port 5173",
          url: "http://localhost:5173",
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
      ]
    : [
        {
          command: "pnpm exec vite --port 5173",
          url: "http://localhost:5173",
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
      ],
});
