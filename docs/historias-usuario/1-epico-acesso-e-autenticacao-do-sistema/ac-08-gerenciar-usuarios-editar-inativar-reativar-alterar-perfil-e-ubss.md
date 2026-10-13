# AC-08 Gerenciar usuários: editar, inativar/reativar, alterar perfil e UBSs (RF025)

- **Épico**: Acesso e Autenticação do Sistema (RF001–RF004, NF009–NF012)
- **Requisitos Funcionais**: RF001 (Vínculo de UBSs), RF002 (Bloqueio de Login para Inativo), RF003 (Políticas de Senha e Redefinição Obrigatória), RF004 (Revogação Imediata de Sessões), RF025 (RBAC e Gestão de Usuários), RF026 (Topologia de UBSs), RF028 (Trilha de Auditoria)
- **Requisitos Não-Funcionais**: NF009 (Menor Privilégio / RBAC), NF011 (Criptografia BCrypt custo 12), NF018 (Preservação de Histórico e Imutabilidade no SUS)
- **ADRs Vinculadas**: ADR-002 (Escopos Globais e Multi-tenancy), ADR-003 (Arquitetura Hexagonal), ADR-006 (RBAC e Perfis), ADR-007 (Endpoints REST e DTOs), ADR-016 (Transações Atômicas e RLS), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes BDD)

---

## 1. História de Usuário

> **Como** Administrador do FarmaUBS (visão global/sistêmica),  
> **quero** editar informações cadastrais dos usuários, gerenciar seus perfis e UBSs vinculadas, inativar ou reativar contas e emitir senhas provisórias para recuperação de acesso,  
> **para que** o controle de acesso reflita dinamicamente a equipe de saúde de cada município, revogando acessos indevidos imediatamente e garantindo a continuidade do trabalho farmacêutico sem violar a rastreabilidade do SUS nem permitir exclusão de dados históricos (RF025, RF003, NF018).

---

## 2. Regras de Negócio e Casos de Borda

