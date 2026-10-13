# AC-02 | Políticas de RLS e interceptor de propagação do escopo via SET LOCAL (ADR-016)

## História de Usuário

**Como** Administrador do FarmaUBS,
**quero** que o isolamento entre municípios seja garantido no nível do banco de dados por Row-Level Security, com o contexto de tenant propagado automaticamente a cada transação,
**para que** dados de um município nunca sejam acessíveis por outro, mesmo que a camada de aplicação falhe em aplicar o escopo.

## Critérios de Aceite

- [x] Tabelas multi-tenant possuem `ENABLE` + `FORCE ROW LEVEL SECURITY` e política com `USING` e `WITH CHECK` baseadas no GUC `app.municipio_id`, usando o padrão `NULLIF(current_setting('app.municipio_id', true), '')::uuid` (fail-closed no PostgreSQL 18).
- [x] A API conecta ao banco como role de aplicação `farmaubs_app` (DML, não-dona das tabelas), com `GRANT`s concedidos nas migrations; nenhuma operação de runtime usa o superuser `POSTGRES_USER`.
- [x] O interceptor centralizado aplica `SET LOCAL app.municipio_id` no início de cada transação, no mesmo `queryRunner`/transação em que o repositório executa as queries, com commit/rollback no final.
- [x] Rotas públicas (login, recuperação de senha) operam sem contexto de tenant; rotas de domínio falham fechado (0 linhas) quando o contexto está ausente.
- [x] Teste de integração obrigatório de RLS (ADR-030): conecta como `farmaubs_app` e tenta deliberadamente ler e escrever dados de outro `municipio_id`, verificando que a política bloqueia.
- [x] Teste unitário do interceptor (camada A): verifica o `SET LOCAL` com o GUC e valor corretos, e o comportamento com escopo ausente.

## Subtarefas

- [] Criar a role farmaubs_app e ajustar o docker-compose para a API conectar com ela (substituindo o superuser)
- [] Escrever a migration de RLS: habilitar e forçar RLS nas tabelas tenant-scoped e criar as políticas com o padrão NULLIF
- [] Conceder GRANTs de DML para farmaubs_app nas migrations
- [] Implementar o TransactionInterceptor (abre transação, aplica SET LOCAL, executa o caso de uso, commit/rollback)
- [] Implementar o interceptor de tenant: leitura do escopo da sessão (ADR-006) e propagação do GUC
- [] Recriar o harness de integração (jest-integration.json, global-setup.ts com banco efêmero e role farmaubs_app, script test:integration)
- [] Escrever o teste de integração de RLS (camada B, obrigatório)
- [] Escrever o teste unitário do interceptor (camada A)