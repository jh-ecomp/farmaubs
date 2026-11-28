#!/usr/bin/env node
/**
 * [NF004 / ADR-024 / ADR-025 / RL-08]: Suíte automatizada de Smoke Tests pós-deploy.
 * Executa em Node 22 nativo (zero dependências externas) em < 30s.
 *
 * Variáveis de ambiente:
 *   TARGET_URL          - URL base do ambiente (ex.: https://hml.seudominio.com.br)
 *   SMOKE_MODE          - "full" (padrão, HML/local com login+logout) | "readonly" (PROD)
 *   QA_SMOKE_EMAIL      - E-mail da conta sintética de QA (obrigatório quando SMOKE_MODE=full)
 *   QA_SMOKE_PASSWORD   - Senha da conta sintética de QA (obrigatório quando SMOKE_MODE=full)
 *   SMOKE_TIMEOUT_MS    - Timeout por requisição HTTP em ms (padrão: 10000)
 *   SMOKE_SKIP_LANG_PT  - Se "true", releva ausência temporária de lang="pt-BR" antes da RL-07
 */

const rawTargetUrl = (process.env.TARGET_URL ?? "").trim().replace(/\/+$/, "");
const smokeMode = (process.env.SMOKE_MODE ?? "full").trim().toLowerCase();
const smokeEmail = (process.env.QA_SMOKE_EMAIL ?? "").trim();
const smokePassword = process.env.QA_SMOKE_PASSWORD ?? "";
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS ?? "10000", 10) || 10_000;
const skipLangCheck = process.env.SMOKE_SKIP_LANG_PT === "true";

function fail(step, detail) {
  console.error(`❌ [SMOKE FAIL] ${step}: ${detail}`);
  process.exit(1);
}

function pass(step, detail) {
  console.log(`✅ [SMOKE PASS] ${step}: ${detail}`);
}

async function request(path, init = {}) {
  const url = `${rawTargetUrl}${path}`;
  const res = await fetch(url, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });
  return res;
}

