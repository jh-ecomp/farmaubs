# AC-23 feat(acesso): redefinição administrativa e troca obrigatória de senha

- **Épico**: Autenticação e Controle de Acesso (ADR-006)
- **Requisitos Funcionais**: RF001 (Cadastro/Gestão de Credenciais), RF002 (Autenticação), RF003 (Redefinição/Troca de Senha)
- **Requisitos Não-Funcionais**: NF009 (Menor Privilégio), NF011 (BCrypt Custo 12), NF012 (Sessão Segura e TTL)
- **ADRs Vinculadas**: ADR-003 (Arquitetura Hexagonal), ADR-006 (Sessão Server-Side), ADR-016 (Transações e RLS), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes)

---

## 1. História de Usuário

> **Como** Administrador do FarmaUBS,  
> **quero** poder redefinir a senha de qualquer usuário através da emissão de uma senha provisória ativando a flag `deve_trocar_senha = true`, e como **usuário recebedor**,  
> **quero** autenticar com essa senha provisória e ser forçado a registrar uma nova senha definitiva antes de acessar qualquer funcionalidade do sistema,  
> **para que** o acesso seja restabelecido com segurança administrativa sem envio de links externos por e-mail e garantindo que ninguém além de mim conheça a minha senha definitiva (RF001, RF003, NF011).

---

## 2. Regras de Negócio e Casos de Borda

1. **Ação Administrativa de Redefinição**:
   - Apenas usuários autenticados com o perfil `ADMINISTRADOR` podem invocar o endpoint de redefinição de senha de terceiros (`POST /api/v1/usuarios/:id/senha-provisoria`).
   - O administrador fornece uma senha provisória válida (ou o sistema gera uma senha provisória em conformidade com as políticas de complexidade).
   - O backend gera o hash BCrypt (custo 12) da senha provisória, atualiza `users.senha_hash`, marca `users.deve_trocar_senha = true` e zera `users.tentativas_login_falhas = 0` (desbloqueando a conta se estivesse bloqueada).
   - **Revogação Imediata de Sessões Ativas**: No momento em que o administrador redefine a senha, todas as sessões ativas preexistentes desse usuário são sumariamente revogadas no banco (`ISessionRepository.revogarTodas(usuarioId)`).

2. **Login com Senha Provisória**:
   - O usuário autentica normalmente via `POST /api/v1/acesso/login` fornecendo e-mail e a senha provisória.
   - O backend valida a senha, cria a sessão, mas identifica que `users.deve_trocar_senha === true`.
   - A resposta do login retorna `deveTrocarSenha: true` e `redirectUrl: "/trocar-senha"`.

3. **Guarda de Bloqueio de Escopo no Backend (`MustChangePasswordGuard`)**:
   - Um token de sessão associado a um usuário com `deve_trocar_senha === true` opera em **modo restrito**.
   - Qualquer requisição a endpoints de negócio (dispensação, medicamentos, relatórios, usuários) disparada com esse token deve ser **interceptada e rejeitada** com código `403 Forbidden` (`TrocaDeSenhaObrigatoriaException`).
   - Os únicos endpoints autorizados para essa sessão são:
     - `POST /api/v1/acesso/trocar-senha` (para concluir a redefinição).
     - `POST /api/v1/acesso/logout` (para desistir/sair).
     - `GET /api/v1/acesso/me` (para ler o estado da sessão).

4. **Troca Definitiva de Senha (`POST /api/v1/acesso/trocar-senha`)**:
   - O usuário autenticado envia `{ novaSenha, confirmacaoSenha }`.
   - **Regras de Validação**:
     - `novaSenha` deve ter no mínimo 8 caracteres, contendo ao menos uma letra maiúscula, uma minúscula, um número e um caractere especial.
     - `novaSenha` deve ser exatamente igual a `confirmacaoSenha`.
     - **Anti-Repetição**: A `novaSenha` **não pode ser idêntica à senha provisória** recém-utilizada (`bcrypt.compare(novaSenha, usuario.senhaHash) === false`). Caso seja igual, lança `400 Bad Request - NovaSenhaNaoPodeSerIgualProvisoriaException`.
   - **Conclusão com Sucesso**:
     - Atualiza `users.senha_hash = bcrypt(novaSenha, 12)`.
     - Atualiza `users.deve_trocar_senha = false`.
     - Atualiza `users.senha_atualizada_em = now()`.
     - Mantém a sessão atual válida e atualiza seu escopo para irrestrito.

