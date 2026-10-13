# IN-MOB-03: Conferência de Divergências e Justificativas de Inventário no Celular

**Épico:** 5 - Inventário Mensal  
**Camada:** `apps/mobile` (Expo React Native)  
**Requisitos Funcionais Relacionados:** RF-013  
**Requisitos Não Funcionais Relacionados:** RNF-001, RNF-006, RNF-007, RNF-009  
**ADRs Aplicadas:** ADR-006 (Contratos TypeScript via @farmaubs/shared), ADR-007 (TanStack Query), ADR-022 (Expo Mobile), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)  
**História Frontend Irmã:** IN-07 (Mapa de Conciliação e Divergências: Comparativo e Justificativas)  
**Complexidade Estimada:** Média  

---

## 1. História de Usuário

**Como** Farmacêutico Responsável ou Gestor de Farmácia da UBS pelo aplicativo móvel,  
**Quero** inspecionar a lista de divergências apuradas na contagem do inventário (sobras e faltas), selecionar o motivo sanitário para cada discrepância e fornecer justificativa textual com validação de caracteres,  
**Para que** eu possa sanear e justificar todas as discordâncias de estoque diretamente pelo celular antes da homologação final.

---

## 2. Regras de Negócio e Casos de Borda Mobile

### 2.1 Apresentação das Divergências em Cards Móveis
- **Card de Conciliação por Lote**:
  - Exibe o medicamento, lote, data de validade e fabricante.
  - Comparativo visual:
    - `Teórico`: Saldo que o sistema registrava no início do ciclo.
    - `Físico`: Saldo apurado na contagem física (**IN-MOB-02**).
    - `Divergência`:
      - **Sobra (+X)**: Badge azul com sinal positivo.
      - **Falta (-X)**: Badge vermelho com sinal negativo.
- **Seletor de Motivo Sanitário (Picker / Modal Tátil)**:
  - Opções padronizadas da rede: `Erro de Digitação Anterior`, `Avaria não Informada`, `Dispensação sem Baixa`, `Lote Trocado`, `OUTROS`.
- **Campo de Justificativa Textual Obrigatória**:
  - Input multiline acionado por toque no card ou em bottom sheet.
  - **Regra Estrita para "OUTROS"**:
    - Caso o motivo seja `OUTROS`, o texto exige no mínimo **15 caracteres** (validado pelo schema Zod compartilhado).
    - Contador visual em tempo real (ex.: `8/15 mín.`).
    - Mensagem de aviso em vermelho caso o farmacêutico tente salvar com texto insuficiente.

### 2.2 Recontagem Rápida e Painel de Pendências
- **Botão de Recontagem Rápida**:
  - Permite alterar a contagem física diretamente do card da divergência caso a equipe encontre uma caixa esquecida na gaveta, recalculando a diferença instantaneamente.
- **Barra Fixa de Validação no Rodapé**:
  - Exibe resumo: "X divergências pendentes de justificativa".
  - Quando todas as divergências estiverem justificadas com motivos válidos, a barra se torna verde: "Todas as divergências saneadas — pronto para homologação" e habilita o botão para avançar para a homologação (**IN-MOB-04**).

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

```typescript
import {
  InventarioDivergenciaItemDTO,
  justificarDivergenciaSchema,
  MotivoDivergenciaInventario,
} from '@farmaubs/shared';

export interface UseDivergenciasInventarioMobileReturn {
  divergencias: InventarioDivergenciaItemDTO[];
  isLoading: boolean;
  salvarJustificativa: (itemId: string, motivo: MotivoDivergenciaInventario, justificativa?: string) => Promise<void>;
  pendenciasCount: number;
  todasSaneadas: boolean;
  refetch: () => Promise<void>;
}
```

---

## 3.3 Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: `IN-07` (Mapa de conciliação: comparação em tempo real, seleção de motivos e justificativa para Outros).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `InventarioDivergenciaItemDTO`, `justificarDivergenciaSchema`, `MotivoDivergenciaInventario`.
- **Se o Frontend Web já implementou IN-07**:
  - O Mobile utiliza exatamente o mesmo schema Zod `justificarDivergenciaSchema` e a rota `PATCH /api/v1/inventario/ciclos/:id/itens/:itemId/justificativa`, assegurando que a regra de 15 caracteres mínimos para `OUTROS` seja respeitada em ambas as plataformas.
- **Se o Frontend Web ainda NÃO implementou IN-07**:
  - O desenvolvedor Mobile define os enums de motivos e schemas de justificativa em `packages/shared/src/contracts/inventario/`, permitindo que a tabela web os consuma diretamente.

---

## 4. Critérios de Aceite Detalhados

1. **Destaque das Discrepâncias**: O aplicativo deve exibir claramente a diferença entre a contagem física e o estoque teórico com cores distintas para sobras (+) e faltas (-).
2. **Seleção Tátil do Motivo**: A escolha do motivo sanitário deve ocorrer de forma fluida via seletor nativo ou bottom sheet.
3. **Exigência de 15 Caracteres para "OUTROS"**: O formulário deve bloquear o saneamento se o motivo for `OUTROS` e o texto explicativo contiver menos de 15 caracteres.
4. **Atualização em Tempo Real**: Conforme cada justificativa é confirmada, o contador de pendências do rodapé deve ser decrementado imediatamente.
5. **Recontagem Integrada**: Deve ser possível corrigir o valor físico contado sem sair da lista de divergências.

---

## 5. Cenários de Teste em BDD (Gherkin em Português)

```gherkin
Funcionalidade: Conferência de Divergências e Justificativas no Celular
  Como farmacêutico da UBS
  Quero revisar as divergências de contagem no aplicativo móvel
  Para justificar sobras e faltas antes do fechamento do ciclo

  Contexto:
    Dado que a contagem do lote "LOT-990" resultou em falta de 5 caixas
    E o usuário visualiza o card de divergência no celular

  Cenário: Justificativa com motivo "OUTROS" e texto insuficiente
    Quando o usuário seleciona o motivo "OUTROS"
    E digita a justificativa "Perda de frasco"
    E toca no botão "Salvar Justificativa"
    Então o sistema deve exibir o erro "O motivo Outros exige no mínimo 15 caracteres (digitados: 14)"
    E o card deve continuar com status de pendente

  Cenário: Justificativa válida e liberação para homologação
    Dado que resta apenas 1 divergência pendente no inventário
    Quando o usuário preenche a justificativa completa com mais de 15 caracteres
    E confirma o salvamento
    Então a justificativa deve ser gravada com sucesso
    E o rodapé deve exibir "Todas as divergências saneadas — pronto para homologação"
    E o botão de homologação deve ser habilitado
```

---

## 6. Checklist de DoD (Definition of Done)

- [ ] Tela `DivergenciasInventarioScreen` implementada com lista tátil e bottom sheet para justificativas.
- [ ] Schema `justificarDivergenciaSchema` importado de `@farmaubs/shared`.
- [ ] Suporte a recontagem in loco com recálculo instantâneo de diferença.
- [ ] Rodapé fixo com contador reativo de pendências bloqueantes.
- [ ] Testes de componentes mobile simulando validação de caracteres do motivo "OUTROS".
