# RE-MOB-04: Consulta de Histórico de Conferências e Recebimentos no Celular

**Épico:** 3 - Recebimento de Medicamentos  
**Camada:** `apps/mobile` (Expo React Native)  
**Requisitos Funcionais Relacionados:** RF-023, RF-024  
**Requisitos Não Funcionais Relacionados:** RNF-001, RNF-004, RNF-006, RNF-009  
**ADRs Aplicadas:** ADR-006 (Contratos TypeScript via @farmaubs/shared), ADR-007 (TanStack Query), ADR-022 (Expo Mobile), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)  
**História Frontend Irmã:** RE-08 (Painel de Recebimentos e Termo de Estorno Web)  
**Complexidade Estimada:** Média  

---

## 1. História de Usuário

**Como** Farmacêutico ou Atendente de Farmácia em deslocamento na farmácia ou almoxarifado,  
**Quero** consultar pelo aplicativo mobile o histórico dos últimos recebimentos e conferências físicas homologadas na minha UBS,  
**Para que** eu possa verificar rapidamente se uma remessa já foi dada como recebida, conferir a quantidade de volumes/itens e consultar o protocolo da nota/guia sem precisar ir até o terminal desktop.

---

## 2. Regras de Negócio e Casos de Borda Mobile

### 2.1 Contexto e Escopo de Consulta
- **Escopo por UBS:** A consulta retorna apenas os recebimentos registrados para a UBS ativa vinculada à sessão do usuário (`user.ubsId`).
- **Filtro de Período Rápido (Chips):**
  - "Hoje" (filtro padrão inicial).
  - "Últimos 7 dias".
  - "Últimos 30 dias".
  - Filtro por termo de busca (número do documento/NF ou nome do fornecedor/origem).
- **Ações Disponíveis no Mobile:**
  - Visualização em lista tátil com resumo: Data/Hora, Número do Documento, Origem/Fornecedor, Qtd de Itens Conferidos e Nome do Responsável.
  - Abertura de modal/bottom sheet com o detalhamento completo dos lotes e quantidades conferidas.
  - Visualização do protocolo de confirmação com possibilidade de compartilhamento nativo (`Share.share`) do resumo para outros canais (ex: WhatsApp do almoxarifado/coordenação).
- **Restrição de Segurança / Estorno:**
  - A operação de estorno/cancelamento de recebimento com emissão de justificativa técnica e estorno de estoque permanece restrita à aplicação Web Desktop (RE-08), com o app mobile exibindo apenas o status (ex: `EFETIVADO` ou `ESTORNADO`).

### 2.2 Usabilidade Mobile e Performance
- `FlatList` otimizada com paginação infinita (`onEndReachedThreshold={0.4}`, páginas de 15 registros).
- Suporte a `RefreshControl` (pull-to-refresh) com feedback háptico.
- Estados de UI claros: Skeleton loader nos cards, empty state caso não haja remessas no período e error banner com botão "Tentar novamente".
- Altura mínima de touch target de 44x44pt para cada item da lista.

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

```typescript
import {
  RecebimentoListItemDTO,
  RecebimentoDetalheDTO,
  PeriodoFiltroRecebimento,
} from '@farmaubs/shared';

export interface UseHistoricoRecebimentosMobileReturn {
  recebimentos: RecebimentoListItemDTO[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  filtroPeriodo: PeriodoFiltroRecebimento;
  termoBusca: string;
  setFiltroPeriodo: (periodo: PeriodoFiltroRecebimento) => void;
  setTermoBusca: (busca: string) => void;
  refetch: () => Promise<void>;
  fetchNextPage: () => void;
  hasNextPage: boolean;
}
```

---

## 3.3 Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: `RE-08` (Painel de histórico: visualização ontem/hoje, intervalo customizado, XLSX, termo e estorno).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `ListarRecebimentosQuery`, `ItemHistoricoRecebimentoDto`, `RecebimentoListItemDTO`, `PeriodoFiltroRecebimento`.
- **Se o Frontend Web já implementou RE-08**:
  - O Mobile utiliza exatamente a rota `GET /api/v1/recebimento/entradas` com os mesmos parâmetros de filtro e paginação já homologados no painel web.
