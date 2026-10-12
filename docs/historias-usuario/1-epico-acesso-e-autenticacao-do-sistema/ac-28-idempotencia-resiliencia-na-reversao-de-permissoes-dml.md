# AC-28 Idempotência e resiliência na reversão de permissões DML (schema migration)

---

- **Épico**: Autenticação e Controle de Acesso (ADR-006)
- **Requisitos Funcionais**: Débito Técnico / Manutenção de Schema PostgreSQL
- **Requisitos Não-Funcionais**: NF009 (Menor Privilégio e Segurança de Acesso), NF016 (Confiabilidade e Idempotência de Migrações)
- **ADRs Vinculadas**: ADR-003 (Arquitetura Hexagonal), ADR-016 (Segurança, Permissões e RLS), ADR-030 (Pirâmide de Testes e Validação de Schema), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

### 1. História de Usuário

> **Como** engenheiro de software e operador do pipeline de CI do FarmaUBS,  
> **quero** que o método `down()` da migração de concessão de permissões (`1788525896383GrantDmlFarmaubsApp`) seja tolerante a rotinas já destruídas por migrações anteriores,  
> **para que** a suíte de testes de schema (Camada B — `moon run backend:test-schema`) e procedimentos de rollback de banco executem do início ao fim sem falhas de `undefined_function`.

---

### 2. Regras de Negócio e Casos de Borda

1. **Idempotência no Rollback de Permissões (`down`)**:
   - No PostgreSQL nativo, a cláusula `REVOKE EXECUTE ON FUNCTION nome(...)` não suporta sintaxe `IF EXISTS`.
   - Como a migração que cria as funções (`CreateAuthFunctions`, timestamp `1788600000000`) possui timestamp posterior à `GrantDmlFarmaubsApp` (timestamp `1788525896383`), durante um rollback em ordem reversa (`down`), as funções são deletadas com `DROP FUNCTION` antes que a `GrantDmlFarmaubsApp` execute seu `down()`.
   - A revogação de privilégios sobre funções (`auth_buscar_sessao_por_token`, `auth_registrar_falha_login`, `auth_buscar_usuario_por_email`) deve ser encapsulada em blocos defensivos PL/pgSQL com tratamento de exceção `WHEN undefined_function THEN NULL;` ou verificação em catálogo `pg_proc`.

2. **Preservação de Integridade em Ambiente Limpo e Produção**:
   - O método `up()` não deve ser alterado estruturalmente, garantindo que instalações do zero continuem concedendo os privilégios estritos do usuário `farmaubs_app`.
   - O comportamento das tabelas no `down()` (`REVOKE ... ON TABLE ...`) deve ser mantido, garantindo a remoção limpa dos privilégios residuais de DML.

---

### 3. Escopo Técnico e Arquitetura de Migrações

#### Arquivo Alvo:
`apps/backend/src/modules/acesso/infrastructure/persistence/migrations/1788525896383GrantDmlFarmaubsApp.ts`

#### Padrão de SQL Defensivo no `down()`:
```typescript
public async down(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public
       REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM farmaubs_app`,
  );
  await queryRunner.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public
       REVOKE EXECUTE ON FUNCTIONS FROM farmaubs_app`,
  );

  // Revogações defensivas protegidas contra funções já dropadas em migrações reversas
  await queryRunner.query(`
    DO $$
    BEGIN
      REVOKE EXECUTE ON FUNCTION auth_buscar_sessao_por_token(text) FROM farmaubs_app;
    EXCEPTION
      WHEN undefined_function THEN NULL;
    END $$;
  `);

  await queryRunner.query(`
    DO $$
    BEGIN
      REVOKE EXECUTE ON FUNCTION auth_registrar_falha_login(uuid) FROM farmaubs_app;
    EXCEPTION
      WHEN undefined_function THEN NULL;
    END $$;
  `);

  await queryRunner.query(`
    DO $$
    BEGIN
      REVOKE EXECUTE ON FUNCTION auth_buscar_usuario_por_email(text) FROM farmaubs_app;
    EXCEPTION
      WHEN undefined_function THEN NULL;
    END $$;
  `);

  await queryRunner.query(
    `REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE sessions FROM farmaubs_app`,
  );
  await queryRunner.query(
    `REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE user_units FROM farmaubs_app`,
  );
  await queryRunner.query(
    `REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE unidades_saude FROM farmaubs_app`,
  );
  await queryRunner.query(
    `REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE users FROM farmaubs_app`,
  );
}
```