1. **Autorização Exclusiva de Administrador (RF025, NF009)**:
   - Todas as rotas de mutação de usuários são restritas ao perfil `ADMINISTRADOR`.
   - Tentativas com outros perfis (`FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `GERENTE`) retornam `403 Forbidden`. Requisições não autenticadas retornam `401 Unauthorized`.

2. **Escopo Global do Administrador com Integridade Territorial (ADR-002, RF001, RF026)**:
   - O Administrador pode gerenciar usuários de qualquer município cadastrado.
   - **Regra de Integridade Territorial**: Todas as UBSs atribuídas ao usuário devem pertencer estritamente ao `municipio_id` cadastrado daquele usuário. A inclusão de UBS de município divergente lança `UnidadeSaudeInvalidaException` (`400 Bad Request`).
   - O usuário deve possuir no mínimo 1 UBS ativa associada.

3. **Edição Cadastral e Unicidade de E-mail (RF025)**:
   - Permite atualizar `nomeCompleto` e `email`.
   - O e-mail é normalizado em minúsculas (`trim().toLowerCase()`).
   - Se o novo e-mail informado já estiver em uso por **outro** usuário, aborta com `UsuarioEmailJaExisteException` (`409 Conflict`). Se o usuário mantiver o seu próprio e-mail atual, a operação é aceita normalmente.

4. **Sincronização Atômica de Associações de UBS (`user_units`)**:
   - A atualização de UBSs é realizada em bloco na mesma transação:
     1. Remove vínculos antigos que não constam na nova lista.
     2. Mantém os vínculos existentes.
     3. Insere os novos vínculos, prevenindo duplicidades (`UNIQUE (usuario_id, unidade_id)`).

5. **Inativação Lógica com Revogação Obrigatória de Sessões (RF002, RF004, NF018)**:
   - **Nunca deleta o registro no banco** (preservação de histórico do SUS). Altera `users.ativo = false`.
   - **Revogação Imediata**: Dispara `ISessionRepository.revogarTodas(usuarioId)` na mesma operação, invalidando imediatamente todos os tokens de sessão ativos daquele usuário.
   - Usuário inativo tem seu login bloqueado sumariamente (`LoginUseCase`).

6. **Reativação de Conta**:
   - Altera `users.ativo = true`.
   - Não restaura sessões antigas revogadas; o usuário precisará realizar novo login com suas credenciais.

7. **Redefinição Administrativa de Senha Provisória (RF003, NF011, RF004)**:
   - Em caso de esquecimento ou perda de acesso, o Administrador define uma nova senha provisória para o usuário.
   - **Validação de Complexidade (NF011)**: A senha provisória deve conter no mínimo 8 caracteres, com ao menos uma letra maiúscula, uma minúscula, um número e um caractere especial (`@$!%*?&#`).
   - A senha provisória é gravada utilizando hash **BCrypt com custo 12**.
   - **Flag de Troca Obrigatória**: Define `users.deve_trocar_senha = true`. No próximo login, o usuário é forçado a redefinir sua senha antes de acessar qualquer funcionalidade.
   - **Desbloqueio de Conta**: Zera `tentativas_login_falhas = 0` e remove o bloqueio temporário `bloqueado_ate = null`.
   - **Revogação Preventiva**: Revoga imediatamente todas as sessões ativas do usuário (`revogarTodas`).

8. **Travas Críticas de Continuidade e Segurança**:
   - **Bloqueio de Auto-inativação**: O Administrador logado não pode inativar a si próprio (`usuarioAlvo.id === usuarioExecutor.id`). Lança `AutoInativacaoBloqueadaException` (`409 Conflict`).
   - **Proteção do Último Administrador Ativo**: É proibido inativar ou alterar o perfil do **último Administrador ativo** do sistema. Lança `UltimoAdministradorException` (`409 Conflict`).

9. **Trilha de Auditoria Transacional (RF028, NF018)**:
   - Todas as operações (`EDICAO_DADOS`, `MUDANCA_PERFIL_UBSS`, `INATIVACAO`, `REATIVACAO`, `REDEFINICAO_SENHA_PROVISORIA`) gravam um registro de auditoria na mesma transação TypeORM com: `data_hora`, `usuario_executor_id`, `usuario_alvo_id`, `tipo_operacao` e `detalhes` (diff dos dados).

---

## 3. Contratos de API (`@farmaubs/shared`)

### 3.1 Endpoints REST (`apps/backend/src/modules/acesso/api/controllers/user.controller.ts`)

| Método | Rota | Descrição | Status Sucesso | Erros Mapeados |
| :--- | :--- | :--- | :--- | :--- |
| `PATCH` | `/api/v1/usuarios/:id` | Edição cadastral (nome/e-mail) | `200 OK` | `400`, `401`, `403`, `404`, `409` |
| `PUT` | `/api/v1/usuarios/:id/associacoes` | Atualização de perfil e UBSs | `200 OK` | `400`, `401`, `403`, `404`, `409` |
| `PATCH` | `/api/v1/usuarios/:id/status` | Inativação ou reativação (`ativo`) | `200 OK` | `400`, `401`, `403`, `404`, `409` |
| `POST` | `/api/v1/usuarios/:id/senha-provisoria` | Emissão de senha provisória | `204 No Content` | `400`, `401`, `403`, `404` |

### 3.2 DTOs de Entrada e Resposta no `@farmaubs/shared`

Arquivo: [`packages/shared/src/administracao/usuario.types.ts`](file:///c:/Users/jaohe/projetos/farmaubs/packages/shared/src/administracao/usuario.types.ts)

```typescript
// 1. Edição de Dados Cadastrais
export interface EditarUsuarioComando {
  nomeCompleto?: string;
  email?: string;
}

// 2. Atualização de Perfil e UBSs Vinculadas
export interface AtualizarAssociacoesUsuarioComando {
  perfilId: string;
  ubsIds: string[]; // Mínimo de 1 UBS pertencente ao município do usuário
}

// 3. Alteração de Status
export interface AlterarStatusUsuarioComando {
  ativo: boolean;
}

// 4. Redefinição Administrativa de Senha Provisória
export interface RedefinirSenhaProvisoriaComando {
  senhaProvisoria: string;
}

// 5. Resposta Unificada de Atualização
export interface UsuarioAtualizadoResultado {
  id: string;
  municipioId: string;
  nomeCompleto: string;
  email: string;
  perfilId: string;
  ativo: boolean;
  deveTrocarSenha: boolean;
  ubsIds: string[];
  atualizadoEm: Date | string;
}
```

---

## 4. Arquitetura no Backend (`apps/backend/`)

Conforme Seção 1.1 do [CONTRIBUTING.md](file:///c:/Users/jaohe/projetos/farmaubs/CONTRIBUTING.md):

```text
apps/backend/src/modules/acesso/
├── api/
│   ├── controllers/
│   │   └── user.controller.ts                # Endpoints PATCH, PUT e POST protegidos por RolesGuard
│   └── dto/
│       ├── edit-user.dto.ts                  # DTOs validados com class-validator
│       ├── update-associations.dto.ts
│       ├── toggle-status.dto.ts
│       └── set-temporary-password.dto.ts
├── application/
│   └── use-cases/
│       ├── edit-user.use-case.ts             # Edição de nome/e-mail com checagem de duplicidade
│       ├── update-associations.use-case.ts   # Sincronização atômica de perfil e UBSs
│       ├── toggle-user-status.use-case.ts    # Inativação/reativação + revogação de sessões
│       └── set-temporary-password.use-case.ts # Hash BCrypt + flag deveTrocarSenha + reset bloqueio
├── domain/
│   ├── entities/
│   │   └── user-management.entity.ts         # Regras puras de validação de domínio
│   ├── errors/
│   │   └── user-management.errors.ts         # Exceções (AutoInativacao, UltimoAdmin, etc.)
│   └── ports/
│       ├── user.repository.port.ts           # Métodos estendidos de persistência
│       ├── session.repository.port.ts        # Porta revogarTodas(usuarioId)
│       └── audit.repository.port.ts          # Porta para trilha de auditoria
└── infrastructure/
    └── adapters/
        ├── typeorm-user.repository.ts        # Transações atômicas com QueryRunner
        └── typeorm-audit.repository.ts       # Gravação do log de auditoria
```

---

## 5. Critérios de Aceite Detalhados

- [x] **Guarda RBAC em Todos os Endpoints**:
  - Toda operação de mutação exige token JWT de usuário com perfil `ADMINISTRADOR`. Chamadas com qualquer outro perfil retornam `403 Forbidden`.
- [x] **Edição Cadastral e Unicidade de E-mail**:
  - Permite alterar `nomeCompleto` e `email`.
  - Tentativa de registrar e-mail em uso por outro usuário retorna `409 Conflict`.
  - Se o e-mail não for alterado, a edição do nome ocorre com sucesso sem erro de duplicidade.
- [x] **Integridade Territorial na Associação de UBSs**:
  - Se qualquer UBS na lista `ubsIds` pertencer a outro município que não seja o do usuário, aborta com `400 Bad Request` e mensagem detalhada.
  - Se a lista `ubsIds` estiver vazia, retorna `400 Bad Request`.
  - A sincronização na tabela `user_units` remove desmarcadas e insere novas de forma atômica.
- [x] **Inativação e Revogação Imediata**:
  - Ao inativar (`ativo = false`), comuta o status no banco e executa a revogação de todas as sessões ativas do usuário alvo.
  - O usuário inativado não consegue mais acessar endpoints nem realizar login (`401 Unauthorized`).
- [x] **Reativação**:
  - Ao reativar (`ativo = true`), o usuário volta a estar habilitado para efetuar login com suas credenciais.
- [x] **Redefinição Administrativa de Senha Provisória**:
  - Valida regras de complexidade da `senhaProvisoria` (mínimo 8 caracteres, maiúscula, minúscula, número e símbolo).
  - Criptografa a senha com BCrypt (custo 12).
  - Define `deve_trocar_senha = true`.
  - Reseta `tentativas_login_falhas = 0` e `bloqueado_ate = null`.
  - Revoga imediatamente todas as sessões ativas existentes do usuário.
  - Retorna status `204 No Content`.
- [x] **Travas de Continuidade**:
  - Se o Administrador tentar inativar a si próprio, retorna `409 Conflict`.
  - Se a base tiver apenas 1 administrador ativo e houver tentativa de inativá-lo ou rebaixá-lo, retorna `409 Conflict`.
- [x] **Auditoria Transacional**:
  - Todas as 4 operações de escrita geram registros de auditoria na mesma transação. Se houver falha na gravação do evento ou na operação, todo o processo sofre rollback.

---

## 6. Cenários de Teste em BDD (Gherkin — ADR-030)

### Camada A — Testes Unitários de Casos de Uso (`*.steps.ts`)

```gherkin
# language: pt
Funcionalidade: Gestão de Usuários e Senha Provisória (Camada A)

  Cenário: Edição de dados cadastrais com novo e-mail único
    Dado que o Administrador solicita alteração do usuário "Carlos Silva"
    Quando informar novo nome "Carlos E. Silva" e novo e-mail "carlos.novo@ubs.gov.br"
    E o novo e-mail não estiver em uso por nenhum outro usuário
    Então os dados do usuário devem ser atualizados
    E um evento de auditoria "EDICAO_DADOS" deve ser registrado

  Cenário: Rejeição de e-mail duplicado de outro usuário
    Dado que já existe o usuário "Mariana Dias" cadastrado com o e-mail "mariana@ubs.gov.br"
    Quando o Administrador tentar alterar o e-mail de "Carlos Silva" para "mariana@ubs.gov.br"
    Então o sistema deve lançar a exceção "UsuarioEmailJaExisteException"
    E os dados de Carlos Silva não devem ser alterados

  Cenário: Associação de UBSs rejeita unidade de outro município
    Dado que o usuário "Carlos Silva" pertence ao município de "Santos"
    Quando o Administrador associar uma UBS pertencente a "São Vicente"
    Então o caso de uso deve lançar a exceção "UnidadeSaudeInvalidaException"
    E nenhuma associação deve ser gravada

  Cenário: Inativação revoga ativamente todas as sessões do usuário
    Dado que o usuário "Carlos Silva" possui 3 sessões ativas registradas
    Quando o Administrador inativar a conta de "Carlos Silva"
    Então o campo ativo do usuário deve se tornar falso
    E o método revogarTodas do repositório de sessões deve ser chamado com o ID de Carlos
    E um evento de auditoria "INATIVACAO" deve ser registrado

  Cenário: Bloqueio de auto-inativação do administrador executor
    Dado que o Administrador logado possui o ID "admin-001"
    Quando ele enviar uma solicitação para inativar o usuário "admin-001"
    Então o sistema deve lançar a exceção "AutoInativacaoBloqueadaException"

  Cenário: Proteção contra inativação do último administrador ativo
    Dado que o sistema possui apenas 1 usuário ativo com perfil "ADMINISTRADOR"
    Quando o Administrador tentar inativar esse usuário ou mudar seu perfil para "GERENTE"
    Então o sistema deve lançar a exceção "UltimoAdministradorException"

  Cenário: Redefinição de senha provisória com flags e desbloqueio
    Dado que o usuário "Carlos Silva" está bloqueado com 5 tentativas falhas de login
    E possui sessões ativas no sistema
    Quando o Administrador definir uma nova senha provisória válida "Provisoria@2026"
    Então a senha deve ser hasheada com BCrypt
    E o campo deve_trocar_senha deve se tornar verdadeiro
    E as tentativas de login falhas devem ser zeradas
    E o bloqueio temporário deve ser limpo
    E todas as sessões ativas de Carlos devem ser revogadas
    E um evento de auditoria "REDEFINICAO_SENHA_PROVISORIA" deve ser registrado

  Cenário: Rejeição de senha provisória que não atende aos critérios de complexidade
    Dado que o Administrador tenta redefinir a senha provisória de "Carlos Silva"
    Quando ele fornecer a senha fraca "123456"
    Então o sistema deve lançar a exceção "SenhaFracaException"
    E a senha anterior do usuário deve permanecer intacta
```

### Camada B — Integração com Banco PostgreSQL Real (`user-management.integration.ts`)

```gherkin
  Cenário: Sincronização atômica de user_units sem violar constraints
    Dado um usuário com 2 UBSs cadastradas na tabela user_units
    Quando o repositório executar a sincronização para uma lista de 3 novas UBSs
    Então as 2 associações anteriores devem ser deletadas
    E as 3 novas associações devem ser persistidas
    E a constraint UNIQUE (usuario_id, unidade_id) deve permanecer íntegra

  Cenário: Rollback transacional se a gravação da auditoria falhar
    Dado uma alteração de status solicitada pelo Administrador
    Quando o repositório de auditoria falhar ao persistir o log
    Então toda a transação do banco deve sofrer rollback
    E o status do usuário deve permanecer inalterado
```

### Camada C — Teste de Endpoints HTTP e Guards (`user.controller.spec.ts`)

```gherkin
  Cenário: Bloqueio de acesso para perfil não administrador
    Dado que uma requisição POST é enviada para "/api/v1/usuarios/uuid-1/senha-provisoria"
    E o token JWT pertence ao perfil "FARMACEUTICO_RESPONSAVEL"
    Então o status de resposta HTTP deve ser 403 Forbidden

  Cenário: Administrador define senha provisória com sucesso
    Dado que o Administrador envia POST para "/api/v1/usuarios/uuid-1/senha-provisoria"
    E o payload contém uma senha que atende à complexidade
    Então o status de resposta HTTP deve ser 204 No Content
```

---

## 7. Definition of Done (DoD)

1. **Backend**:
   - 4 Casos de uso implementados: `EditUserUseCase`, `UpdateAssociationsUseCase`, `ToggleUserStatusUseCase` e `SetTemporaryPasswordUseCase`.
   - 4 Endpoints expostos no `UserController` sob `/api/v1/usuarios`, decorados com `@nestjs/swagger` e `@UseGuards(JwtAuthGuard, RolesGuard)` com `@Roles(PerfilCodigo.ADMINISTRADOR)`.
   - Método `revogarTodas` de `ISessionRepository` chamado nas operações de inativação e de redefinição de senha provisória.
   - Trilha de auditoria gravada atomicamente na mesma transação TypeORM via `QueryRunner`.
2. **Segurança e Criptografia**:
   - Senha provisória validada com regex de complexidade e hasheada com BCrypt custo 12.
   - `deve_trocar_senha = true` persistido no banco.
3. **Qualidade e Testes**:
   - 100% dos cenários Gherkin da Camada A implementados em `*.steps.ts` e passando.
   - Cenários da Camada B validando constraints de banco e rollback transacional no PostgreSQL real.
   - Testes de endpoints e guards da Camada C passando com 100% de sucesso.
4. **Build e Contratos**:
   - DTOs e interfaces consolidados em `packages/shared/src/administracao/usuario.types.ts`.
   - `pnpm build` executado e aprovado em todo o monorepo sem erros.