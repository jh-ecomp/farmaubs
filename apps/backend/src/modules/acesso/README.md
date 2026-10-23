# Módulo de acesso e autenticação (`@farmaubs/backend`)

O módulo de Acesso e Autenticação é responsável pela segurança de identidade, controle de sessão, propagação de tenant RLS e autorização RBAC do FarmaUBS.

---

## 1. Responsabilidades

- **Autenticação de usuários:** Login com validação de credenciais, hash bcrypt e bloqueio por tentativas excessivas.
- **Gerenciamento de sessão:** Transporte de sessão via cookie seguro `HttpOnly` na web e Bearer token no mobile, com expiração deslizante e revogação atômica.
- **Segurança de credenciais:** Fluxo de redefinição administrativa e troca obrigatória de senha provisória (`deve_trocar_senha`).
- **Isolamento de tenant (RLS):** Guard e interceptor de sessão que injetam `SET LOCAL app.municipio_id` e `SET LOCAL app.current_ubs_id` na conexão de banco a cada requisição.
- **Controle de acesso RBAC:** Decorators e guards de perfil (`ADMINISTRADOR`, `GERENTE`, `FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`).

---

## 2. Endpoints expostos

| Método | Rota | Descrição | Perfis permitidos |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/login` | Autenticação com e-mail e senha | Público |
| `POST` | `/api/v1/auth/logout` | Encerra a sessão ativa e revoga o token | Autenticado |
| `GET` | `/api/v1/auth/me` | Retorna dados do usuário autenticado e perfil | Autenticado |
| `POST` | `/api/v1/auth/troca-senha-obrigatoria` | Troca de senha no primeiro acesso | Autenticado com pendência |
| `GET` | `/api/v1/usuarios` | Listagem paginada de usuários | Administrador, Gerente |
| `POST` | `/api/v1/usuarios` | Cadastro de novos operadores e UBSs | Administrador |
| `PATCH` | `/api/v1/usuarios/:id` | Edição de perfil, lotação ou inativação | Administrador |

---

## 3. Estrutura interna

```text
apps/backend/src/modules/acesso/
├── acesso.module.ts              # Custom providers com useFactory para os Use Cases
├── api/
│   ├── controllers/              # AcessoController e UserController
│   ├── decorators/               # CurrentUser, Roles, Public
│   ├── dto/                      # Validações de entrada Swagger implementando @farmaubs/shared
│   ├── guards/                   # SessionAuthGuard, RolesGuard
│   └── interceptors/             # TenantInterceptor (RLS)
├── application/
│   └── use-cases/                # LoginUseCase, LogoutUseCase, CadastrarUsuarioUseCase, etc.
├── domain/
│   ├── entities/                 # Usuario, Sessao, Perfil
│   ├── ports/                    # AuthProviderPort, UsuarioRepositoryPort, SessaoRepositoryPort
│   └── errors/                   # CredenciaisInvalidasError, SessaoExpiradaError
└── infrastructure/
    ├── adapters/                 # Repositórios TypeORM e implementações Bcrypt
    └── persistence/              # Entidades TypeORM e migrações SQL
```
