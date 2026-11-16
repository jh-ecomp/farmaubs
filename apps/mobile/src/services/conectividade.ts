export const MENSAGEM_MODO_OFFLINE =
  "Modo sem conexão: algumas funcionalidades da UBS requerem internet";
export const MENSAGEM_CONEXAO_RESTABELECIDA = "Conexão restabelecida";
export const MENSAGEM_ACAO_OFFLINE = "Ação indisponível sem conexão com a internet";
export const DURACAO_BANNER_RESTABELECIDO_MS = 3000;

export type FaseBanner = "oculto" | "offline" | "restabelecida";

export type RedeObservada = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type?: string | null;
};

/** [AC-MOB-06]: Mesma forma da história. Fica no mobile enquanto o pacote compartilhado não tem o tipo. */
export type ConectividadeState = {
  online: boolean;
  tipoConexao?: string;
};

/**
 * [AC-MOB-06]: null ainda não foi medido. Só false conta como sem rede.
 * @param rede - Leitura do NetInfo.
 * @returns True quando o banner offline deve aparecer.
 */
export function redeEstaOffline(rede: RedeObservada): boolean {
  return rede.isConnected === false || rede.isInternetReachable === false;
}

/**
 * [AC-MOB-06]: Traduz a leitura nativa para o estado da história.
 * @param rede - Leitura do NetInfo.
 * @returns Online e o tipo wifi, cellular, none ou unknown.
 */
export function estadoConectividade(rede: RedeObservada): ConectividadeState {
  return {
    online: !redeEstaOffline(rede),
    tipoConexao: rede.type ?? undefined,
  };
}

/**
 * [AC-MOB-06]: Offline permanece. A volta só acontece a partir do offline, para o aviso verde.
 * @param atual - O que o banner está mostrando.
 * @param offline - Resultado de redeEstaOffline.
 * @returns Próxima fase. Ocultar depois dos 3s é o timer da tela, não esta função.
 */
export function proximaFase(atual: FaseBanner, offline: boolean): FaseBanner {
  if (offline) return "offline";
  if (atual === "offline") return "restabelecida";
  return atual;
}
