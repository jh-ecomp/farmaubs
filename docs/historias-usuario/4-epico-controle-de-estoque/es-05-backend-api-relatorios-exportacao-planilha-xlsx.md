# ES-05: API de Relatórios: Geração e Download de Planilha Excel (.xlsx) por Período, Princípio Ativo e Perdas

---

- **Épico**: Controle de Estoque (RF005, RF006, RF007, RF009, RF011, RF018, RF020, RF022, RF023, RF028, NF001, NF002, NF003, NF007, NF009, NF015)
- **Requisitos Funcionais**: RF020 (Gerar Relatório de Perdas por Vencimento), RF028 (Exportação de Dados e Log de Auditoria em Planilha)
- **Requisitos Não-Funcionais**: NF003 (Padrão Nacional de Datas e Números), NF007 (Download Rápido de Planilha), NF015 (Isolamento Multi-tenant via RLS)
- **ADRs Vinculadas**: ADR-002 / ADR-016 (Isolamento RLS por UBS), ADR-003 (Arquitetura Hexagonal), ADR-007 (Endpoints REST e Swagger), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camadas A e C), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de Usuário

> **Como** farmacêutico responsável ou gerente de farmácia da UBS,  
> **quero** um endpoint dedicado para gerar e baixar relatórios estruturados de estoque em formato de planilha Excel (.xlsx), filtrados por tipo de relatório (saldos atuais, perdas por vencimento ou movimentações), intervalo customizado de datas e princípio ativo,  
> **para que** eu possa conciliar inventários físicos, subsidiar a elaboração do pedido mensal de reposição enviado à CAF e prestar contas sobre descartes à coordenação da atenção básica (RF020, RF028).

---

## 2. Regras de Negócio e Casos de Borda

1. **Tipos de Relatório Suportados (`tipoRelatorio`)**:
   - `SALDOS_ATUAIS`: Fotografia em tempo real de todos os medicamentos com seus saldos por lote, fabricantes, validades e status de cobertura na UBS.
   - `PERDAS_VENCIMENTO` (RF020): Consolidação detalhada de todas as baixas e descartes por validade expirada ou avaria física no intervalo de datas informado, com lotes, quantidades e justificativas.
   - `MOVIMENTACOES_PERIODO`: Extrato cronológico de todas as entradas, dispensas e ajustes realizados na unidade dentro do período selecionado.

2. **Parâmetros e Validações Temporais**:
   - `dataInicio` e `dataFim` no formato ISO `YYYY-MM-DD`.
   - Validações: `dataFim >= dataInicio`. Intervalo máximo permitido: 365 dias corridos.
   - Caso `dataInicio` e `dataFim` sejam omitidos no relatório de movimentações ou perdas, assume-se por padrão os últimos 30 dias corridos.

3. **Formatação Profissional da Planilha (ExcelJS)**:
   - Formato binário: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
   - Nome do arquivo no cabeçalho `Content-Disposition`:
     `relatorio_estoque_<tipoRelatorio>_<ubsId>_<dataInicio>_<dataFim>.xlsx`.
   - Estilização corporativa do FarmaUBS:
     - Cabeçalho institucional com nome da UBS, CNES, município de Parnaíba e data de emissão;
     - Linha de títulos das colunas com fundo azul SUS (#005BA6), texto branco e negrito;
     - Células de data formatadas como `DD/MM/AAAA`;
     - Células numéricas alinhadas à direita com formatação de inteiros;
     - Largura automática ajustada ao conteúdo das colunas.

---

## 3. Escopo Técnico & Arquitetural (Clean Architecture — ADR-034)

### 1. Pacote Compartilhado (`@farmaubs/shared`)
- **`src/contracts/estoque/relatorios.types.ts`**: `ExportarRelatorioEstoqueQueryDto`, enum `TipoRelatorioEstoque` e schema Zod `exportarRelatorioEstoqueSchema`.

### 2. Camada de Aplicação (`apps/backend/src/modules/estoque/application/`)
- **Use Cases**:
  - `gerar-relatorio-estoque-xlsx.use-case.ts`: Consulta os registros correspondentes ao tipo solicitado via porta, orquestra a geração do arquivo através de `GeradorPlanilhaEstoquePort` e devolve o buffer binário com metadados de cabeçalho HTTP.

### 3. Camada de Domínio (`apps/backend/src/modules/estoque/domain/`)
- **Portas (Interfaces)**:
  - `estoque-relatorios.repository.port.ts`: Contrato `consultarDadosParaRelatorio(ubsId, tipo, range, produtoId)`.
  - `gerador-planilha-estoque.port.ts`: Interface agnóstica para geração da planilha Excel.

### 4. Camada de Infraestrutura (`apps/backend/src/modules/estoque/infrastructure/`)
- **Adaptadores de Banco (`adapters/`)**:
  - `typeorm-estoque-relatorios.repository.ts`.
- **Adaptadores de Serviço (`services/`)**:
  - `exceljs-gerador-planilha-estoque.service.ts`: Implementa `GeradorPlanilhaEstoquePort` com formatação temática institucional e auto-largura.
- **Adaptadores de Entrada HTTP (`controllers/`)**:
  - `estoque-relatorios.controller.ts`: Endpoint `GET /api/v1/estoque/relatorios/exportar-xlsx` com streaming de buffer.

---

## 4. Critérios de Aceite (Gherkin BDD)

### Cenário 1: Download de relatório de saldos atuais em planilha Excel
```gherkin
Dado que o farmacêutico está autenticado na sua UBS
Quando ele requisitar "GET /api/v1/estoque/relatorios/exportar-xlsx?tipoRelatorio=SALDOS_ATUAIS"
Então a API deve retornar status 200 (OK)
E o cabeçalho "Content-Type" deve ser "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
E o cabeçalho "Content-Disposition" deve conter "attachment; filename=\"relatorio_estoque_SALDOS_ATUAIS_"
E a planilha gerada deve conter colunas de: Medicamento, Princípio Ativo, Fabricante, Lote, Validade, Saldo e Status
```

### Cenário 2: Download de relatório de perdas por vencimento com intervalo de datas
```gherkin
Dado que foram descartadas 150 unidades por vencimento no mês de agosto de 2026
Quando o usuário requisitar "GET /api/v1/estoque/relatorios/exportar-xlsx?tipoRelatorio=PERDAS_VENCIMENTO&dataInicio=2026-08-01&dataFim=2026-08-31"
Então a API deve retornar status 200 (OK)
E o arquivo baixado deve listar apenas as baixas por motivo de perda ocorridas em agosto de 2026
E deve totalizar na última linha a quantidade consolidada de itens perdidos
```

---

## 5. Contratos de Dados (DTOs TypeScript)

```typescript
export class ExportarRelatorioEstoqueQueryDto {
  @IsEnum(['SALDOS_ATUAIS', 'PERDAS_VENCIMENTO', 'MOVIMENTACOES_PERIODO'])
  tipoRelatorio: 'SALDOS_ATUAIS' | 'PERDAS_VENCIMENTO' | 'MOVIMENTACOES_PERIODO';

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsString()
  principioAtivo?: string;

  @IsOptional()
  @IsString()
  categoria?: string;
}
```

---

## 6. Definition of Done (DoD)

- [ ] Serviço de exportação implementado com streaming seguro via biblioteca `ExcelJS`.
- [ ] Suporte aos três tipos de relatórios com metadados institucionais da UBS no cabeçalho.
- [ ] Testes unitários (Camada A) validando formatação de células, cálculo de totais e filtros de datas.
- [ ] Testes E2E (Camada C) validando download de stream binário e garantia de RLS por tenant.
