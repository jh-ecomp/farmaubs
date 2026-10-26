# DI-03 feat(dispensacao): API de Dispensação: Busca textual de medicamentos e algoritmo de sugestão FEFO

---

- **Épico**: Dispensação de Medicamentos (RF010, NF009, NF010)
- **Requisitos Funcionais**: RF010 (Registro de Dispensa e Sugestão FEFO)
- **Requisitos Não-Funcionais**: NF009 (Menor Privilégio RBAC), NF010 (Performance de Consulta < 500ms)
- **ADRs Vinculadas**: ADR-002 (Escopo por UBS), ADR-003 (Arquitetura Hexagonal), ADR-007 (Endpoints REST e Swagger), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camadas A e C), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico operando a bancada de dispensação na UBS,  
> **quero** buscar medicamentos através de pesquisa textual rápida (por nome comercial, princípio ativo ou apresentação) e receber a lista de lotes disponíveis em estoque com a indicação automática do lote com vencimento mais próximo (FEFO),  
> **para que** eu possa selecionar o medicamento sem necessidade de código de barras físico no MVP e priorizar a saída dos lotes que vencem primeiro, minimizando o desperdício de insumos públicos (RF010, NF010).

---

## 2. Regras de negócio e casos de borda

1. **Busca Textual Otimizada (Sem Código de Barras no MVP)**:
   - A busca aceita fragmentos parciais de texto (`ilike %termo%`), ignorando acentuação e distinção entre maiúsculas e minúsculas.
   - A busca atua sobre os campos:
     - `nome_comercial`
     - `principio_ativo`
     - `apresentacao` (ex.: "comprimido 50mg", "xarope 100ml").
   - Retorna apenas medicamentos que possuam cadastro ativo no catálogo municipal.

2. **Algoritmo de Sugestão FEFO (First Expired, First Out)**:
   - Para o medicamento selecionado, a API consulta todos os lotes com saldo estocado positivo (`saldo_atual > 0`) na **unidade de saúde atual da sessão**.
   - Ordenação estrita: `data_validade ASC`, seguida de `created_at ASC` como critério de desempate.
   - O primeiro item da lista de lotes é marcado com `sugeridoFefo: true`.
   - Caso um lote esteja vencido (`data_validade < hoje`), ele **não deve ser sugerido para dispensa** e deve ser marcado como bloqueado para saída regular.

3. **Flexibilidade de Lotes**:
   - A resposta da API entrega o lote sugerido por FEFO e a lista completa de lotes alternativos disponíveis em estoque para aquela UBS, permitindo ao farmacêutico escolher outro lote caso haja embalagem aberta na farmácia.

4. **Alertas Clínicos e de Validade**:
   - Cada lote retornado contém a indicação de dias restantes até o vencimento.
   - Lotes com vencimento em até 30 dias recebem indicador de urgência (`alertaValidadeCurta: true`).
   - Medicamentos com controle especial de antimicrobianos recebem `requerDataReceita: true`.

---

## 3. Contratos de dados e protocolo HTTP

### Endpoints REST (`DispensacaoCatalogoController`)

| Método | Rota | Descrição | Roles Permitidos |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/dispensacao/medicamentos` | Busca textual de medicamentos no catálogo | `FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `GERENTE`, `ADMINISTRADOR` |
| `GET` | `/api/v1/dispensacao/medicamentos/:id/lotes-fefo` | Consulta lotes estocados na UBS com ordenação FEFO | `FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `GERENTE`, `ADMINISTRADOR` |

### Contratos no `@farmaubs/shared` (`packages/shared/src/dispensacao/catalogo.types.ts`)

```typescript
export interface MedicamentoBuscaDto {
  id: string;
  principioAtivo: string;
  nomeComercial?: string;
  apresentacao: string;
  categoria: string;
  antimicrobiano: boolean;
  saldoTotalUbs: number;
}

export interface LoteDisponivelDto {
  id: string;
  numeroLote: string;
  dataValidade: string; // YYYY-MM-DD
  saldoDisponivel: number;
  sugeridoFefo: boolean;
  diasParaVencimento: number;
  alertaValidadeCurta: boolean;
  vencido: boolean;
}

