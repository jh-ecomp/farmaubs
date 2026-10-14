# IN-04 feat(inventario): API de Homologação: Fechamento Atômico (ACID), Ajuste de Saldos, Geração de Ata Oficial e Exportação .xlsx

---

- **Épico**: Inventário Mensal (RF009, RF011, RF013, RF014, RF021, RF028, NF001, NF002, NF003, NF005, NF007, NF008, NF009, NF015)
- **Requisitos Funcionais**: RF013 (Realizar Inventário Mensal), RF014 (Consultar Histórico), RF021 (Gerar Relatório de Inventário Mensal), RF028 (Log de Auditoria e Ata)
- **Requisitos Não-Funcionais**: NF008 (Geração de Relatórios em até 30s), NF009 (RBAC Restrito), NF015 (Isolamento Multi-tenant via RLS)
- **ADRs Vinculadas**: ADR-002 / ADR-016 (Isolamento RLS por UBS), ADR-003 (Arquitetura Hexagonal), ADR-007 (Endpoints REST e Swagger), ADR-008 / ADR-015 (Transações Atômicas ACID com Lock Pessimista), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camadas A, B e C), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico responsável pela farmácia da UBS,  
> **quero** homologar formalmente o ciclo de inventário mensal através de uma transação segura que valide o saneamento de todas as divergências, ajuste atomicamente os saldos dos lotes no banco de dados, gere a Ata Oficial imutável com número sequencial e permita o download do relatório completo em planilha Excel (.xlsx) e PDF,  
> **para que** o estoque da unidade seja sincronizado com precisão matemática, gerando os documentos fiscais comprobatórios para assinatura da gerência e envio à CAF Central de Parnaíba (RF013, RF021, RF028).

---

## 2. Regras de negócio e casos de borda

1. **Validações Pré-Homologação Bloqueantes (RF013)**:
   - A requisição `POST /api/v1/inventario/ciclos/:id/homologar` realiza verificações prévias:
     1. O ciclo deve estar com status `EM_ANDAMENTO`;
     2. **Conferência Completa**: Nenhum item do ciclo pode estar com `quantidade_fisica IS NULL`. Caso contrário, retorna `422 (Unprocessable Entity)` com a lista de itens pendentes de contagem;
     3. **Justificativa de Divergências**: Nenhum item com $\text{divergencia} \neq 0$ pode estar com `motivo_divergencia` nulo ou justificativa vazia. Caso contrário, retorna `422 (Unprocessable Entity)` bloqueando a homologação.
2. **Transação Atômica de Ajuste de Saldos (ADR-008 / ACID)**:
   - Dentro de um `DataSource.transaction()` com lock exclusivo (`SELECT FOR UPDATE`) nos lotes da unidade:
     - Para cada item com $\text{divergencia} > 0$ (sobra):
       - Atualiza `lotes.saldo_atual = quantidade_fisica`;
       - Gera registro em `movimentacoes_estoque` do tipo `AJUSTE_ENTRADA_INVENTARIO`.
     - Para cada item com $\text{divergencia} < 0$ (falta/perda):
       - Atualiza `lotes.saldo_atual = quantidade_fisica`;
       - Gera registro em `movimentacoes_estoque` do tipo `AJUSTE_SAIDA_INVENTARIO`.
     - Atualiza `ciclos_inventario.status = 'HOMOLOGADO'`, registrando `homologado_em = NOW()` e `homologado_por_id`.
3. **Geração da Ata Oficial de Inventário (RF028)**:
   - Cria o registro em `atas_inventario` contendo:
     - Número sequencial único anual (ex.: `ATA-INV-2026/001`);
     - Totais apurados: total de itens conferidos, itens com divergência, unidades de sobra e unidades de falta;
     - Hash SHA-256 gerado a partir do payload de conciliação;
     - Termo formal de declaração sanitária do farmacêutico responsável.
4. **Exportação da Planilha Oficial (.xlsx) (RF021)**:
   - Rota dedicada: `GET /api/v1/inventario/ciclos/:id/exportar-xlsx`.
   - Gera planilha estruturada via biblioteca `ExcelJS` com cabeçalho oficial, dados da UBS, resumo e tabela completa de conferência.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs)

### Endpoints REST
- `POST /api/v1/inventario/ciclos/:id/homologar`: Homologação atômica do inventário.
- `GET /api/v1/inventario/ciclos/:id/ata`: Consulta da Ata Oficial gerada com hash SHA-256.
- `GET /api/v1/inventario/ciclos/:id/exportar-xlsx`: Download do relatório consolidado em Excel.

### DTOs TypeScript

