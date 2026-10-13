# AC-21 Proteção de rotas por perfil e logout (NF009)

- **Épico**: Acesso e Autenticação do Sistema (RF001–RF004, NF009–NF012)
- **Requisitos Funcionais**: RF002 (Acesso ao Sistema), RF003 (Troca de Senha Obrigatória), RF004 (Logout), RF025 (RBAC e Gestão de Usuários)
- **Requisitos Não-Funcionais**: NF001 (Usabilidade / Interface Intuitiva), NF002 (Design Responsivo), NF009 (Controle de Acesso Baseado em Perfil / RBAC), NF016 (Defesa em Profundidade no Cliente)
- **ADRs Vinculadas**: ADR-006 (Controle de Acesso RBAC), ADR-011 (React + Vite), ADR-012 (SPA Client-Side Rendering), ADR-013 (Context API para Estado de UI / TanStack Query para Servidor), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de Usuário

> **Como** usuário do FarmaUBS (qualquer perfil),  
> **quero** que as rotas da aplicação sejam estritamente protegidas conforme o meu perfil de acesso (`perfilCodigo`), que o menu exiba somente os recursos permitidos e que eu possa encerrar minha sessão com segurança pelo menu,  
> **para que** eu navegue exclusivamente pelas funcionalidades autorizadas ao meu papel profissional e finalize meu uso de forma explícita e segura, sem que telas restritas fiquem expostas ou acessíveis pelo histórico do navegador (NF009, RF004, ADR-013).

---

## 2. Regras de Negócio e Casos de Borda

1. **Guards de Rota no Roteador (React Router)**:
   - **`ProtectedRoute`**: Envolve todas as páginas privadas (`apps/frontend/src/components/ProtectedRoute.tsx`). Se `status === 'carregando'`, exibe splash acessível de carregamento sem renderizar filhos. Se `status === 'nao_autenticado'`, redireciona para `/login`, preservando a rota pretendida no estado de navegação (`state: { from: location }`) para redirecionamento pós-login.
   - **`RoleRoute`**: Envolve rotas de perfis específicos (`apps/frontend/src/components/RoleRoute.tsx`). Utiliza `hasRole(rolesPermitidos)` do `AuthContext` (AC-19). Se o usuário autenticado não possuir o perfil exigido, é redirecionado para a rota de acesso negado (`/403`).
   - **Trava de Troca Obrigatória de Senha (`deveTrocarSenha = true`)**: Se o snapshot do usuário autenticado indicar `deveTrocarSenha: true` (usuário novo ou com senha provisória da AC-08/AC-23), o `ProtectedRoute` intercepta a navegação e força o redirecionamento imediato para `/trocar-senha-obrigatoria`, impedindo o acesso ao restante da aplicação até que a nova senha seja cadastrada.

2. **Matriz de Permissões e Visibilidade (Espelhamento do Backend AC-13 e App Mobile)**:
   - O frontend reflete a mesma matriz RBAC declarativa definida no backend (AC-13) e consumida no mobile (`AC-MOB-03`).
   - O componente de navegação (`Sidebar` / `HeaderMenu`) consome `hasRole()` para renderizar condicionalmente os links. Itens de menu para rotas não autorizadas **não são renderizados no DOM**, evitando ruído visual e tentativas vãs de navegação.

3. **Página de Acesso Negado (`/403` / `AccessDenied`)**:
   - Localizada em `apps/frontend/src/pages/AccessDenied.tsx`.
   - Exibe mensagem amigável e clara em Português do Brasil (NF003): *"Acesso Negado: Seu perfil não possui permissão para acessar este recurso"*.
   - Disponibiliza botão de retorno à tela inicial permitida do perfil (`/dashboard`).
   - Acessível para leitores de tela com `role="alert"` e `aria-live="assertive"` (ADR-032).

