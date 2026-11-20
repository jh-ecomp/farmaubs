# AC-31 test(acesso): Migração da Suíte de Testes de Frontend do Módulo de Acesso (Vitest -> Playwright BDD e E2E Full-Stack)

---

- **Épico**: Acesso e Autenticação do Sistema (RF001, RF002, RF004, RF025, NF009, NF012)
- **Camada**: Frontend Web (`apps/frontend`) — Camada D e E2E Full-Stack (Camadas C + D)
- **Requisitos Funcionais**: RF001 (Cadastro de Usuários), RF002 (Login e Troca Obrigatória de Senha), RF004 (Logout), RF025 (Gestão de Usuários)
- **Requisitos Não-Funcionais**: NF009 (Proteção RBAC), NF012 (Timeout de Sessão Deslizante e Aviso 5 min antes)
- **ADRs Vinculadas**: ADR-006 (Sessão Cookie HttpOnly e RBAC), ADR-011 (React 19 + Vite), ADR-030 (Estratégia de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA com `@axe-core/playwright`), ADR-035 (Orquestração Moonrepo)

---

## 1. História de usuário

> **Como** engenheiro de software e mantenedor de qualidade do FarmaUBS,  
> **quero** migrar a verificação dos fluxos de frontend do Épico 1 (Login, Troca Obrigatória de Senha, Proteção RBAC de Rotas, Modal de Timeout de Inatividade com `page.clock`, Logout e Gestão Administrativa de Usuários) dos testes em JSDOM/Vitest para especificações vivas executáveis em **Gherkin (pt-BR)** com **Playwright + `playwright-bdd`**, tanto na modalidade de **Teste de Sistema de Frontend** (`moon run frontend:test-bdd`) quanto na modalidade **E2E Full-Stack** (`moon run frontend:test-e2e`),  
> **para que** os cenários BDD já documentados nas histórias `AC-16`, `AC-18`, `AC-19`, `AC-20`, `AC-21`, `AC-24`, `AC-25` e `AC-30` rodem em um navegador Chromium real com validação autêntica de cookies `HttpOnly`, avanço de relógio de inatividade e auditoria de contraste WCAG 2.1 AA.

---

## 2. Escopo da migração e funcionalidades do Playwright aplicadas

1. **Arquivos Vitest mapeados na transição**:
   - `apps/frontend/src/pages/Login.spec.tsx` (`AC-16`)
   - `apps/frontend/src/pages/TrocarSenha/TrocarSenha.spec.tsx` (`AC-24`)
   - `apps/frontend/src/pages/AdminUsuarios/AdminUsuarios.spec.tsx` e `RedefinirSenhaModal.spec.tsx` (`AC-18`)
   - `apps/frontend/src/components/ProtectedRoute.spec.tsx` e `RoleRoute.spec.tsx` (`AC-21`)
   - `apps/frontend/src/components/SessionTimeoutModal.spec.tsx` e `hooks/useSessionTimeout.spec.ts` (`AC-20`)
   - `apps/frontend/src/contexts/AuthContext.spec.tsx` e `auth-cookie-context.spec.tsx` (`AC-19`, `AC-25`, `AC-30`)
2. **Recursos nativos do Playwright exigidos**:
   - **Controle de Relógio (`page.clock`)**: Avançar o tempo do navegador para faltarem 5 minutos para `expiresAt` (`NF012`), validando a abertura automática do `SessionTimeoutModal` e a renovação deslizante ao clicar em `"Continuar conectado"`.
   - **Cookies `HttpOnly` e `storageState`**: Validar que nenhum token é gravado em `localStorage` (`AC-30`) e que o cookie `farmaubs_session` governa a sessão autenticada.
   - **Auditoria WCAG 2.1 AA (`@axe-core/playwright`)**: Auditar contraste real e semântica ARIA na tela de Login, Troca de Senha e Painel de Usuários.

---

## 3. Estrutura técnica dos arquivos BDD

- **Modalidade 1 — Teste de Sistema de Frontend (`moon run frontend:test-bdd`)**:
  - `apps/frontend/e2e/features/sistema/acesso-login-sessao-sistema.feature`
  - `apps/frontend/e2e/features/sistema/acesso-gestao-usuarios-sistema.feature`
- **Modalidade 2 — Teste E2E Full-Stack (`moon run frontend:test-e2e`)**:
  - `apps/frontend/e2e/features/fullstack/acesso-fullstack.feature`
- **Step Definitions**:
  - `apps/frontend/e2e/steps/acesso.steps.ts`

---

## 4. Cenários de teste em BDD (Gherkin — camada D & E2E)

```gherkin
# language: pt
Funcionalidade: Autenticação, Sessão HttpOnly, Timeout de Inatividade e RBAC (Camada D & E2E)

  Cenário: Login institucional com cookie HttpOnly sem vazamento de token no localStorage e auditoria WCAG 2.1 AA
    Dado que o usuário acessa a página pública "/login"
    Quando ele preenche o e-mail "farma.parnaiba@farmaubs.dev" e a senha "Farma@123456" e aciona "Entrar no FarmaUBS"
    Então ele deve ser redirecionado para a bancada operacional da UBS
    E o "localStorage" do navegador não deve conter a chave "@FarmaUBS:token"
    E a tela não deve apresentar violações críticas de acessibilidade WCAG 2.1 AA

  Cenário: Exibição do modal de aviso de inatividade 5 minutos antes da expiração e renovação da sessão
    Dado que o farmacêutico está autenticado com sessão ativa de 60 minutos
    Quando o relógio do navegador avançar 55 minutos sem interação
    Então o modal de aviso de expiração de sessão deve ser exibido na tela
    Quando o farmacêutico clicar em "Continuar conectado"
    Então a requisição POST para "/api/v1/acesso/renovar" deve ser enviada
    E o modal de aviso deve ser fechado mantendo a sessão ativa

  Cenário: Bloqueio RBAC ao tentar acessar gestão administrativa de usuários com perfil de Farmacêutico
    Dado que o usuário autenticado possui perfil "FARMACEUTICO_RESPONSAVEL"
    Quando ele tentar navegar diretamente para a rota "/admin/usuarios"
    Então a tela de "Acesso Negado" deve ser exibida bloqueando a operação
```

---

## 5. Checklist de DoD e aceitação

- [ ] Arquivos `.feature` em português criados para Sistema Frontend e E2E Full-Stack cobrindo Login, Troca de Senha, Timeout (`page.clock`), RBAC e Gestão de Usuários.
- [ ] Validação explícita de que `@FarmaUBS:token` não existe no `localStorage` (`AC-30`).
- [ ] Auditoria `@axe-core/playwright` executada sem violações WCAG 2.1 AA nas telas do Épico 1.
- [ ] Tarefas `moon run frontend:test-bdd` e `moon run frontend:test-e2e` passando sem erros.
