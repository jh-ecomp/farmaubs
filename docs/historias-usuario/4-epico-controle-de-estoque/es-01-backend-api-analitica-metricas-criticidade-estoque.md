# ES-01 feat(estoque): API Analítica: Métricas de Criticidade, Totalizadores e Cálculo de Ruptura e Validade Curta

---

- **Épico**: Controle de Estoque (RF005, RF006, RF007, RF009, RF011, RF018, RF020, RF022, RF023, RF028, NF001, NF002, NF003, NF007, NF009, NF015)
- **Requisitos Funcionais**: RF018 (Exibir Dashboard de Indicadores), RF022 (Alertar Medicamentos Próximos ao Vencimento), RF023 (Alertar Risco de Ruptura de Estoque)
- **Requisitos Não-Funcionais**: NF007 (Performance de Resposta < 500ms e Carga Geral < 2s), NF009 (RBAC por Perfil), NF015 (Isolamento Multi-tenant por UBS via RLS)
- **ADRs Vinculadas**: ADR-002 / ADR-016 (Isolamento RLS por UBS), ADR-003 (Arquitetura Hexagonal), ADR-007 (Endpoints REST e Swagger), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camadas A e C), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico responsável ou gerente de farmácia da UBS,  
> **quero** consultar um endpoint analítico consolidado que retorne os indicadores globais de estoque da unidade (total de medicamentos ativos, total de unidades físicas, quantidade de itens em risco de ruptura e total de lotes com validade no mês corrente ou inferior a 90 dias),  
> **para que** eu possa obter um panorama imediato da saúde do estoque da farmácia ao carregar o sistema, agindo preventivamente sobre vencimentos iminentes e desabastecimento (RF018, RF022, RF023).

---

## 2. Regras de negócio e casos de borda

1. **Cálculo do Total de Medicamentos Ativos**:
   - Conta a quantidade de produtos cadastrados no catálogo oficial com status `ativo` que possuam vínculo de distribuição na UBS atual.
2. **Cálculo do Total de Unidades Físicas**:
   - Soma inteira de todos os saldos físicos positivos (`saldo_atual > 0`) em todos os lotes armazenados na farmácia da UBS.
3. **Cálculo de Risco de Ruptura de Estoque (RF023)**:
   - Para cada medicamento com saldo na unidade:
     - Calcula o consumo médio diário (CMD) com base nas dispensações dos últimos 30 a 90 dias (`CMD = totalDispensado / diasApurados`);
     - Determina a cobertura atual em dias (`coberturaDias = saldoAtual / CMD`);
     - Um item é classificado em **Risco de Ruptura** quando:
       `coberturaDias <= (tempoMedioEntregaCafDias + margemSegurancaDias)`.
       *(Valores padrão: entrega CAF = 15 dias, margem de segurança = 5 dias; cobertura limite = 20 dias).*
     - Se o saldo do medicamento for igual a 0 (`saldoAtual == 0`), é contabilizado sumariamente como **Ruptura Imediata**.
4. **Identificação de Lotes com Validade Curta e Mês Corrente (RF022)**:
   - Conta lotes com `saldo_atual > 0` que se enquadrem em:
     - **Vencendo no Mês Vigente**: Data de validade com mês e ano idênticos ao mês/ano corrente local da UBS;
     - **Validade Curta (< 90 dias)**: Data de validade entre a data de hoje e 90 dias corridos à frente.
   - Lotes já expirados (`validade < hoje`) são contabilizados separadamente para alimentar os relatórios de perda.
5. **Isolamento Multi-tenant (ADR-016)**:
   - Todas as queries agregadas filtram estritamente pelo `ubs_id` do usuário logado via variável de sessão RLS do PostgreSQL (`app.current_ubs_id`).

---

## 3. Contratos de dados e Protocolo HTTP (DTOs)

### Endpoints REST
- `GET /api/v1/estoque/metricas`: Métricas consolidadas de estoque e criticidade da UBS.

### DTOs TypeScript

