# AC-01 | Migrations do módulo de acesso

## História de usuário

Como desenvolvedor(a) de banco de dados do FarmaUBS, quero criar as migrations do módulo de acesso, incluindo as tabelas base `municipios` e `unidades_saude` (RF026), com identificadores **UUID v7 (RFC 9562)** ordenados por tempo, para que o schema do PostgreSQL esteja pronto para suportar o isolamento multi-tenant (ADR-002), autenticação, autorização RBAC e recuperação de conta conforme o ADR-006 e os requisitos RF001 a RF004, antes do desenvolvimento dos casos de uso e das políticas de RLS (AC-02).

## Visão geral

Esta história entrega a fundação persistente do módulo de acesso, dentro de `/apps/backend` conforme ADR-022 (o banco é parte do adaptador de repositório, não um artefato separado). O schema deve nascer alinhado às decisões já fechadas: isolamento multi-tenant com colunas de escopo indexadas (ADR-016), sessão server-side no PostgreSQL (ADR-006), catálogo de perfis extensível para RBAC (NF009) e proteção de dados sensíveis desde a modelagem (NF010/NF011).

As tabelas `municipios` e `unidades_saude` (RF026) são **pré-requisito estrutural** desta história: `users.municipio_id` referencia `municipios` e `user_units.unidade_id` referencia `unidades_saude`. Elas nascem aqui, nesta migration, porque todo o módulo de acesso depende das FKs.

A migração de políticas de RLS e grants de papel de aplicação **não** faz parte desta história; ela é a AC-02. Porém, todas as tabelas multi-tenant são criadas com as colunas de escopo (`municipio_id`) já presentes e indexadas, para que a AC-02 apenas anexe as políticas sem alterar o schema.

## Escopo

**Inclui**
- Configuração do TypeORM no backend como ferramenta de migrations (DataSource, `synchronize: false`, scripts pnpm).
- Atualização da imagem do PostgreSQL no compose para a versão com suporte nativo a `uuidv7()` (PostgreSQL 18) e ajuste das referências de versão no ADR-015/ADR-016.
- Tabelas `municipios`, `unidades_saude`, `perfis`, `users`, `user_units`, `sessions`, `password_reset_tokens`, `totp_secrets`.
- Constraints, índices e seeds idempotentes.
- Testes de integração de schema (ADR-030, camada B).
- Documentação das convenções no CONTRIBUTING.

**Não inclui**
- Políticas de RLS, grants e interceptor de `SET LOCAL` (AC-02).
- Implementação dos casos de uso de login, cadastro, recuperação e 2FA (AC-04 a AC-10).
- Serviço de criptografia AES-256 (AC-15); a migration apenas define a coluna que recebe o valor cifrado.

**Nota de escopo:** constraints e índices essenciais de integridade fazem parte desta história. A AC-03 permanece como validação consolidada de índices compostos de consulta e revisão de performance.

## Decisões de design aplicadas

