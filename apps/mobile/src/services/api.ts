import { sessionService } from "./session.service";
import { comBearer, sessaoDeveSerApagada } from "./session-gravada";
import { comUnidade } from "./unidade-ativa";
import { lerExpiresAtHeader } from "./alerta-sessao";

export class SessaoExpirada extends Error {
  constructor() {
    super("sessao-expirada");
  }
}

export class TempoEsgotado extends Error {
  constructor() {
    super("tempo-esgotado");
  }
}

const TIMEOUT_API_MS = 15_000;

let aoExpirar: () => void = () => {};
let aoNovaExpiracao: (expiraEm: string) => void = () => {};

/**
 * [NF012]: O App registra o que fazer quando um 401 apaga a sessão.
 * @param fn - Volta o app para a tela de login.
 */
export function definirAoSessaoExpirar(fn: () => void): void {
  aoExpirar = fn;
}

/**
 * [AC-MOB-07]: O App reagenda o alerta quando uma resposta traz X-Session-Expires-At.
 * @param fn - Recebe o ISO novo.
 */
export function definirAoNovaExpiracao(fn: (expiraEm: string) => void): void {
  aoNovaExpiracao = fn;
}

/**
 * [NF011]: Toda chamada autenticada leva o Bearer. O login passa autenticada false para o 401 continuar sendo senha errada.
 * @param url - URL absoluta da API.
 * @param init - Opções do fetch.
 * @param opcoes - autenticada false no POST de login.
 * @returns Resposta HTTP. Lança SessaoExpirada depois de limpar o SecureStore.
 */
export async function fetchApi(
  url: string,
  init: RequestInit = {},
  opcoes?: { autenticada?: boolean },
): Promise<Response> {
  const autenticada = opcoes?.autenticada !== false;
  const token = autenticada ? await sessionService.obterToken() : null;
  const unidadeId = autenticada ? await sessionService.obterUnidadeAtiva() : null;
  const usouBearer = !!token;
  let headers = init.headers;
  if (usouBearer) headers = comBearer(token, headers);
  if (unidadeId) headers = comUnidade(unidadeId, headers);
  const controle = new AbortController();
  const timer = init.signal ? null : setTimeout(() => controle.abort(), TIMEOUT_API_MS);
  if (init.signal) {
    if (init.signal.aborted) controle.abort();
    else init.signal.addEventListener("abort", () => controle.abort(), { once: true });
  }
  try {
    const res = await fetch(url, { ...init, signal: controle.signal, headers });
    if (sessaoDeveSerApagada(res.status, usouBearer)) {
      await sessionService.limparSessao();
      aoExpirar();
      throw new SessaoExpirada();
    }
    if (res.ok) {
      const iso = lerExpiresAtHeader(res.headers.get("X-Session-Expires-At"));
      if (iso) {
        try {
          await aoNovaExpiracao(iso);
        } catch {
          // o alerta é extra; a resposta da API continua válida
        }
      }
    }
    return res;
  } catch (erro) {
    if (erro instanceof SessaoExpirada) throw erro;
    if (controle.signal.aborted) throw new TempoEsgotado();
    throw erro;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
