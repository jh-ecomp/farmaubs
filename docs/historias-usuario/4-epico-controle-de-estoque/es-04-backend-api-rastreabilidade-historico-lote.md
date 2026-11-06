# ES-04 feat(estoque): API de Rastreabilidade: Histórico Cronológico e Linha do Tempo de Movimentações por Lote

---

- **Épico**: Controle de Estoque (RF005, RF006, RF007, RF009, RF011, RF018, RF020, RF022, RF023, RF028, NF001, NF002, NF003, NF007, NF009, NF015)
- **Requisitos Funcionais**: RF028 (Consultar Log de Auditoria e Rastreabilidade Operacional)
- **Requisitos Não-Funcionais**: NF007 (Performance de Resposta < 500ms), NF009 (RBAC de Consulta: Farmacêutico Responsável, Farmacêutico Residente, Gerente), NF015 (Isolamento Multi-tenant via RLS por município `app.municipio_id` e segregação por UBS via filtro explícito `ubs_id = ANY($2::uuid[])`)
- **ADRs Vinculadas**: ADR-002 / ADR-016 (Isolamento RLS por Município e segregação por UBS), ADR-003 (Arquitetura Hexagonal), ADR-007 (Endpoints REST e Swagger), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camadas A, B e E2E), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico responsável, farmacêutico residente ou gerente de saúde da UBS,  
> **quero** consultar a linha do tempo cronológica completa e imutável de todas as movimentações ocorridas em um lote específico de medicamento,  
> **para que** eu possa auditar desvios de estoque, responder a diligências e inspeções sanitárias da Anvisa e fiscalizar cada entrada, dispensa ou ajuste manual com identificação do operador responsável e documento de suporte (RF028).

---

## 2. Regras de negócio e casos de borda

1. **Dados de Cabeçalho do Lote**:
   - Identificação do produto: Nome comercial, princípio ativo, apresentação, forma farmacêutica, concentração e código CATMAT e ATC.
   - Dados do lote: Código do lote, fabricante/laboratório, data de validade, data de cadastro na UBS (`dataCadastro`), saldo inicial recebido (`saldoInicial`) e saldo físico atual (`saldoAtual`).
2. **Cronologia Ordenada de Eventos de Estoque**:
   - Ordenação cronológica estrita das movimentações (ordem do banco e conciliação por cadeia de saldos entre eventos de mesmo timestamp).
   - Eventos suportados:
     - `ENTRADA_RECEBIMENTO`: Recebimento de remessa da CAF ou compra (vinculado ao número da guia/NF);
     - `SAIDA_DISPENSACAO`: Saída por atendimento ao paciente;
     - `AJUSTE_ENTRADA`: Ajuste positivo manual com motivo e justificativa;
     - `AJUSTE_SAIDA`: Ajuste negativo manual (vencimento, avaria, perda);
     - `ESTORNO_ENTRADA`: Reversão de recebimento cancelado;
     - `ESTORNO_DISPENSACAO`: Reversão de dispensa estornada com restituição ao lote.
3. **Conciliação Matemática**:
   - Cada evento da lista exibe a `quantidade`, a `operacao` (`+` ou `-`) e o `saldoResultante` calculado no momento exato da movimentação.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs)

### Endpoints REST
- `GET /api/v1/estoque/lotes/:loteId/rastreabilidade`: Linha do tempo e histórico completo de movimentações do lote.

### DTOs TypeScript (`@farmaubs/shared`)

