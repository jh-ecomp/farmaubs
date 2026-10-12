# AC-19 Contexto de autenticação: usuário atual, perfil e escopo de tenant (ADR-013, ADR-006)

- **Épico**: Acesso e Autenticação do Sistema (RF001–RF004, NF009–NF012)
- **Requisitos Funcionais**: RF002 (Inicialização e Sessão do Usuário), RF004 (Logout e Revogação de Sessão)
- **Requisitos Não-Funcionais**: NF001 (Interface Fluida sem Flashes de Acesso Indevido), NF009 (Menor Privilégio / RBAC na UI), NF012 (Sessão Segura), NF015 (Isolamento Multi-tenant no Frontend)
- **ADRs Vinculadas**: ADR-006 (Controle de Acesso RBAC), ADR-011 (React + Vite), ADR-013 (Context API para UI / TanStack Query para Servidor), ADR-022 (`@farmaubs/shared`), ADR-029 (Arquitetura Hexagonal no NestJS), ADR-030 (Pirâmide de Testes — Camadas A e D), ADR-032 (Acessibilidade WCAG 2.1 AA)

---

## 1. História de Usuário

> **Como** usuário autenticado do FarmaUBS (qualquer perfil),  
> **quero** que o frontend valide e mantenha em um contexto global de autenticação os dados oficiais do usuário (`id`, `nomeCompleto`, `email`), seu perfil RBAC (`perfilCodigo`), flag de troca obrigatória (`deveTrocarSenha`) e escopo de lotação (`municipioId`, `unidadeIds`),  
> **para que** o estado de autenticação seja consistente com o servidor, as rotas protegidas eliminem flashes indevidos e as telas conheçam exatamente as permissões do usuário sem heurísticas locais ou chamadas redundantes.

---

## 2. Regras de Negócio e Casos de Borda