1. **Migrations via TypeORM** (decisão do time): ORM TypeORM com `synchronize: false` e migrations versionadas em TypeScript em `apps/backend/src/database/migrations`. DDL que o TypeORM não abstrai, políticas de RLS, grants, índices avançados, é executado via `queryRunner.query()` com SQL nativo dentro da própria migration (necessário para a AC-02). A geração automática (`migration:generate`) a partir das entities é aceita, mas o diff gerado deve ser revisado manualmente antes do merge, pois entidades não devem divergir das migrations.
2. **Convenção de nomenclatura**: migrations nomeadas por timestamp + descrição (ex.: `1735000000000-CreateMunicipios.ts`), nomes de tabelas/colunas em `snake_case` (consistente com `dispensas`, `movimentacoes_estoque` do ADR-017), timestamps `TIMESTAMPTZ` em UTC.
3. **Forward-only em produção**: migrations são imutáveis após o merge; qualquer alteração de schema exige nova migration. `migration:revert` apenas para conveniência de desenvolvimento local.
4. **DDL transacional**: cada migration roda dentro de transação (padrão do TypeORM), com `IF NOT EXISTS` em índices e seeds idempotentes via `ON CONFLICT DO NOTHING`.
5. **Identificadores - UUID v7 (RFC 9562)**: chave primária simples `UUID` gerada por `uuidv7()`, função nativa do PostgreSQL 18 (imagem do compose atualizada nesta história). O UUID v7 embute o timestamp Unix em milissegundos nos 48 bits mais significativos, produzindo chaves **ordenadas temporalmente**: melhor localidade de índice B-tree, menor fragmentação de páginas sob inserção contínua e ordenação cronológica implícita, coerente com a filosofia de consulta por período do ADR-017. As colunas de FK permanecem `UUID` (sem default). Fallback registrado: caso a imagem permaneça em PostgreSQL 16 (sem `uuidv7()` nativo), as alternativas são a extensão `pg_uuidv7` (criada na migration 000) ou a geração na camada de aplicação, a decisão adotada é PostgreSQL 18 nativo.
6. **Segredos nunca em plaintext**: sessões e tokens de redefinição persistem apenas o hash SHA-256 do token bruto; o segredo TOTP é persistido como texto cifrado (a cifragem é responsabilidade da AC-15). Vazamento do banco não expõe token utilizável nem segredo TOTP.
7. **Catálogo de perfis como tabela lookup**, não enum do PostgreSQL: permite adicionar perfis sem `ALTER TYPE`, referenciável por FK e alinhado à extensibilidade do RBAC (NF009). Perfis são catálogo global, fora do escopo de tenant, no mesmo espírito da tabela nacional RENAME do ADR-016.
8. **E-mail normalizado com unicidade global**: índice único sobre `lower(email)` garante login determinístico (RF002 usa apenas e-mail e senha). A normalização é responsabilidade da camada de aplicação.
9. **Prontidão para RLS**: toda tabela multi-tenant nasce com `municipio_id` obrigatório e indexado, conforme ADR-016, para que a AC-02 aplique as políticas sem retrofit. `municipios` (a dimensão de tenant em si) e `perfis` (catálogo global) ficam fora de RLS.

## Dependências

- **Nenhuma tabela externa**: as tabelas base `municipios` e `unidades_saude` (RF026) são criadas nesta própria história.
- **PostgreSQL 18 com `uuidv7()` nativo (RFC 9562)**: exige atualizar a imagem do compose (`postgres:16-alpine` → `postgres:18-alpine`) e ajustar as referências de versão no ADR-015/ADR-016. Sem isso, os defaults das PKs não compilam.
- **AC-02 (RLS + interceptor)**: consome este schema para anexar políticas e grants.
- **AC-05 (login) e AC-09 (2FA)**: consomem `sessions` e `totp_secrets`.
- **AC-15 (criptografia)**: fornece o serviço que cifra o segredo TOTP; a coluna `segredo_cifrado` já nasce pronta para isso.

## Casos de teste

- **TC-01** Aplicar todas as migrations do zero em banco PostgreSQL limpo (efêmero, via Docker Compose) deve terminar sem erro; validar via `information_schema` a existência das 8 tabelas com colunas e tipos esperados.
- **TC-02** Inserir dois usuários com o mesmo e-mail (com variações de caixa) deve falhar por violação de unicidade.
- **TC-03** Inserir associação duplicada `(usuario_id, unidade_id)` deve falhar por violação de unicidade.
- **TC-04** Integridade referencial: usuário com `municipio_id` ou `perfil_id` inexistente, e `user_units` com `unidade_id` inexistente, devem falhar.
- **TC-05** Seed de perfis: após a migração existem exatamente os 4 perfis do ADR-006; re-executar a migration não duplica registros.
- **TC-06** Unicidade de `codigo_ibge` em `municipios`: inserir dois municípios com o mesmo código IBGE deve falhar.
- **TC-07** Colunas obrigatórias: inserção sem `senha_hash`, `email`, `nome_completo`, `municipios.nome` ou `unidades_saude.responsavel_tecnico` deve falhar.
- **TC-08** `token_hash` único em `sessions` e `password_reset_tokens`: duplicidade deve falhar.
- **TC-09** Reversão (down) funciona em ambiente de dev; documentar que produção é forward-only.
- **TC-10** Prontidão RLS: toda tabela multi-tenant (`unidades_saude`, `users`, `user_units`, `sessions`, `password_reset_tokens`, `totp_secrets`) possui `municipio_id` (ou FK equivalente ao tenant) NOT NULL com índice (validação automatizada no teste de schema).
- **TC-11** O teste de integração de schema roda no banco de teste efêmero a cada execução, sem afetar o banco de desenvolvimento (ADR-030, camada B).
- **TC-12** PKs geradas são UUID v7: após inserção, validar `uuid_extract_version(id) = 7` e a ordenação temporal (ids crescentes na ordem de inserção, dentro da precisão de milissegundos).
- **TC-13** `uuidv7()` está disponível no banco de teste (função nativa presente após a atualização do compose para PostgreSQL 18).

