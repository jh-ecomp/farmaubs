# AL-01 feat(alertas): Migrações do Schema de Alertas de Estoque, Parâmetros Operacionais por UBS e Fila Outbox Transacional

---

- **Épico**: Alertas, Notificações e Parâmetros Operacionais (RF022, RF023, RF024, RF026, RF027, RF028, NF015, NF018)
- **Requisitos Funcionais**: RF022 (Alertar Vencimento Próximo), RF023 (Alertar Risco de Ruptura), RF027 (Configurar Parâmetros do Sistema), RF028 (Log de Auditoria)
- **Requisitos Não-Funcionais**: NF015 (Isolamento Multi-tenant por UBS via RLS), NF018 (Auditabilidade Imutável)
- **ADRs Vinculadas**: ADR-002 / ADR-016 (Isolamento RLS por Município/UBS), ADR-004 (Transactional Outbox no PostgreSQL), ADR-008 / ADR-015 (PostgreSQL 18 e Consistência Transacional), ADR-030 (Pirâmide de Testes — Camada B), ADR-033 (Clean Architecture Pura)

---

## 1. História de usuário

> **Como** engenheiro de software e administrador de banco de dados do FarmaUBS,  
> **quero** criar e versionar as tabelas relacionais de parâmetros operacionais por UBS (`parametros_operacionais_ubs`), de ocorrências de alertas (`alertas_estoque`) e de fila de eventos assíncronos (`outbox_events`), com chaves de deduplicação, índices parciais e políticas de Row-Level Security (RLS),  
> **para que** o sistema armazene limiares customizados por farmácia, mantenha o ciclo de vida auditável dos alertas de vencimento e ruptura sem duplicações e garanta o envio confiável de e-mails na mesma transação das operações de estoque (RF022, RF023, RF027, ADR-004, ADR-016).

---

## 2. Regras de negócio e casos de borda

1. **Parâmetros Operacionais por UBS (`parametros_operacionais_ubs`)**:
   - Relação `1:1` com `unidades_saude` (`ubs_id UNIQUE`).
   - Valores padrão canônicos alinhados aos requisitos (`RF022`, `RF023`, `RF027`):
     - `limiar_vencimento_dias`: `90` (restrição `CHECK (limiar_vencimento_dias BETWEEN 15 AND 365)`);
     - `estoque_seguranca_dias`: `7` (restrição `CHECK (estoque_seguranca_dias BETWEEN 0 AND 90)`);
     - `caf_lead_time_days`: `15` (restrição `CHECK (caf_lead_time_days BETWEEN 1 AND 60)` — sincronizado com `unidades_saude.caf_lead_time_days`);
     - `janela_consumo_dias`: `90` (restrição `CHECK (janela_consumo_dias IN (30, 60, 90, 180, 365))`);
     - `notificar_email_vencimento` e `notificar_email_ruptura`: `BOOLEAN NOT NULL DEFAULT TRUE`.
2. **Unicidade de Alertas Ativos por Item (`alertas_estoque`)**:
   - Não pode existir mais de um alerta não resolvido (`status IN ('ATIVO', 'LIDO')`) para a mesma combinação `(ubs_id, tipo_alerta, produto_id, COALESCE(lote_id, '00000000-0000-0000-0000-000000000000'))`.
   - Essa garantia é imposta por índice único parcial no banco (`idx_alerta_unico_nao_resolvido`).
3. **Outbox Transacional e Idempotência (`outbox_events` — ADR-004)**:
   - Grava eventos de domínio (`ALERTA_ESTOQUE_CRIADO`, `PARAMETRO_UBS_ATUALIZADO`) na mesma transação ACID da operação principal.
   - Possui `idempotency_key VARCHAR(160) UNIQUE` para impedir que duas avaliações simultâneas enfileirem dois e-mails idênticos para o mesmo lote/produto no mesmo dia.
   - Controle de processamento com `status` (`PENDENTE`, `PROCESSANDO`, `PROCESSADO`, `FALHA`), `tentativas INT DEFAULT 0`, `erro_mensagem TEXT` e `processed_at TIMESTAMPTZ`.
4. **Isolamento Multi-tenant via RLS (ADR-016)**:
   - As tabelas `parametros_operacionais_ubs`, `alertas_estoque` e `outbox_events` possuem Row-Level Security ativado e forçado (`ENABLE` + `FORCE ROW LEVEL SECURITY`) filtrando por `municipio_id` e `ubs_id`.

