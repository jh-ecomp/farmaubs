# AC-MOB-02 Armazenamento Seguro de Sessão e Token via Hardware Keystore/Keychain (NF011, ADR-034)

- **Épico**: Acesso e Autenticação do Sistema
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF002 (Autenticação de Usuários), RF004 (Logout e Revogação), RF025 (RBAC)
- **Requisitos Não-Funcionais**: NF001 (Usabilidade), NF011 (Criptografia e Proteção de Dados), NF012 (Sessão Segura), NF018 (Auditoria e Rastreabilidade)
- **ADRs Vinculadas**: ADR-006 (Autenticação/Autorização), ADR-014 (Resiliência Offline), ADR-022 (Monorepo), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança Monorepo)

---

## 1. História de Usuário

> **Como** arquiteto de segurança e desenvolvedor mobile,  
> **quero** que os tokens de autenticação JWT e metadados de sessão do usuário sejam salvos em armazenamento criptografado por hardware (Keystore no Android e Keychain no iOS) através de uma camada unificada de serviço,  
> **para que** os dados sensíveis dos profissionais de saúde permaneçam estritamente protegidos contra vazamentos, inspeções indevidas ou furto do aparelho físico, mantendo o usuário conectado de forma confiável (NF011, ADR-034).

---

## 2. Regras de Negócio e Casos de Borda

1. **Uso Exclusivo de Criptografia de Hardware (`expo-secure-store`)**:
   - É expressamente proibido o uso de `AsyncStorage` comum ou armazenamento não criptografado para persistir o token JWT de acesso (`farmaubs_auth_token`) ou o payload do usuário (`farmaubs_auth_user`).
   - A biblioteca `expo-secure-store` garante integração nativa com o **Android Keystore System** e o **iOS Keychain Services**.

2. **Isolamento de Camada via `sessionService`**:
   - A camada de UI (telas e componentes) nunca deve invocar diretamente primitivos de armazenamento. Todas as operações passam pelo `sessionService` em `src/services/session.service.ts`.
   - Métodos públicos canônicos:
     - `salvarSessao(token: string, usuario: UsuarioAutenticado): Promise<void>`
     - `obterToken(): Promise<string | null>`
     - `obterUsuario(): Promise<UsuarioAutenticado | null>`
     - `limparSessao(): Promise<void>`

3. **Restauração Automática e Permanência da Sessão com o App Encerrado (Cold Start)**:
   - A sessão armazenada no hardware criptografado (`expo-secure-store`) permanece válida e persistente **mesmo quando o usuário fecha o aplicativo, encerra o processo na bandeja de multitarefas (*swipe away*) ou quando o SO finaliza o app por gestão de memória**.
   - Fechar ou encerrar o aplicativo móvel **NÃO desloga o usuário** nem apaga as credenciais locais.
   - Ao iniciar o aplicativo móvel a partir de um encerramento completo (cold start), o módulo de bootstrap consulta o `sessionService`.
   - Se o token e os dados de perfil existirem e o prazo de expiração ainda for válido (`expira_em > now()`), o app restaura o contexto autenticado imediatamente e transiciona diretamente para a rota autenticada sem exigir nova digitação de credenciais.
   - Caso o token esteja corrompido, inacessível ou o tempo limite tenha expirado, o serviço purga o armazenamento e encaminha para a tela de Login.

4. **Tratamento de Sessão Expirada ou Revogada (HTTP 401)**:
   - Todas as requisições autenticadas enviam o header `Authorization: Bearer <token>`.
   - Caso o servidor responda `401 Unauthorized` (por inatividade, revogação remota ou expiração de TTL):
     - O app intercepta o código 401.
     - Invoca imediatamente `sessionService.limparSessao()`.
     - Notifica o usuário: *"Sua sessão expirou por segurança. Por favor, entre novamente."*.
     - Redireciona para a tela de Login resetando o histórico de navegação.

5. **Notificação de Inatividade no SO Android**:
   - Conforme especificado em **AC-MOB-07**, o alerta preventivo de timeout (5 minutos antes da expiração) e o aviso de expiração são emitidos como **notificações nativas do SO Android**, garantindo que o operador seja alertado mesmo com o aplicativo em segundo plano ou fechado.

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