---

### 4. Arquitetura e Estrutura de Pastas

Conforme a [ADR-034](file:///c:/Users/jaohe/projetos/farmaubs/docs/adrs/adr-034-clean-architecture-fullstack.md) e o [CONTRIBUTING.md](file:///c:/Users/jaohe/projetos/farmaubs/CONTRIBUTING.md):

```text
apps/backend/
├── src/modules/acesso/infrastructure/persistence/migrations/
│   └── 1788525896383GrantDmlFarmaubsApp.ts       # Ajuste de idempotência no método down()
└── test/schema/
    ├── schema-harness.ts                         # Execução de up/down completo em Postgres efêmero
    └── schema-integration.test.ts                # Validação dos testes TC-10 e TC-11 (Camada B)
```

---

### 5. Critérios de Aceite Detalhados

- [ ] **Rollback Completo sem Exceções**: A execução de `revertAllMigrations()` durante os testes de schema reverte 100% das migrações sem falhas de `function ... does not exist`.
- [ ] **Aprovação nos Testes TC-10 e TC-11**: Os testes `TC-10 — down() remove os objetos na ordem correta` e `TC-11 — up → down → up é idempotente` passam com status verde no Jest.
- [ ] **Não Regressão em Banco Limpo**: A aplicação de todas as migrações a partir do zero (`up()`) permanece funcionando perfeitamente sem alteração de permissões para `farmaubs_app`.
- [ ] **Isolamento de Escopo**: Alteração restrita exclusivamente ao arquivo de migração do backend e validação nos testes de integração de schema.

---

### 6. Cenários de Aceite em Formato BDD (Gherkin — Especificação Camada B)

> **Nota de Governança de Testes (CONTRIBUTING.md Seção 5.2):**  
> Os testes de migrations puras e integridade de schema pertencem à **Camada B** e são implementados exclusivamente em **Jest + Docker PostgreSQL efêmero** (`apps/backend/test/schema/schema-integration.test.ts`).  
> Conforme a diretriz do projeto, testes técnicos de schema **NÃO devem ser executados via Cucumber.js** (`moon run backend:test-bdd`), pois este é reservado à especificação de comportamento de regras de negócio de casos de uso (Camadas A e C). A sintaxe Gherkin abaixo atua estritamente como especificação declarativa de requisitos de negócio/aceite para a suíte Jest.

#### Especificação Comportamental da Suíte Jest (`schema-integration.test.ts`)
```gherkin
# language: pt
Funcionalidade: Idempotência do Ciclo de Vida de Migrações (Camada B)

  Cenário: TC-10 — Reversão ordenada de migrações (down)
    Dado que todas as migrações do schema estão aplicadas em um banco PostgreSQL limpo
    Quando for solicitada a reversão de todas as migrações até o estado inicial
    Então nenhuma exceção de rotina inexistente (undefined_function) deve ser lançada
    E todos os objetos de schema devem ser desmontados com sucesso

  Cenário: TC-11 — Ciclo completo up → down → up
    Dado um banco PostgreSQL limpo
    Quando todas as migrações forem executadas via up()
    E subsequentemente todas as migrações forem revertidas via down()
    E novamente todas as migrações forem reaplicadas via up()
    Então o estado final do schema deve ser equivalente à primeira execução
    E o teste de idempotência deve concluir com 100% de sucesso
```

---

### 7. Definition of Done (DoD) & Pré-requisitos

#### Pré-requisitos Técnicos
- [x] Docker e container `farmaubs-postgres-test` funcionais na porta `5435`.
- [x] Suíte `schema-integration.test.ts` pronta e diagnosticada na história AC-06.

#### Critérios de Conclusão (DoD) com Moonrepo
- [ ] Método `down()` de `1788525896383GrantDmlFarmaubsApp.ts` atualizado com blocos defensivos PL/pgSQL.
- [ ] Comando `moon run backend:test-schema` executando com **13/13 testes aprovados** (100% verde em banco efêmero na porta 5435).
- [ ] Teardown do ambiente de testes validado via `moon run backend:test-schema-down`.
- [ ] `moon run backend:test` (Camada A) e `moon run backend:test-integration` (Camada C) permanecem passando sem regressão.
- [ ] `moon run :build` passando globalmente no monorepo sem quebras no grafo DAG.
- [ ] PR aberto com template canônico, vinculando a issue da AC-28.