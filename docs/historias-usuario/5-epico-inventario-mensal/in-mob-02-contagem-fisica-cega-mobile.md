# IN-MOB-02 feat(inventario): Contagem Física de Inventário nas Prateleiras no Celular (RF013)

---

- **Épico**: Inventário Mensal (RF013, NF001, NF002, NF005, NF007)
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF013 (Realizar Inventário Mensal - Contagem Física)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva), NF002 (Ergonomia Touch em Campo), NF005 (Autosave em Rascunho), NF007 (Resposta Ágil)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-007 (API REST), ADR-022 (Monorepo), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança Monorepo)

---

## 1. História de usuário

> **Como** farmacêutico ou técnico de farmácia percorrendo as prateleiras da farmácia da UBS com o smartphone,  
> **quero** registrar a contagem física das caixas e frascos por lote diretamente no aplicativo, com busca ágil, botões incrementais táteis (+/-) e salvamento automático contínuo em rascunho (autosave),  
> **para que** eu possa realizar o levantamento físico com velocidade e conforto, sem pranchetas de papel e com garantia de que nenhuma digitação será perdida caso a conexão oscile (RF013, NF005).

---

## 2. Regras de negócio e casos de borda

1. **Ergonomia de Bancada e Contagem Física**:
   - Identificação do lote com nome do medicamento, apresentação, fabricante, código do lote e validade.
   - Botões largos de incremento (`+`) e decremento (`-`) nas laterais (mínimo de 48x48pt).
   - Não permite valores negativos (`>= 0`).
2. **Navegação e Filtros Rápidos**:
   - Busca com debounce de 300ms.
   - Filtros rápidos: `Pendentes` (padrão ao abrir), `Contados` e `Todos`.
3. **Salvamento Automático em Rascunho (Autosave)**:
   - Disparo em background com debounce de 1 segundo para `PUT /api/v1/inventario/ciclos/:id/itens/:itemId/contagem`.
   - Indicadores de sincronização: "Salvando contagem...", "Todas as contagens salvas" ou aviso de retenção local caso haja queda de rede.
4. **Detecção de Divergência**:
   - Badge sutil indicando divergência com atalho direto "Justificar" para a tela de conciliação (**IN-MOB-03**).

---

## 3. Contratos de dados e Protocolo HTTP (DTOs / Tipagens)

```typescript
export interface InventarioItemContagemDTO {
  id: string;
  produtoNome: string;
  principioAtivo: string;
  fabricanteNome: string;
  numeroLote: string;
  dataValidade: string;
  quantidadeTeorica: number;
  quantidadeFisica: number | null;
  divergencia: number | null;
  motivoDivergencia?: string;
  justificativaDivergencia?: string;
}

export interface SalvarContagemItemInputDTO {
  quantidadeFisica: number;
  motivoDivergencia?: string;
  justificativaDivergencia?: string;
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

- **Camada**: Mobile (`apps/mobile`).
- **Telas e Componentes**:
  - `apps/mobile/src/screens/inventario/ContagemFisicaScreen.tsx`.
  - `apps/mobile/src/features/inventario/components/ItemContagemCard.tsx`.
- **Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)**:
  - Contra-parte Web: `IN-06`.
  - Contratos compartilhados em `@farmaubs/shared` (`packages/shared/src/contracts/inventario/`).
  - Utilização da função pura `calcularDivergencia(teorico, fisico)`.

---

## 5. Cenários de teste em BDD (Gherkin — camada Mobile)

```gherkin
# language: pt
Funcionalidade: Contagem Física de Inventário no Celular (IN-MOB-02 / RF013)

  Contexto:
    Dado que o usuário está na tela de contagem do ciclo ativo no celular
    E a lista exibe o lote "LT-PARACETAMOL-100" pendente de contagem

  Cenário: Incremento de quantidade física com botões táteis
    Quando o usuário toca no botão "+" 5 vezes
    Então a quantidade exibida deve ser 5
    E a barra de sincronização deve indicar "Salvando..."
    E após 1 segundo deve indicar "Todas as contagens salvas"

  Cenário: Filtro por itens pendentes de contagem
    Dado que 10 itens já foram contados e 20 estão pendentes
    Quando o usuário seleciona o filtro "Pendentes"
    Então a lista deve exibir exatamente os 20 itens sem contagem
```

---

## 6. Checklist de DoD e aceitação

- [ ] Componente `ContagemFisicaScreen` com botões táteis largos (mínimo 48x48pt).
- [ ] Mecanismo de autosave com debounce e tolerância a falhas de conexão.
- [ ] Integração com `@farmaubs/shared` para tipagens e cálculo de divergência.
- [ ] Testes automatizados com React Native Testing Library validando incremento e autosave.