5. **Abandono do Fluxo**:
   - Se o usuário fechar a conexão, abandonar a tela ou o token de 60 minutos expirar (NF012) sem submeter a nova senha:
     - `users.deve_trocar_senha` **continua `true`**.
     - No próximo acesso, a senha provisória continua funcionando normalmente para login, mas o ciclo se repete: o usuário será novamente barrado pelo guard e forçado a passar pela troca de senha.

---

## 3. Contratos de API (`@farmaubs/shared`)

### 3.1 Endpoints no Backend

| Método | Rota | Autenticação | Descrição |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/usuarios/:id/senha-provisoria` | `ADMINISTRADOR` | Administrador redefine a senha do usuário para uma senha provisória. |
| `POST` | `/api/v1/acesso/trocar-senha` | Usuário logado (`Bearer Token`) | Usuário define sua nova senha definitiva, desativando a flag. |

### 3.2 Tipagens Compartilhadas (`packages/shared/src/acesso/`)

```typescript
// Comando do Administrador para emitir senha provisória
export interface DefinirSenhaProvisoriaComando {
  senhaProvisoria: string;
}

export interface DefinirSenhaProvisoriaResultado {
  mensagem: string;
  usuarioId: string;
  deveTrocarSenha: true;
}

// Comando do Usuário para cadastrar sua nova senha definitiva
export interface TrocarSenhaComando {
  novaSenha: string;
  confirmacaoSenha: string;
}

export interface TrocarSenhaResultado {
  sucesso: boolean;
  mensagem: string;
}
```

---

## 4. Arquitetura e Estrutura de Pastas (Backend)

Conforme o [CONTRIBUTING.md](file:///c:/Users/jaohe/projetos/farmaubs/CONTRIBUTING.md):

```text
apps/backend/src/modules/acesso/
├── api/
│   ├── controllers/
│   │   ├── acesso.controller.ts            # Adiciona POST /acesso/trocar-senha
│   │   └── user.controller.ts              # Adiciona POST /usuarios/:id/senha-provisoria
│   ├── dto/
│   │   ├── set-temporary-password.dto.ts   # Validação class-validator
│   │   └── change-password.dto.ts
│   └── guards/
│       └── must-change-password.guard.ts   # Intercepta rotas se deve_trocar_senha === true
├── application/
│   └── use-cases/
│       ├── set-temporary-password.use-case.ts # Emissão administrativa de senha provisória
│       ├── change-password.use-case.ts        # Troca de senha definitiva do usuário
│       ├── set-temporary-password.steps.ts    # Testes BDD Camada A
│       └── change-password.steps.ts
└── domain/
    └── errors/
        └── password.errors.ts              # Exceções de domínio (SenhaIgualProvisoria, etc.)
