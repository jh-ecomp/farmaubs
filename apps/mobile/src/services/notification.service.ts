import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import {
  CANAL_ALERTA_SESSAO,
  CORPO_ALERTA_SESSAO,
  DESCRICAO_CANAL_ALERTA_SESSAO,
  instanteAlerta,
  NOME_CANAL_ALERTA_SESSAO,
  TITULO_ALERTA_SESSAO,
} from "./alerta-sessao";

const ALERTA_ID = "farmaubs-session-warning";
const TOQUE_TRATADO_KEY = "farmaubs_alerta_tratado";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * [AC-MOB-07]: Agenda e cancela o aviso nativo. A regra do horário fica em alerta-sessao.ts.
 */
export const notificationService = {
  async prepararCanal(): Promise<void> {
    if (Platform.OS !== "android") return;
    await Notifications.setNotificationChannelAsync(CANAL_ALERTA_SESSAO, {
      name: NOME_CANAL_ALERTA_SESSAO,
      importance: Notifications.AndroidImportance.HIGH,
      description: DESCRICAO_CANAL_ALERTA_SESSAO,
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
    });
  },

  /**
   * [AC-MOB-07]: Pede a permissão no Android 13+. Negar não lança erro.
   * @returns True quando o sistema pode mostrar o alerta.
   */
  async pedirPermissao(): Promise<boolean> {
    await this.prepararCanal();
    const atual = await Notifications.getPermissionsAsync();
    if (atual.granted) return true;
    const pedido = await Notifications.requestPermissionsAsync();
    return pedido.granted;
  },

  /**
   * [AC-MOB-07]: Só lê a permissão. Voltar das configurações do Android não pode abrir o diálogo de novo.
   * @returns True quando o sistema pode mostrar o alerta.
   */
  async permissaoConcedida(): Promise<boolean> {
    const atual = await Notifications.getPermissionsAsync();
    return atual.granted;
  },

  async cancelarAlertaSessao(): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(ALERTA_ID).catch(() => {});
  },

  /**
   * [AC-MOB-07]: Troca o alarme anterior pelo novo expiresAt menos 5 minutos.
   * @param expiresAt - ISO da API.
   */
  async agendarAlertaSessao(expiresAt: string): Promise<void> {
    const quando = instanteAlerta(expiresAt, Date.now());
    await this.cancelarAlertaSessao();
    if (quando == null) return;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: ALERTA_ID,
        content: {
          title: TITULO_ALERTA_SESSAO,
          body: CORPO_ALERTA_SESSAO,
          data: { action: "renew_session", expiresAt },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: quando,
          channelId: CANAL_ALERTA_SESSAO,
        },
      });
    } catch {
      // shortcut: sem permissão de alarme exato o Android recusa; o app segue.
    }
  },
};

/**
 * [AC-MOB-07]: Ouve o toque na notificação. A chave evita tratar de novo o mesmo aviso ao reabrir o app.
 * @param fn - Recebe expiresAt e a chave do toque.
 * @returns Cancela a escuta.
 */
export function escutarToqueAlerta(fn: (expiresAt: string, chave: string) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((resposta) => {
    const lido = lerToque(resposta);
    if (!lido) return;
    fn(lido.expiresAt, lido.chave);
  });
  return () => sub.remove();
}

export async function ultimoToqueAlerta(): Promise<{ expiresAt: string; chave: string } | null> {
  const resposta = await Notifications.getLastNotificationResponseAsync();
  if (!resposta) return null;
  return lerToque(resposta);
}

export async function toqueJaTratado(chave: string): Promise<boolean> {
  return (await SecureStore.getItemAsync(TOQUE_TRATADO_KEY)) === chave;
}

export async function marcarToqueTratado(chave: string): Promise<void> {
  await SecureStore.setItemAsync(TOQUE_TRATADO_KEY, chave);
}

function lerToque(resposta: Notifications.NotificationResponse): { expiresAt: string; chave: string } | null {
  const data = resposta.notification.request.content.data;
  if (!data || typeof data.expiresAt !== "string") return null;
  return {
    expiresAt: data.expiresAt,
    chave: `${resposta.notification.request.identifier}:${resposta.notification.date}`,
  };
}
