# DI-05 feat(dispensacao): API de Histórico: Listagem temporal (ontem/hoje padrão, range de datas), filtros e exportação .xlsx

---

- **Épico**: Dispensação de Medicamentos (RF012, RF028, NF009, NF010)
- **Requisitos Funcionais**: RF012 (Consulta de Histórico com Filtros e Exportação), RF028 (Estorno de Atendimento)
- **Requisitos Não-Funcionais**: NF009 (RBAC de Visualização para Farmacêuticos e Gerentes), NF010 (Resposta e Geração Ágil de Planilha)
- **ADRs Vinculadas**: ADR-002 (Escopo por UBS), ADR-003 (Arquitetura Hexagonal), ADR-007 (Endpoints REST), ADR-015 (Estorno Transacional), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camadas A e C), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico ou gerente da UBS,  
> **quero** listar as dispensações realizadas na minha unidade com visualização inicial padrão das saídas de ontem e hoje, filtrar por intervalos de datas arbitrários, paciente, categoria ou medicamento, exportar a consulta em planilha Excel (.xlsx) e poder realizar o estorno de um atendimento caso necessário,  
> **para que** eu possa auditar os atendimentos recentes da farmácia, gerar relatórios de apoio ao planejamento do pedido mensal e reverter saídas incorretas com restituição automática do lote ao estoque (RF012, RF028).

---

## 2. Regras de negócio e casos de borda

1. **Filtro Temporal Padrão: Ontem e Hoje (`D-1` e `D0`)**:
   - Quando os parâmetros `dataInicio` e `dataFim` forem omitidos na requisição de listagem:
     - `dataInicio` é assumido automaticamente como ontem às `00:00:00` (fuso local da UBS).
     - `dataFim` é assumido como hoje às `23:59:59`.
   - Essa regra atende à necessidade operacional da farmácia de auditar imediatamente o plantão anterior e o expediente atual sem sobrecarregar a listagem com dados históricos antigos.

2. **Seletor de Range Customizado de Datas**:
   - O usuário pode enviar `dataInicio` e `dataFim` (formato ISO `YYYY-MM-DD`).
   - Validações: `dataFim >= dataInicio`. O intervalo máximo permitido em uma única consulta ou exportação é de até 365 dias corridos.

3. **Filtros Combinados de Busca**:
   - `pacienteTermo`: busca parcial por nome, CPF ou CNS do paciente atendido.
   - `medicamentoTermo`: busca parcial pelo nome ou princípio ativo do medicamento dispensado.
   - `categoria`: filtra pela categoria clínica/farmacêutica (ex.: "Hipertensão", "Diabetes", "Antimicrobianos").
   - `status`: filtra por `concluida` ou `estornada`. Padrão: exibe todas.

4. **Exportação Estruturada em Planilha Excel (`.xlsx`)**:
   - Endpoint dedicado que retorna um binário com `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
   - Nome do arquivo sugerido no cabeçalho `Content-Disposition`: `dispensacoes_ubs_<unidade>_<dataInicio>_<dataFim>.xlsx`.
   - Colunas obrigatórias na planilha:
     1. Data/Hora do Atendimento
     2. Paciente (Nome Completo)
     3. CPF do Paciente (Formatado)
     4. Cartão SUS (CNS)
     5. Medicamento / Apresentação
     6. Categoria
     7. Lote Dispensado
     8. Data de Validade do Lote
     9. Quantidade Dispensada
     10. Posologia
     11. Farmacêutico Dispensador
     12. Status do Atendimento

5. **Estorno de Dispensação (`POST /api/v1/dispensacoes/:id/estorno`)**:
   - Permitido apenas para dispensações com status `concluida` e realizadas no mesmo município/UBS do usuário.
   - Motivo obrigatório (`motivoEstorno` com mínimo de 10 caracteres).
   - Execução transacional (ACID):
     - Atualiza status para `estornada`, preenche `estornado_em`, `motivo_estorno` e `estornado_por_id`.
     - Incrementa o saldo dos respectivos lotes físicos com a quantidade devolvida.
     - Registra movimentação de estorno em `movimentacoes_estoque` com tipo `ENTRADA_ESTORNO_DISPENSACAO`.

---

## 3. Contratos de dados e protocolo HTTP

### Endpoints REST (`HistoricoDispensacaoController`)

| Método | Rota | Descrição | Roles Permitidos |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/dispensacoes` | Listagem paginada de dispensas com filtros temporais | `FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `GERENTE`, `ADMINISTRADOR` |
| `GET` | `/api/v1/dispensacoes/exportar-xlsx` | Download de planilha Excel (.xlsx) das dispensas filtradas | `FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `GERENTE`, `ADMINISTRADOR` |
| `POST` | `/api/v1/dispensacoes/:id/estorno` | Estorna um atendimento e devolve os itens ao estoque | `FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `ADMINISTRADOR` |

### Contratos no `@farmaubs/shared` (`packages/shared/src/dispensacao/historico.types.ts`)

```typescript
export interface ListarDispensacoesQuery {
  pagina?: number;
  limite?: number;
  dataInicio?: string; // YYYY-MM-DD (Default: ontem)
  dataFim?: string;    // YYYY-MM-DD (Default: hoje)
  pacienteTermo?: string;
  medicamentoTermo?: string;
  categoria?: string;
  status?: "concluida" | "estornada";
}

