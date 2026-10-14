# IN-01 feat(inventario): Migrations do Schema de Inventário de Estoque, Itens de Contagem e Atas Oficiais

---

- **Épico**: Inventário Mensal (RF009, RF011, RF013, RF014, RF021, RF028, NF001, NF002, NF003, NF005, NF007, NF008, NF009, NF015)
- **Requisitos Funcionais**: RF013 (Realizar Inventário Mensal), RF028 (Log de Auditoria e Rastreabilidade)
- **Requisitos Não-Funcionais**: NF015 (Isolamento Multi-tenant por UBS via RLS)
- **ADRs Vinculadas**: ADR-002 / ADR-016 (Isolamento RLS por UBS), ADR-008 / ADR-015 (PostgreSQL 18 e Consistência Transacional), ADR-030 (Pirâmide de Testes — Camada B), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de usuário

> **Como** administrador de banco de dados e engenheiro backend do FarmaUBS,  
> **quero** criar e versionar as tabelas relacionais do módulo de inventário mensal (`ciclos_inventario`, `inventario_itens`, `atas_inventario`), com colunas calculadas de divergência, restrições parciais de unicidade e políticas RLS de tenant,  
> **para que** o sistema permita congelar snapshots de saldos teóricos, auditar contagens físicas cegas e homologar atas oficiais imutáveis com total integridade referencial e segurança jurídica para o SUS (RF013, RF028, ADR-016).

---

## 2. Regras de negócio e casos de borda

1. **Ciclo Único Ativo por UBS**:
   - Uma UBS só pode possuir no máximo um ciclo de inventário com status `EM_ANDAMENTO` por vez. Essa regra é reforçada no banco de dados via índice único condicional: `CREATE UNIQUE INDEX idx_ciclo_ativo_por_ubs ON ciclos_inventario(ubs_id) WHERE status = 'EM_ANDAMENTO'`.
2. **Snapshot Congelado de Saldos Teóricos**:
   - Cada linha em `inventario_itens` armazena o saldo teórico congelado no instante da abertura do ciclo. Novos lotes recebidos durante o inventário não alteram o snapshot original.
3. **Coluna Gerada de Divergência**:
   - O campo `divergencia` é uma coluna gerada armazenada (`GENERATED ALWAYS AS (quantidade_fisica - quantidade_teorica) STORED`), garantindo precisão matemática e indexabilidade nas consultas de conciliação.
4. **Motivo Obrigatório em Divergências**:
   - Caso `quantidade_fisica != quantidade_teorica`, a aplicação exige `motivo_divergencia` (enum sanitário) e justificativa textual quando o motivo for `OUTROS`.
5. **Imutabilidade e Hash da Ata Oficial**:
   - A tabela `atas_inventario` é estritamente de inserção (`INSERT-only`). Registra o `hash_integridade` (SHA-256) do extrato de conciliação para garantir inviolabilidade legal perante órgãos de fiscalização sanitária.
6. **Isolamento Multi-tenant via RLS (ADR-016)**:
   - As tabelas `ciclos_inventario`, `inventario_itens` e `atas_inventario` possuem Row-Level Security ativado vinculado a `app.current_ubs_id`.

---

## 3. Contratos de dados e Schema SQL (DDL)