```typescript
export const TIPOS_MOVIMENTACAO_ESTOQUE = [
  "ENTRADA_RECEBIMENTO",
  "SAIDA_DISPENSACAO",
  "AJUSTE_ENTRADA",
  "AJUSTE_SAIDA",
  "ESTORNO_ENTRADA",
  "ESTORNO_DISPENSACAO",
] as const;

export type TipoMovimentacaoEstoque = (typeof TIPOS_MOVIMENTACAO_ESTOQUE)[number];

export interface MovimentacaoLoteItemDto {
  id: string;
  dataHora: string; // ISO 8601
  tipoMovimentacao: TipoMovimentacaoEstoque;
  operacao: "+" | "-";
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

export interface RastreabilidadeLoteDto {
  lote: {
    id: string;
    numeroLote: string;
    dataValidade: string;
    dataCadastro: string;
    saldoAtual: number;
    saldoInicial: number;
    fabricanteNome: string;
  };
  medicamento: {
    id: string;
    nome: string;
    principioAtivo: string;
    apresentacao: string;
    codigoCatmat?: string;
    codigoAtc?: string;
    formaFarmaceutica?: string;
    concentracao?: string;
  };
  movimentacoes: MovimentacaoLoteItemDto[];
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

### 1. Pacote Compartilhado (`@farmaubs/shared`)
- **`src/estoque/rastreabilidade.types.ts`**: `RastreabilidadeLoteDto`, `MovimentacaoLoteItemDto` e tipo `TipoMovimentacaoEstoque`.

### 2. Camada de Aplicação (`apps/backend/src/modules/estoque/application/`)
- **Use Cases**:
  - `consultar-rastreabilidade-lote.use-case.ts`: Consulta os dados cadastrais do lote e enriquece a linha do tempo cronológica com cálculos de saldo resultante por movimentação via `ordenarPorCadeia`, `conciliarCadeia` e `traduzirTipo`.

### 3. Camada de Domínio (`apps/backend/src/modules/estoque/domain/`)
- **Portas (Interfaces)**:
  - `estoque-rastreabilidade.repository.port.ts`: Contrato `buscarLinhaDoTempoLote(loteId: string, unidadeIds: string[]): Promise<RastreabilidadeLoteBruta | null>`.

### 4. Camada de Infraestrutura (`apps/backend/src/modules/estoque/infrastructure/`)
- **Adaptadores de Banco (`adapters/`)**:
  - `estoque-rastreabilidade-pg.repository.ts`: Query combinada sobre as tabelas `lotes`, `produtos`, `fabricantes` e `movimentacoes_estoque`, filtrando por `ubs_id = ANY($2::uuid[])` sob RLS de município (`app.municipio_id`).
- **Adaptadores de Entrada HTTP (`api/controllers/`)**:
  - `estoque-rastreabilidade.controller.ts`: Endpoint `GET /api/v1/estoque/lotes/:loteId/rastreabilidade`.

---

## 5. Cenários de teste em BDD (Gherkin)

```gherkin
# language: pt
Funcionalidade: Rastreabilidade e Linha do Tempo do Lote

  Cenário: Consulta da linha do tempo do lote com múltiplos tipos de evento
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

  Cenário: Tentativa de acesso a lote pertencente a outra UBS do mesmo município
    Dado que o lote "uuid-outro-tenant" pertence à "UBS Ilha Grande"
    Quando o farmacêutico logado na "UBS Central" tentar consultar a sua rastreabilidade
    Então a API deve retornar status 404 (Not Found)
    E nenhuma informação sobre o lote deve ser exposta
```

---

## 6. Checklist de DoD e aceitação

- [ ] Endpoint implementado com query otimizada sobre a tabela `movimentacoes_estoque`.
- [ ] Testes unitários (Camada A) validando ordem cronológica (`ordenarPorCadeia`), tradução de tipos (`traduzirTipo`), conciliação de saldos (`conciliarCadeia`) e cálculo de `saldoInicial`.
- [ ] Testes de integração (Camada B) contra PostgreSQL real com RLS (`farmaubs_app`), validando integridade do cabeçalho, isolamento por município e filtro por `unidadeIds`.
- [ ] Testes E2E validando fluxo HTTP completo, autenticação RBAC com os 3 perfis e resposta 404 entre UBSs do mesmo município.
