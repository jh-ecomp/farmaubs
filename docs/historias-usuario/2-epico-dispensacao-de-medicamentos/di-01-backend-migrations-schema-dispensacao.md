# DI-01 feat(dispensacao): Migrations do schema de dispensação (`pacientes`, `dispensacoes`, `dispensacao_itens` e movimentações)

---

- **Épico**: Dispensação de Medicamentos (RF010, RF012, RF028, NF009, NF010, NF015, NF017)
- **Requisitos Funcionais**: RF010 (Registro de Dispensa com Paciente Obrigatório), RF012 (Histórico e Rastreabilidade), RF028 (Auditoria Operacional)
- **Requisitos Não-Funcionais**: NF015 (Isolamento Multitenant via RLS), NF017 (LGPD e Integridade de Dados Pessoais)
- **ADRs Vinculadas**: ADR-002 (Multi-tenancy e RLS), ADR-003 (Arquitetura Hexagonal), ADR-015 (PostgreSQL & Transações ACID), ADR-016 (Políticas RLS), ADR-030 (Pirâmide de Testes — Camada B), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de usuário

> **Como** administrador de banco de dados e engenheiro backend do FarmaUBS,  
> **quero** criar e versionar as tabelas relacionais do módulo de dispensação (`pacientes`, `dispensacoes`, `dispensacao_itens` e vínculos de auditoria/movimentação), aplicando chaves estrangeiras, índices e políticas de Row-Level Security (RLS),  
> **para que** o sistema armazene os atendimentos com total integridade referencial, bloqueie acessos entre municípios e preserve o histórico operacional mesmo em caso de cancelamento/estorno (ADR-002, ADR-015, NF015).

---

## 2. Regras de negócio e casos de borda

1. **Estrutura de Pacientes (`pacientes`)**:
   - Dados obrigatórios:
     - `cns`: Cartão Nacional de Saúde com exatamente 15 dígitos numéricos.
     - `cpf`: 11 dígitos numéricos com restrição de unicidade por município (`idx_pacientes_municipio_cpf`).
     - `nome_completo`: varchar(150), não nulo.
     - `data_nascimento`: date, não nulo (não pode ser data futura).
   - Multi-tenancy: vinculado obrigatoriamente a `municipio_id` (UUID), protegido com RLS de isolamento municipal.
   - Soft delete: campo `ativo boolean NOT NULL DEFAULT true`.

2. **Estrutura do Cabeçalho de Dispensação (`dispensacoes`)**:
   - Chave primária: `id` (UUIDv7).
   - Vínculos obrigatórios:
     - `municipio_id`: UUID, referenciando `municipios(id)`.
     - `unidade_id`: UUID, referenciando `unidades_saude(id)`.
     - `paciente_id`: UUID, referenciando `pacientes(id)`.
     - `dispensador_id`: UUID, referenciando `users(id)` (o farmacêutico logado no atendimento).
   - Metadados clínicos e de controle:
     - `numero_atendimento`: sequência única ou código legível diário.
     - `receita_emissao_em`: date opcional para receitas comuns, obrigatório caso contenha antimicrobianos.
     - `status`: enum ou varchar(20) (`concluida`, `estornada`). Padrão: `concluida`.
     - `estornado_em`: timestamptz nulo por padrão.
     - `motivo_estorno`: text nulo por padrão.
     - `estornado_por_id`: UUID referenciando `users(id)`.
   - Índices de performance:
     - `idx_dispensacoes_unidade_created`: (`unidade_id`, `created_at DESC`) para consulta rápida das dispensas de ontem e hoje.
     - `idx_dispensacoes_paciente`: (`paciente_id`, `created_at DESC`) para histórico do paciente.

3. **Estrutura dos Itens Dispensados (`dispensacao_itens`)**:
   - Vínculos:
     - `dispensacao_id`: UUID referenciando `dispensacoes(id)` com `ON DELETE RESTRICT`.
     - `medicamento_id`: UUID referenciando o catálogo de medicamentos.
     - `lote_id`: UUID referenciando o lote físico de estoque.
   - Quantidades e posologia:
     - `quantidade_dispensada`: integer > 0 (quantidade física em unidades/comprimidos).
     - `posologia`: text opcional contendo instruções de administração ao paciente.

4. **Políticas de Isolamento RLS**:
   - `pacientes`: RLS aplicado baseado em `app.municipio_id`.
   - `dispensacoes`: RLS aplicado baseado em `app.municipio_id` e conferência de `app.unidade_id`.
   - `dispensacao_itens`: herda proteção relacional de `dispensacoes`.
   - O role `farmaubs_app` recebe permissões `SELECT, INSERT, UPDATE` (sem `DELETE` permanente).

---

## 3. Contratos de dados e Schema SQL (DDL)

