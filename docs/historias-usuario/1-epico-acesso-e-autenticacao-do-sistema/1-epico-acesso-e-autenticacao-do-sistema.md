# Acesso e autenticação do sistema (RF001–RF004, NF009–NF012)

## História de usuário do épico

> **Como** usuário e Administrador do FarmaUBS,
> **quero** um módulo de acesso completo: cadastro e gestão de usuários, login com credenciais seguras e bloqueio por tentativas, recuperação de senha, logout e sessão com timeout,
> **para que** somente usuários autorizados acessem o sistema, cada um dentro do seu perfil (RBAC) e do seu escopo de UBS/município, com credenciais protegidas (bcrypt, 2FA) e dados sensíveis criptografados em repouso, em conformidade com LGPD e com as decisões dos ADRs-006/007/013/016/027/030/032.

## Escopo do épico

### Requisitos funcionais cobertos

| RF | Descrição | História |
| --- | --- | --- |
| RF001 | Cadastro de usuário com perfil e UBSs associadas | AC-04, AC-18 |
| RF002 | Login com validação de credenciais e bloqueio por tentativas | AC-05, AC-16 |
| RF003 | Recuperação de senha via link válido por 2 horas | AC-07 (pendente), AC-17 |
| RF004 | Logout com encerramento da sessão | AC-06, AC-21 |
| RF025 | Gestão de usuários (editar, inativar/reativar, perfil, UBSs) | AC-08, AC-12, AC-18 |

### Requisitos não funcionais cobertos

| NF | Descrição | História |
| --- | --- | --- |
| NF009 | RBAC por perfil | AC-13, AC-21 |
| NF010 | Criptografia AES-256 de dados sensíveis em repouso (LGPD) | AC-15 |
| NF011 | Hash bcrypt (cost 12) e 2FA TOTP opcional | AC-04, AC-05 |
| NF012 | Timeout de sessão (60 min, aviso 5 min antes) | AC-10, AC-20 |
| NF015 | Isolamento de dados por UBS (multi-tenancy) | AC-13 |

### ADRs aplicados

| ADR | Tema | História |
| --- | --- | --- |
| ADR-006 | Autenticação/autorização, sessão server-side, escopo na sessão | AC-05, AC-10, AC-13, AC-14 |
| ADR-007 | API REST `/api/v1/*`, DTOs, Swagger | AC-11, AC-12 |
| ADR-013 | Estado de cliente/UI (Context API), TanStack Query | AC-16, AC-19 |
| ADR-016 | RLS e interceptor de tenant | AC-02 (pendente), AC-13 |
| ADR-027 | Gestão de segredos (`.env` por ambiente) | Todas (DoD) |
| ADR-030 | Camadas de teste A/B/C/D | Todas |
| ADR-032 | Acessibilidade WCAG 2.1 AA | AC-16, AC-17, AC-18, AC-19, AC-20, AC-21 |

## Backlog do épico (índice de histórias)

### Fundação (dependência de todo o épico)

| AC | Título | Camada de teste | Status |
| --- | --- | --- | --- |
| AC-01 | Migrations do schema de acesso (`users`, `profiles`, `user_units`, `sessions`, `password_reset_tokens`, `totp_secrets`) | — | ✅ Redigida |
| AC-02 | Role `farmaubs_app`, RLS, interceptor de transação e harness de integração | B | ✅ Redigida |
| AC-03 | Constraints e índices (e-mail único, `user_units` única, índices de sessão/token) | B | ✅ Redigida |

### Backend — autenticação e administração

| AC | Título | Camada de teste | Depende de | Status |
| --- | --- | --- | --- | --- |
| AC-04 | Cadastrar usuário com hash bcrypt, perfil e UBSs (RF001) | A, B | AC-01, AC-02, AC-03 | ✅ Redigida |
| AC-05 | Login com validação e bloqueio por tentativas (RF002) | A, B, C | AC-04 | ✅ Redigida |
| AC-06 | Logout com encerramento da sessão (RF004) | A, B, C | AC-05 | ✅ Redigida |
| AC-07 | Recuperação de senha (RF003) | A, B | AC-04 | ⏳ Pendente de redação (Despriorizada) |
| AC-08 | Gerenciar usuários: editar, inativar/reativar, perfil, UBSs (RF025) | A, B | AC-04, AC-05 | ✅ Redigida |
| AC-09 | 2FA TOTP opt-in com segredo criptografado em repouso (NF011) | A, B, C | AC-04 | ⏳ Pendente de redação (Despriorizada) |
| AC-10 | Timeout de sessão: expiração deslizante + timestamp absoluto (NF012) | A, B, C | AC-03, AC-05 | ✅ Redigida |
| AC-11 | Endpoints REST `/api/v1/auth/*` com DTOs e Swagger (ADR-007) | A, C | AC-04 a AC-07, AC-10 | ✅ Redigida |
| AC-12 | Endpoints REST `/api/v1/usuarios/*` com DTOs e Swagger (ADR-007, RF025) | A, C | AC-04, AC-08, AC-11 | ✅ Redigida |
| AC-13 | Guards de autorização RBAC por perfil e escopo de tenant (ADR-006) | A, B | AC-05, AC-11, AC-12 | ✅ Redigida |
| AC-14 | Porta `AuthProvider` e adaptador de sessão server-side (ADR-006) | A, B | AC-04, AC-05, AC-06, AC-10 | ✅ Redigida |
| AC-15 | Criptografia AES-256 para dados sensíveis em repouso (NF010) | A, B | AC-14 | ⏳ Pendente de redação (Despriorizada) |

