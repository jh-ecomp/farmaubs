# AC-30 feat(acesso): Migração de sessão para cookie `HttpOnly` e expurgo de tokens do `localStorage` no frontend

---

- **Épico**: Autenticação e Controle de Acesso (RF001–RF004, NF009–NF012)
- **Requisitos Funcionais**: RF001 (Login e Restauração de Sessão), RF002 (Inicialização e Ciclo de Vida da Sessão), RF004 (Logout e Higienização de Memória)
- **Requisitos Não-Funcionais**: NF001 (Interface sem Flashes), NF009 (Menor Privilégio na UI), NF012 (Sessão Segura e Anti-XSS)
- **ADRs Vinculadas**: ADR-006 (Controle de Acesso RBAC), ADR-011 (React + Vite), ADR-013 (Context API e TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de Usuário

> **Como** usuário autenticado do FarmaUBS,  
> **quero** que a aplicação não armazene tokens de autenticação em `localStorage` e que todas as requisições HTTP incluam automaticamente as credenciais seguras do navegador,  
> **para que** minhas credenciais não possam ser extraídas ou interceptadas por scripts executados no cliente, mantendo a sessão protegida mesmo em caso de vulnerabilidades em bibliotecas de terceiros (NF012, ADR-034).

---

## 2. Regras de Negócio e Casos de Borda

1. **Pré-requisito do Backend (AC-29)**:
   - Esta história depende do suporte a cookies `HttpOnly` e `credentials: true` implementado no backend pela **AC-29**.
   - O isolamento de escopo (Seção 2.1 do `CONTRIBUTING.md`) deve ser estritamente respeitado: esta tarefa altera **exclusivamente** arquivos de `apps/frontend/`.

2. **Eliminação de tokens em armazenamento client-side**:
   - A chave `@FarmaUBS:token` **deve ser permanentemente banida do `localStorage` e do `sessionStorage`**.
   - Apenas dados não-sensíveis de apresentação do usuário logado (`@FarmaUBS:usuario`) e timestamp de expiração (`@FarmaUBS:expiresAt`) podem ser mantidos localmente para suportar reidratação visual de UI rápida sem flash.

3. **Paridade Arquitetural com App Mobile (`apps/mobile`)**:
   - Assim como o frontend elimina o uso de `localStorage` para tokens, o aplicativo móvel (`apps/mobile` — `AC-MOB-02`) **bane o uso de `AsyncStorage` para credenciais sensíveis**.
   - No mobile, o token de sessão é armazenado exclusivamente no Hardware Keystore/Keychain (`expo-secure-store`) sob encriptação de hardware e proteção biométrica.
   - Ambas as aplicações garantem vetores de ataque zerados contra vazamento de credenciais via scripts em JavaScript.

4. **Inclusão automática de credenciais (`credentials: 'include'`)**:
   - O cliente HTTP centralizado (`apps/frontend/src/services/api.ts`) e quaisquer outros serviços que realizem requisições devem definir obrigatoriamente a opção `{ credentials: "include" }`.
   - Nenhum cabeçalho manual `Authorization: Bearer ...` deve ser montado a partir de storage no frontend.

5. **Ciclo de vida do contexto (`AuthContext.tsx`)**:
   - Na montagem do `AuthProvider` (recarga F5 ou abertura de aba):
     - `status` inicia como `'carregando'`.
     - O frontend executa imediatamente `GET /api/v1/acesso/me` com `credentials: 'include'`.
     - Se a API responder `200 OK`: o estado é populado com os dados oficiais do usuário e transiciona para `status: 'autenticado'`.
     - Se a API responder `401 Unauthorized`: o estado é limpo e transiciona para `status: 'nao_autenticado'`.
     - Se houver falha de rede (`NETWORK_ERROR`): aplica fallback para `'nao_autenticado'`, prevenindo spinner infinito.

6. **Fluxo de login (`authService.login`)**:
   - Não tenta ler cabeçalho `Authorization` da resposta do login nem salva token.
   - Retorna os dados do corpo (`usuario`, `sessao`, `redirectUrl`) e confia no cookie setado automaticamente pelo navegador.

7. **Fluxo de logout (`authService.logout`)**:
   - Dispara `POST /api/v1/acesso/logout` com `credentials: 'include'` para que o backend revogue a sessão e limpe o cookie.
   - Limpa o cache do TanStack Query (`queryClient.clear()`).
   - Remove dados residuais do storage local (`@FarmaUBS:usuario`, `@FarmaUBS:expiresAt`).
   - Redefine o estado global para `'nao_autenticado'` e redireciona para `/login`.

---

## 3. Contratos de Dados e Protocolo HTTP

### Requisição client-side centralizada (`fetch`)
```typescript
const resposta = await fetch(url, {
  ...options,
  credentials: "include", // Garante envio automático do cookie farmaubs_session
  headers: {
    "Content-Type": "application/json",
    ...options.headers,
  },
});
```

### Contrato de retorno do login no frontend (`LoginResponse`)
```typescript
export interface LoginResponse {
  // O campo token torna-se desnecessário / opcional (deprecated no web)
  expiresAt: string;
  ttlSeconds: number;
  warningSeconds: number;
  usuario: UsuarioAutenticado;
  redirectUrl: string;
}
```

---

## 4. Escopo Técnico da Implementação — Clean Architecture (Frontend)

Conforme a [ADR-034](file:///c:/Users/jaohe/projetos/farmaubs/docs/adrs/adr-034-clean-architecture-fullstack.md) e [CONTRIBUTING.md](file:///c:/Users/jaohe/projetos/farmaubs/CONTRIBUTING.md) (Seções 1.2 e 2.2):

### Frontend (`apps/frontend/`)
- **`src/services/api.ts` (Camada de Serviços / API Client)**:
  - Adicionar `credentials: "include"` na chamada base de `fetch` em todos os métodos (`login`, `logout`, `getSessaoMe`, `renovarSessao`, `trocarSenhaObrigatoria`, etc.).
  - Remover extração do cabeçalho `Authorization` no método `login`.
  - Remover qualquer leitura de `localStorage.getItem("@FarmaUBS:token")`.
- **`src/services/usuario.service.ts`**:
  - Remover leitura manual de token e adicionar `credentials: "include"`.
- **`src/contexts/AuthContext.tsx` (Estado de UI / Contexto de Sessão)**:
  - Eliminar inicialização baseada na presença de `@FarmaUBS:token`.
  - Ao inicializar, chamar sempre `api.getSessaoMe()` enquanto `status === 'carregando'`.
  - No `login()`, não salvar `@FarmaUBS:token` no `localStorage`.
  - No `logout()`, manter limpeza de cache de queries (`queryClient.clear()`) e remoção de chaves residuais.
- **Testes da Camada D (Vitest)**:
  - Atualizar `AuthContext.spec.tsx`, `api.spec.ts`, `Login.spec.tsx`, `TrocarSenha.spec.tsx`, `AdminUsuarios.spec.tsx` e `SessionTimeoutModal.spec.tsx`:
    - Remover mocks de `localStorage.setItem("@FarmaUBS:token")`.
    - Ajustar asserções para validar `{ credentials: "include" }` nas requisições.

---

## 5. Cenários de Teste em BDD (Gherkin — Camada D / Vitest)

> **Nota de Governança de Testes (CONTRIBUTING.md Seção 5.2):**  
> Os cenários Gherkin abaixo definem a especificação comportamental da Camada D. No frontend, eles são implementados com **Vitest + React Testing Library** (`AuthContext.spec.tsx`) e executados pelo comando do Moonrepo `moon run frontend:test` (o runner Cucumber.js `@cucumber/cucumber` é restrito ao backend).

Arquivo de teste principal: `apps/frontend/src/contexts/AuthContext.spec.tsx`

```gherkin
# language: pt
Funcionalidade: Gestão de sessão via cookies HttpOnly no frontend (AC-30)

  Cenário: Inicialização e restauração automática com cookie válido
    Dado que o navegador possui um cookie "farmaubs_session" válido
    E a API responde 200 OK para GET "/api/v1/acesso/me" com os dados do usuário
    Quando a aplicação é carregada no navegador
    Então a requisição deve ser enviada com credentials "include"
    E nenhum token de autenticação deve ser gravado no localStorage
    E o status da autenticação deve transicionar para "autenticado"
    E os dados do usuário logado devem estar disponíveis no contexto

  Cenário: Inicialização com cookie inexistente ou expirado
    Dado que a API responde 401 Unauthorized para GET "/api/v1/acesso/me"
    Quando a aplicação é carregada no navegador
    Então o status final deve ser "nao_autenticado"
    E o usuário no contexto deve ser nulo
    E a chave "@FarmaUBS:token" não deve existir no localStorage

  Cenário: Login bem-sucedido não expõe token no localStorage
    Dado que o usuário submete o formulário de login com sucesso
    Quando a API responde 200 OK com cookie setado
    Então o usuário é redirecionado para a rota apropriada
    E as credenciais de sessão não devem constar em localStorage.getItem("@FarmaUBS:token")
    E o cache de usuário visual deve estar populado

  Cenário: Logout seguro limpa estado e aciona backend com credentials include
    Dado que o usuário está autenticado no contexto
    Quando a ação de logout for acionada
    Então a chamada para "POST /api/v1/acesso/logout" deve ser disparada com credentials "include"
    E o cache do TanStack Query deve ser limpo via queryClient.clear()
    E o status da aplicação deve se tornar "nao_autenticado"
    E o usuário deve ser redirecionado para "/login"
```

---

## 6. Definition of Done (DoD) com Moonrepo

1. [ ] **Pré-requisito**: Backend com suporte a cookies `HttpOnly` e CORS configurado (conforme **AC-29**).
2. [ ] Nenhuma ocorrência de `localStorage.setItem("@FarmaUBS:token")` ou `localStorage.getItem("@FarmaUBS:token")` remanescente no código de produção do frontend.
3. [ ] Todas as chamadas de API do frontend utilizam `{ credentials: "include" }`.
4. [ ] `AuthContext.tsx` valida sessão na inicialização consultando `GET /api/v1/acesso/me` de forma transparente.
5. [ ] `Login.tsx` autentica e navega sem depender da manipulação de tokens em JavaScript.
6. [ ] `logout()` dispara revogação no backend com cookies e limpa o cache em memória do TanStack Query (`queryClient.clear()`).
7. [ ] 100% dos testes do frontend atualizados e passando via `moon run frontend:test`.
8. [ ] Linting estático aprovado sem erros via `moon run frontend:lint` e `moon check --affected`.
9. [ ] Build de produção do monorepo aprovado (`moon run :build`).