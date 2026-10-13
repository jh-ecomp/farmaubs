# AC-MOB-07 Aviso de Timeout de Sessão via Notificação Nativa do SO Android (NF012, ADR-034)

- **Épico**: Acesso e Autenticação do Sistema
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF002 (Autenticação e Sessão), RF004 (Encerramento de Sessão)
- **Requisitos Não-Funcionais**: NF001 (Usabilidade), NF002 (Ergonomia e Mobile), NF011 (Segurança de Credenciais), NF012 (Sessão Segura: Timeout e Aviso Prévio)
- **ADRs Vinculadas**: ADR-006 (Autenticação/Autorização e Sessão Server-Side), ADR-014 (Resiliência Offline), ADR-022 (`@farmaubs/shared`), ADR-034 (Workspace Mobile Expo)

---

## 1. História de Usuário

> **Como** profissional de saúde operando o FarmaUBS em dispositivo móvel,  
> **quero** receber um aviso nativo de expiração iminente da sessão diretamente como notificação do sistema operacional Android (5 minutos antes do término da sessão), mesmo quando o aplicativo estiver em segundo plano ou tiver sido encerrado,  
> **para que** eu possa estender a sessão com um único toque ou saber antecipadamente que devo me reautenticar, sem ser surpreendido por bloqueios ou perda de dados em atendimentos clínicos (NF012, NF002).

---

## 2. Regras de Negócio e Casos de Borda

1. **Permanência da Sessão com o App Encerrado**:
   - A sessão armazenada no hardware seguro (`expo-secure-store`) permanece ativa mesmo quando o usuário fecha o aplicativo, encerra o processo na bandeja de multitarefas (*swipe away*) ou o SO finaliza o app por gestão de memória.
   - O encerramento do processo do app **NÃO** invalida nem apaga as credenciais locais.
   - Ao reabrir o app (cold start), a sessão é restaurada automaticamente se `expira_em > now()`.

2. **Canal de Notificações do Android (Notification Channel)**:
   - O aplicativo deve registrar um canal de notificações dedicado no Android:
     - `id`: `farmaubs-session-alerts`
     - `name`: `Alertas de Sessão e Segurança`
     - `importance`: `AndroidImportance.HIGH` (com banner/alerta visual no topo do dispositivo e vibração padrão)
     - `description`: `Avisos sobre expiração de sessão e segurança da conta do FarmaUBS`.

3. **Agendamento da Notificação Prévia de Inatividade (5 minutos antes)**:
   - Em todo login bem-sucedido e a cada resposta da API contendo o cabeçalho `X-Session-Expires-At` (ou resposta de `POST /api/v1/acesso/renovar`):
     1. O serviço `notificationService` obtém a data de expiração absoluta `expiresAt`.
     2. Calcula o instante do alerta prévio: `triggerTime = new Date(expiresAt).getTime() - 5 * 60 * 1000`.
     3. Agenda uma notificação local no Android via biblioteca nativa (`expo-notifications`):
        - Título: `⚠️ Sessão do FarmaUBS expirando`
        - Corpo: `Sua sessão expira em 5 minutos por inatividade. Toque para continuar conectado.`
        - Dados adicionais (`data`): `{ action: 'renew_session', expiresAt }`.
   - **Garantia de Disparo com App Encerrado**: Como o agendamento é registrado nas APIs nativas do Android (AlarmManager/JobScheduler do SO), o aviso é entregue mesmo se o aplicativo estiver completamente encerrado.

4. **Renovação Deslizante e Cancelamento de Alertas Anteriores**:
   - Havendo qualquer atividade do usuário que dispare requisição à API ou renovação explícita:
     1. O serviço cancela imediatamente o agendamento de notificação prévio (`Notifications.cancelScheduledNotificationAsync(notificationId)`).
     2. Um novo alarme é agendado para o novo `expiresAt - 5 min`.

5. **Ação ao Tocar na Notificação**:
   - **Caso 1 (Dentro da Janela de 5 Minutos)**: Se o usuário tocar na notificação e o tempo atual ainda for menor que `expiresAt`:
     - O aplicativo abre em primeiro plano.
     - O cliente invoca automaticamente `sessionService.renovarSessao()` (`POST /api/v1/acesso/renovar`).
     - A sessão é renovada por mais 60 minutos, reagendando o próximo alarme.
     - Exibe feedback discreto na tela: *"Sessão estendida com sucesso."*.
   - **Caso 2 (Após Expiração Completa)**: Se o usuário demorar e abrir a notificação após o instante `expiresAt`:
     - O app detecta que o token expirou, limpa o `SecureStore` via `sessionService.limparSessao()` e encaminha para a tela de Login com mensagem informativa: *"Sua sessão expirou por inatividade. Por favor, acesse novamente."*.

