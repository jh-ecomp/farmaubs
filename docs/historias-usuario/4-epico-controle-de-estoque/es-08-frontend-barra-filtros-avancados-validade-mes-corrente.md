# ES-08 feat(estoque): Barra de Filtros Avançados: Busca Livre, Filtro de Validade no Mês Corrente e Categorias da REMUME

---

- **Épico**: Controle de Estoque (RF005, RF006, RF007, RF009, RF011, RF018, RF020, RF022, RF023, RF028, NF001, NF002, NF003, NF007, NF009, NF015)
- **Requisitos Funcionais**: RF005 (Filtro por Categorias e Catálogo), RF022 (Filtro Exclusivo de Medicamentos Vencendo no Mês Corrente)
- **Requisitos Não-Funcionais**: NF001 (Interface Fluida e Intuitiva), NF007 (Debounce de 300ms para Busca Textual)
- **ADRs Vinculadas**: ADR-011 (React 19 + Tailwind CSS), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico responsável ou operador de farmácia da UBS,  
> **quero** uma barra de filtros ergonômica e ágil com campo de busca por texto com debounce, filtro rápido para isolar medicamentos que vencem no mês corrente, seletor de categorias clínicas e filtro por nível de disponibilidade,  
> **para que** eu possa localizar em poucos segundos qualquer medicamento ou insumo da farmácia sem sobrecarregar a interface com recarregamentos desnecessários (RF005, RF022).

---

## 2. Regras de negócio e casos de borda

1. **Campo de Busca Textual com Debounce (300ms)**:
   - Permite digitar o nome comercial, princípio ativo ou código de lote com debounce de 300ms.
   - Ícone de lupa à esquerda e botão limpar ("X") à direita quando preenchido.
2. **Filtro de Validade Dedicado**:
   - `Todos`: Sem filtro temporal;
   - `Vencendo no Mês Vigente`: Isola itens com lote expirando no mês civil atual (com badge laranja no seletor);
   - `Validade Curta (< 90 dias)`: Isola itens expirando nos próximos 90 dias;
   - `Vencidos`: Exibe apenas lotes cuja validade já expirou.
3. **Filtro por Categoria Clínica da REMUME**:
   - Dropdown com as categorias do município (ex.: "Anti-hipertensivos", "Antidiabéticos", "Antimicrobianos", etc.).
4. **Filtro por Nível de Estoque**:
   - Seleção entre: "Todos", "Apenas em Estoque", "Baixo Estoque / Risco de Ruptura" e "Zerados".
5. **Botão Limpar Filtros**:
   - Reseta todos os campos para o estado padrão em um único clique e refaz a consulta na primeira página.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs / Tipagens)

```typescript
export interface ConsultarSaldosQueryDto {
  termo?: string;
  categoria?: string;
  filtroValidade?: 'TODOS' | 'MES_CORRENTE' | 'VALIDADE_90D' | 'VENCIDOS';
  statusEstoque?: 'TODOS' | 'EM_ESTOQUE' | 'BAIXO_ESTOQUE' | 'ZERADO';
  pagina?: number;
  itensPorPagina?: number;
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

- **Camada**: D (Testes de Componentes React).
- **Componente**: `apps/frontend/src/features/estoque/components/EstoqueFiltrosBar.tsx`.
- **Props**:
  - `valores: ConsultarSaldosQueryDto`;
  - `onChange: (novosFiltros: Partial<ConsultarSaldosQueryDto>) => void`;
  - `onLimpar: () => void`.

### Compartilhamento Arquitetural com `@farmaubs/shared` e App Mobile (`apps/mobile` - ES-MOB-03)
- **DTO de Consulta Compartilhado**: `ConsultarSaldosQueryDto` e schema Zod `consultarSaldosQuerySchema` centralizados em `@farmaubs/shared`.
- **Ergonomia Tátil**: No mobile, os filtros são apresentados via chips de rolagem horizontal e Bottom Sheet para filtros combinados.

---

## 5. Cenários de teste em BDD (Gherkin — camada D)

```gherkin
# language: pt
Funcionalidade: Barra de Filtros de Estoque (Camada D)

  Cenário: Seleção do filtro "Vencendo no Mês Vigente"
    Dado que a barra de filtros está renderizada
    Quando o farmacêutico selecionar a opção "Vencendo no Mês Vigente" no seletor de validade
    Então o callback "onChange" deve ser disparado com "filtroValidade=MES_CORRENTE" e "pagina=1"
    E a interface deve exibir um chip/tag indicativo de filtro ativo

  Cenário: Digitação no campo de busca com debounce
    Dado que o farmacêutico digita "Amox" no campo de busca textual
    Quando passarem 300 milissegundos sem novas teclas digitadas
    Então a busca deve ser disparada com termo "Amox"
    E a página da consulta deve ser resetada para a primeira página
```

---

## 6. Checklist de DoD e aceitação

- [ ] Componente implementado com debounce funcional via hook customizado `useDebounce`.
- [ ] Seletor de validade contendo opção explícita de "Vencendo no Mês Corrente".
- [ ] Testes de componentes (Camada D) validando atraso do debounce e acionamento dos filtros com acessibilidade por teclado (`Tab`, `Enter`).
- [ ] Schema Zod consumido de `@farmaubs/shared`.