4. **Fluxo de Logout Explícito e Descarte de Histórico (RF004, AC-06, AC-25, AC-30)**:
   - O item "Sair" é posicionado no menu de usuário do cabeçalho/sidebar (`UserMenu.tsx`).
   - Ao acionar o logout:
     1. Aciona o método `logout()` do `AuthContext`, que consome `POST /api/v1/acesso/logout` enviando credenciais (`credentials: 'include'`).
     2. Invalida e limpa o cache de dados em memória do TanStack Query (`queryClient.clear()`).
     3. Redireciona o navegador para `/login` com substituição de histórico (`navigate('/login', { replace: true })`), impedindo que o botão "Voltar" do navegador reabra telas autenticadas com sessão encerrada.

5. **Acessibilidade e Usabilidade (ADR-032, WCAG 2.1 AA)**:
   - Navegação por teclado completa via tecla `Tab` e setas direcionais nos menus suspensos (primitivos Radix UI).
   - Indicador de foco visualmente destacado (`focus-visible:ring-2`).
   - Links ativos do menu marcados semanticamente com `aria-current="page"`.

---

## 3. Matriz de Rotas e Permissões por Perfil (Sincronizada com AC-13)

| Rota no Frontend | Farmacêutico Residente | Farmacêutico Responsável | Gerente / Coordenador | Administrador | Descrição |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `/login` | Public | Public | Public | Public | Tela de autenticação pública |
| `/trocar-senha-obrigatoria` | 🔒 | 🔒 | 🔒 | 🔒 | Acessível apenas quando `deveTrocarSenha = true` |
| `/dashboard` | ✅ | ✅ | ✅ | ✅ | Visão geral da UBS / Sistema |
| `/estoque` | ✅ | ✅ | ✅ | ✅ | Entradas, saídas e lotes |
| `/dispensas` | ✅ | ✅ | ✅ | ✅ | Registro e consulta de dispensas |
| `/indicadores` | ✅ | ✅ | ✅ | ✅ | Curva ABC e métricas operacionais |
| `/relatorios` | ❌ | ✅ | ✅ | ✅ | Inventários e relatórios de perdas |
| `/log-auditoria` | ❌ | ❌ | ✅ | ✅ | Consulta somente-leitura de auditoria |
| `/usuarios` | ❌ | ❌ | ❌ | ✅ | Gestão de contas de usuários (AC-08/AC-12) |
| `/ubs` | ❌ | ❌ | ❌ | ✅ | Gestão de UBSs municipais (RF026) |
| `/parametros` | ❌ | ✅ | ❌ | ✅ | Limiares de alerta e estoque de segurança |
| `/403` | ✅ | ✅ | ✅ | ✅ | Tela acessível de acesso negado |

> **Nota de Defesa em Profundidade (NF016)**: A proteção no frontend garante excelência em UX (escondendo links e prevenindo navegação inútil). A validação real de segurança permanece intransponível no backend (`RolesGuard` e `TenantScopeGuard` da AC-13).

---

## 4. Compartilhamento Arquitetural com `@farmaubs/shared` e Paridade com App Mobile

