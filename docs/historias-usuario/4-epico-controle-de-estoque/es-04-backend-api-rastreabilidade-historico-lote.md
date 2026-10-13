# ES-04: API de Rastreabilidade: Histórico Cronológico e Linha do Tempo de Movimentações por Lote

---

- **Épico**: Controle de Estoque (RF005, RF006, RF007, RF009, RF011, RF018, RF020, RF022, RF023, RF028, NF001, NF002, NF003, NF007, NF009, NF015)
- **Requisitos Funcionais**: RF028 (Consultar Log de Auditoria e Rastreabilidade Operacional)
- **Requisitos Não-Funcionais**: NF007 (Performance de Resposta < 500ms), NF009 (RBAC de Consulta), NF015 (Isolamento Multi-tenant via RLS)
- **ADRs Vinculadas**: ADR-002 / ADR-016 (Isolamento RLS por UBS), ADR-003 (Arquitetura Hexagonal), ADR-007 (Endpoints REST e Swagger), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camadas A e C), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de Usuário

> **Como** farmacêutico responsável ou gerente de saúde da UBS,  
> **quero** consultar a linha do tempo cronológica completa e imutável de todas as movimentações ocorridas em um lote específico de medicamento,  
> **para que** eu possa auditar desvios de estoque, responder a diligências e inspeções sanitárias da Anvisa e fiscalizar cada entrada, dispensa ou ajuste manual com identificação do operador responsável e documento de suporte (RF028).

---

## 2. Regras de Negócio e Casos de Borda

1. **Dados de Cabeçalho do Lote**:
   - Identificação do produto: Nome comercial, princípio ativo, forma farmacêutica, concentração e código RENAME/REMUME.
   - Dados do lote: Código do lote, fabricante/laboratório, data de validade, data de cadastro na UBS, saldo inicial recebido e saldo físico atual.

2. **Cronologia Ordenada de Eventos de Estoque**:
   - Ordenação cronológica estrita (da movimentação mais recente para a mais antiga ou vice-versa, com suporte a filtro).
   - Eventos suportados na linha do tempo:
     - `ENTRADA_RECEBIMENTO`: Recebimento de remessa da CAF ou compra (vinculado ao número da guia/NF);
     - `SAIDA_DISPENSACAO`: Saída por atendimento ao paciente (vinculado ao identificador do paciente/atendimento);
     - `AJUSTE_ENTRADA`: Ajuste positivo manual com motivo e justificativa;
     - `AJUSTE_SAIDA`: Ajuste negativo manual (vencimento, avaria, perda);
     - `ESTORNO_ENTRADA`: Reversão de recebimento cancelado;
     - `ESTORNO_DISPENSACAO`: Reversão de dispensa estornada com restituição ao lote.

3. **Conciliação Matemática**:
   - Cada evento da lista exibe a `quantidade`, a `operacao` (`+` ou `-`) e o `saldoResultante` calculado no momento exato da movimentação, assegurando que o histórico não apresente descontinuidades numéricas.

---

## 3. Escopo Técnico & Arquitetural (Clean Architecture — ADR-034)

### 1. Pacote Compartilhado (`@farmaubs/shared`)
- **`src/contracts/estoque/rastreabilidade.types.ts`**: `RastreabilidadeLoteDto`, `MovimentacaoLoteItemDto` e enum `TipoMovimentacaoEstoque`.

### 2. Camada de Aplicação (`apps/backend/src/modules/estoque/application/`)
- **Use Cases**:
  - `consultar-rastreabilidade-lote.use-case.ts`: Consulta os dados cadastrais do lote e enriquece a linha do tempo cronológica com cálculos de saldo resultante por movimentação.

### 3. Camada de Domínio (`apps/backend/src/modules/estoque/domain/`)
- **Portas (Interfaces)**:
  - `estoque-rastreabilidade.repository.port.ts`: Contrato `buscarLinhaDoTempoLote(loteId: string, ubsId: string)`.

### 4. Camada de Infraestrutura (`apps/backend/src/modules/estoque/infrastructure/`)
- **Adaptadores de Banco (`adapters/`)**:
  - `typeorm-estoque-rastreabilidade.repository.ts`: Query combinada indexada na tabela `movimentacoes_estoque` ordenada por timestamp.
- **Adaptadores de Entrada HTTP (`controllers/`)**:
  - `estoque-rastreabilidade.controller.ts`: Endpoint `GET /api/v1/estoque/lotes/:loteId/rastreabilidade`.

---

## 4. Critérios de Aceite (Gherkin BDD)

### Cenário 1: Consulta da linha do tempo do lote com múltiplos tipos de evento
```gherkin
Dado que o farmacêutico está autenticado na UBS
E o lote "LT-PARACETAMOL-123" teve:
  - 1 entrada de 500 comprimidos (Guia CAF-2026/089)
  - 1 dispensa de 30 comprimidos
  - 1 ajuste de saída de 10 comprimidos por quebra
Quando ele consultar "GET /api/v1/estoque/lotes/uuid-lote-123/rastreabilidade"
Então a API deve retornar status 200 (OK)
E o payload deve conter o saldo atual de 460 comprimidos
E a lista de movimentações deve conter exatamente os 3 eventos ordenados por data
E cada evento deve conter o nome do usuário responsável, quantidade e documento de referência
```

### Cenário 2: Tentativa de acesso a lote pertencente a outra UBS
```gherkin
Dado que o lote "uuid-outro-tenant" pertence à "UBS Ilha Grande"
Quando o farmacêutico logado na "UBS Central" tentar consultar a sua rastreabilidade
Então a API deve retornar status 404 (Not Found)
E nenhuma informação sobre o lote deve ser exposta
```

---

## 5. Contratos de Dados (DTOs TypeScript)

```typescript
export interface MovimentacaoLoteTimelineDto {
  id: string;
  dataHora: string; // ISO 8601
  tipoMovimentacao:
    | 'ENTRADA_RECEBIMENTO'
    | 'SAIDA_DISPENSACAO'
    | 'AJUSTE_ENTRADA'
    | 'AJUSTE_SAIDA'
    | 'ESTORNO_ENTRADA'
    | 'ESTORNO_DISPENSACAO';
  operacao: '+' | '-';
  quantidade: number;
  saldoResultante: number;
  documentoReferencia?: string;
  motivo?: string;
  justificativa?: string;
  usuarioResponsavel: {
    id: string;
    nome: string;
  };
}

export interface RastreabilidadeLoteResponseDto {
  lote: {
    id: string;
    numeroLote: string;
    dataValidade: string;
    saldoAtual: number;
    fabricanteNome: string;
  };
  medicamento: {
    id: string;
    nome: string;
    principioAtivo: string;
    apresentacao: string;
    codigoRename?: string;
  };
  movimentacoes: MovimentacaoLoteTimelineDto[];
}
```

---

## 6. Definition of Done (DoD)

- [ ] Endpoint implementado com query otimizada sobre a tabela `movimentacoes_estoque`.
- [ ] Testes unitários (Camada A) validando ordem cronológica e conferência de saldo resultante.
- [ ] Testes E2E (Camada C) validando isolamento por RLS e formatação dos eventos de auditoria.