```typescript
export interface HomologarInventarioResponseDto {
  cicloId: string;
  numeroCiclo: string;
  status: 'HOMOLOGADO';
  homologadoEm: string;
  ata: {
    id: string;
    numeroAta: string;
    hashIntegridade: string;
    totalItensConferidos: number;
    totalItensComDivergencia: number;
    totalUnidadesSobra: number;
    totalUnidadesFalta: number;
  };
}

export interface AtaInventarioDetalhadaResponseDto {
  numeroAta: string;
  dataEmissao: string;
  ubs: {
    nome: string;
    cnes: string;
    municipio: string;
  };
  farmaceuticoResponsavel: {
    nome: string;
    crf: string;
  };
  resumo: {
    totalItens: number;
    totalConformes: number;
    totalDivergentes: number;
    saldoFisicoTotal: number;
  };
  itensDivergentes: {
    medicamento: string;
    lote: string;
    fabricante: string;
    quantidadeTeorica: number;
    quantidadeFisica: number;
    divergencia: number;
    motivo: string;
    justificativa: string;
  }[];
  termoDeclaracao: string;
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

### 1. Pacote Compartilhado (`@farmaubs/shared`)
- **`src/contracts/inventario/homologacao.types.ts`**: `InventarioAtaOficialDTO`, `HomologarInventarioInputDTO`, `ResumoHomologacaoDTO` e schema Zod `homologarInventarioSchema`.
- **`src/domain/inventario/homologacao-helpers.ts`**: Função pura `verificarProntidaoHomologacao(itens)` que valida se todos os itens foram contados e se todas as divergências foram justificadas.

### 2. Camada de Aplicação (`apps/backend/src/modules/inventario/application/`)
- **Use Cases**:
  - `homologar-inventario.use-case.ts`: Executa a validação de prontidão de `@farmaubs/shared`, orquestra a transação atômica ACID via `UnitOfWorkPort` / `InventarioHomologacaoRepositoryPort`, gera a Ata Oficial com hash SHA-256 e encerra o ciclo.
  - `consultar-ata-oficial.use-case.ts`: Recupera os dados estruturados da Ata Oficial para exibição ou impressão.
  - `exportar-inventario-xlsx.use-case.ts`: Monta a planilha executiva oficial do ciclo via `GeradorPlanilhaInventarioPort`.

### 3. Camada de Domínio (`apps/backend/src/modules/inventario/domain/`)
- **Entidades de Domínio**: `CicloInventario`, `AtaInventario`, `Lote` e `MovimentacaoEstoque`.
- **Portas (Interfaces)**:
  - `inventario-homologacao.repository.port.ts`: Métodos de ajuste atômico de saldos e encerramento.
  - `ata-oficial.repository.port.ts`: Persistência e consulta da Ata Oficial.
  - `gerador-planilha-inventario.port.ts`: Interface agnóstica de planilha Excel.
  - `unit-of-work.port.ts`: Abstração de transação atômica.
- **Erros de Domínio**: `CicloComItensPendentesException`, `DivergenciaSemJustificativaException`, `CicloJaHomologadoException`.

### 4. Camada de Infraestrutura (`apps/backend/src/modules/inventario/infrastructure/`)
- **Adaptadores de Banco (`adapters/`)**:
  - `typeorm-inventario-homologacao.repository.ts` e `typeorm-ata-oficial.repository.ts`.
- **Adaptadores de Serviço (`services/`)**:
  - `exceljs-gerador-planilha-inventario.service.ts`: Geração e streaming do `.xlsx`.
- **Adaptadores de Entrada HTTP (`controllers/`)**:
  - `inventario-homologacao.controller.ts`: Endpoints `POST /:id/homologar`, `GET /:id/ata` e `GET /:id/exportar-xlsx`.

---

## 5. Cenários de teste em BDD (Gherkin — camada A, B e C)

```gherkin
# language: pt
Funcionalidade: Homologação de Inventário e Emissão de Ata Oficial (Camadas A, B e C)

  Cenário: Homologação bem-sucedida de ciclo com acerto de estoque e emissão de ata
    Dado que todos os 100 itens do ciclo "INV-2026/09" foram contados fisicamente
    E todas as 4 divergências identificadas possuem motivo e justificativa preenchidos
    Quando o farmacêutico enviar "POST /api/v1/inventario/ciclos/uuid-ciclo-123/homologar"
    Então a API deve retornar status 200 (OK)
    E o status do ciclo deve passar para "HOMOLOGADO"
    E os saldos dos 4 lotes divergentes devem ser atualizados exatamente para a contagem física
    E deve ser gerada a Ata Oficial "ATA-INV-2026/001" com hash de integridade SHA-256

  Cenário: Bloqueio de homologação caso existam itens pendentes de contagem
    Dado que o ciclo possui 100 itens mas apenas 95 foram contados
    Quando for tentada a homologação do ciclo
    Então a API deve recusar a operação com status 422 (Unprocessable Entity)
    E detalhar: "Não é possível homologar o inventário: existem 5 itens pendentes de contagem física"
    E nenhum saldo de lote deve ser modificado
```

---

## 6. Checklist de DoD e aceitação

- [ ] Caso de uso `HomologarInventarioUseCase` implementado com lock pessimista em transação TypeORM.
- [ ] Geração do número de Ata sequencial com trava de concorrência por tenant e ano.
- [ ] Exportação `.xlsx` estruturada com formatação profissional via ExcelJS.
- [ ] Testes unitários (Camada A) cobrindo bloqueios de divergência não justificada.
- [ ] Testes transacionais (Camada B) assegurando rollback total se houver erro no ajuste de qualquer lote.
- [ ] Testes E2E (Camada C) validando fluxo completo de homologação e download da planilha.