export interface DispensacaoItemListaDto {
  id: string;
  numeroAtendimento: string;
  dataAtendimento: string | Date;
  status: "concluida" | "estornada";
  pacienteNome: string;
  pacienteCpf: string;
  pacienteCns: string;
  dispensadorNome: string;
  totalItens: number;
  medicamentosResumo: string; // Ex: "Dipirona 500mg (20), Paracetamol (10)"
}

export interface DispensacoesPaginadasResultado {
  itens: DispensacaoItemListaDto[];
  totalItens: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
  dataInicioEfetiva: string;
  dataFimEfetiva: string;
}

export interface EstornarDispensacaoRequest {
  motivoEstorno: string;
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

### 1. Pacote Compartilhado (`@farmaubs/shared`)
- **`src/contracts/dispensacao/historico.types.ts`**: Tipos de listagem, paginação, filtros e payload de estorno (`EstornarDispensacaoRequest`, `DispensacaoListItemDto`).
- **`src/domain/data-helpers.ts`**: Helper de datas padrão `obterIntervaloOntemHoje()` compartilhado entre backend, frontend e mobile.

### 2. Camada de Aplicação (`apps/backend/src/modules/dispensacao/application/`)
- **Use Cases**:
  - `listar-dispensacoes.use-case.ts`: Aplicação das datas default (`D-1` e `D0`), paginação e filtros compostos por UBS.
  - `exportar-dispensacoes-xlsx.use-case.ts`: Consulta os dados via porta e orquestra a geração via serviço de exportação.
  - `estornar-dispensacao.use-case.ts`: Reversão de saldo atômica via `UnitOfWorkPort` / `DispensacaoRepositoryPort` e registro de auditoria.

### 3. Camada de Domínio (`apps/backend/src/modules/dispensacao/domain/`)
- **Portas (Interfaces)**:
  - `historico-dispensacao.repository.port.ts`: Contratos `listarFiltrado` e `buscarParaExportacao`.
  - `gerador-planilha.port.ts`: Contrato agnóstico de geração de planilhas (`gerarXlsx(dados): Promise<Buffer>`).

### 4. Camada de Infraestrutura (`apps/backend/src/modules/dispensacao/infrastructure/`)
- **Adaptadores de Banco (`adapters/`)**:
  - `typeorm-historico-dispensacao.repository.ts`: Implementa `HistoricoDispensacaoRepositoryPort` com paginação e joins otimizados.
- **Adaptadores de Serviço (`services/`)**:
  - `exceljs-gerador-planilha.service.ts`: Implementa `GeradorPlanilhaPort` utilizando `exceljs` com formatação corporativa e colunas auto-ajustáveis.
- **Adaptadores de Entrada HTTP (`controllers/`)**:
  - `dispensacao-historico.controller.ts`: Endpoints `GET /` (listagem), `GET /exportar-xlsx` (streaming de binário) e `POST /:id/estorno`.

---

## 5. Cenários de teste em BDD (Gherkin — camada A)

```gherkin
# language: pt
Funcionalidade: Consulta de Histórico de Dispensas e Exportação XLSX (Camada A)

  Cenário: Aplicação do filtro padrão temporal de ontem e hoje
    Dado que existem dispensas realizadas há 5 dias, ontem e hoje
    Quando o caso de uso ListarDispensacoesUseCase for executado sem informar datas
    Então o resultado deve conter apenas as dispensas realizadas entre ontem e hoje
    E as datas efetivas retornadas devem corresponder a ontem e hoje

  Cenário: Filtro por range customizado de datas e identificação de paciente
    Dado que o usuário define o período de "2026-09-01" até "2026-09-30"
    E busca pelo CPF "12345678909"
    Quando o caso de uso de listagem for executado
    Então apenas os atendimentos do paciente no mês de setembro devem ser retornados

  Cenário: Estorno de atendimento com devolução de saldo ao lote
    Dado uma dispensação com status "concluida" que retirou 15 unidades do lote "LOT-X"
    Quando o farmacêutico solicitar o estorno com motivo "Paciente desistiu da retirada"
    Então o status da dispensação deve mudar para "estornada"
    E o saldo do lote "LOT-X" deve ser incrementado em 15 unidades
```

---

## 6. Checklist de DoD e aceitação

- [ ] Filtro padrão `D-1` e `D0` implementado e coberto por testes.
- [ ] Exportação `.xlsx` gerada via stream com cabeçalhos e formatação adequada de colunas.
- [ ] Operação de estorno atualiza saldo do lote e registra auditoria sob transação ACID.
- [ ] Micro-TSDoc em todos os métodos e use cases.
- [ ] Testes da Camada A cobrindo paginação, filtros e lógica de estorno.
- [ ] Endpoint documentado no Swagger com schema do arquivo binário e DTOs.
