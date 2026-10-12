# IN-MOB-01: Visão Geral de Ciclos e Acompanhamento de Inventário no Celular

**Épico:** 5 - Inventário Mensal  
**Camada:** `apps/mobile` (Expo React Native)  
**Requisitos Funcionais Relacionados:** RF-014, RF-021  
**Requisitos Não Funcionais Relacionados:** RNF-001, RNF-002, RNF-007, RNF-009  
**ADRs Aplicadas:** ADR-006 (Contratos TypeScript via @farmaubs/shared), ADR-007 (TanStack Query), ADR-022 (Expo Mobile), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)  
**História Frontend Irmã:** IN-05 (Tela de Visão Geral: Histórico de Inventários e Indicador de Ciclo Ativo)  
**Complexidade Estimada:** Média  

---

## 1. História de Usuário

**Como** Farmacêutico ou Atendente de Farmácia da UBS em rotina na unidade,  
**Quero** consultar no celular o estado do inventário mensal ativo na minha UBS, visualizando a barra de progresso das contagens físicas realizadas e acessando com um toque a tela de contagem,  
**Para que** eu possa acompanhar o andamento da conferência em tempo real e retomar imediatamente a contagem das caixas sem depender do computador desktop.

---

## 2. Regras de Negócio e Casos de Borda Mobile

### 2.1 Interface e Indicadores do Ciclo Ativo
- **Card Principal de Ciclo Ativo (Status `EM_ANDAMENTO`)**:
  - Exibido com destaque no topo da tela do módulo móvel:
    - Número do Ciclo e Mês de Referência (ex.: "Ciclo 2026/10 - Outubro").
    - Data/hora de abertura e nome do farmacêutico responsável.
    - **Barra de Progresso Visual**: Percentual calculado via `calcularProgressoInventario(total, contados)` com animação de preenchimento.
    - Contadores numéricos em destaque: "85 de 140 itens contados (60%)".
    - Badge de divergências: número de itens com discordância entre o saldo teórico e a contagem física.
  - **Botão Primário Tátil**: `Continuar Contagem Física` (área ampla de toque, cor primária `#2563EB`, navega para **IN-MOB-02**).
- **Estado sem Ciclo Aberto**:
  - Quando não houver inventário aberto para a UBS ativa:
    - Card ilustrativo com status `Nenhum inventário em andamento`.
    - Mensagem orientadora informando a data prevista para o próximo ciclo mensal.
    - O acionamento de abertura de novos ciclos é mantido preferencialmente via web ou liberado apenas para perfis `FARMACEUTICO` com modal de confirmação.

### 2.2 Histórico Rápido de Inventários Anteriores
- Lista resumida dos últimos 3 ciclos homologados na UBS com:
  - Mês/Ano de referência.
  - Número da Ata Oficial.
  - Status `HOMOLOGADO` em verde.
  - Botão de ação para visualizar o resumo da Ata ou compartilhar o protocolo (**IN-MOB-04**).

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

```typescript
import {
  InventarioCicloAtivoDTO,
  InventarioHistoricoItemDTO,
  StatusCicloInventario,
  calcularProgressoInventario,
} from '@farmaubs/shared';

export interface UseInventarioVisaoGeralMobileReturn {
  cicloAtivo: InventarioCicloAtivoDTO | null;
  historicoRecente: InventarioHistoricoItemDTO[];
  isLoading: boolean;
  refetch: () => Promise<void>;
  progressoPercentual: number;
}
```

---

## 3.3 Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: `IN-05` (Tela de visão geral: histórico de inventários realizados, indicador de ciclo ativo e início de ciclo).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `InventarioCicloAtivoDTO`, `InventarioHistoricoItemDTO`, `StatusCicloInventario`, `calcularProgressoInventario`.
- **Se o Frontend Web já implementou IN-05**:
  - O Mobile utiliza exatamente a mesma rota `GET /api/v1/inventario/ciclos/ativo` e a função pura `calcularProgressoInventario` de `@farmaubs/shared` para garantir percentuais e barras de progresso idênticas.
- **Se o Frontend Web ainda NÃO implementou IN-05**:
  - O desenvolvedor Mobile define os contratos e a função de progresso em `packages/shared/src/contracts/inventario/`, permitindo que a tela web de visão geral os consuma diretamente.

---

## 4. Critérios de Aceite Detalhados

1. **Exibição do Ciclo Ativo**: Ao abrir o módulo de inventário no app, se houver um ciclo ativo, seu resumo e progresso devem ser renderizados imediatamente.
2. **Navegação para Contagem**: Tocar em "Continuar Contagem Física" deve direcionar o usuário para a lista de itens a contar (**IN-MOB-02**) preservando o estado do ciclo.
3. **Atualização do Progresso**: Conforme itens são contados no celular, a barra de progresso deve refletir o novo percentual sem necessidade de reiniciar o aplicativo.
4. **Resiliência Offline / Instabilidade**: Se houver falha de conexão, um banner de aviso deve ser exibido com opção de tentar novamente.

---

## 5. Cenários de Teste em BDD (Gherkin em Português)

```gherkin
Funcionalidade: Visão Geral de Inventário no Celular
  Como farmacêutico da UBS
  Quero visualizar o status do ciclo de inventário no celular
  Para acompanhar a evolução da conferência mensal

  Contexto:
    Dado que existe um ciclo de inventário "2026/10" ativo com 100 itens na UBS
    E o usuário abre a aba "Inventário" no aplicativo mobile

  Cenário: Visualização do progresso do ciclo em andamento
    Dado que 45 itens já foram contados
    Quando a tela de visão geral é renderizada
    Então deve exibir a barra de progresso indicando "45%"
    E o botão "Continuar Contagem Física" deve estar habilitado e em destaque

  Cenário: Acesso direto à tela de contagem física
    Quando o usuário toca no botão "Continuar Contagem Física"
    Então o aplicativo deve navegar para a tela de contagem de medicamentos
    E carregar os itens pertencentes ao ciclo "2026/10"
```

---

## 6. Checklist de DoD (Definition of Done)

- [ ] Tela `InventarioVisaoGeralScreen` implementada no `apps/mobile/src/screens/inventario/`.
- [ ] Hook `useCicloAtivo` consumindo a rota compartilhada da API via TanStack Query.
- [ ] Utilização da função `calcularProgressoInventario` de `@farmaubs/shared`.
- [ ] Testes automatizados com React Native Testing Library cobrindo estado ativo e sem ciclo.