Conforme a [ADR-034](file:///c:/Users/jaohe/projetos/farmaubs/docs/adrs/adr-034-clean-architecture-fullstack.md):
- **Contratos e Lógica Pura no `@farmaubs/shared`**:
  - `packages/shared/src/acesso/perfil.types.ts`: contém `PerfilCodigo` e matriz declarativa de autorização.
  - Funções puras de verificação de papel (`hasRole`, `podeAcessarRecurso`) são compartilhadas entre Web e Mobile.
- **Paridade com App Mobile (`apps/mobile`)**:
  - **`AC-MOB-01` & `AC-MOB-03`**: O roteamento móvel com Expo Router implementa navegação condicional por abas (Tabs) e Stack Guards equivalentes aos guards do React Router (`ProtectedRoute` e `RoleRoute`).
  - **`AC-MOB-02` & `AC-MOB-05`**: O fluxo de logout limpa os tokens do Hardware Keystore (`expo-secure-store`) e descarta o estado de sessão de forma simétrica à limpeza de cookies e cache do frontend.

---

## 5. Arquitetura no Frontend (`apps/frontend/`) — Padrão Canônico do Monorepo

Conforme a [ADR-034](file:///c:/Users/jaohe/projetos/farmaubs/docs/adrs/adr-034-clean-architecture-fullstack.md) e [CONTRIBUTING.md](file:///c:/Users/jaohe/projetos/farmaubs/CONTRIBUTING.md) (Seções 1.2 e 2.2):

```text
apps/frontend/src/
├── components/
│   ├── ProtectedRoute.tsx                # Guard de autenticação e trava deveTrocarSenha
│   ├── ProtectedRoute.spec.tsx           # Testes unitários/componente do guard
│   ├── RoleRoute.tsx                     # Guard de perfil RBAC com redirecionamento para /403
│   ├── Sidebar.tsx                       # Renderização dinâmica de itens via hasRole()
│   ├── Sidebar.spec.tsx                  # Teste de visibilidade do menu por perfil
│   └── UserMenu.tsx                      # Menu de usuário com botão acessível de Logout
├── pages/
│   └── AccessDenied.tsx                  # Página 403 com anúncio para leitores de tela
├── contexts/
│   └── AuthContext.tsx                   # Fornece status, hasRole() e logout()
├── App.tsx                               # Definição das rotas declarativas do React Router
└── test/                                 # Utilitários e mocks de teste Camada D (Vitest)
```

> **Regra de Clean Architecture no Frontend:** O frontend não utiliza diretórios artificiais como `presentation/` ou `infrastructure/`. A separação entre estado de UI (`contexts/`, `components/`) e comunicação externa (`services/api.ts`) mantém o código desacoplado e aderente ao padrão canônico do projeto.

---

## 6. Critérios de Aceite Detalhados

- [ ] **Guard `ProtectedRoute`**:
  - Usuários não autenticados tentando acessar qualquer rota protegida são redirecionados para `/login`.
  - Salva a URL requisitada em `location.state.from` para redirecionamento após o login.
  - Se `usuario.deveTrocarSenha === true` e a rota atual não for `/trocar-senha-obrigatoria`, força redirecionamento para `/trocar-senha-obrigatoria`.
- [ ] **Guard `RoleRoute`**:
  - Se o usuário autenticado não possuir o perfil exigido na rota (avaliado via `hasRole`), é redirecionado para `/403`.
  - Impede a renderização de componentes filhos restritos antes da validação.
- [ ] **Renderização Dinâmica do Menu (`Sidebar`)**:
  - Avalia cada item de menu contra a permissão do usuário logado via `hasRole`.
  - Rotas restritas (como `/usuarios` para farmacêuticos) não aparecem na interface nem no DOM acessível.
- [ ] **Fluxo Completo de Logout**:
  - Acionável por clique ou tecla `Enter`/`Space` no item "Sair".
  - Dispara `POST /api/v1/acesso/logout` no backend (com cookies/credentials).
  - Limpa dados do `AuthContext` e esvazia o cache do TanStack Query (`queryClient.clear()`).
  - Redireciona para `/login` substituindo o histórico (`replace: true`).
- [ ] **Página de Acesso Negado (`/403` / `AccessDenied`)**:
  - Exibe mensagem descritiva com anúncio para leitores de tela (`role="alert"`).
  - Possui link/botão "Voltar ao Dashboard".
- [ ] **Acessibilidade WCAG 2.1 AA (ADR-032)**:
  - Foco de teclado visível em todos os itens de navegação e botões.
  - Navegação fluida sem armadilhas de teclado (*focus traps*).

---

## 7. Cenários de Teste em BDD (Gherkin — Camada D / Vitest)

> **Nota de Governança de Testes (CONTRIBUTING.md Seção 5.2):**  
> Os cenários Gherkin abaixo definem a especificação viva de comportamento da Camada D. No frontend, eles são implementados com **Vitest + React Testing Library** (`*.spec.tsx`) e executados pelo comando do Moonrepo `moon run frontend:test` (o runner Cucumber.js `@cucumber/cucumber` é restrito ao backend).

Arquivos de teste: `apps/frontend/src/components/ProtectedRoute.spec.tsx` e `Sidebar.spec.tsx`

```gherkin
# language: pt
Funcionalidade: Proteção de Rotas e Logout no Frontend (NF009, Camada D)

  Cenário: Usuário não autenticado é redirecionado para tela de login
    Dado que o usuário não está autenticado no AuthContext
    Quando tentar acessar a rota protegida "/dashboard"
    Então o componente ProtectedRoute deve interceptar a navegação
    E o usuário deve ser redirecionado para "/login"
    E a rota "/dashboard" não deve ser renderizada

  Cenário: Usuário com senha provisória é forçado para redefinição
    Dado que o usuário está autenticado
    E possui deveTrocarSenha igual a verdadeiro
    Quando ele tentar navegar para "/estoque"
    Então o guard deve redirecioná-lo para "/trocar-senha-obrigatoria"

  Cenário: Farmacêutico tenta acessar rota restrita de Administrador
    Dado que o usuário está autenticado com o perfil "FARMACEUTICO_RESPONSAVEL"
    Quando tentar acessar a rota "/usuarios" protegida com RoleRoute([ADMINISTRADOR])
    Então deve ser redirecionado para a página "/403"
    E a página de Acesso Negado deve anunciar o alerta para leitores de tela

  Cenário: Menu exibe somente itens autorizados para o perfil
    Dado que o usuário logado possui perfil "FARMACEUTICO_RESIDENTE"
    Quando a Sidebar for renderizada
    Então os links para "/dashboard", "/estoque" e "/dispensas" devem estar visíveis
    E os links para "/relatorios", "/usuarios" e "/ubs" não devem existir no DOM

  Cenário: Logout pelo menu encerra sessão e substitui histórico
    Dado que o usuário está autenticado na rota "/dashboard"
    Quando o usuário clicar no botão "Sair"
    Então o serviço de logout deve ser acionado
    E o contexto deve ser desautenticado
    E a navegação deve redirecionar para "/login" com replace habilitado

  Cenário: Navegação por teclado acessível no menu
    Dado que o usuário navega pelo menu utilizando a tecla Tab
    Quando alcançar o item "Sair"
    Então o foco visual deve estar visível
    E pressionar Enter deve disparar o logout
```

---

## 8. Definition of Done (DoD)

1. **Componentes e Roteamento**:
   - Guards `ProtectedRoute` e `RoleRoute` consolidados em `apps/frontend/src/components/`.
   - `Sidebar` e `UserMenu` dinâmicos integrados à árvore de layout do React Router em `apps/frontend/src/App.tsx`.
   - Página `AccessDenied.tsx` criada/ajustada em `apps/frontend/src/pages/` com design responsivo em Tailwind e suporte a leitores de tela.
2. **Integração e Segurança**:
   - Redirecionamento forçado para `/trocar-senha-obrigatoria` para usuários com `deveTrocarSenha: true`.
   - Logout integrado ao endpoint canônico `POST /api/v1/acesso/logout` e descarte do histórico com `replace: true`.
3. **Qualidade e Validação com Moonrepo**:
   - 100% dos testes unitários/componente da Camada D (`*.spec.tsx`) passando com Vitest e React Testing Library (`moon run frontend:test`).
   - Conformidade com WCAG 2.1 AA comprovada em testes de acessibilidade (foco visível, `role="alert"` e `aria-current`).
   - Linting e checagem de tipos estáticos sem erros (`moon run frontend:lint` e `moon check --affected`).
   - Compilação global do monorepo aprovada via Moonrepo (`moon run :build`).