```typescript
export interface EstoqueMetricasResponseDto {
  totalMedicamentosAtivos: number;
  totalUnidadesFisicas: number;
  itensRiscoRuptura: number;
  lotesValidadeMesAtual: number;
  lotesValidadeCurta90d: number;
  lotesVencidos: number;
  calculadoEm: string; // ISO 8601
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

### 1. Pacote Compartilhado (`@farmaubs/shared`)
- **`src/contracts/estoque/metricas.types.ts`**: `EstoqueMetricasResponseDto` e chaves de cache `['estoque', 'metricas', ubsId]`.
- **`src/domain/estoque/criticidade-helpers.ts`**: Funções puras de cálculo de cobertura em dias (`calcularCoberturaDias`), identificação de risco de ruptura (`verificarRiscoRuptura`) e classificação de vencimento no mês/90 dias (`classificarValidadeLote`), compartilhadas com frontend e mobile.

### 2. Camada de Aplicação (`apps/backend/src/modules/estoque/application/`)
- **Use Cases**:
  - `obter-metricas-estoque.use-case.ts`: Executa query agregada através da porta de repositório, aplica os helpers de criticidade de `@farmaubs/shared` e retorna o DTO consolidado.

### 3. Camada de Domínio (`apps/backend/src/modules/estoque/domain/`)
- **Portas (Interfaces)**:
  - `estoque-metricas.repository.port.ts`: Contrato `obterMetricasAgregadasPorUbs(ubsId: string)`.

### 4. Camada de Infraestrutura (`apps/backend/src/modules/estoque/infrastructure/`)
- **Adaptadores de Banco (`adapters/`)**:
  - `typeorm-estoque-metricas.repository.ts`: Queries agregadas otimizadas no PostgreSQL utilizando CTEs e RLS (`app.current_ubs_id`).
- **Adaptadores de Entrada HTTP (`controllers/`)**:
  - `estoque-analitica.controller.ts`: Endpoint `GET /api/v1/estoque/metricas` com autenticação JWT e extração de `ubsId`.

---

## 5. Cenários de teste em BDD (Gherkin — camada A e C)

```gherkin
# language: pt
Funcionalidade: Métricas e Indicadores de Estoque (Camadas A e C)

  Cenário: Retorno consolidado das métricas operacionais com sucesso
    Dado que o farmacêutico está autenticado e vinculado à UBS "UBS Central Parnaíba"
    E a UBS possui 85 medicamentos ativos cadastrados
    E a soma dos saldos de todos os lotes é de 12.450 unidades físicas
    E existem 4 medicamentos cuja cobertura é inferior a 20 dias de consumo
    E existem 6 lotes com vencimento dentro do mês atual
    Quando ele enviar uma requisição "GET /api/v1/estoque/metricas"
    Então a API deve retornar status 200 (OK)
    E o JSON de resposta deve conter:
      | totalMedicamentosAtivos | 85 |
      | totalUnidadesFisicas    | 12450 |
      | itensRiscoRuptura       | 4 |
      | lotesValidadeMesAtual   | 6 |
      | lotesValidadeCurta90d   | 11 |

  Cenário: Isolamento multi-tenant garantindo segregação entre UBSs
    Dado que o usuário da "UBS Central" possui dados cadastrados
    Quando um farmacêutico autenticado da "UBS Piauí" consultar "GET /api/v1/estoque/metricas"
    Então a API deve processar os cálculos exclusivamente com os lotes e dispensações vinculados à "UBS Piauí"
    E nenhum dado da "UBS Central" deve ser computado nas somas
```

---

## 6. Checklist de DoD e aceitação

- [ ] Caso de uso `ObterMetricasEstoqueUseCase` implementado com agregação SQL performática indexada.
- [ ] Endpoint `GET /api/v1/estoque/metricas` documentado no Swagger.
- [ ] Testes unitários (Camada A) cobrindo regras de cálculo de CMD, cobertura e limites de 90 dias.
- [ ] Testes E2E (Camada C) validando integridade de dados e aplicação de RLS por tenant.
