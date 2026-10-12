# DI-MOB-05 Consulta de Histórico de Dispensações Mobile (RF012)

- **Épico**: Dispensação de Medicamentos
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF012 (Consulta de Histórico e Auditoria)
- **Requisitos Não-Funcionais**: NF001 (Microinterações Fluídas), NF002 (Ergonomia Mobile), NF010 (Feedback Instantâneo)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-007 (API REST), ADR-022 (Monorepo), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança Monorepo)

---

## 1. História de Usuário

> **Como** farmacêutico ou coordenador da UBS em mobilidade,  
> **quero** consultar o histórico das dispensações recentes da unidade diretamente no celular, com filtro rápido de "Ontem e Hoje" e busca por paciente ou medicamento,  
> **para que** eu acompanhe o fluxo de saídas do plantão, audite entregas e tire dúvidas de atendimentos prestados sem necessidade de um computador de mesa (RF012).

---

## 2. Regras de Negócio e Casos de Borda Mobile

1. **Filtro Temporal Inicial: "Ontem e Hoje"**:
   - Ao abrir a aba/tela de Histórico, a consulta carrega por padrão os atendimentos de ontem e hoje (`D-1` e `D0`).
   - Chips rápidos de filtro no topo da tela com rolagem horizontal:
     - `[Ontem e Hoje]` (ativo por padrão)
     - `[Hoje]`
     - `[Últimos 7 dias]`
     - `[Este Mês]`

2. **Listagem Otimizada com Cartões de Atendimento**:
   - Cada item da lista (`<FlatList>`) exibe:
     - Horário e número do atendimento;
     - Nome do paciente e últimos 4 dígitos do CPF;
     - Resumo dos medicamentos entregues (ex.: "Losartana 50mg (30 un), Metformina (60 un)");
     - Tag de status: `Concluída` (verde) ou `Estornada` (vermelho).
   - Suporte nativo a **Pull-to-Refresh** para atualizar a listagem puxando a tela para baixo.

3. **Busca Rápida Filtrada**:
   - Barra de pesquisa no topo com filtro por nome de paciente ou medicamento.
   - Aplica debounce de 300ms antes de disparar a requisição paginada.

4. **Detalhes do Atendimento em Folha Inferior (Modal)**:
   - Ao tocar em um cartão, abre-se uma folha inferior exibindo os detalhes completos: lotes dos medicamentos, profissional responsável, prescritor e motivo de estorno (se aplicável).

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

### 3.1 Rotas Consumidas
- `GET /api/v1/dispensacoes?periodo={periodo}&termo={termo}&page={page}`

### 3.2 Tipagens Compartilhadas (`packages/shared/src/dispensacao/historico.types.ts`)

```typescript
export interface ItemHistoricoDispensacaoDto {
  id: string;
  numeroAtendimento: string;
  pacienteNome: string;
  dataHora: string;
  status: 'concluida' | 'estornada';
  itensResumo: string;
  totalUnidades: number;
}
```

---

## 3.3 Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: `DI-10` (Painel de histórico de dispensas com filtro ontem/hoje e exportação em XLSX).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `ItemHistoricoDispensacaoDto`, `ListarDispensacoesQuery`.
- **Se o Frontend Web já implementou DI-10**:
  - O Mobile utiliza exatamente a mesma rota `GET /api/v1/dispensacoes` e os mesmos parâmetros de consulta temporal (`periodoPredefinido=ONTEM_HOJE`), evitando divergências de filtros entre web e app.
- **Se o Frontend Web ainda NÃO implementou DI-10**:
  - O desenvolvedor Mobile define os parâmetros de filtro e o DTO resumido em `packages/shared/src/dispensacao/historico.types.ts`, assegurando que o painel web consuma as mesmas estruturas quando for implementado.

---

## 4. Critérios de Aceite Detalhados

- [ ] Carga inicial automática com atendimentos de Ontem e Hoje.
- [ ] Chips de período temporal com rolagem horizontal fluida.
- [ ] Pull-to-refresh nativo atualizando a lista de registros.
- [ ] Pesquisa textual de histórico com debounce integrado.
- [ ] Modal ou folha inferior com detalhes completos do atendimento selecionado.

---

## 5. Cenários de Teste (BDD / Gherkin)

```gherkin
# language: pt
Funcionalidade: Consulta de Histórico de Dispensações Mobile (DI-MOB-05 / RF012)

  Cenário: Carga inicial com atendimentos recentes da UBS
    Dado que o farmacêutico acessa a aba de histórico no app mobile
    Quando a tela terminar de carregar
    Então o chip "Ontem e Hoje" deve estar selecionado
    E a lista deve exibir os atendimentos recentes da UBS ativa

  Cenário: Atualização da lista com gesto de puxar para baixo (Pull-to-refresh)
    Dado que a lista de atendimentos está sendo exibida
    Quando o usuário puxar o topo da lista para baixo
    Então o indicador de carregamento nativo deve ser acionado
    E os dados devem ser sincronizados com o servidor

  Cenário: Visualização dos detalhes do atendimento ao tocar no cartão
    Dado que o usuário toca no atendimento "#DSP-2026-0042"
    Quando o modal de detalhes for aberto
    Então os medicamentos, lotes, quantidades e profissional responsável devem ser apresentados
```

---

## 6. Checklist de DoD e Aceitação

- [ ] Tela construída com React Native e componentes de lista performáticos.
- [ ] Tipos consumidos de `@farmaubs/shared`.
- [ ] Checagem estática aprovada via `moon run mobile:typecheck`.
