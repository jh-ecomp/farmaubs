# ES-MOB-05: Ficha de Rastreabilidade do Lote no Celular

**Épico:** 4 - Controle de Estoque  
**Camada:** `apps/mobile` (Expo React Native)  
**Requisitos Funcionais Relacionados:** RF-028  
**Requisitos Não Funcionais Relacionados:** RNF-001, RNF-007, RNF-009  
**ADRs Aplicadas:** ADR-006 (Contratos TypeScript via @farmaubs/shared), ADR-007 (TanStack Query), ADR-022 (Expo Mobile), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)  
**História Frontend Irmã:** ES-09 (Modais Operacionais: Ficha de Rastreabilidade do Lote)  
**Complexidade Estimada:** Baixa  

---

## 1. História de Usuário

**Como** Farmacêutico Responsável ou Fiscal Sanitário durante inspeção no estoque da UBS,  
**Quero** consultar no celular a ficha de rastreabilidade completa de um lote específico, com sua linha do tempo cronológica de entradas, saídas, dispensações e ajustes,  
**Para que** eu possa auditar a procedência, verificar quem efetuou cada movimentação e esclarecer discrepâncias de saldo sem sair da prateleira da farmácia.

---

## 2. Regras de Negócio e Casos de Borda Mobile

### 2.1 Linha do Tempo Visual (Timeline Mobile)
- **Cabeçalho Informativo do Lote**:
  - Medicamento, concentração, fabricante, código do lote, data de validade (com badge de vencimento correspondente) e saldo atual remanescente.
- **Estrutura Cronológica da Timeline**:
  - Eventos exibidos do mais recente para o mais antigo.
  - Marcadores gráficos por tipo de movimentação:
    - **Verde** (`ENTRADA_RECEBIMENTO`): Ícone de caminhão/caixa recebida, número do documento/NF e quantidade adicionada (+).
    - **Azul** (`SAIDA_DISPENSACAO`): Ícone de usuário/receita, senha/comprovante e quantidade dispensada (-).
    - **Roxo** (`AJUSTE_ENTRADA` / `AJUSTE_SAIDA`): Ícone de ferramentas/ajuste, motivo sanitário, justificativa textual e variação de saldo.
    - **Cinza** (`ESTORNO`): Ícone de cancelamento com detalhes do motivo do estorno.
- **Informações em Cada Ponto da Linha do Tempo**:
  - Data e hora formatadas (`DD/MM/AAAA às HH:mm`).
  - Quantidade movimentada com sinal positivo (+) ou negativo (-).
  - Saldo resultante no estoque físico após a movimentação.
  - Nome completo e papel do operador responsável.

### 2.2 Performance e Navegação Mobile
- Renderização via Bottom Sheet ou tela modal dedicada (`FichaRastreabilidadeScreen`).
- Scroll suave com `FlatList` caso o lote tenha histórico volumoso de dispensações.
- Estado de carregamento com skeleton loaders de linha do tempo.

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

```typescript
import {
  RastreabilidadeLoteDto,
  MovimentacaoLoteItemDto,
  TipoMovimentacaoEstoque,
} from '@farmaubs/shared';

export interface UseRastreabilidadeLoteMobileReturn {
  dados: RastreabilidadeLoteDto | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
}
```

---

## 3.3 Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: `ES-09` (Modais de ficha de movimentação do lote e ajuste rápido justificado).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `RastreabilidadeLoteDto`, `MovimentacaoLoteItemDto`, `TipoMovimentacaoEstoque`.
- **Se o Frontend Web já implementou ES-09**:
  - O Mobile utiliza exatamente a mesma rota `GET /api/v1/estoque/lotes/:id/rastreabilidade` e o DTO de eventos históricos já consumidos pelo modal web.
- **Se o Frontend Web ainda NÃO implementou ES-09**:
  - O desenvolvedor Mobile define os tipos de movimentações em `packages/shared/src/contracts/estoque/`, permitindo que o modal web use os mesmos contratos de linha do tempo.

---

## 4. Critérios de Aceite Detalhados

1. **Abertura Rápida**: Ao tocar no botão "Rastrear" de qualquer lote, a ficha de rastreabilidade deve carregar os dados em menos de 1 segundo.
2. **Identificação Visual de Movimentações**: Cada tipo de movimentação deve possuir cor e ícone semântico padronizado.
3. **Exibição do Saldo Resultante**: O operador deve ser capaz de conferir o saldo após cada operação ao longo do tempo.
4. **Detalhes da Operação**: Ao tocar em um evento da linha do tempo, informações complementares (como justificativa de ajuste ou número de receita) devem ser expandidas.

---

## 5. Cenários de Teste em BDD (Gherkin em Português)

```gherkin
Funcionalidade: Ficha de Rastreabilidade do Lote no Celular
  Como farmacêutico da UBS
  Quero auditar o histórico de um lote no meu smartphone
  Para verificar o histórico de entradas e saídas físicas

  Contexto:
    Dado que o usuário está no estoque mobile e seleciona o lote "LOT-8890"

  Cenário: Visualização da linha do tempo do lote
    Quando a tela de rastreabilidade é carregada
    Então o cabeçalho deve exibir o código "LOT-8890" e a validade
    E a lista deve apresentar as movimentações em ordem cronológica decrescente
    E a primeira entrada no estoque deve ser identificada com ícone verde de recebimento
    E cada evento deve indicar o saldo resultante e o usuário responsável
```

---

## 6. Checklist de DoD (Definition of Done)

- [ ] Componente `FichaRastreabilidadeLoteMobile` implementado com design de linha do tempo.
- [ ] Hook de consulta integrado a `GET /api/v1/estoque/lotes/:loteId/rastreabilidade` via TanStack Query.
- [ ] Ícones semânticos para cada tipo de movimentação de estoque.
- [ ] Testes de renderização com React Native Testing Library validando exibição de eventos.
