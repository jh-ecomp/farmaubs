# AC-25 feat(acesso): Encerrar Sessão no Cliente (Frontend)

- **Épico**: Autenticação e Controle de Acesso (ADR-006)
- **Requisitos Funcionais**: RF004 (Encerrar Sessão / Logout)
- **Requisitos Não-Funcionais**: NF009 (Menor Privilégio e Segurança), NF012 (Sessão Segura e Controle de Inatividade)
- **ADRs Vinculadas**: ADR-003 (Arquitetura Hexagonal), ADR-006 (Sessão Server-Side em PostgreSQL), ADR-013 (Gerenciamento de Estado de Cliente e Cache), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes)

---

### 1. História de Usuário

> **Como** usuário autenticado do FarmaUBS (qualquer perfil),  
> **quero** que ao clicar em "Sair" todos os dados temporários sejam removidos do navegador e o cache de consultas seja expurgado imediatamente,  
> **para que** informações confidenciais de saúde (pacientes, medicamentos, inventários) não permaneçam acessíveis na memória do navegador após minha saída, protegendo a privacidade em computadores compartilhados da UBS (RF004, NF012).

---

### 2. Regras de Negócio e Casos de Borda

1. **Higienização Completa de Credenciais (LGPD / SUS Compliance)**:
   - A função de logout deve remover todos os itens prefixados `@FarmaUBS:*` do `localStorage` (`token`, `usuario`, `expiresAt`, etc.).
   - O estado do `AuthContext` deve ser redefinido para desautenticado (`isAuthenticated: false`, `usuario: null`).

2. **Expurgo Obrigatório do Cache do TanStack Query (ADR-013)**:
   - `queryClient.clear()` deve ser executado no momento do logout, sem exceção.
   - Esse passo é mandatório para evitar que dados confidenciais de saúde — consultas de pacientes, dispensações e inventários de medicamentos — permaneçam na memória do navegador após a saída.

3. **Resiliência a Falhas de Conectividade**:
   - Caso a chamada HTTP `POST /api/v1/acesso/logout` falhe por erro de rede ou indisponibilidade do servidor, o frontend **deve forçar a limpeza local** (storage + cache + estado) e redirecionar para `/login`.
   - O usuário nunca pode ficar preso em um estado autenticado no cliente quando manifestou intenção de sair.

4. **Diferenciação do Motivo de Saída**:
   - **Logout Voluntário**: o usuário clica em "Sair" ➔ redireciona para `/login` sem mensagem de alerta.
   - **Logout por Inatividade (Timeout — NF012)**: o `useSessionTimeout` dispara o encerramento ➔ grava `logoutReason: 'timeout'` no `sessionStorage` antes de redirecionar ➔ a tela de login lê e exibe: *"Sua sessão expirou por inatividade. Faça login novamente."*

5. **Acessibilidade do Botão de Saída**:
   - O botão de logout deve ser acionável por teclado (`Tab` + `Enter`), possuir `aria-label="Encerrar sessão"` e indicador de foco visível conforme os padrões de acessibilidade do projeto.

---

### 3. Contrato da API (`@farmaubs/shared`)

O frontend consome o endpoint provido pela AC-06:

- **Rota Canônica**: `API_ROUTES.ACESSO.LOGOUT` (`POST /api/v1/acesso/logout`)
- **Cabeçalho Obrigatório**: `Authorization: Bearer <token_plain>` (gerenciado pelo `authService`).
- **Resposta esperada**: `204 No Content` em caso de sucesso.
- Qualquer erro HTTP (inclusive `4xx`/`5xx`) ou erro de rede aciona o caminho de fallback local.

---

### 3.1 Estratégia de Integração e Independência de Ciclos (Frontend Web ↔ Mobile)

- **Contra-parte no Mobile**: `AC-MOB-05` (Encerramento Seguro de Sessão no Aplicativo Móvel).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - Constante de rota `API_ROUTES.ACESSO.LOGOUT` (`POST /api/v1/acesso/logout`).
- **Se o Mobile já implementou AC-MOB-05**:
  - O Frontend Web utiliza a mesma rota e a mesma premissa fail-safe de limpeza de sessão local independente de sucesso ou falha na resposta de rede.
- **Se o Mobile ainda NÃO implementou**:
  - O Frontend Web consome a rota do backend e documenta a garantia de expurgo de cache (`queryClient.clear()`), servindo de referência de segurança para a implementação no app nativo.

---

### 4. Arquitetura e Estrutura de Pastas

