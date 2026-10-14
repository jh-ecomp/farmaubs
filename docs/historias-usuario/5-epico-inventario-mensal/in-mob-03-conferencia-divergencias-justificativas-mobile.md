# IN-MOB-03 feat(inventario): Conferência de Divergências e Justificativas de Inventário no Celular (RF013)

---

- **Épico**: Inventário Mensal (RF013, NF001, NF006, NF007, NF009)
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF013 (Realizar Inventário Mensal - Mapa de Divergências)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva), NF006 (Contraste e Semântica de Cores), NF007 (Resposta Ágil), NF009 (RBAC por Perfil)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-007 (API REST), ADR-022 (Monorepo), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança Monorepo)

---

## 1. História de usuário

> **Como** farmacêutico responsável ou gestor de farmácia da UBS pelo aplicativo móvel,  
> **quero** inspecionar a lista de divergências apuradas na contagem do inventário (sobras e faltas), selecionar o motivo sanitário para cada discrepância e fornecer justificativa textual com validação de caracteres,  
> **para que** eu possa sanear e justificar todas as discordâncias de estoque diretamente pelo celular antes da homologação final (RF013).

---

## 2. Regras de negócio e casos de borda

1. **Card de Conciliação por Lote**:
   - Exibe medicamento, lote, validade e fabricante.
   - Comparativo visual: Teórico, Físico e Divergência (+X Sobra azul / -X Falta vermelho).
2. **Seletor de Motivo Sanitário**:
   - Opções padronizadas da rede e opção `OUTROS`.
3. **Regra Estrita para Motivo "OUTROS"**:
   - Exige no mínimo **15 caracteres** no campo descritivo com contador visual em tempo real (`8/15 mín.`).
4. **Recontagem Rápida e Painel de Pendências**:
   - Permite ajustar a contagem física diretamente do card caso encontrada caixa esquecida.
   - Barra inferior com resumo de pendências que habilita o avanço para homologação (**IN-MOB-04**) apenas após saneamento completo.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs / Tipagens)

```typescript
export interface InventarioDivergenciaItemDTO {
  id: string;
  produtoNome: string;
  principioAtivo: string;
  fabricanteNome: string;
  numeroLote: string;
  dataValidade: string;
  quantidadeTeorica: number;
  quantidadeFisica: number;
  divergencia: number;
  motivoDivergencia?: string;
  justificativaDivergencia?: string;
  conferidoPorNome: string;
}

export type MotivoDivergenciaInventario =
  | 'VALIDADE_VENCIDA'
  | 'AVARIA_QUEBRA'
  | 'EXTRAVIO'
  | 'ERRO_DIGITACAO'
  | 'ERRO_CONFERENCIA_ENTRADA'
  | 'DISPENSA_NAO_EFETIVADA'
  | 'ENTREGA_CAF_SEM_CONFERENCIA'
  | 'OUTROS';
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

- **Camada**: Mobile (`apps/mobile`).
- **Telas e Componentes**:
  - `apps/mobile/src/screens/inventario/DivergenciasScreen.tsx`.
  - `apps/mobile/src/features/inventario/components/JustificativaBottomSheet.tsx`.
- **Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)**:
  - Contra-parte Web: `IN-07`.
  - Contratos compartilhados em `@farmaubs/shared` (`packages/shared/src/contracts/inventario/`).
  - Validação de 15 caracteres mínimos para `OUTROS` via schema Zod compartilhado.

---

## 5. Cenários de teste em BDD (Gherkin — camada Mobile)

```gherkin
# language: pt
Funcionalidade: Justificativa de Divergências no Celular (IN-MOB-03 / RF013)

  Contexto:
    Dado que o usuário está na tela de divergências do ciclo ativo
    E o lote "LT-8812" apresenta falta de 15 unidades

  Cenário: Justificativa com motivo "OUTROS" e validação de tamanho mínimo
    Quando o usuário seleciona o motivo "OUTROS"
    E digita a justificativa "Ajuste físico" (13 caracteres)
    Então o contador deve alertar que faltam 2 caracteres
    E o botão de salvar justificativa deve permanecer desabilitado

  Cenário: Saneamento completo liberando homologação
    Dado que todas as divergências foram justificadas
    Quando a tela atualiza
    Então a barra inferior deve ficar verde com a mensagem "Todas as divergências saneadas"
    E o botão "Avançar para Homologação" deve ser habilitado
```

---

## 6. Checklist de DoD e aceitação

- [ ] Componente `DivergenciasScreen` com cards de comparativo teórico vs. físico.
- [ ] Bottom Sheet acessível para seleção de motivo e justificativa textual.
- [ ] Validador bloqueando "OUTROS" com menos de 15 caracteres via Zod compartilhado.
- [ ] Testes de interface automatizados com React Native Testing Library.
