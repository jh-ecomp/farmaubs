# RE-01: Migrations do Schema de Recebimento de Cargas e Gestão de Lotes (RF008, RF028)

---

- **Épico**: Recebimento de Medicamentos (RF008, RF024, RF028, NF009, NF015)
- **Requisitos Funcionais**: RF008 (Registro de Recebimento e Estoque de Lotes), RF028 (Rastreabilidade e Log de Movimentação)
- **Requisitos Não-Funcionais**: NF009 (RBAC), NF015 (Isolamento Multi-tenant por UBS via RLS)
- **ADRs Vinculadas**: ADR-002 / ADR-016 (RLS Multi-Tenant), ADR-008 / ADR-015 (Consistência Transacional e Integridade Relacional), ADR-030 (Pirâmide de Testes — Camada B), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## Contexto & Problema

O recebimento de medicamentos na farmácia da Unidade Básica de Saúde (UBS) exige rastreabilidade rigorosa de ponta a ponta. Atualmente, os insumos chegam à unidade acompanhados de Guias de Remessa da CAF Central (ex: `MOD 06 2908 2026`) ou Notas Fiscais, contendo medicamentos produzidos por múltiplos fabricantes/laboratórios e divididos em lotes com diferentes prazos de validade.

Para garantir a conformidade sanitária (Anvisa/SUS) e o isolamento multi-tenant estrito (ADR-016), é indispensável criar no PostgreSQL as tabelas de suporte ao recebimento (`fabricantes`, `documentos_entrada`, `recebimento_itens`, `lotes`), associadas às movimentações de auditoria e protegidas por Row-Level Security (RLS).

---

## Escopo Técnico & Arquitetural (Clean Architecture — ADR-034)

### Camada de Infraestrutura / Persistência (`apps/backend/src/modules/recebimento/infrastructure/persistence/`)
- **`migrations/`**:
  - `apps/backend/src/database/migrations/<timestamp>-cria-schema-recebimento.ts`.
  - Tabelas criadas: `fabricantes`, `documentos_entrada`, `recebimento_itens`, `lotes` e extensão de `movimentacoes_estoque`.
- **`entities/` (ORM Mappers)**:
  - `fabricante.typeorm-entity.ts`
  - `documento-entrada.typeorm-entity.ts`
  - `recebimento-item.typeorm-entity.ts`
  - `lote.typeorm-entity.ts`
- **Mapeamento para Entidades de Domínio**:
  - `FabricanteMapper`, `DocumentoEntradaMapper` e `LoteMapper` para conversão com os modelos do domínio em `domain/entities/`.
- **Decisões Arquiteturais**: ADR-008 (Consistência Transacional), ADR-015 (PostgreSQL 18), ADR-016 (RLS Multi-Tenant), ADR-034 (Clean Architecture Fullstack).

---

## Critérios de Aceite (Gherkin BDD)

### Cenário 1: Execução e reversão da migration de forma idempotente
```gherkin
Dado que o banco de dados PostgreSQL 18 está operando na versão mais recente
Quando o comando TypeORM migration:run for executado para o schema de recebimento
Então as tabelas "fabricantes", "documentos_entrada", "recebimento_itens" e "lotes" devem ser criadas com sucesso
E todas as constraints de integridade referencial (FKs), unicidade e checagens (CHECK) devem estar ativas
E quando o comando migration:revert for executado
Então as tabelas e tipos ENUM devem ser removidos sem deixar dependências órfãs
```

### Cenário 2: Isolamento de dados multi-tenant com Row-Level Security (RLS)
```gherkin
Dado que existem duas UBS distintas cadastradas no sistema: "UBS Piauí" e "UBS Ilha Grande"
E foram registradas guias de entrada e lotes para ambas as unidades
Quando uma conexão com o banco executar "SET LOCAL app.current_ubs_id = '<id-ubs-piaui>'"
E executar "SELECT * FROM documentos_entrada"
Então devem ser retornadas exclusivamente as guias pertencentes à "UBS Piauí"
E consultas à tabela "lotes" devem isolar os saldos estritamente para a "UBS Piauí"
```

### Cenário 3: Validação de constraints de integridade física e datas
```gherkin
Dado que uma inserção é tentada na tabela "recebimento_itens"
Quando a quantidade recebida for menor ou igual a zero (ex: 0 ou -10)
Então o banco de dados deve rejeitar o registro com violação de CHECK constraint "chk_recebimento_item_qtd_positiva"
E quando a data de validade de um lote for anterior à data de criação
Então o registro deve ser bloqueado pela constraint "chk_lote_validade_futura"
```

