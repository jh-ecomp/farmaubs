# IN-MOB-01 feat(inventario): Visão Geral de Ciclos e Acompanhamento de Inventário no Celular (RF014, RF021)

---

- **Épico**: Inventário Mensal (RF014, RF021, NF001, NF002, NF007)
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF014 (Consultar Histórico de Inventários), RF021 (Relatório de Inventário Mensal)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva), NF002 (Ergonomia Touch), NF007 (Resposta Ágil)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-007 (API REST), ADR-022 (Monorepo), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança Monorepo)

---

## 1. História de usuário

> **Como** farmacêutico ou atendente de farmácia da UBS em rotina na unidade,  
> **quero** consultar no celular o estado do inventário mensal ativo na minha UBS, visualizando a barra de progresso das contagens físicas realizadas e acessando com um toque a tela de contagem,  
> **para que** eu possa acompanhar o andamento da conferência em tempo real e retomar imediatamente a contagem das caixas sem depender do computador desktop (RF014, RF021).

---

## 2. Regras de negócio e casos de borda

1. **Card Principal de Ciclo Ativo (Status `EM_ANDAMENTO`)**:
   - Número do Ciclo e Mês de Referência.
   - Barra de progresso visual calculada via `calcularProgressoInventario(total, contados)`.
   - Contadores numéricos em destaque e badge de divergências.
   - Botão tátil primário: `Continuar Contagem Física` (navega para **IN-MOB-02**).
2. **Estado sem Ciclo Aberto**:
   - Card ilustrativo informando que não há ciclo em andamento.
3. **Histórico Rápido de Inventários Anteriores**:
   - Lista resumida dos últimos 3 ciclos homologados na UBS com status `HOMOLOGADO` e link para consulta de Ata (**IN-MOB-04**).

---

## 3. Contratos de dados e Protocolo HTTP (DTOs / Tipagens)

```typescript
export interface InventarioCicloAtivoDTO {
  id: string;
  numeroCiclo: string;
  status: 'EM_ANDAMENTO';
  iniciadoEm: string;
  abertoPorNome: string;
  totalItens: number;
  itensConferidos: number;
  percentualConcluido: number;
  totalDivergencias: number;
}

export interface InventarioHistoricoItemDTO {
  id: string;
  numeroCiclo: string;
  numeroAta: string;
  homologadoEm: string;
  farmaceuticoNome: string;
  totalSobras: number;
  totalFaltas: number;
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

- **Camada**: Mobile (`apps/mobile`).
- **Telas e Componentes**:
  - `apps/mobile/src/screens/inventario/InventarioVisaoGeralScreen.tsx`.
- **Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)**:
  - Contra-parte Web: `IN-05`.
  - Contratos compartilhados em `@farmaubs/shared` (`packages/shared/src/contracts/inventario/`).
  - Utilização da função pura `calcularProgressoInventario` de `@farmaubs/shared`.

---

## 5. Cenários de teste em BDD (Gherkin — camada Mobile)

```gherkin
# language: pt
Funcionalidade: Visão Geral de Inventário no Celular (IN-MOB-01 / RF014, RF021)

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

## 6. Checklist de DoD e aceitação

- [ ] Tela `InventarioVisaoGeralScreen` implementada no `apps/mobile/src/screens/inventario/`.
- [ ] Hook `useCicloAtivo` consumindo a rota compartilhada da API via TanStack Query.
- [ ] Utilização da função `calcularProgressoInventario` de `@farmaubs/shared`.
- [ ] Testes automatizados com React Native Testing Library cobrindo estado ativo e sem ciclo.
