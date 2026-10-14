# IN-06 feat(inventario): Formulário de Contagem Física: Lançamento por Lote com Busca Inteligente e Salvamento Automático em Rascunho

---

- **Épico**: Inventário Mensal (RF009, RF011, RF013, RF014, RF021, RF028, NF001, NF002, NF003, NF005, NF007, NF008, NF009, NF015)
- **Requisitos Funcionais**: RF013 (Realizar Inventário Mensal - Contagem Física)
- **Requisitos Não-Funcionais**: NF001 (Interface Rápida de Bancada), NF002 (Design Responsivo), NF005 (Autosave em Rascunho sem Perda de Digitação)
- **ADRs Vinculadas**: ADR-011 (React 19 + Tailwind CSS), ADR-013 (TanStack Query e Context API), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico responsável ou residente da UBS,  
> **quero** uma interface ágil de conferência física na prateleira que permita buscar medicamentos por texto, lançar as quantidades físicas contadas por lote com salvamento automático contínuo em rascunho (autosave) e visualizar o feedback de divergência em tempo real,  
> **para que** eu execute a contagem das caixas sem receio de perder o trabalho caso ocorra instabilidade de rede ou o navegador seja fechado acidentalmente (RF013, NF005).

---

## 2. Regras de negócio e casos de borda

1. **Mecanismo de Busca e Navegação por Itens**:
   - Barra de busca com debounce (300ms) permitindo filtrar por nome comercial, princípio ativo ou código de lote.
   - Filtros rápidos: "Todos", "Apenas Não Conferidos" (prioritário na rotina) e "Já Conferidos".
2. **Lançamento de Quantidade Física**:
   - Exibe medicamento, concentração, fabricante, lote e validade.
   - Campo numérico `quantidadeFisica` com botões incrementais (`+` e `-`) e digitação direta (inteiro `>= 0`).
3. **Persistência Contínua em Rascunho (Autosave - NF005)**:
   - Ao alterar o valor do campo numérico:
     - Dispara requisição com debounce de 1 segundo para `PUT /api/v1/inventario/ciclos/:id/itens/:itemId/contagem`;
     - Indicador visual no topo: "Salvando alterações...", "Todas as contagens salvas em rascunho" ou aviso de retenção local caso haja falha temporária de rede.
4. **Identificação Imediata de Divergência**:
   - Se a contagem física for divergente do saldo teórico, a linha recebe destaque visual e exibe botão "Justificar Divergência".

---

## 3. Contratos de dados e Protocolo HTTP (DTOs / Schemas Zod)

```typescript
import { z } from 'zod';

export const salvarContagemItemSchema = z.object({
  quantidadeFisica: z
    .number({ invalid_type_error: 'Informe um número válido' })
    .int('A quantidade deve ser um número inteiro')
    .min(0, 'A quantidade física não pode ser negativa'),
  motivoDivergencia: z.string().optional(),
  justificativaDivergencia: z.string().max(500).optional(),
});

export type SalvarContagemItemInputDTO = z.infer<typeof salvarContagemItemSchema>;
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

- **Camada**: D (Testes de Componentes e Fluxos React).
- **Componente Principal**: `apps/frontend/src/features/inventario/components/InventarioContagemForm.tsx`.
- **Hooks & Integrações**:
  - `useItensContagem(cicloId, filtros)`: TanStack Query;
  - `useSalvarContagemItem()`: Mutação com atualização otimista (optimistic update);
  - `useAutosaveInventario()`: Hook personalizado para controle de status e fila de sincronização.

### Compartilhamento Arquitetural com `@farmaubs/shared` e App Mobile (`apps/mobile` - IN-MOB-02)
- **Contratos e DTOs de Contagem**: `SalvarContagemItemInputDTO` e `salvarContagemItemSchema` centralizados em `@farmaubs/shared`.
- **Lógica Pura de Comparação de Divergência**: `calcularDivergencia(saldoTeorico, quantidadeFisica)`.
- **Especialização Mobile**: O app mobile (**IN-MOB-02**) é o instrumento primário de bancada nas prateleiras com botões incrementais táteis (+ / -) de 44x44pt e `KeyboardAvoidingView`.

---

## 5. Cenários de teste em BDD (Gherkin — camada D)

```gherkin
# language: pt
Funcionalidade: Formulário de Contagem Física e Autosave (Camada D)

  Cenário: Digitação de contagem e salvamento automático em rascunho
    Dado que o farmacêutico está na tela de contagem do ciclo ativo
    Quando ele digitar a quantidade física "45" no lote "LT-DIP-01"
    Então o indicador de sincronização deve passar para "Salvando alterações..."
    E após 1 segundo a requisição de atualização deve ser confirmada
    E o indicador deve exibir "Todas as contagens salvas em rascunho" com ícone de check

  Cenário: Filtro por itens pendentes de conferência física
    Dado que o ciclo possui 120 itens e 40 já foram contados
    Quando o usuário acionar o filtro "Apenas Não Conferidos"
    Então a lista na tela deve exibir exatamente os 80 itens que ainda estão com contagem nula
    E o contador superior deve refletir a quantidade pendente
```

---

## 6. Checklist de DoD e aceitação

- [ ] Formulário de contagem implementado com inputs numéricos acessíveis e foco ordenado por teclado.
- [ ] Mecanismo de autosave com debounce e tratamento de erros de conexão com retenção em estado local.
- [ ] Testes de componentes (Camada D) validando cálculo de divergência na UI, disparo de requisição e persistência de dados.
- [ ] Schemas e helpers de validação consumidos de `@farmaubs/shared`.
