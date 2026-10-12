# AC-MOB-05 Encerramento Seguro de Sessão (Logout) no Aplicativo Móvel (RF004)

- **Épico**: Acesso e Autenticação do Sistema
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF004 (Logout e Revogação), RF025 (RBAC)
- **Requisitos Não-Funcionais**: NF001 (Usabilidade), NF011 (Segurança e Criptografia), NF018 (Auditoria)
- **ADRs Vinculadas**: ADR-006 (Autenticação/Autorização), ADR-022 (Monorepo), ADR-034 (Workspace Mobile Expo)

---

## 1. História de Usuário

> **Como** profissional de saúde utilizando o FarmaUBS em dispositivo móvel compartilhado na UBS,  
> **quero** encerrar minha sessão com confirmação de saída rápida e revogação imediata,  
> **para que** todas as chaves de acesso sejam excluídas do celular e a sessão seja invalidada no servidor, impedindo acessos posteriores de outros operadores com as minhas credenciais (RF004, NF011).

---

## 2. Regras de Negócio e Casos de Borda

1. **Acesso Fácil e Confirmação de Ação**:
   - A opção "Sair do Sistema" fica visível no menu lateral do aplicativo ou no perfil do usuário no cabeçalho.
   - Ao tocar em "Sair", o aplicativo exibe um diálogo de confirmação nativo (`Alert.alert`): *"Deseja realmente sair do FarmaUBS?"* com as opções "Cancelar" e "Sair".

2. **Fluxo Fail-Safe de Revogação**:
   - Ao confirmar a saída:
     1. O aplicativo extrai o token atual do `sessionService`.
     2. Dispara a requisição `POST /api/v1/auth/logout` com o cabeçalho `Authorization: Bearer <token>`.
     3. Mesmo que ocorra um erro de rede (ex.: aparelho sem conexão ou servidor offline), a operação de limpeza local é executada de forma incondicional (`finally`).
     4. O `sessionService.limparSessao()` remove as chaves da Keystore/Keychain.
     5. O estado em memória do usuário é limpo (`setUsuario(null)`).
     6. O aplicativo redireciona o fluxo para a tela de Login resetando a pilha de telas do navegador móvel (impedindo o retorno pelo botão "Voltar").

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

### 3.1 Rotas Utilizadas
- Endpoint: `POST /api/v1/auth/logout`
- Cabeçalho: `Authorization: Bearer <token>`

---

## 3.2 Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: `AC-21` (Proteção de rotas por perfil e logout) e `AC-25` (Encerrar sessão no cliente).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - Endpoint comum `POST /api/v1/auth/logout`.
- **Se o Frontend Web já implementou AC-21/AC-25**:
  - O Mobile utiliza o mesmo endpoint e fluxo fail-safe de expurgo local de sessão (mesmo sob erro de rede).
  - Enquanto o Web limpa cookies/memória e redireciona SPA, o Mobile limpa o `SecureStore`, cancela notificações agendadas (`AC-MOB-07`) e reseta o stack do React Navigation.
- **Se o Frontend Web ainda NÃO implementou**:
  - O Mobile implementa a chamada de logout e expurgo de hardware de forma autônoma, referenciando a especificação do backend (`AC-06`).

---

## 4. Critérios de Aceite Detalhados

- [ ] Botão de logout visível e acessível em todas as telas principais do aplicativo.
- [ ] Diálogo de confirmação com prevenção de toques acidentais.
- [ ] Chamada de revogação de sessão ao backend (`POST /api/v1/auth/logout`).
- [ ] Expurgo obrigatório das chaves locais do `SecureStore` mesmo se a chamada de rede falhar.
- [ ] Reset da navegação para a tela de login impedindo que o botão "Voltar" reabra telas privadas.

---

## 5. Cenários de Teste (BDD)

```gherkin
Funcionalidade: Logout Seguro no Aplicativo Móvel (AC-MOB-05 / RF004)

Cenário: 1. Logout com confirmação e revogação no servidor
  Dado que o usuário está navegando autenticado no app mobile
  Quando abre o menu de perfil e seleciona "Sair do Sistema"
  E confirma a ação no diálogo de alerta
  Então o aplicativo dispara a requisição de logout para a API
  E apaga as credenciais da Keystore/Keychain
  E redireciona a interface para a tela de Login
  E pressionar o botão voltar do aparelho não reabre o app autenticado

Cenário: 2. Cancelamento do diálogo de saída
  Dado que o usuário tocou em "Sair do Sistema"
  Quando toca em "Cancelar" no diálogo de confirmação
  Então o diálogo é fechado
  E a sessão do usuário permanece ativa e inalterada
```