- **Se o Frontend Web ainda NÃO implementou RE-08**:
  - O desenvolvedor Mobile define os contratos de consulta e listagem em `packages/shared/src/recebimento/historico-recebimento.types.ts`, assegurando que a tabela web e o relatório XLSX consumam o mesmo schema.

---

## 4. Critérios de Aceite Detalhados

1. **Listagem Padrão:** Ao abrir a tela de histórico no mobile, o app deve carregar os recebimentos do dia corrente ("Hoje").
2. **Chips de Filtragem:** A alternância entre "Hoje", "Últimos 7 dias" e "Últimos 30 dias" deve disparar refetch imediato e animar a transição de lista.
3. **Busca Rápida:** Ao digitar número de documento ou fornecedor no campo de busca (com debounce de 300ms), a lista deve filtrar os registros correspondentes.
4. **Detalhe da Remessa:** Ao tocar em um card de recebimento, deve ser aberto um Bottom Sheet mostrando cada medicamento da remessa, fabricante, lote, validade e quantidade recebida.
5. **Identificação de Estornos:** Caso uma remessa tenha sido estornada via web, o card deve exibir badge visual vermelho `ESTORNADO` com a data e motivo do cancelamento, prevenindo conferências duplicadas.
6. **Compartilhamento de Protocolo:** Deve haver botão "Compartilhar Protocolo" que formata os dados essenciais (UBS, NF, Origem, Data, Responsável, Total de Itens) e invoca a API nativa de compartilhamento.

---

## 5. Cenários de Teste em BDD (Gherkin em Português)

```gherkin
Funcionalidade: Consulta de Histórico de Recebimentos no Celular
  Como conferente ou farmacêutico da farmácia municipal
  Quero consultar os recebimentos homologados no meu smartphone
  Para verificar rapidamente a entrada de mercadorias no estoque da UBS

  Contexto:
    Dado que o usuário está autenticado no aplicativo mobile com a UBS "UBS Central" selecionada
    E acessa a aba "Histórico de Recebimentos"

  Cenário: Visualização dos recebimentos do dia
    Quando a tela é carregada
    Então o chip "Hoje" deve estar ativo por padrão
    E a lista deve exibir os recebimentos homologados hoje para a "UBS Central"
    E cada card deve exibir o número do documento, origem e quantidade de itens

  Cenário: Consulta detalhada dos lotes recebidos
    Dado que a lista exibe o recebimento "NF 44921 - Distribuidora Saúde"
    Quando o usuário toca sobre o card do recebimento
    Então uma folha de detalhes deve ser exibida
    E deve listar todos os medicamentos, lotes, validades e quantidades que entraram no estoque
    E deve exibir o botão "Compartilhar Resumo"

  Cenário: Visualização de remessa estornada
    Dado que a remessa "NF 39100" foi cancelada e estornada no painel administrativo web
    Quando o usuário visualiza o card desta remessa no celular
    Então deve ser exibida a etiqueta "ESTORNADO" em destaque
    E os itens devem ser assinalados como cancelados no detalhamento
```

---

## 6. Checklist de DoD (Definition of Done)

- [ ] Componente `HistoricoRecebimentosScreen` implementado no `apps/mobile/src/screens/recebimento/`.
- [ ] Hook `useHistoricoRecebimentos` implementado consumindo client da API compartilhado (`@farmaubs/shared`).
- [ ] Chips de filtro por período com animação e feedback háptico.
- [ ] Bottom Sheet de detalhe do recebimento com lista de lotes e validades.
- [ ] Integração com `Share.share` nativo para compartilhamento de protocolo.
- [ ] Testes de componentes mobile com React Native Testing Library cobrindo renderização, troca de chip e abertura de detalhe.