---

## Definição de Tipos e DDL SQL

```sql
-- 1. Catálogo de Fabricantes / Laboratórios Produtores
CREATE TABLE IF NOT EXISTS public.fabricantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razao_social VARCHAR(180) NOT NULL,
    nome_fantasia VARCHAR(120) NOT NULL,
    cnpj VARCHAR(14) UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tipo ENUM para Documentos de Origem
DO $$ BEGIN
    CREATE TYPE public.tipo_documento_entrada_enum AS ENUM (
        'GUIA_CAF',
        'NOTA_FISCAL',
        'REMESSA_DLOG',
        'COMPRA_PREGAO',
        'DOACAO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Cabeçalho de Documentos de Entrada (Guias de Remessa / NF)
CREATE TABLE IF NOT EXISTS public.documentos_entrada (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ubs_id UUID NOT NULL REFERENCES public.ubss(id) ON DELETE RESTRICT,
    numero_documento VARCHAR(100) NOT NULL,
    tipo_documento public.tipo_documento_entrada_enum NOT NULL DEFAULT 'GUIA_CAF',
    fornecedor_origem VARCHAR(180) NOT NULL,
    data_recebimento TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usuario_recebedor_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_documento_numero_valido CHECK (length(trim(numero_documento)) >= 2)
);

-- 4. Tabela de Lotes da UBS
CREATE TABLE IF NOT EXISTS public.lotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ubs_id UUID NOT NULL REFERENCES public.ubss(id) ON DELETE RESTRICT,
    produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
    fabricante_id UUID NOT NULL REFERENCES public.fabricantes(id) ON DELETE RESTRICT,
    numero_lote VARCHAR(60) NOT NULL,
    data_validade DATE NOT NULL,
    saldo_atual INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ATIVO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_lote_saldo_nao_negativo CHECK (saldo_atual >= 0),
    CONSTRAINT uq_ubs_produto_lote_fabricante UNIQUE (ubs_id, produto_id, numero_lote, fabricante_id)
);

-- 5. Itens Concretos do Recebimento (Linhas da Guia de Entrada)
CREATE TABLE IF NOT EXISTS public.recebimento_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    documento_entrada_id UUID NOT NULL REFERENCES public.documentos_entrada(id) ON DELETE CASCADE,
    produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
    fabricante_id UUID NOT NULL REFERENCES public.fabricantes(id) ON DELETE RESTRICT,
    lote_id UUID NOT NULL REFERENCES public.lotes(id) ON DELETE RESTRICT,
    numero_lote VARCHAR(60) NOT NULL,
    data_validade DATE NOT NULL,
    quantidade_recebida INTEGER NOT NULL,
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_recebimento_item_qtd_positiva CHECK (quantidade_recebida > 0)
);

-- Habilitação de RLS
ALTER TABLE public.documentos_entrada ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recebimento_itens ENABLE ROW LEVEL SECURITY;

-- Políticas de Isolamento RLS
CREATE POLICY rls_documentos_entrada_ubs ON public.documentos_entrada
    FOR ALL
    USING (ubs_id = NULLIF(current_setting('app.current_ubs_id', true), '')::uuid);

CREATE POLICY rls_lotes_ubs ON public.lotes
    FOR ALL
    USING (ubs_id = NULLIF(current_setting('app.current_ubs_id', true), '')::uuid);
```

---

## Regras de Negócio e Casos de Borda

1. **Unicidade de Lote por UBS e Fabricante**: Um mesmo medicamento pode possuir o mesmo identificador de lote em fabricantes diferentes; por isso, a chave de unicidade deve contemplar `(ubs_id, produto_id, numero_lote, fabricante_id)`.
2. **Saldo Não Negativo**: A constraint `chk_lote_saldo_nao_negativo` assegura que nenhuma operação concorrente resulte em saldo negativo.
3. **Auditoria de Estorno**: Caso uma entrada seja estornada, os registros originais da tabela `recebimento_itens` permanecem intactos para preservar a trilha de auditoria física da guia original.

---

## Definition of Done (DoD)

- [ ] Arquivo de migration criado e testado via `pnpm migration:run` e `pnpm migration:revert`.
- [ ] Teste de integração de banco (Camada B) validando criação das tabelas, chaves estrangeiras e constraints.
- [ ] Teste automatizado verificando o isolamento de consultas RLS com `SET LOCAL app.current_ubs_id`.