```sql
-- 1. Tabela de Pacientes
CREATE TABLE pacientes (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  municipio_id uuid NOT NULL REFERENCES municipios(id) ON DELETE RESTRICT,
  cns varchar(15) NOT NULL,
  cpf varchar(11) NOT NULL,
  nome_completo varchar(150) NOT NULL,
  data_nascimento date NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_pacientes_cns_length CHECK (length(cns) = 15),
  CONSTRAINT chk_pacientes_cpf_length CHECK (length(cpf) = 11)
);

CREATE UNIQUE INDEX idx_pacientes_municipio_cpf ON pacientes (municipio_id, cpf);
CREATE UNIQUE INDEX idx_pacientes_municipio_cns ON pacientes (municipio_id, cns);
CREATE INDEX idx_pacientes_nome ON pacientes (municipio_id, lower(nome_completo));

-- 2. Tabela de Dispensações (Atendimentos)
CREATE TABLE dispensacoes (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  municipio_id uuid NOT NULL REFERENCES municipios(id) ON DELETE RESTRICT,
  unidade_id uuid NOT NULL REFERENCES unidades_saude(id) ON DELETE RESTRICT,
  paciente_id uuid NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
  dispensador_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status varchar(20) NOT NULL DEFAULT 'concluida',
  receita_emissao_em date,
  estornado_em timestamptz,
  motivo_estorno text,
  estornado_por_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_dispensacoes_status CHECK (status IN ('concluida', 'estornada'))
);

CREATE INDEX idx_dispensacoes_unidade_periodo ON dispensacoes (unidade_id, created_at DESC);
CREATE INDEX idx_dispensacoes_paciente ON dispensacoes (paciente_id, created_at DESC);

-- 3. Tabela de Itens Dispensados
CREATE TABLE dispensacao_itens (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  dispensacao_id uuid NOT NULL REFERENCES dispensacoes(id) ON DELETE RESTRICT,
  medicamento_id uuid NOT NULL,
  lote_id uuid NOT NULL,
  quantidade_dispensada integer NOT NULL CHECK (quantidade_dispensada > 0),
  posologia text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dispensacao_itens_dispensacao ON dispensacao_itens (dispensacao_id);
CREATE INDEX idx_dispensacao_itens_lote ON dispensacao_itens (lote_id);
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

### Camada de Infraestrutura / Persistência (`apps/backend/src/modules/dispensacao/infrastructure/persistence/`)
- **`migrations/`**:
  - Criar arquivo de migração versionada `1790000000000-create-dispensacao-tables.ts` implementando `MigrationInterface` (métodos `up` e `down`) com índices e RLS.
- **`entities/` (ORM Mappers)**:
  - Criar entidades TypeORM responsáveis exclusivamente pelo mapeamento relacional (anotações `@Entity`, `@Column`, `@ManyToOne`):
    - `paciente.typeorm-entity.ts`
    - `dispensacao.typeorm-entity.ts`
    - `dispensacao-item.typeorm-entity.ts`
- **Mapeamento para Entidades de Domínio**:
  - Criar mappers puros `PacienteMapper` e `DispensacaoMapper` convertendo entre os modelos de banco TypeORM e as entidades agnósticas de domínio (`domain/entities/`).

### Camada de Testes (Camada B — Concorrência e Schema)
- Criar teste de schema e rollback em `test/schema/dispensacao-schema.spec.ts` validando constraints de integridade territorial, unicidade de CPF/CNS e integridade do rollback.

---

## 5. Cenários de teste em BDD (Gherkin — camada B)

```gherkin
# language: pt
Funcionalidade: Integridade do Schema de Dispensação (Camada B)

  Cenário: Tentativa de inserção de paciente sem CNS ou CPF válido
    Dado que a migração de dispensação foi executada no PostgreSQL
    Quando tentar inserir um paciente com CPF de 10 dígitos
    Então o banco de dados deve rejeitar com violação de CHECK constraint "chk_pacientes_cpf_length"

  Cenário: Rejeição de paciente duplicado no mesmo município
    Dado que já existe um paciente cadastrado com CPF "12345678901" no município "Parnaíba"
    Quando tentar cadastrar outro paciente com o mesmo CPF no mesmo município
    Então o banco de dados deve rejeitar por violação do índice único "idx_pacientes_municipio_cpf"

  Cenário: Garantia de isolamento multi-tenancy e integridade de dispensação
    Dado que existe uma dispensação cadastrada na unidade "UBS Jardim Primavera"
    Quando a role "farmaubs_app" consultar a tabela "dispensacoes" com tenant configurado para outro município
    Então nenhum registro deve ser retornado pelas políticas de RLS
```

---

## 6. Checklist de DoD e aceitação

- [x] Arquivo de migração TypeORM criado e idempotente.
- [x] Método `down()` desfaz todas as tabelas e índices em ordem reversa sem erros de dependência.
- [x] RLS ativado nas tabelas operacionais com grant para `farmaubs_app`.
- [x] Campos de identificação do paciente configurados como `NOT NULL` com constraints de tamanho.
- [x] Testes da Camada B aprovados no banco efêmero (`pnpm test:schema`).
