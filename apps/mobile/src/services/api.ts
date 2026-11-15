import { sessionService } from "./session.service";
import { comBearer, sessaoDeveSerApagada } from "./session-gravada";
import { comUnidade } from "./unidade-ativa";

export class SessaoExpirada extends Error {
  constructor() {
    super("sessao-expirada");
  }
}

let aoExpirar: () => void = () => {};

/**
 * [NF012]: O App registra o que fazer quando um 401 apaga a sessão.
 * @param fn - Volta o app para a tela de login.
 */
export function definirAoSessaoExpirar(fn: () => void): void {
  aoExpirar = fn;
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
  const res = await fetch(url, {
    ...init,
    headers,
  });
  if (sessaoDeveSerApagada(res.status, usouBearer)) {
    await sessionService.limparSessao();
    aoExpirar();
    throw new SessaoExpirada();
  }
  return res;
}