1. **Enriquecimento Canônico da Sessão (`GET /api/v1/acesso/me`)**:
   - O backend deve retornar os dados completos do usuário logado e o código do perfil (`ADMINISTRADOR`, `FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `GERENTE`) através de join com `users` e `perfis`.
   - O frontend **não deve deduzir o perfil por strings no e-mail** nem usar IDs numéricos fictícios; os dados devem ser consumidos diretamente do contrato `SessaoUsuarioDto`.

2. **Ciclo de Vida do Contexto (`AuthStatus`)**:
   - `status: 'carregando' | 'autenticado' | 'nao_autenticado'`.
   - Ao iniciar a aplicação (`AuthProvider` montado):
     - Se houver token salvo, define `status: 'carregando'` e efetua `GET /api/v1/acesso/me`.
     - Se a chamada retornar `200`, popula o estado com o snapshot do usuário e define `status: 'autenticado'`.
     - Se o token for inválido/expirado (`401`) ou não houver token, limpa o armazenamento e define `status: 'nao_autenticado'`.
   - Enquanto `status === 'carregando'`, nenhuma rota protegida deve redirecionar para `/login` ou `/403`, exibindo um splash/spinner de carregamento acessível (`role="status"`, `aria-live="polite"`).

3. **Helpers RBAC e Escopo**:
   - `hasRole(roles: PerfilCodigo | PerfilCodigo[])`: Retorna `true` se o usuário logado tiver o perfil especificado.
   - `isAdmin`: Retorna `true` para `PerfilCodigo.ADMINISTRADOR`.
   - `escopoAtivo`: Retorna `{ municipioId, unidadeIds, isGlobalAdmin: perfilCodigo === 'ADMINISTRADOR' }`.

4. **Logout Seguro e Revogação (RF004)**:
   - Endpoint `POST /api/v1/acesso/logout` no backend que atualiza a sessão para `status = 'revogada'` na tabela `sessions`.
   - No frontend, a função `logout()` invoca o endpoint, limpa os dados do contexto e do armazenamento (`localStorage`), esvazia o cache do TanStack Query (`queryClient.clear()`) e redireciona para `/login`.

---

## 3. Contratos de Dados (`@farmaubs/shared`)

### `packages/shared/src/acesso/session.types.ts`
```typescript
import type { PerfilCodigo } from "./perfil.types";

export interface SessaoUsuarioDto {
  id: string;
  nomeCompleto: string;
  email: string;
  perfilCodigo: PerfilCodigo;
  municipioId: string;
  unidadeIds: string[];
  deveTrocarSenha: boolean;
  expiresAt: string;
}
```

---

## 3.1 Estratégia de Integração e Independência de Ciclos (Frontend Web ↔ Mobile)

- **Contra-parte no Mobile**: `AC-MOB-02` (Armazenamento Seguro de Sessão) e `AC-MOB-03` (Seleção e alternância de UBS ativa).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `SessaoUsuarioDto`, `UsuarioAutenticado`, `PerfilCodigo` e cabeçalho `x-unidade-id`.
- **Se o Mobile já implementou AC-MOB-02/AC-MOB-03**:
  - O Frontend Web aproveita a modelagem e validação de sessão já presentes em `@farmaubs/shared`.
  - Garante que a chave de propagação de tenant (`x-unidade-id`) e o formato do payload do usuário sejam idênticos nos interceptors do Axios/fetch.
- **Se o Mobile ainda NÃO implementou**:
  - O Frontend Web publica as definições de contexto e sessão em `packages/shared/src/acesso/session.types.ts`, fornecendo ao workspace mobile as interfaces prontas para o hook/serviço nativo.

---

## 4. Escopo Técnico da Implementação

### 4.1 Pacote Compartilhado (`packages/shared/`)
- Exportar `SessaoUsuarioDto` em `packages/shared/src/acesso/session.types.ts` e no index do módulo.

### 4.2 Backend (`apps/backend/`)
- **`acesso.controller.ts`**:
  - Atualizar `GET /api/v1/acesso/me` para buscar dados na entidade de usuário e perfil, retornando `SessaoUsuarioDto`.
  - Adicionar `POST /api/v1/acesso/logout` invocando `sessionRepo.revogar(sessionId)`.

### 4.3 Frontend (`apps/frontend/`)
- **`AuthContext.tsx`**:
  - Refatorar para utilizar `SessaoUsuarioDto` e gerenciar `status: 'carregando' | 'autenticado' | 'nao_autenticado'`.
  - Implementar efeito inicial que valida a sessão ativa em `GET /api/v1/acesso/me`.
  - Expor helpers `hasRole`, `isAdmin` e `escopoAtivo`.
  - Exibir splash screen acessível com `role="status"` durante o estado `'carregando'`.
- **`api.ts`**:
  - Remover a dedução por string de e-mail e integrar login ao novo contrato.
  - Implementar métodos `obterSessaoAtual()` (`GET /acesso/me`) e `logout()` (`POST /acesso/logout`).
- **`RoleRoute.tsx`**:
  - Substituir validação de strings manuais por `const { hasRole } = useAuth()`.
- **`auth-context.spec.tsx` (Camada D)**:
  - Criar suíte de testes com React Testing Library e Vitest cobrindo os cenários abaixo.

---

## 5. Cenários de Teste em BDD (Gherkin — Camada D)

Arquivo: `apps/frontend/src/test/components/auth-context.spec.tsx`

```gherkin
# language: pt
Funcionalidade: Contexto Global de Autenticação (ADR-013, AC-19)

  Cenário: Inicialização e restauração automática com sessão válida
    Dado que existe um token de autenticação salvo no armazenamento
    E a API responde com 200 OK para GET "/api/v1/acesso/me" com os dados do usuário
    Quando a aplicação é montada
    Então inicialmente o indicador de carregamento com role="status" deve estar visível
    E em seguida o status deve transicionar para "autenticado"
    E os dados de "nomeCompleto", "perfilCodigo" e "municipioId" devem estar disponíveis

  Cenário: Inicialização com token inválido ou expirado
    Dado que existe um token inválido salvo no armazenamento
    E a API responde com 401 Unauthorized para GET "/api/v1/acesso/me"
    Quando a aplicação é montada
    Então o status final deve ser "nao_autenticado"
    E o token deve ser removido do armazenamento
    E isAuthenticated deve ser falso

  Cenário: Helper hasRole valida corretamente as permissões
    Dado um usuário autenticado com perfil "FARMACEUTICO_RESPONSAVEL"
    Quando o componente consultar hasRole(FARMACEUTICO_RESPONSAVEL)
    Então deve retornar verdadeiro
    Mas quando consultar hasRole(ADMINISTRADOR)
    Então deve retornar falso

  Cenário: Administrador possui isGlobalAdmin verdadeiro no escopo
    Dado um usuário autenticado com perfil "ADMINISTRADOR"
    Quando o componente consultar escopoAtivo
    Então isGlobalAdmin deve ser verdadeiro

  Cenário: Logout revoga sessão e limpa os estados
    Dado que o usuário está autenticado no contexto
    Quando a ação de logout() for acionada
    Então a requisição POST "/api/v1/acesso/logout" deve ser disparada
    E o usuário no contexto deve se tornar nulo
    E o status deve ser "nao_autenticado"
```

---

## 6. Definition of Done (DoD)

1. [ ] Contrato `SessaoUsuarioDto` exportado em `@farmaubs/shared`.
2. [ ] Backend responde `GET /api/v1/acesso/me` com `SessaoUsuarioDto` e possui rota `POST /api/v1/acesso/logout`.
3. [ ] Heurística de adivinhação de perfil por e-mail em `api.ts` completamente eliminada.
4. [ ] `AuthProvider` gerencia `status: 'carregando' | 'autenticado' | 'nao_autenticado'` com splash acessível (`role="status"`).
5. [ ] `RoleRoute` e guards utilizam `hasRole()` do `useAuth()`.
6. [ ] 100% dos cenários BDD da Camada D implementados e passando em `auth-context.spec.tsx`.
7. [ ] `pnpm -r test` e `pnpm -r build` executando sem erros em todo o monorepo.