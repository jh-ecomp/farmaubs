# AC-22 feat(acesso): enriquecer resposta de autenticação (login) e contrato de sessão com perfil RBAC e escopo

## 1. Contexto e Motivação

Atualmente, o endpoint de autenticação `POST /api/v1/acesso/login` retorna apenas o cabeçalho `Authorization: Bearer <token>` e o corpo:

```json
{
  "usuarioId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "redirectUrl": "/dashboard"
}
```

Isso gera uma **defasagem crítica com o frontend**, pois a interface necessita saber imediatamente quem é o usuário, qual o seu perfil de acesso (RBAC - RF025), qual o seu município/UBSs e se ele precisa trocar a senha (RF001). 

Como a API não entrega essas informações e o endpoint `GET /api/v1/acesso/me` ainda não está implementado, o frontend foi forçado a usar um mock estático (`perfil: ["FARMACEUTICO"]`, `municipio_id: 1`) em `apps/frontend/src/services/api.ts`. Como consequência, **nenhum usuário consegue ser reconhecido como Administrador (`ADMINISTRADOR`) na interface**, impedindo a validação visual do painel administrativo (AC-18) e a guarda de rotas RBAC.

> **Observação de Banco de Dados:** A procedure PostgreSQL `auth_buscar_usuario_por_email` já seleciona `id`, `municipio_id`, `nome_completo`, `perfil_id` e `deve_trocar_senha`. O backend apenas descarta esses dados na camada de aplicação/apresentação.

---

## 2. Escopo da Solução

1. **Atualização do Contrato Compartilhado (`@farmaubs/shared`)**:
   - Enriquecer `LoginResponse` para incluir os dados do usuário autenticado e metadados de expiração de sessão.
   - Garantir tipagem estrita com `PerfilCodigo` (`ADMINISTRADOR`, `FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `GERENTE`).

2. **Camada de Dados e Portas (`apps/backend`)**:
   - Atualizar a porta `IAcessoRepository` e o tipo `UserAcessoRecord` para retornar `nomeCompleto`, `perfilCodigo`, `municipioId`, `unidadeIds` e `deveTrocarSenha`.
   - Ajustar o repositório `AcessoPgRepository` para resolver o código natural do perfil (`perfis.codigo`) e os IDs das UBSs associadas (`user_units.unit_id`).

3. **Caso de Uso (`LoginUseCase`)**:
   - Propagar os dados do usuário e da sessão no `LoginResult`.
   - Implementar a regra de negócio do `redirectUrl`: se `deveTrocarSenha === true`, redirecionar para `/trocar-senha`; caso contrário, para `/dashboard`.

4. **Camada de Apresentação (`AcessoController`)**:
   - Atualizar `LoginResponseDto` e anotações OpenAPI/Swagger (`@ApiProperty`).
   - (Opcional recomendado) Implementar o endpoint `GET /api/v1/acesso/me` para hidratação de sessão via token ativo.

---

## 3. Contrato da API Proposto (`@farmaubs/shared`)

### `POST /api/v1/acesso/login`

**Resposta 200 OK:**
```json
{
  "usuario": {
    "id": "01919a77-3e15-7000-8000-000000000020",
    "nomeCompleto": "Carlos Eduardo da Silva",
    "email": "carlos.silva@ubs.gov.br",
    "perfilCodigo": "ADMINISTRADOR",
    "municipioId": "01919a77-3e15-7000-8000-000000000001",
    "unidadeIds": [
      "01919a77-3e15-7000-8000-000000000010"
    ],
    "deveTrocarSenha": false
  },
  "sessao": {
    "expiresAt": "2026-09-11T17:15:00.000Z",
    "ttlSeconds": 3600,
    "warningSeconds": 300
  },
  "redirectUrl": "/dashboard"
}
```

---

## 4. Critérios de Aceite

- [x] O `LoginResponse` em `packages/shared/src/acesso/login.types.ts` é atualizado contendo o objeto `usuario` (com `id`, `nomeCompleto`, `email`, `perfilCodigo`, `municipioId`, `unidadeIds`, `deveTrocarSenha`) e `sessao` (com `expiresAt`, `ttlSeconds`, `warningSeconds`).
- [x] O DTO `LoginResponseDto` no backend reflete esse contrato e está totalmente documentado no Swagger.
- [x] `AcessoPgRepository` obtém o `perfilCodigo` real da tabela `perfis` e a lista de `unidadeIds` da tabela `user_units`.
- [ ] O caso de uso `LoginUseCase` define `redirectUrl = '/trocar-senha'` quando `deveTrocarSenha === true`, e `redirectUrl = '/dashboard'` quando for `false`.
- [ ] O cabeçalho `Authorization: Bearer <token>` continua sendo retornado na resposta HTTP 200 (mantendo retrocompatibilidade).
- [ ] O endpoint `GET /api/v1/acesso/me` é disponibilizado com guarda de autenticação (Bearer Token) retornando os dados do usuário logado e sua sessão.
- [ ] Testes unitários do `LoginUseCase` atualizados cobrindo o retorno dos novos campos e a regra de `redirectUrl`.
- [ ] Testes do `AcessoController` e do Swagger atualizados e passando.

---

## 5. Tarefas Técnicas

- [ ] `packages/shared`: Atualizar interfaces em `src/acesso/login.types.ts` e exportar via `index.ts`.
- [ ] `apps/backend`: Atualizar `UserAcessoRecord` em `src/modules/acesso/domain/ports/acesso.repository.port.ts`.
- [ ] `apps/backend`: Atualizar `AcessoPgRepository` para carregar `perfilCodigo` e `unidadeIds`.
- [ ] `apps/backend`: Atualizar lógica e testes unitários de `LoginUseCase`.
- [ ] `apps/backend`: Atualizar `LoginResponseDto` em `src/modules/acesso/api/dto/login.dto.ts`.
- [ ] `apps/backend`: Adicionar endpoint `GET /api/v1/acesso/me` em `AcessoController`.
- [ ] `apps/frontend`: Remover o mock de `usuario` em `apps/frontend/src/services/api.ts` e consumir os dados reais retornados pela API.

---

## 6. Referências

- **ADR-006**: Autenticação, sessão server-side e perfis RBAC
- **ADR-013**: Gerenciamento de estado de cliente com TanStack Query e Context API
- **RF001**: Cadastrar Usuário (`deveTrocarSenha`)
- **RF002**: Autenticar Usuário
- **RF025**: Controle de Acesso Baseado em Perfis (RBAC)
- **NF012**: Sessão Segura e Timeout por Inatividade (60 minutos de TTL e 5 minutos de aviso)