### 3.1 Chaves Padronizadas de Armazenamento
- Chave do Token: `farmaubs_auth_token`
- Chave do Usuário: `farmaubs_auth_user`

### 3.2 Tipagens Consumidas
```typescript
import type { UsuarioAutenticado } from "@farmaubs/shared";

export interface SessionStorageContract {
  salvarSessao(token: string, usuario: UsuarioAutenticado): Promise<void>;
  obterToken(): Promise<string | null>;
  obterUsuario(): Promise<UsuarioAutenticado | null>;
  limparSessao(): Promise<void>;
}
```

---

## 4. Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: `AC-19` (Contexto de Autenticação) e `AC-30` (Transporte e armazenamento seguro de sessão).
- **Diferença de Mecanismo**:
  - Web: Adota transporte de sessão via cookie HttpOnly ou gestão em memória (`AuthContext`) com expurgo de `localStorage` para mitigar ataques XSS em navegadores.
  - Mobile: Adota armazenamento local em hardware seguro (Android Keystore via `expo-secure-store`), onde a sessão permanece salva e ativa entre execuções completas do aplicativo.
- **Artefatos Compartilhados (`@farmaubs/shared`)**:
  - `UsuarioAutenticado` e `PerfilCodigo` em `packages/shared/src/acesso/`.
- **Se o Frontend Web já implementou AC-19/AC-30**:
  - O Mobile consome a mesma interface `UsuarioAutenticado` e o mesmo contrato de decodificação de perfil RBAC e escopo de UBS.
- **Se o Frontend Web ainda NÃO implementou**:
  - O time Mobile referencia diretamente as interfaces exportadas em `@farmaubs/shared`. Se for necessário persistir metadados extras na sessão móvel (ex.: timestamp de expiração local), esses campos devem ser adicionados a `@farmaubs/shared` para manter a paridade com o frontend web.

---

## 4. Critérios de Aceite Detalhados

- [ ] Implementação de `sessionService` utilizando `expo-secure-store` para gravação, leitura e deleção de credenciais.
- [ ] Validação em runtime de integridade do JSON salvo em `farmaubs_auth_user`, tratando exceções de parsing de forma fail-safe (limpeza automática se corrompido).
- [ ] Injeção automática do cabeçalho `Authorization: Bearer <token>` nas requisições HTTP da API.
- [ ] Resposta 401 dispara expurgo completo das chaves locais do SecureStore e redireciona para a tela de Login.
- [ ] Testes unitários do serviço cobrindo escrita, leitura, tratamento de exceções e limpeza segura.

---

## 5. Cenários de Teste (BDD)

```gherkin
Funcionalidade: Armazenamento Seguro de Sessão Mobile (AC-MOB-02 / NF011)

Contexto:
  Dado que o módulo de sessão móvel foi inicializado no dispositivo

Cenário: 1. Gravação criptografada da sessão após login com sucesso
  Quando o login do usuário "ana.souza@farmaubs.local" for validado com sucesso
  Então o token "jwt-token-valido-xyz" é gravado na chave "farmaubs_auth_token" do SecureStore
  E os dados de "UsuarioAutenticado" são serializados na chave "farmaubs_auth_user"
  E nenhuma informação sensível é gravada em texto plano no dispositivo

Cenário: 2. Restauração de sessão em reinicialização do aplicativo
  Dado que existem credenciais válidas gravadas no SecureStore
  Quando o aplicativo é aberto a partir de um encerramento completo (cold start)
  Então o aplicativo lê o token e perfil do usuário do SecureStore
  E inicializa o contexto global como autenticado
  E apresenta diretamente a tela principal ao usuário

Cenário: 3. Interceptação de erro 401 da API e expurgo de credenciais
  Dado que o usuário está navegando autenticado no app mobile
  Quando uma chamada à API retornar 401 Unauthorized por sessão expirada
  Então o aplicativo invoca o expurgo do SecureStore
  E as chaves "farmaubs_auth_token" e "farmaubs_auth_user" são deletadas
  E o usuário é encaminhado para a tela de Login com mensagem de sessão expirada
```
