/**
 * [NF004 / NF007 / NF014 / ADR-025 / ADR-030 / RL-08]: Roteiro k6 de Teste de Estresse e Recuperação (Stress Test).
 *
 * ATENÇÃO:
 *   Execute EXCLUSIVAMENTE contra homologação (farmaubs-hml com dados sintéticos) e fora de horário
 *   crítico caso HML e PROD compartilhem a mesma VPS. NUNCA execute contra farmaubs-prod!
 *
 * Objetivo:
 *   Elevar a concorrência progressivamente até 4x a carga nominal (50 -> 100 -> 150 -> 200 VUs)
 *   para identificar o ponto de inflexão (knee point) de latência, provar ausência de queda de
 *   processo/deadlock no PostgreSQL e comprovar auto-recuperação no estágio final (10 VUs + healthcheck).
 *
 * Execução padrão (5m15s):
 *   k6 run \
 *     -e TARGET_URL="https://hml.<DOMINIO>" \
 *     -e QA_SMOKE_EMAIL="qa.smoke@farmaubs.dev" \
 *     -e QA_SMOKE_PASSWORD="<SENHA>" \
 *     --summary-export="scratch/evidencias-disciplina/3-stress-test-200vus.json" \
 *     infra/load-tests/k6-ubs-stress.js
 */
import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend } from "k6/metrics";

const TARGET_URL = (__ENV.TARGET_URL || "http://127.0.0.1:8081").replace(/\/+$/, "");
const QA_EMAIL = __ENV.QA_SMOKE_EMAIL || "qa.smoke@farmaubs.dev";
const QA_PASSWORD = __ENV.QA_SMOKE_PASSWORD || "";
const FAST_VERIFY = __ENV.K6_FAST_VERIFY === "true";

const recoveryHealthDuration = new Trend("post_stress_health_duration_ms");

export const options = {
  stages: FAST_VERIFY
    ? [
        { duration: "4s", target: 50 },
        { duration: "4s", target: 100 },
        { duration: "4s", target: 150 },
        { duration: "5s", target: 200 },
        { duration: "5s", target: 10 },
        { duration: "3s", target: 0 },
      ]
    : [
        { duration: "1m", target: 50 },
        { duration: "1m", target: 100 },
        { duration: "1m", target: 150 },
        { duration: "1m", target: 200 },
        { duration: "1m", target: 10 },
        { duration: "15s", target: 0 },
      ],
  thresholds: {
    // Sob sobrecarga de 4x permite-se aumento de latência, mas sem indisponibilidade sistêmica nem falha no health pós-pico
    http_req_failed: ["rate<0.05"],
    post_stress_health_duration_ms: ["p(95)<1000"],
  },
};

export function setup() {
  if (!QA_PASSWORD) {
    throw new Error("Defina QA_SMOKE_PASSWORD para executar o Stress Test k6.");
  }

  const loginRes = http.post(
    `${TARGET_URL}/api/v1/acesso/login`,
    JSON.stringify({ email: QA_EMAIL, senha: QA_PASSWORD }),
    { headers: { "Content-Type": "application/json" } },
  );

  if (loginRes.status !== 200) {
    throw new Error(
      `Falha no setup() ao autenticar ${QA_EMAIL}: HTTP ${loginRes.status} — ${loginRes.body}`,
    );
  }

  const token = loginRes.json().token;
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    Cookie: `farmaubs_session=${token}`,
  };

  const meRes = http.get(`${TARGET_URL}/api/v1/acesso/me`, { headers: authHeaders });
  if (meRes.status !== 200) {
    throw new Error(`Falha ao consultar /api/v1/acesso/me no setup(): HTTP ${meRes.status}`);
  }

  const meBody = meRes.json();
  const unidadeId =
    Array.isArray(meBody.unidadeIds) && meBody.unidadeIds.length > 0
      ? meBody.unidadeIds[0]
      : null;

  if (!unidadeId) {
    throw new Error("Conta sintética de QA não possui UBS vinculada em unidadeIds.");
  }

  let medicamentoId = null;
  const medsRes = http.get(
    `${TARGET_URL}/api/v1/dispensacao/medicamentos?termo=a`,
    { headers: authHeaders },
  );
  if (medsRes.status === 200) {
    const meds = medsRes.json();
    if (Array.isArray(meds) && meds.length > 0) {
      medicamentoId = meds[0].id;
    }
  }

  return { token, unidadeId, medicamentoId };
}

export default function (data) {
  const syntheticIp = `10.30.${Math.floor(__VU / 250)}.${(__VU % 250) + 1}`;
  const params = {
    headers: {
      Authorization: `Bearer ${data.token}`,
      Cookie: `farmaubs_session=${data.token}`,
      "X-Forwarded-For": syntheticIp,
    },
  };

  group("Sobrecarga Progressiva UBS (até 200 VUs)", () => {
    const saldosRes = http.get(
      `${TARGET_URL}/api/v1/estoque/saldos?unidadeId=${data.unidadeId}&pagina=1&itensPorPagina=20`,
      params,
    );
    check(saldosRes, {
      "estoque/saldos respondeu sem erro 5xx": (r) => r.status === 200,
    });

    const medsRes = http.get(
      `${TARGET_URL}/api/v1/dispensacao/medicamentos?termo=a`,
      params,
    );
    check(medsRes, {
      "dispensacao/medicamentos respondeu sem erro 5xx": (r) => r.status === 200,
    });

    if (data.medicamentoId) {
      const fefoRes = http.get(
        `${TARGET_URL}/api/v1/dispensacao/medicamentos/${data.medicamentoId}/lotes-fefo`,
        params,
      );
      check(fefoRes, {
        "lotes-fefo respondeu sem erro 5xx": (r) => r.status === 200,
      });
    }

    const healthRes = http.get(`${TARGET_URL}/api/v1/health`);
    check(healthRes, {
      "health permaneceu 200 OK": (r) => r.status === 200,
    });
  });

  sleep(0.5);
}

/**
 * Valida ao término da rampa de estresse e recuperação que a API e o pool PostgreSQL
 * permanecem íntegros e respondendo rapidamente em /api/v1/health.
 */
export function teardown() {
  const healthRes = http.get(`${TARGET_URL}/api/v1/health`);
  recoveryHealthDuration.add(healthRes.timings.duration);

  const ok = check(healthRes, {
    "Recuperação pós-estresse: GET /api/v1/health HTTP 200": (r) => r.status === 200,
    "Recuperação pós-estresse: database up": (r) => {
      try {
        const body = r.json();
        return body.status === "ok" && body.checks && body.checks.database === "up";
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    throw new Error(
      `Serviço degradado após Stress Test: HTTP ${healthRes.status} — ${healthRes.body}`,
    );
  }
}