6. **Permissões no Android 13+ (POST_NOTIFICATIONS)**:
   - No bootstrap do aplicativo pós-login, o serviço verifica e solicita a permissão de notificações em tempo de execução (`Notifications.requestPermissionsAsync()`).
   - Caso o usuário negue a permissão, o app exibe um aviso sutil nas configurações de perfil informando que alertas de expiração no SO estarão indisponíveis.

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

### 3.1 Cabeçalhos e Endpoints Consumidos
- Cabeçalho de Resposta HTTP: `X-Session-Expires-At: 2026-10-12T19:30:00.000Z`
- Endpoint de Renovação: `POST /api/v1/acesso/renovar`
- Cabeçalho de Envio: `Authorization: Bearer <token>`

### 3.2 Tipagem Compartilhada
```typescript
import type { RenovarSessaoResponse } from "@farmaubs/shared";

export interface SessionNotificationPayload {
  action: "renew_session" | "session_expired";
  expiresAt: string;
}
```

---

## 4. Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: `AC-20` (Aviso de inatividade e renovação de sessão via modal em tela `SessionTimeoutModal.tsx`).
- **Artefatos Compartilhados (`@farmaubs/shared`)**:
  - Ambos os clientes consomem o mesmo endpoint `POST /api/v1/acesso/renovar` e o cabeçalho `X-Session-Expires-At`.
  - A interface `RenovarSessaoResponse` em `packages/shared/src/acesso/session.types.ts` é o contrato comum.
- **Se o Frontend Web já implementou AC-20**:
  - O Mobile reutiliza diretamente o endpoint `/acesso/renovar`, o contrato `RenovarSessaoResponse` e os parâmetros de timing (`warningSeconds = 300`).
  - Enquanto o Frontend Web exibe um modal visual de contagem na página aberta, o Mobile adapta o conceito para uma notificação nativa do SO Android.
- **Se o Frontend Web ainda NÃO implementou AC-20**:
  - O time Mobile pode avançar com o agendamento de notificações nativas e o consumo do endpoint de renovação fornecido pelo Backend (`AC-10`).
  - Se `RenovarSessaoResponse` necessitar de campos adicionais (ex.: `warningSeconds`), o desenvolvedor Mobile estende `@farmaubs/shared` garantindo retrocompatibilidade para o Frontend Web.

---

## 5. Critérios de Aceite Detalhados

- [ ] A sessão no app mobile permanece salva e acessível no `expo-secure-store` após o fechamento completo do aplicativo.
- [ ] Criação de `notification.service.ts` em `apps/mobile/src/services/` gerenciando agendamento e cancelamento de notificações locais via `expo-notifications`.
- [ ] Configuração de `NotificationChannel` no Android com alta prioridade e nome legível ao usuário.
- [ ] A cada requisição bem-sucedida ou login, uma notificação de alerta é agendada para exatamente 5 minutos antes de `expiresAt`.
- [ ] O agendamento anterior é cancelado e recalculado a cada renovação de atividade da sessão.
- [ ] A notificação é entregue pelo SO Android mesmo quando o processo do app está fechado/encerrado.
- [ ] O toque na notificação abre o app e renova a sessão automaticamente se estiver dentro do prazo de tolerância.
- [ ] Se o tempo limite foi ultrapassado ao tocar na notificação, o app limpa o `SecureStore` e redireciona para a tela de Login com mensagem amigável.
- [ ] Solicitação de permissão de notificação no Android 13+ com tratamento de recusa sem quebrar a execução do app.

---

## 6. Cenários de Teste (BDD)

```gherkin
Funcionalidade: Aviso de Timeout via Notificação Android (AC-MOB-07 / NF012)

Cenário: 1. Agendamento de notificação prévia de inatividade após login
  Dado que o usuário efetuou login no app móvel com sessão válida até "12:00:00"
  Quando o login é concluído
  Então o serviço de notificações agenda um alerta local para "11:55:00" no Android
  E o canal "Alertas de Sessão e Segurança" é utilizado com alta prioridade

Cenário: 2. Notificação disparada com o aplicativo encerrado
  Dado que existe um alerta de timeout agendado para as "11:55:00"
  E o usuário encerrou completamente o app móvel na bandeja de multitarefas
  Quando o relógio do sistema atingir "11:55:00"
  Então o sistema operacional Android exibe a notificação de aviso de expiração da sessão
  E o corpo da mensagem indica que restam 5 minutos

Cenário: 3. Toque na notificação com renovação automática
  Dado que o usuário visualizou a notificação de expiração no Android
  Quando ele toca na notificação antes da expiração definitiva
  Então o aplicativo FarmaUBS é aberto em primeiro plano
  E o app dispara a requisição de renovação de sessão para a API
  E a expiração é estendida com reagendamento do novo alerta

Cenário: 4. Reabertura do aplicativo com sessão expirada
  Dado que a notificação foi emitida e o usuário não interagiu antes das "12:00:00"
  Quando o usuário reabre o aplicativo após as "12:00:00"
  Então o app identifica a expiração do token
  E limpa os dados do SecureStore
  E apresenta a tela de Login com mensagem de sessão expirada por inatividade
```