export interface SugestaoFefoResultado {
  medicamento: MedicamentoBuscaDto;
  loteSugerido: LoteDisponivelDto | null;
  lotesDisponiveis: LoteDisponivelDto[];
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

### 1. Pacote Compartilhado (`@farmaubs/shared`)
- **`src/contracts/dispensacao/catalogo.types.ts`**: Tipos `MedicamentoBuscaDto`, `LoteDisponivelDto` e `SugestaoFefoResultado`.
- **`src/domain/estoque/fefo-helpers.ts`**: Funções puras de ordenação e seleção do lote prioritário (`ordenarLotesPorFEFO`, `selecionarLoteSugeridoFEFO`), reutilizadas por backend, frontend e mobile.

### 2. Camada de Aplicação (`apps/backend/src/modules/dispensacao/application/`)
- **Use Cases**:
  - `buscar-medicamentos-dispensacao.use-case.ts`: Executa a busca textual no catálogo e agrega os saldos consolidados na UBS.
  - `obter-sugestao-lotes-fefo.use-case.ts`: Obtém os lotes físicos via porta, invoca os helpers puros de FEFO de `@farmaubs/shared` e formata a resposta.

### 3. Camada de Domínio (`apps/backend/src/modules/dispensacao/domain/`)
- **Entidades de Domínio**: `LoteEstoque` e `Medicamento` com métodos para checagem de validade e alertas clínicos.
- **Portas (Interfaces)**:
  - `dispensacao-catalogo.repository.port.ts`: Contrato de consulta (`buscarPorTermoEUnidade`, `listarLotesPorMedicamentoEUnidade`).

### 4. Camada de Infraestrutura (`apps/backend/src/modules/dispensacao/infrastructure/`)
- **Adaptadores de Banco (`adapters/`)**:
  - `typeorm-dispensacao-catalogo.repository.ts`: Queries eficientes com `LEFT JOIN` na tabela de lotes e filtros de saldos > 0.
- **Adaptadores de Entrada HTTP (`controllers/`)**:
  - `dispensacao-catalogo.controller.ts`: Controller REST com proteção de roles RBAC e documentação OpenAPI.

---

## 5. Cenários de teste em BDD (Gherkin — camada A)

```gherkin
# language: pt
Funcionalidade: Busca Textual e Sugestão FEFO de Medicamentos (Camada A)

  Cenário: Busca por fragmento de nome do princípio ativo
    Dado que existem os medicamentos "Dipirona 500mg" e "Amoxicilina 500mg" cadastrados
    Quando o farmacêutico buscar pelo termo "amox"
    Então o resultado deve conter exatamente 1 medicamento
    E o nome retornado deve ser "Amoxicilina 500mg"

  Cenário: Sugestão do lote com vencimento mais próximo (FEFO)
    Dado que a UBS possui o lote "LOTE-A" com vencimento em "2026-12-01" e saldo 100
    E possui o lote "LOTE-B" com vencimento em "2026-10-15" e saldo 50
    Quando o caso de uso ObterSugestaoLotesFefo for executado para o medicamento
    Então o loteSugerido deve ser o "LOTE-B"
    E o lote "LOTE-B" deve ter sugeridoFefo marcado como verdadeiro

  Cenário: Descarte de lotes vencidos da sugestão de saída
    Dado que a UBS possui um lote com data de validade anterior à data de hoje
    Quando a consulta de lotes para dispensação for executada
    Então o lote vencido não deve ser sugerido para a dispensa
    E deve ter a flag vencido como verdadeira
```

---

## 6. Checklist de DoD e aceitação

- [x] Busca textual sem dependência de leitor de código de barras físico.
- [x] Sugestão de lotes estritamente em ordem crescente de validade (FEFO).
- [x] Bloqueio de sugestão para lotes já expirados.
- [x] Métodos documentados com cabeçalho Micro-TSDoc.
- [x] Testes unitários puros na Camada A validando cenários de ordenação e desempate.
- [x] Documentação Swagger com parâmetros e payloads de resposta.