```

---

## 5. Critérios de Aceite Detalhados (Backend)

- [x] **Endpoint Administrativo (`/usuarios/:id/senha-provisoria`)**:
  - Exige perfil `ADMINISTRADOR` (outros perfis recebem `403 Forbidden`).
  - Atualiza `senha_hash` com BCrypt custo 12 e marca `deve_trocar_senha = true`.
  - Revoga imediatamente todas as sessões ativas do usuário alvo via `ISessionRepository.revogarTodas(id)`.
  - Retorna `200 OK` com confirmação.
- [x] **Login com Senha Provisória**:
  - O endpoint `/api/v1/acesso/login` autentica com a senha provisória e retorna `deveTrocarSenha: true` e `redirectUrl: "/trocar-senha"`.
- [x] **Guarda Global de Bloqueio**:
  - Usuários autenticados com `deveTrocarSenha === true` são impedidos de executar qualquer rota de negócio (`403 Forbidden - Troca de senha pendente`).
- [x] **Endpoint de Troca de Senha (`/acesso/trocar-senha`)**:
  - Exige autenticação Bearer Token.
  - Valida se `novaSenha === confirmacaoSenha`.
  - Valida regras de complexidade (8+ caracteres, maiúsculas, minúsculas, dígitos e símbolos).
  - Rejeita se a `novaSenha` for idêntica à senha provisória atual com `400 Bad Request`.
  - Salva o novo hash BCrypt (custo 12), define `deve_trocar_senha = false` e atualiza `senha_atualizada_em = now()`.
  - Retorna `200 OK`.
- [x] **Persistência da Flag em Abandono**:
  - Se o usuário não chamar `/trocar-senha`, `deve_trocar_senha` permanece `true` no banco indefinidamente até que a troca seja efetuada.

---

## 6. Cenários de Teste em BDD (Gherkin — ADR-030)

### Camada A — Use Cases (`set-temporary-password.steps.ts` e `change-password.steps.ts`)
```gherkin
# language: pt
Funcionalidade: Redefinição e Troca Obrigatória de Senha (Camada A)

  Cenário: Administrador define senha provisória para farmacêutico
    Dado que sou um Administrador autenticado
    Quando eu definir a senha provisória "Provisoria@2026" para o usuário "Lucas Mendes"
    Então o hash da senha de Lucas deve ser atualizado com custo 12
    E o campo deve_trocar_senha deve ser marcado como verdadeiro
    E todas as sessões ativas anteriores de Lucas devem ser revogadas

  Cenário: Farmacêutico troca a senha provisória por nova senha válida
    Dado que o usuário "Lucas Mendes" possui deve_trocar_senha como verdadeiro
    E está autenticado com sua sessão provisória
    Quando ele submeter a nova senha "NovaSenhaSegura@2026" com confirmação idêntica
    Então o hash da senha é atualizado no repositório
    E o campo deve_trocar_senha passa a ser falso
    E a data de senha_atualizada_em é registrada

  Cenário: Tentativa de reutilizar a senha provisória como nova senha
    Dado que o usuário está autenticado com a senha provisória "Provisoria@2026"
    Quando ele tentar definir "Provisoria@2026" como sua nova senha
    Então o sistema deve lançar a exceção "NovaSenhaNaoPodeSerIgualProvisoriaException"
    E o campo deve_trocar_senha permanece verdadeiro

  Cenário: Senha com confirmação divergente
    Dado que o usuário tenta trocar a senha
    Quando ele informa "NovaSenha@2026" e confirmação "OutraSenha@2026"
    Então o sistema deve lançar erro de confirmação de senha divergente
```

### Camada B — Integração de Banco (`password-management.integration.ts`)
```gherkin
  Cenário: Verificação de atomicidade e revogação de sessões no PostgreSQL
    Dado que o usuário possui registros ativos na tabela "sessions"
    Quando o caso de uso de senha provisória for executado
    Então as sessões do usuário devem constar com status "revogada"
    E a consulta de login com a senha provisória deve ser bem-sucedida
```

### Camada C — Endpoints da API (`acesso.e2e.spec.ts`)
```gherkin
  Cenário: Guarda bloqueia acesso ao dashboard para usuário com troca pendente
    Dado que o usuário logou com senha provisória e obteve um token
    Quando ele tentar chamar "GET /api/v1/administracao/usuarios"
    Então a API deve responder com status 403 Forbidden
    Quando ele chamar "POST /api/v1/acesso/trocar-senha" com dados válidos
    Então a API responde 200 OK
    E chamadas subsequentes ao dashboard passam a responder 200 OK
```

---

## 7. Definition of Done (DoD - Backend)

- [x] Endpoints `/usuarios/:id/senha-provisoria` e `/acesso/trocar-senha` implementados e testados.
- [x] Guard de bloqueio `MustChangePasswordGuard` registrado no pipeline NestJS.
- [x] Tipos exportados em `@farmaubs/shared`.
- [x] 100% dos testes unitários (Camada A), integração (Camada B) e controller (Camada C) passando.