## Critérios de aceite

- [x] As 8 tabelas são criadas por migrations versionadas via TypeORM, com colunas, tipos, constraints e índices conforme o modelo acima.
- [x] Tabelas `municipios` e `unidades_saude` criadas e funcionais como base das FKs do módulo (RF026).
- [x] Todas as PKs usam `uuidv7()` (RFC 9562) com ordenação temporal; FKs permanecem `UUID` sem default (TC-12 verde).
- [x] Catálogo de perfis populado com os 4 perfis do ADR-006 e seed idempotente.
- [x] Unicidade garantida: `codigo_ibge`, e-mail normalizado, associação usuário/UBS e `token_hash`.
- [x] `synchronize: false` confirmado no DataSource; nenhuma alteração de schema fora de migration.
- [x] Migrations aplicam do zero em banco limpo sem erro (TC-01 verde).
- [x] Migrations imutáveis após o merge; qualquer mudança futura de schema exige nova migration.
- [x] Nenhum segredo persistido em plaintext no schema (token hash SHA-256; segredo TOTP como coluna de texto cifrado).
- [x] Conformidade com ADR-016: PK UUID simples (v7), colunas de escopo indexadas, nomenclatura `snake_case`.
- [x] Documentação das convenções e comandos no CONTRIBUTING.
- [x] Revisão do desenvolvedor(a) de banco + validação do desenvolvedor sênior concluídas.

## Definição de pronto (DoD)

- [x] Todas as tarefas concluídas e revisadas em PR aprovado.
- [x] Testes de integração de schema verdes localmente (ADR-030), incluindo TC-12 e TC-13.
- [x] Imagem do compose atualizada para PostgreSQL 18 e ADR-015/ADR-016 ajustados (referência de versão).
- [x] Comandos de migration documentados e reproduzíveis por qualquer desenvolvedor do time.
- [x] Sem pendência de AC-02 no schema: colunas de escopo presentes e indexadas.

## Subtarefas

- [ ] Configurar TypeORM no backend: instalar dependências, criar DataSource lendo as variáveis do .env (ADR-027), definir synchronize: false, diretório de migrations e compatibilidade com o monorepo pnpm (ADR-022).
- [ ] Adicionar scripts pnpm no apps/backend/package.json: migration:generate, migration:run, migration:revert.
- [ ] Atualizar a imagem do compose para postgres:18-alpine, validar uuidv7() disponível e ajustar referências de versão no ADR-015/ADR-016.
- [ ] Migration municipios: tabela + unicidade de codigo_ibge, PK uuidv7() (RF026, ADR-002).
- [ ] Migration unidades_saude: FKs, caf_lead_time_days e índice de escopo municipio_id (RF026).
- [ ] Migration perfis: criação da tabela + seed idempotente dos 4 perfis do ADR-006.
- [ ] Migration users: colunas, constraints, índice único de e-mail normalizado e índice de municipio_id.
- [ ] Migration user_units: FKs, unicidade (usuario_id, unidade_id) e índice de escopo.
- [ ] Migration sessions: colunas, CHECK de status, índices (usuario_id, expira_em, token_hash).
- [ ] Migration password_reset_tokens: colunas, índices (usuario_id, expira_em, token_hash).
- [ ] Migration totp_secrets: colunas, índices (usuario_id, ativo, ultimo_uso_em).
- [ ] Seeds de desenvolvimento: um município, uma UBS e um usuário administrador inicial (apenas para ambiente local, nunca em produção).
- [ ] Testes de integração de schema: aplicação do zero em banco limpo e asserções de schema (TC-01 a TC-13).
- [ ] Documentação no CONTRIBUTING: como rodar migrations, convenções de nomenclatura, forward-only em produção, reversão em dev.