async function main() {
  const startedAt = Date.now();

  if (!rawTargetUrl) {
    fail("Configuração", "Variável TARGET_URL é obrigatória (ex.: https://hml.farmaubs.com.br).");
  }
  if (smokeMode !== "full" && smokeMode !== "readonly") {
    fail("Configuração", `SMOKE_MODE inválido ("${smokeMode}"). Use "full" ou "readonly".`);
  }
  if (smokeMode === "full" && (!smokeEmail || !smokePassword)) {
    fail(
      "Configuração",
      "QA_SMOKE_EMAIL e QA_SMOKE_PASSWORD são obrigatórios quando SMOKE_MODE=full.",
    );
  }

  console.log(
    `🚀 Iniciando Smoke Tests FarmaUBS | TARGET_URL=${rawTargetUrl} | SMOKE_MODE=${smokeMode}`,
  );

  // 1. Healthcheck da API + Banco PostgreSQL
  {
    const res = await request("/api/v1/health");
    if (res.status !== 200) {
      fail("1. GET /api/v1/health", `Esperava HTTP 200, recebeu ${res.status}.`);
    }
    const body = await res.json();
    if (body?.status !== "ok" || body?.checks?.database !== "up") {
      fail(
        "1. GET /api/v1/health",
        `Payload inesperado: ${JSON.stringify(body)}`,
      );
    }
    pass(
      "1. GET /api/v1/health",
      `HTTP 200 | status=${body.status} | database=${body.checks.database} | uptime=${body.uptime}s`,
    );
  }

  // 2. Entrega do Frontend estático (SPA)
  {
    const res = await request("/");
    if (res.status !== 200) {
      fail("2. GET /", `Esperava HTTP 200, recebeu ${res.status}.`);
    }
    const html = await res.text();
    if (!html.toLowerCase().includes("<!doctype html>") || !html.includes('id="root"')) {
      fail("2. GET /", "Resposta não contém o HTML esperado da SPA (#root).");
    }
    const hasPtBr = /<html[^>]*\blang=["']pt-BR["']/i.test(html);
    if (!hasPtBr && !skipLangCheck) {
      fail("2. GET /", 'HTML da SPA não contém o atributo lang="pt-BR" (NF003 / RL-07).');
    }
    pass(
      "2. GET /",
      `HTTP 200 | SPA entregue (${html.length} bytes${hasPtBr ? ', lang="pt-BR"' : ", lang check ignorado"})`,
    );
  }

  // 3. Bloqueio de acesso anônimo em rota protegida
  {
    const res = await request("/api/v1/acesso/me");
    if (res.status !== 401) {
      fail(
        "3. GET /api/v1/acesso/me (anônimo)",
        `Esperava HTTP 401 sem credenciais, recebeu ${res.status}.`,
      );
    }
    pass("3. GET /api/v1/acesso/me (anônimo)", "HTTP 401 confirmado.");
  }

  if (smokeMode === "readonly") {
    const elapsedMs = Date.now() - startedAt;
    console.log(
      `🎉 Smoke Tests (modo readonly) concluídos com sucesso em ${elapsedMs}ms.`,
    );
    return;
  }

  // 4. Login sintético em HML + verificação do cookie HttpOnly farmaubs_session
  let sessionCookiePair = "";
  {
    const res = await request("/api/v1/acesso/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: smokeEmail, senha: smokePassword }),
    });

    if (res.status !== 200) {
      const errText = await res.text();
      fail(
        "4. POST /api/v1/acesso/login",
        `Esperava HTTP 200, recebeu ${res.status} (${errText}).`,
      );
    }

    const setCookies =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : [res.headers.get("set-cookie") ?? ""].filter(Boolean);

    const sessionCookieHeader = setCookies.find((c) =>
      c.startsWith("farmaubs_session="),
    );
    if (!sessionCookieHeader) {
      fail(
        "4. POST /api/v1/acesso/login",
        "Cabeçalho Set-Cookie com farmaubs_session não encontrado.",
      );
    }
    if (!/;\s*HttpOnly\b/i.test(sessionCookieHeader)) {
      fail(
        "4. POST /api/v1/acesso/login",
        "Cookie farmaubs_session não possui flag obrigatória HttpOnly.",
      );
    }
    if (rawTargetUrl.startsWith("https://") && !/;\s*Secure\b/i.test(sessionCookieHeader)) {
      fail(
        "4. POST /api/v1/acesso/login",
        "Cookie farmaubs_session em HTTPS não possui flag obrigatória Secure.",
      );
    }

    sessionCookiePair = sessionCookieHeader.split(";")[0].trim();

    const meRes = await request("/api/v1/acesso/me", {
      headers: { Cookie: sessionCookiePair },
    });
    if (meRes.status !== 200) {
      fail(
        "4b. GET /api/v1/acesso/me (autenticado)",
        `Esperava HTTP 200 com cookie de sessão, recebeu ${meRes.status}.`,
      );
    }
    const meBody = await meRes.json();
    if (!meBody?.usuarioId || meBody?.email?.toLowerCase() !== smokeEmail.toLowerCase()) {
      fail(
        "4b. GET /api/v1/acesso/me (autenticado)",
        `Sessão retornou usuário divergente: ${JSON.stringify(meBody)}`,
      );
    }

    pass(
      "4. Login + Sessão HttpOnly",
      `HTTP 200 | Cookie HttpOnly validado | usuarioId=${meBody.usuarioId}`,
    );
  }

  // 5. Logout com revogação server-side (HTTP 204) + invalidação imediata do token
  {
    const logoutRes = await request("/api/v1/acesso/logout", {
      method: "POST",
      headers: { Cookie: sessionCookiePair },
    });
    if (logoutRes.status !== 204) {
      fail(
        "5. POST /api/v1/acesso/logout",
        `Esperava HTTP 204 No Content, recebeu ${logoutRes.status}.`,
      );
    }

    const afterLogoutRes = await request("/api/v1/acesso/me", {
      headers: { Cookie: sessionCookiePair },
    });
    if (afterLogoutRes.status !== 401) {
      fail(
        "5b. GET /api/v1/acesso/me (pós-logout)",
        `Sessão deveria estar revogada (401), mas retornou ${afterLogoutRes.status}.`,
      );
    }

    pass(
      "5. Logout + Revogação Server-Side",
      "HTTP 204 No Content e sessão invalidada (401 pós-logout).",
    );
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(
    `🎉 Smoke Tests (modo full) concluídos com 100% de sucesso em ${elapsedMs}ms.`,
  );
}

main().catch((err) => {
  fail("Erro não tratado", err instanceof Error ? err.message : String(err));
});
