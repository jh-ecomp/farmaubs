# RE-04 feat(recebimento): API de Histórico de Recebimentos: Listagem temporal (ontem/hoje padrão, range de datas), filtros, comprovante, estorno e exportação .xlsx

---

- **Épico**: Recebimento de Medicamentos (RF008, RF024, RF028, NF001, NF007, NF009, NF015)
- **Requisitos Funcionais**: RF008 (Registro de Entrada de Medicamentos), RF028 (Consulta de Histórico, Log de Auditoria, Estorno e Exportação de Dados)
- **Requisitos Não-Funcionais**: NF007 (Performance de Consultas < 2s e Geração Rápida de Planilha), NF009 (RBAC para Farmacêuticos e Gerentes), NF015 (Isolamento Multi-tenant por UBS via RLS)
- **ADRs Vinculadas**: ADR-002 / ADR-016 (Escopo por UBS e RLS), ADR-003 (Arquitetura Hexagonal), ADR-007 (Endpoints REST e Swagger), ADR-008 / ADR-015 (Estorno Transacional ACID), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camadas A e C), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico responsável ou gerente da farmácia da UBS,  
> **quero** consultar a listagem de recebimentos com visualização inicial padrão das entradas de ontem e hoje, filtrar por intervalos de datas arbitrários (range de datas), termo de busca e status, exportar os dados em planilha Excel (.xlsx), visualizar os dados completos para emissão do Termo de Recebimento de Carga SUS e poder realizar o estorno justificado de uma entrada incorreta,  
> **para que** eu possa auditar as cargas recebidas na unidade, conciliar as remessas entregues pela CAF, prestar contas à coordenação e reverter erros de lançamento com consistência estrita no estoque (RF008, RF028).

---

## 2. Regras de negócio e casos de borda

1. **Filtro Temporal Padrão: Ontem e Hoje (`D-1` e `D0`)**:
   - Quando os parâmetros `dataInicio` e `dataFim` forem omitidos na requisição de listagem:
     - `dataInicio` é assumido automaticamente como ontem às `00:00:00` (fuso local da UBS).
     - `dataFim` é assumido como hoje às `23:59:59`.
   - Essa regra atende à rotina operacional da farmácia de conferir o plantão anterior e o expediente atual sem sobrecarga desnecessária.
2. **Seletor de Range Customizado de Datas**:
   - O endpoint aceita `dataInicio` e `dataFim` no formato ISO `YYYY-MM-DD`.
   - Validações: `dataFim >= dataInicio`. O intervalo máximo permitido em uma única consulta ou exportação é de até 365 dias corridos.
3. **Filtros Combinados de Busca**:
   - `termo`: busca textual parcial pelo nome do medicamento, princípio ativo, número do lote ou número do documento fiscal/guia de remessa da CAF.
   - `fornecedor`: filtra pela origem da remessa (ex.: `CAF_CENTRAL`, `DLOG_MINISTERIO`, `SESAPI`, `COMPRA_DIRETA`, `DOACAO`).
   - `status`: filtra por `CONCLUIDO` ou `ESTORNADO`. Padrão: exibe todas.
4. **Exportação Estruturada em Planilha Excel (`.xlsx`)**:
   - Rota dedicada: `GET /api/v1/recebimento/entradas/exportar-xlsx`.
   - Retorna arquivo binário com `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
   - Cabeçalho `Content-Disposition`: `attachment; filename="recebimentos_ubs_<unidade>_<dataInicio>_<dataFim>.xlsx"`.
   - Respeita os mesmos filtros aplicados (datas, termo de busca, fornecedor e status).
5. **Consulta de Comprovante / Termo de Recebimento**:
   - Retorna os dados completos do documento, dados institucionais da UBS (Nome, CNES), dados do farmacêutico recebedor e a lista detalhada de itens com lotes, validades e quantidades para renderização e impressão do Termo Oficial de Carga SUS.
6. **Estorno de Recebimento com Reversão de Saldo (`POST /api/v1/recebimento/entradas/:id/estorno`)**:
   - Permitido apenas para documentos com status `CONCLUIDO` e vinculados à UBS do usuário autenticado.
   - Exige justificativa obrigatória com no mínimo 10 caracteres.
   - Execução sob transação atômica (ACID):
     - Para cada item da entrada, verifica se o lote possui `saldo_atual >= quantidadeRecebida`.
     - Caso qualquer lote não possua saldo suficiente (ex.: parte das unidades já foi dispensada a pacientes), a operação é cancelada e retorna status `422 (Unprocessable Entity)`.
     - Se todos os itens possuírem saldo suficiente, deduz o saldo dos lotes, altera o status do documento para `ESTORNADO`, registra a data/hora, o responsável e a movimentação `ESTORNO_ENTRADA` no log de auditoria.
7. **Prevenção de Duplo Estorno**:
   - Se o documento já estiver estornado, retorna `400 (Bad Request)` com mensagem explícita.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs)

### Endpoints REST
1. `GET /api/v1/recebimento/entradas`: Listagem paginada com filtro temporal padrão ontem/hoje, range e busca.
2. `GET /api/v1/recebimento/entradas/exportar-xlsx`: Geração e download do arquivo Excel (.xlsx) filtrado.
3. `GET /api/v1/recebimento/entradas/:id/comprovante`: Dados completos para emissão do Termo de Recebimento de Carga SUS.
4. `POST /api/v1/recebimento/entradas/:id/estorno`: Estorno atômico com dedução de estoque e justificativa obrigatória.

### DTOs TypeScript (com class-validator)

```typescript
export class ListarEntradasQueryDto {
  @IsOptional()
  @IsDateString()
  dataInicio?: string; // Formato YYYY-MM-DD. Se omitido, assume ontem 00:00:00