### Frontend — autenticação e administração

| AC | Título | Camada de teste | Depende de | Status |
| --- | --- | --- | --- | --- |
| AC-16 | Tela de login com validação e feedback de erro (RF002) | D | AC-05, AC-10, AC-11 | ✅ Redigida |
| AC-17 | Tela de recuperação de senha (RF003) | D | AC-07, AC-11, AC-16 | ⏳ Pendente de redação  (Despriorizada) |
| AC-18 | Gestão de usuários no painel administrativo (RF001, RF025) | D | AC-08, AC-12, AC-13, AC-16 | ✅ Redigida |
| AC-19 | Contexto de autenticação: usuário atual, perfil e escopo (ADR-013) | D | AC-06, AC-10, AC-11, AC-16 | ✅ Redigida |
| AC-20 | Aviso de timeout e encerramento de sessão (NF012) | D | AC-10, AC-19 | ✅ Redigida |
| AC-21 | Proteção de rotas por perfil e logout (NF009) | D | AC-13, AC-19 | ✅ Redigida |

### Mobile — aplicativo móvel do operador

| AC | Título | Camada de teste | Depende de | Status |
| --- | --- | --- | --- | --- |
| AC-MOB-01 | Tela de login mobile com validação e feedback (RF002) | D | AC-05, AC-11 | ✅ Redigida |
| AC-MOB-02 | Armazenamento seguro de sessão e permanência em cold start (NF011, ADR-034) | D | AC-05, AC-14 | ✅ Redigida |
| AC-MOB-03 | Seleção e alternância de UBS ativa (NF015) | D | AC-05, AC-13 | ✅ Redigida |
| AC-MOB-04 | Troca obrigatória de senha provisória no mobile (RF002) | D | AC-23 | ✅ Redigida |
| AC-MOB-05 | Logout seguro no aplicativo móvel (RF004) | D | AC-06 | ✅ Redigida |
| AC-MOB-06 | Detecção de conectividade e aviso offline (ADR-014) | D | — | ✅ Redigida |
| AC-MOB-07 | Aviso de timeout e notificação nativa no SO Android (NF012) | D | AC-10, AC-MOB-02 | ✅ Redigida |

## Sequenciamento recomendado

Ordem de execução com dependências, sem paralelismo dentro da fundação (todas operam sobre o mesmo schema):

1. **Fundação**: AC-01 → AC-02 → AC-03 (sequenciais, mesmo schema)
2. **Backend de autenticação**: AC-04 → AC-05 → AC-06 → AC-07 (sequenciais)
3. **Backend de administração e suporte**: AC-08 → AC-10 → AC-13 → AC-14 → AC-15 (podem ser paralelizadas em lotes após AC-07)
4. **Endpoints**: AC-11 (após AC-04 a AC-07 e AC-10) → AC-12 (após AC-04, AC-08 e AC-11)
5. **Frontend**: AC-16 (após AC-11) → AC-19 → AC-20 → AC-21 → AC-17 → AC-18 (AC-18 depende também de AC-12)

## DoD do épico (Definition of Done)

- [ ] Todas as histórias do backlog concluídas com seus critérios de aceite atendidos (AC-01 a AC-21, incluindo a AC-07 pendente de redação).
- [ ] Todo caso de uso novo do domínio com teste unitário correspondente antes do merge (camada A, ADR-030).
- [ ] Toda mudança em política de RLS com teste de integração dedicado tentando deliberadamente acessar dados de outro `municipio_id` (camada B obrigatória, ADR-030).
- [ ] Requisitos funcionais Essenciais do épico (RF001, RF002, RF003, RF004) com pelo menos um teste e2e de caminho feliz via API (camada C, ADR-030).
- [ ] Fluxos Essenciais do frontend testados na camada D (componentes de formulário com Testing Library + `axe-core`).
- [ ] Nenhum segredo (`SESSION_SECRET`, `ENCRYPTION_KEY`, credenciais) versionado nem registrado em log (ADR-027).
- [ ] Senhas armazenadas exclusivamente como hash bcrypt cost 12; token de sessão armazenado sempre como `token_hash`, nunca em texto puro (NF011, ADR-006).
- [ ] Dados sensíveis (CNS/CPF, segredo TOTP) criptografados em repouso com AES-256-GCM (NF010, AC-15).
- [ ] Sessão server-side com expiração deslizante, timestamp absoluto exposto ao frontend e aviso 5 minutos antes (NF012, AC-10/AC-20).
- [ ] Guards RBAC e escopo de tenant aplicados em todas as rotas autenticadas, com matriz de permissões sincronizada entre frontend e backend (NF009, AC-13/AC-21).
- [ ] Fluxos do frontend com navegação por teclado e foco visível validados (ADR-032, WCAG 2.1 AA).

## Fora de escopo do épico

- **Autenticação institucional (gov.br via OAuth2)**: ponto de extensão previsto na porta `AuthProvider` (AC-14), sem implementação nesta fase (roadmap B2G futuro).
- **Gerenciamento de UBSs (RF026)**, **parâmetros do sistema (RF027)** e **log de auditoria (RF028)**: épicos administrativos distintos, fora deste backlog.
- **Fila offline de mutações e autosave (NF005, ADR-014)**: dependências de frontend tratadas em épico próprio, não neste.