Conforme o [CONTRIBUTING.md](file:///c:/Users/jaohe/projetos/farmaubs/CONTRIBUTING.md):

```text
apps/frontend/src/
├── services/
│   └── api.ts                             # authService.logout(): dispara POST /acesso/logout
├── contexts/
│   └── AuthContext.tsx                    # logout(): chama authService → limpa storage
│                                          # → queryClient.clear() → setState → redirect
└── components/common/
    └── UserMenu.tsx (ou Header.tsx)       # Botão acessível "Sair" com aria-label e foco visível
```

> **Nota Arquitetural (ADR-013)**: O `QueryClient` deve ser acessado via `useQueryClient()` dentro do `AuthContext` ou injetado no provider raiz. O `queryClient.clear()` **deve preceder** o redirecionamento para garantir que nenhuma re-renderização pós-logout consiga ler dados cacheados.

---

### 5. Critérios de Aceite Detalhados

- [ ] **Chamada ao Backend**: A função de logout dispara `POST /api/v1/acesso/logout` com o Bearer token presente no `localStorage`.
- [ ] **Descarte Completo de Credenciais**: Após o logout (com ou sem sucesso na API), todos os itens `@FarmaUBS:*` são removidos do `localStorage` e o `AuthState` é redefinido para desautenticado.
- [ ] **Expurgo de Cache**: `queryClient.clear()` é executado obrigatoriamente antes do redirecionamento.
- [ ] **Fallback para Falha de Rede**: Se a chamada à API falhar, o frontend executa limpeza local e redireciona para `/login` sem bloquear o usuário.
- [ ] **Logout Voluntário**: Redirecionamento para `/login` sem mensagem adicional.
- [ ] **Logout por Inatividade**: `sessionStorage.setItem('logoutReason', 'timeout')` gravado antes do redirecionamento; a tela de `/login` lê e exibe o aviso de inatividade.
- [ ] **Acessibilidade**: O botão de logout possui `aria-label="Encerrar sessão"`, é focalizável via `Tab` e ativável via `Enter`, com indicador de foco visível.

---

### 6. Cenários de Teste em BDD (Gherkin — ADR-030)

#### Camada D — Teste de Componente Frontend (`AuthContext.spec.tsx`)
```gherkin
# language: pt
Funcionalidade: Logout no Cliente — Limpeza de Credenciais e Cache (Camada D)

  Cenário: Logout voluntário com sucesso limpa storage e expurga cache
    Dado que o usuário está autenticado com token em localStorage
    E existem dados em cache no queryClient (ex: lista de medicamentos)
    Quando a função de logout for acionada pelo clique em "Sair"
    Então a requisição POST para "/api/v1/acesso/logout" deve ser disparada
    E as chaves "@FarmaUBS:token" e "@FarmaUBS:usuario" devem ser removidas do localStorage
    E o método queryClient.clear() deve ser executado
    E o usuário é redirecionado para a rota "/login"
    E nenhuma mensagem de inatividade é exibida na tela de login

  Cenário: Logout por inatividade exibe mensagem ao retornar para o login
    Dado que o hook useSessionTimeout detecta inatividade superior ao limite (NF012)
    Quando o encerramento automático de sessão for acionado
    Então a chave "logoutReason" com valor "timeout" deve ser gravada no sessionStorage
    E o usuário é redirecionado para "/login"
    E a tela de login exibe "Sua sessão expirou por inatividade. Faça login novamente."

  Cenário: Fallback de limpeza local quando a API está indisponível
    Dado que o usuário está autenticado com token em localStorage
    E a API "/api/v1/acesso/logout" está inacessível (falha de rede)
    Quando a função de logout for acionada
    Então as credenciais locais devem ser removidas mesmo assim
    E o método queryClient.clear() deve ser executado
    E o usuário é redirecionado para "/login"
```

---

### 7. Definition of Done (DoD) & Pré-requisitos

#### Pré-requisitos Técnicos
- [ ] AC-06 concluída: endpoint `POST /api/v1/acesso/logout` funcional e retornando `204`.
- [ ] `API_ROUTES.ACESSO.LOGOUT` declarado em `@farmaubs/shared`.

#### Critérios de Conclusão (DoD)
- [ ] Método `authService.logout()` implementado em `apps/frontend/src/services/api.ts`.
- [ ] `AuthContext.tsx` atualizado: invoca `authService.logout()`, executa `queryClient.clear()`, limpa `localStorage`, redefine estado e redireciona.
- [ ] Tratamento de fallback implementado: bloco `catch` na função de logout garante limpeza local mesmo em falha de rede.
- [ ] Lógica de `logoutReason` implementada: gravação no `sessionStorage` pelo `useSessionTimeout` e leitura + exibição na tela de login.
- [ ] Botão de logout acessível (`aria-label`, foco por teclado) presente em `UserMenu.tsx` ou equivalente.
- [ ] Testes da Camada D cobrindo os três cenários BDD acima passando (`pnpm test` no frontend).
- [ ] `pnpm build` passando em `@farmaubs/frontend`.