  @IsOptional()
  @IsDateString()
  dataFim?: string; // Formato YYYY-MM-DD. Se omitido, assume hoje 23:59:59

  @IsOptional()
  @IsString()
  termo?: string; // Busca por medicamento, lote ou número da guia

  @IsOptional()
  @IsEnum(['CAF_CENTRAL', 'DLOG_MINISTERIO', 'SESAPI', 'COMPRA_DIRETA', 'DOACAO'])
  fornecedor?: string;

  @IsOptional()
  @IsEnum(['CONCLUIDO', 'ESTORNADO'])
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  itensPorPagina?: number = 20;
}

export class ExportarEntradasXlsxQueryDto {
  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsString()
  termo?: string;

  @IsOptional()
  @IsEnum(['CAF_CENTRAL', 'DLOG_MINISTERIO', 'SESAPI', 'COMPRA_DIRETA', 'DOACAO'])
  fornecedor?: string;

  @IsOptional()
  @IsEnum(['CONCLUIDO', 'ESTORNADO'])
  status?: string;
}

export class EstornarEntradaDto {
  @IsString()
  @MinLength(10, { message: 'A justificativa do estorno deve conter ao menos 10 caracteres' })
  @MaxLength(500)
  justificativa: string;
}

export interface EntradaItemResumoDto {
  id: string;
  produtoNome: string;
  principioAtivo: string;
  fabricanteNome: string;
  numeroLote: string;
  dataValidade: string;
  quantidadeRecebida: number;
}