```sql
-- 1. Tabela de Ciclos de Inventário
CREATE TYPE status_ciclo_inventario AS ENUM ('EM_ANDAMENTO', 'HOMOLOGADO', 'CANCELADO');

CREATE TABLE ciclos_inventario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ubs_id UUID NOT NULL REFERENCES ubs(id) ON DELETE RESTRICT,
  aberto_por_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  homologado_por_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  numero_ciclo VARCHAR(30) NOT NULL, -- Ex: "INV-2026/10"
  status status_ciclo_inventario NOT NULL DEFAULT 'EM_ANDAMENTO',
  iniciado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  homologado_em TIMESTAMPTZ,
  observacoes_abertura TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint: Apenas 1 ciclo EM_ANDAMENTO por UBS simultaneamente
CREATE UNIQUE INDEX idx_ciclo_ativo_por_ubs 
  ON ciclos_inventario(ubs_id) 
  WHERE status = 'EM_ANDAMENTO';

-- 2. Tabela de Itens de Contagem do Inventário
CREATE TYPE motivo_divergencia_inventario AS ENUM (
  'VALIDADE_VENCIDA',
  'AVARIA_QUEBRA',
  'EXTRAVIO',
  'ERRO_DIGITACAO',
  'ERRO_CONFERENCIA_ENTRADA',
  'DISPENSA_NAO_EFETIVADA',
  'ENTREGA_CAF_SEM_CONFERENCIA',
  'OUTROS'
);

CREATE TABLE inventario_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id UUID NOT NULL REFERENCES ciclos_inventario(id) ON DELETE CASCADE,
  ubs_id UUID NOT NULL REFERENCES ubs(id) ON DELETE RESTRICT,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE RESTRICT,
  quantidade_teorica INT NOT NULL, -- Snapshot congelado no início
  quantidade_fisica INT, -- Null enquanto não conferido
  divergencia INT GENERATED ALWAYS AS (quantidade_fisica - quantidade_teorica) STORED,
  motivo_divergencia motivo_divergencia_inventario,
  justificativa_divergencia TEXT,
  conferido_por_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  conferido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ciclo_lote UNIQUE (ciclo_id, lote_id)
);

-- 3. Tabela de Atas Oficiais de Homologação
CREATE TABLE atas_inventario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id UUID NOT NULL UNIQUE REFERENCES ciclos_inventario(id) ON DELETE RESTRICT,
  ubs_id UUID NOT NULL REFERENCES ubs(id) ON DELETE RESTRICT,
  numero_ata VARCHAR(40) NOT NULL, -- Ex: "ATA-INV-2026/004"
  data_emissao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  farmaceutico_responsavel_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  total_itens_conferidos INT NOT NULL,
  total_itens_com_divergencia INT NOT NULL,
  total_unidades_sobra INT NOT NULL,
  total_unidades_falta INT NOT NULL,
  hash_integridade VARCHAR(64) NOT NULL, -- SHA-256 do extrato de conciliação
  conteudo_declaracao TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Políticas de Row-Level Security (RLS)
ALTER TABLE ciclos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE atas_inventario ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_ciclos_inventario ON ciclos_inventario
  FOR ALL USING (ubs_id = current_setting('app.current_ubs_id', true)::uuid);

CREATE POLICY rls_inventario_itens ON inventario_itens
  FOR ALL USING (ubs_id = current_setting('app.current_ubs_id', true)::uuid);

CREATE POLICY rls_atas_inventario ON atas_inventario
  FOR ALL USING (ubs_id = current_setting('app.current_ubs_id', true)::uuid);
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

### Camada de Infraestrutura / Persistência (`apps/backend/src/modules/inventario/infrastructure/persistence/`)
- **`migrations/`**:
  - `apps/backend/src/database/migrations/<timestamp>-cria-schema-inventario.ts`.
  - Tabelas criadas: `ciclos_inventario`, `inventario_itens`, `atas_inventario` e novos tipos ENUM de movimentação (`AJUSTE_ENTRADA_INVENTARIO`, `AJUSTE_SAIDA_INVENTARIO`).
- **`entities/` (ORM Mappers)**:
  - `ciclo-inventario.typeorm-entity.ts`
  - `inventario-item.typeorm-entity.ts`
  - `ata-inventario.typeorm-entity.ts`
- **Mapeamento para Entidades de Domínio**:
  - `CicloInventarioMapper`, `InventarioItemMapper` e `AtaInventarioMapper` para conversão com os modelos do domínio puro em `domain/entities/`.
- **Decisões Arquiteturais**: ADR-008 / ADR-015 (PostgreSQL 18 e Consistência Transacional), ADR-016 (Isolamento RLS por UBS), ADR-034 (Clean Architecture Fullstack).

---

## 5. Cenários de teste em BDD (Gherkin — camada B)

```gherkin
# language: pt
Funcionalidade: Integridade do Schema de Inventário (Camada B)

  Cenário: Execução e integridade das migrations de inventário
    Dado um banco de dados de testes na versão imediatamente anterior
    Quando a migration de schema de inventário for executada
    Então as tabelas "ciclos_inventario", "inventario_itens" e "atas_inventario" devem ser criadas
    E o índice único parcial "idx_ciclo_ativo_por_ubs" deve estar ativo
    E as colunas calculadas de divergência devem operar com a fórmula física - teórica

  Cenário: Rollback limpo da migration
    Dado que a migration de inventário foi executada com sucesso
    Quando for executado o comando "migration:revert"
    Então as tabelas e tipos ENUM devem ser desfeitos sem deixar resíduos no banco
```

---

## 6. Checklist de DoD e aceitação

- [ ] Arquivo TypeScript da migration implementado e validado contra PostgreSQL 18.
- [ ] Testes de integração de banco de dados (Camada B) validando criação de chaves estrangeiras, coluna gerada de divergência e políticas RLS de tenant.
- [ ] Índice único parcial para `status = 'EM_ANDAMENTO'` ativo e validado.
- [ ] Políticas RLS aplicadas nas 3 tabelas operacionais.