---

## 3. Contratos de dados e Schema SQL (DDL)

```sql
-- 1. Tipos ENUM para Alertas e Outbox
CREATE TYPE tipo_alerta_estoque AS ENUM (
  'VENCIMENTO_PROXIMO',
  'VENCIDO',
  'RISCO_RUPTURA',
  'ESTOQUE_ZERADO'
);

CREATE TYPE severidade_alerta_estoque AS ENUM (
  'ATENCAO',
  'CRITICO'
);

CREATE TYPE status_alerta_estoque AS ENUM (
  'ATIVO',
  'LIDO',
  'RESOLVIDO'
);

CREATE TYPE status_outbox_event AS ENUM (
  'PENDENTE',
  'PROCESSANDO',
  'PROCESSADO',
  'FALHA'
);

-- 2. Tabela de Parâmetros Operacionais por UBS (RF027)
CREATE TABLE parametros_operacionais_ubs (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  municipio_id UUID NOT NULL REFERENCES municipios(id) ON DELETE RESTRICT,
  ubs_id UUID NOT NULL UNIQUE REFERENCES unidades_saude(id) ON DELETE CASCADE,
  limiar_vencimento_dias INT NOT NULL DEFAULT 90
    CONSTRAINT chk_limiar_vencimento_dias CHECK (limiar_vencimento_dias BETWEEN 15 AND 365),
  estoque_seguranca_dias INT NOT NULL DEFAULT 7
    CONSTRAINT chk_estoque_seguranca_dias CHECK (estoque_seguranca_dias BETWEEN 0 AND 90),
  caf_lead_time_days INT NOT NULL DEFAULT 15
    CONSTRAINT chk_caf_lead_time_days CHECK (caf_lead_time_days BETWEEN 1 AND 60),
  janela_consumo_dias INT NOT NULL DEFAULT 90
    CONSTRAINT chk_janela_consumo_dias CHECK (janela_consumo_dias IN (30, 60, 90, 180, 365)),
  notificar_email_vencimento BOOLEAN NOT NULL DEFAULT TRUE,
  notificar_email_ruptura BOOLEAN NOT NULL DEFAULT TRUE,
  atualizado_por_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela de Alertas de Estoque (RF022, RF023)
CREATE TABLE alertas_estoque (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  municipio_id UUID NOT NULL REFERENCES municipios(id) ON DELETE RESTRICT,
  ubs_id UUID NOT NULL REFERENCES unidades_saude(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  lote_id UUID REFERENCES lotes(id) ON DELETE CASCADE, -- Preenchido em alertas de vencimento; NULL em ruptura consolidada
  tipo_alerta tipo_alerta_estoque NOT NULL,
  severidade severidade_alerta_estoque NOT NULL,
  status status_alerta_estoque NOT NULL DEFAULT 'ATIVO',
  titulo VARCHAR(180) NOT NULL,
  descricao TEXT NOT NULL,
  saldo_atual INT NOT NULL,
  consumo_medio_diario NUMERIC(10, 4),
  cobertura_dias INT,
  dias_para_vencer INT,
  data_validade DATE,
  lido_por_id UUID REFERENCES users(id) ON DELETE SET NULL,
  lido_em TIMESTAMPTZ,
  resolvido_em TIMESTAMPTZ,
  motivo_resolucao VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice único parcial: impede duplicidade de alerta aberto para o mesmo produto/lote na UBS
CREATE UNIQUE INDEX idx_alerta_unico_nao_resolvido
  ON alertas_estoque (
    ubs_id,
    tipo_alerta,
    produto_id,
    COALESCE(lote_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE status IN ('ATIVO', 'LIDO');

CREATE INDEX idx_alertas_ubs_status_severidade
  ON alertas_estoque (ubs_id, status, severidade, created_at DESC);

-- 4. Tabela de Transactional Outbox (ADR-004)
CREATE TABLE outbox_events (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  municipio_id UUID NOT NULL REFERENCES municipios(id) ON DELETE RESTRICT,
  ubs_id UUID NOT NULL REFERENCES unidades_saude(id) ON DELETE CASCADE,
  aggregate_type VARCHAR(60) NOT NULL, -- Ex: 'ALERTA_ESTOQUE'
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(80) NOT NULL, -- Ex: 'ALERTA_CRITICO_DETECTADO'
  idempotency_key VARCHAR(160) NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  status status_outbox_event NOT NULL DEFAULT 'PENDENTE',
  tentativas SMALLINT NOT NULL DEFAULT 0,
  proxima_tentativa_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  erro_mensagem TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbox_pendentes
  ON outbox_events (status, proxima_tentativa_em ASC)
  WHERE status = 'PENDENTE';

-- 5. Políticas de Row-Level Security (RLS)
ALTER TABLE parametros_operacionais_ubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametros_operacionais_ubs FORCE ROW LEVEL SECURITY;

ALTER TABLE alertas_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_estoque FORCE ROW LEVEL SECURITY;

ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;

CREATE POLICY rls_parametros_operacionais_ubs ON parametros_operacionais_ubs
  FOR ALL USING (
    municipio_id = NULLIF(current_setting('app.municipio_id', true), '')::uuid
    AND ubs_id = NULLIF(current_setting('app.current_ubs_id', true), '')::uuid
  );

CREATE POLICY rls_alertas_estoque ON alertas_estoque
  FOR ALL USING (
    municipio_id = NULLIF(current_setting('app.municipio_id', true), '')::uuid
    AND ubs_id = NULLIF(current_setting('app.current_ubs_id', true), '')::uuid
  );

CREATE POLICY rls_outbox_events ON outbox_events
  FOR ALL USING (
    municipio_id = NULLIF(current_setting('app.municipio_id', true), '')::uuid
  );
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-033)

### Camada de Infraestrutura / Persistência (`apps/backend/src/modules/alertas/infrastructure/persistence/`)
- **`migrations/`**:
  - `apps/backend/src/database/migrations/<timestamp>-CreateAlertasParametrosOutboxSchema.ts`.
  - População inicial (*backfill*) de `parametros_operacionais_ubs` para todas as `unidades_saude` já cadastradas no banco, copiando o `caf_lead_time_days` existente.
  - Concessão de permissões DML (`GRANT SELECT, INSERT, UPDATE ON ... TO farmaubs_app`).
- **`entities/`**:
  - `parametro-operacional-ubs.entity.ts`
  - `alerta-estoque.entity.ts`
  - `outbox-event.entity.ts`

---

## 5. Cenários de teste em BDD (Gherkin — camada B)

```gherkin
# language: pt
Funcionalidade: Integridade e Isolamento RLS do Schema de Alertas e Outbox (Camada B)

  Cenário: Criação das tabelas e backfill automático de parâmetros para UBSs existentes
    Dado que existem Unidades Básicas de Saúde previamente cadastradas no banco
    Quando a migration do schema de alertas e outbox for executada
    Então as tabelas "parametros_operacionais_ubs", "alertas_estoque" e "outbox_events" devem existir
    E cada UBS existente deve possuir um registro padrão com limiar de vencimento de 90 dias e estoque de segurança de 7 dias

  Cenário: Bloqueio de alertas duplicados abertos para o mesmo lote na mesma UBS
    Dado que existe um alerta com status "ATIVO" do tipo "VENCIMENTO_PROXIMO" para o lote "LT-01" na UBS "A"
    Quando o sistema tentar inserir outro alerta "ATIVO" ou "LIDO" para o mesmo lote "LT-01" na UBS "A"
    Então o banco de dados deve rejeitar a duplicidade pelo índice "idx_alerta_unico_nao_resolvido"
    Mas deve permitir a inserção caso o alerta anterior esteja com status "RESOLVIDO"

  Cenário: Isolamento multi-tenant via Row-Level Security (RLS)
    Dado que existem alertas gravados na UBS "Jardim Primavera" e na UBS "Centro Parnaíba"
    Quando uma sessão autenticada configurar o contexto RLS para a UBS "Centro Parnaíba"
    Então a consulta na tabela "alertas_estoque" deve retornar exclusivamente os alertas da UBS "Centro Parnaíba"
```

---

## 6. Checklist de DoD e aceitação

- [ ] Migration implementada com métodos `up` e `down` reversíveis sem resíduos.
- [ ] *Backfill* automático criando parâmetros padrão para todas as UBSs já presentes no banco.
- [ ] Restrições `CHECK` validando limites mínimos e máximos dos parâmetros operacionais.
- [ ] Índice único parcial `idx_alerta_unico_nao_resolvido` e chave `idempotency_key` no Outbox testados.
- [ ] Testes de integração na Camada B validando o isolamento RLS entre UBSs e municípios distintos.