export interface ComprovanteRecebimentoResponseDto {
  documentoId: string;
  numeroDocumento: string;
  tipoDocumento: string;
  fornecedorOrigem: string;
  dataRecebimento: string;
  status: 'CONCLUIDO' | 'ESTORNADO';
  ubs: {
    id: string;
    nome: string;
    cnes: string;
  };
  usuarioRecebedor: {
    id: string;
    nome: string;
  };
  itens: EntradaItemResumoDto[];
  observacoes?: string;
  justificativaEstorno?: string;
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

### 1. Pacote Compartilhado (`@farmaubs/shared`)
- **`src/contracts/recebimento/historico.types.ts`**: `ListarEntradasQueryDto`, `ExportarEntradasXlsxQueryDto`, `EstornarEntradaDto`, `ComprovanteRecebimentoResponseDto`.
- **`src/domain/data-helpers.ts`**: Helper `obterIntervaloOntemHoje()` compartilhado entre backend, frontend e mobile.

### 2. Camada de Aplicação (`apps/backend/src/modules/recebimento/application/`)
- **Use Cases**:
  - `listar-recebimentos.use-case.ts`: Aplicação das datas default (`D-1` e `D0`), paginação e filtros compostos por UBS.
  - `exportar-recebimentos-xlsx.use-case.ts`: Consulta os dados via porta e orquestra a geração via serviço de exportação.
  - `obter-comprovante-recebimento.use-case.ts`: Busca os dados completos para emissão do Termo SUS.
  - `estornar-recebimento.use-case.ts`: Valida se o saldo atual do lote permite a reversão, executa estorno atômico e gera log de auditoria via `UnitOfWorkPort` / `RecebimentoRepositoryPort`.

### 3. Camada de Domínio (`apps/backend/src/modules/recebimento/domain/`)
- **Portas (Interfaces)**:
  - `historico-recebimento.repository.port.ts`: Contratos `listarFiltrado`, `buscarPorId` e `buscarParaExportacao`.
  - `gerador-planilha.port.ts`: Interface agnóstica de geração de planilhas Excel.
- **Erros de Domínio**:
  - `SaldoInsuficienteParaEstornoException`, `RecebimentoJaEstornadoException`.

### 4. Camada de Infraestrutura (`apps/backend/src/modules/recebimento/infrastructure/`)
- **Adaptadores de Banco (`adapters/`)**:
  - `typeorm-historico-recebimento.repository.ts`.
- **Adaptadores de Serviço (`services/`)**:
  - `exceljs-gerador-planilha.service.ts`: Geração e streaming do arquivo binário `.xlsx`.
- **Adaptadores de Entrada HTTP (`controllers/`)**:
  - `recebimento-historico.controller.ts`: Endpoints `GET /`, `GET /exportar-xlsx`, `GET /:id/comprovante` e `POST /:id/estorno`.

---

## 5. Cenários de teste em BDD (Gherkin — camada A e C)

```gherkin
# language: pt
Funcionalidade: Histórico de Recebimentos, Exportação XLSX e Estorno (Camadas A e C)

  Cenário: Listagem padrão inicial trazendo entradas de ontem e hoje
    Dado que o farmacêutico está autenticado na sua UBS
    E existem recebimentos registrados: 2 hoje, 1 ontem e 3 há 15 dias atrás
    Quando ele consultar "GET /api/v1/recebimento/entradas" sem informar datas
    Então a API deve retornar status 200 (OK)
    E o payload deve conter apenas os 3 recebimentos registrados entre ontem (00:00:00) e hoje (23:59:59)
    E deve indicar a faixa temporal aplicada (dataInicio de ontem e dataFim de hoje)

  Cenário: Consulta com range customizado de datas e busca textual
    Dado que o farmacêutico deseja consultar remessas do mês anterior
    Quando ele consultar "GET /api/v1/recebimento/entradas?dataInicio=2026-08-01&dataFim=2026-08-31&termo=LT-2027M9"
    Então a API deve retornar status 200 (OK)
    E a listagem deve conter apenas entradas realizadas em agosto de 2026 cujos itens contenham o lote "LT-2027M9"

  Cenário: Exportação do histórico de recebimentos em planilha Excel (.xlsx)
    Dado que o usuário aplicou o filtro de datas de "2026-09-01" até "2026-09-30"
    Quando ele requisitar "GET /api/v1/recebimento/entradas/exportar-xlsx?dataInicio=2026-09-01&dataFim=2026-09-30"
    Então a API deve retornar status 200 (OK)
    E o cabeçalho "Content-Type" deve ser "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    E o cabeçalho "Content-Disposition" deve conter "attachment; filename=\"recebimentos_ubs_"
    E o arquivo baixado deve conter a listagem estruturada das entradas do período com colunas de guia, medicamento, fabricante, lote, validade e quantidade

  Cenário: Consulta de dados para o Termo de Recebimento de Carga
    Dado que uma entrada existe com ID "entrada-uuid-123"
    Quando o usuário requisitar "GET /api/v1/recebimento/entradas/entrada-uuid-123/comprovante"
    Então a API deve retornar status 200 (OK)
    E o payload deve conter os dados da UBS (nome, CNES), dados da guia (número, fornecedor), recebedor e lista completa de medicamentos com fabricantes, lotes, validades e quantidades

  Cenário: Estorno bem-sucedido de entrada com reversão de estoque
    Dado que uma entrada de 100 unidades do lote "LT-TESTE" foi registrada hoje
    E o saldo atual do lote na UBS é de 100 unidades
    Quando o farmacêutico enviar "POST /api/v1/recebimento/entradas/:id/estorno" com:
      | justificativa | Lote conferido com divergência física de fabricante |
    Então a API deve retornar status 200 (OK)
    E o status do documento de entrada deve ser alterado para "ESTORNADO"
    E o saldo do lote "LT-TESTE" deve ser deduzido em 100 unidades (saldo final 0)
    E deve ser registrada uma movimentação de estoque "ESTORNO_ENTRADA" com a justificativa

  Cenário: Bloqueio de estorno caso parte do lote já tenha sido dispensada (saldo insuficiente)
    Dado que uma entrada de 100 unidades foi registrada
    Mas 60 unidades desse lote já foram dispensadas, restando saldo de 40 unidades
    Quando for requisitado o estorno da entrada original de 100 unidades
    Então a API deve retornar status 422 (Unprocessable Entity)
    E informar erro: "Não é possível estornar a entrada: saldo atual do lote (40) é inferior à quantidade a ser revertida (100)"
    E nenhum saldo deve ser alterado no banco
```

---

## 6. Checklist de DoD e aceitação

- [ ] Endpoint de listagem implementado com filtro padrão ontem/hoje e suporte a range arbitrário de datas.
- [ ] Endpoint de exportação `.xlsx` implementado com cabeçalhos apropriados e formatação tabular limpa via biblioteca ExcelJS.
- [ ] Endpoint de comprovante oficial retornando dados completos para impressão do Termo SUS.
- [ ] Endpoint de estorno implementado com lock pessimista, validação de saldo remanescente e rollback em caso de falha.
- [ ] Testes unitários (Camada A) cobrindo regras de range de datas, cálculo de saldo remanescente e validação de justificativa.
- [ ] Testes E2E (Camada C) cobrindo listagem com filtros temporais, download do XLSX e fluxo completo de estorno.
