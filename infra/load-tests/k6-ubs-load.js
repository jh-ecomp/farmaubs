/**
 * [NF007 / NF014 / ADR-025 / ADR-030 / RL-08]: Roteiro k6 de Teste de Carga Nominal (Load Test).
 *
 * Objetivo:
 *   Comprovar atendimento ao SLA nominal com 50 usuários simultâneos sustentados em farmaubs-hml:
 *     - Percentil 95 de tempo de resposta: p(95) < 2000ms
 *     - Taxa de falha HTTP: rate < 1% (0.01)
 *
 * Nota sobre Rate Limit (@nestjs/throttler):
 *   Quando executado de um único IP de origem contra HML, 50 VUs geram > 120 req/min no mesmo IP.
 *   Durante a janela de aferição em farmaubs-hml, ajuste temporariamente THROTTLER_ENABLED=false
 *   em /opt/farmaubs/hml/.env (mantendo THROTTLER_ENABLED=true após o teste e sempre em PROD).
 *
 * Execução padrão (4m30s):
 *   k6 run \
 *     -e TARGET_URL="https://hml.<DOMINIO>" \
 *     -e QA_SMOKE_EMAIL="qa.smoke@farmaubs.dev" \
 *     -e QA_SMOKE_PASSWORD="<SENHA>" \
 *     --summary-export="scratch/evidencias-disciplina/2-load-test-50vus.json" \
 *     infra/load-tests/k6-ubs-load.js
 */
import http from "k6/http";
import { check, group, sleep } from "k6";

const TARGET_URL = (__ENV.TARGET_URL || "http://127.0.0.1:8081").replace(/\/+$/, "");
const QA_EMAIL = __ENV.QA_SMOKE_EMAIL || "qa.smoke@farmaubs.dev";
const QA_PASSWORD = __ENV.QA_SMOKE_PASSWORD || "";
const FAST_VERIFY = __ENV.K6_FAST_VERIFY === "true";

export const options = {
  stages: FAST_VERIFY
    ? [
        { duration: "5s", target: 50 },
        { duration: "15s", target: 50 },
        { duration: "5s", target: 0 },
      ]
    : [
        { duration: "1m", target: 50 },
        { duration: "3m", target: 50 },
        { duration: "30s", target: 0 },
      ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
};

/**
 * Autentica uma única vez antes da rampa para compartilhar sessão válida com os 50 VUs,
 * evitando falso negativo 429 no endpoint de login (10 req/min por IP).
 */
export function setup() {
  if (!QA_PASSWORD) {
    throw new Error("Defina QA_SMOKE_PASSWORD para executar o Load Test k6.");
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

  const loginBody = loginRes.json();
  const token = loginBody.token;

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
  // Em testes locais via loopback, distribui IP sintético por VU; atrás da Cloudflare usa o cabeçalho real
  const syntheticIp = `10.20.${Math.floor(__VU / 250)}.${(__VU % 250) + 1}`;
  const params = {
    headers: {
      Authorization: `Bearer ${data.token}`,
      Cookie: `farmaubs_session=${data.token}`,
      "X-Forwarded-For": syntheticIp,
    },
  };

  group("Jornada Operacional UBS (50 VUs)", () => {
    const meRes = http.get(`${TARGET_URL}/api/v1/acesso/me`, params);
    check(meRes, {
      "GET /acesso/me 200": (r) => r.status === 200,
    });

    const saldosRes = http.get(
      `${TARGET_URL}/api/v1/estoque/saldos?unidadeId=${data.unidadeId}&pagina=1&itensPorPagina=15`,
      params,
    );
    check(saldosRes, {
      "GET /estoque/saldos 200": (r) => r.status === 200,
    });

    const buscaMedsRes = http.get(
      `${TARGET_URL}/api/v1/dispensacao/medicamentos?termo=a`,
      params,
    );
    check(buscaMedsRes, {
      "GET /dispensacao/medicamentos 200": (r) => r.status === 200,
    });

    if (data.medicamentoId) {
      const fefoRes = http.get(
        `${TARGET_URL}/api/v1/dispensacao/medicamentos/${data.medicamentoId}/lotes-fefo`,
        params,
      );
      check(fefoRes, {
        "GET /lotes-fefo 200": (r) => r.status === 200,
      });
    }

    const histDispRes = http.get(`${TARGET_URL}/api/v1/dispensacoes`, params);
    check(histDispRes, {
      "GET /dispensacoes 200": (r) => r.status === 200,
    });

    const histRecRes = http.get(
      `${TARGET_URL}/api/v1/recebimento/historico?periodo=ULTIMOS_30_DIAS&pagina=1&limite=15`,
      params,
    );
    check(histRecRes, {
      "GET /recebimento/historico 200": (r) => r.status === 200,
    });
  });

  sleep(1);
}
