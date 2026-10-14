# ES-07 feat(estoque): Tabela Principal de Saldos: Visão por Medicamento, Expansão de Lotes e Badges de Validade em Laranja

---

- **Épico**: Controle de Estoque (RF005, RF006, RF007, RF009, RF011, RF018, RF020, RF022, RF023, RF028, NF001, NF002, NF003, NF007, NF009, NF015)
- **Requisitos Funcionais**: RF005 (Catálogo de Medicamentos e Apresentações), RF022 (Alerta Visual de Validade em Laranja)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva com Expansão em Cascata), NF002 (Design Responsivo em Tablets e Desktops), NF007 (Performance de Renderização)
- **ADRs Vinculadas**: ADR-011 (React 19 + Tailwind CSS), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico ou operador de farmácia da UBS,  
> **quero** visualizar os saldos de medicamentos da unidade em uma tabela limpa e responsiva, com agrupamento por medicamento e capacidade de expandir as linhas para inspecionar os lotes individuais, identificando imediatamente os lotes com vencimento no mês corrente através de badges destacados na cor laranja,  
> **para que** eu possa consultar rapidamente o estoque de bancada e priorizar os lotes com validade crítica durante a rotina diária (RF005, RF022).

---

## 2. Regras de negócio e casos de borda

1. **Estrutura Hierárquica em Cascata (Accordion)**:
   - **Linha Principal (Medicamento)**:
     - Nome do Medicamento, Concentração e Forma Farmacêutica;
     - Princípio Ativo (DCI) e Categoria Clínica da REMUME;
     - Saldo Total na UBS (soma de todos os lotes);
     - Status de Estoque (badge verde "Regular", âmbar "Baixo Estoque", vermelho "Zerado");
     - Botão expansor com chevron (`aria-expanded="true/false"` e `aria-controls`).
   - **Subtabela Expandida (Lotes Físicos daquele Medicamento)**:
     - Código do Lote (fonte monoespaçada) e Fabricante / Laboratório;
     - Data de Validade no formato `DD/MM/AAAA`;
     - **Badge Semântico de Validade**:
       - **Laranja vibrante** (`bg-amber-100 text-amber-800 border-amber-300`): Lote com vencimento no **mês corrente** ou em prazo inferior a 90 dias;
       - **Verde** (`bg-emerald-100 text-emerald-800`): Lote com validade regular (> 90 dias);
       - **Vermelho** (`bg-rose-100 text-rose-800`): Lote vencido com saldo remanescente;
     - Saldo físico individual do lote;
     - Ações por lote: botão "Ajuste Rápido (+/-)" e botão "Ficha de Rastreabilidade".
2. **Ordenação Inteligente dos Lotes (FEFO)**:
   - Lotes na linha expandida são ordenados prioritariamente por data de validade crescente.
3. **Controles de Paginação Acessíveis**:
   - Rodapé com indicador de página atual, total de registros e navegação com teclado e rótulos `aria-label`.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs / Tipagens)

```typescript
export interface LoteEstoqueDto {
  id: string;
  numeroLote: string;
  fabricanteId: string;
  fabricanteNome: string;
  dataValidade: string;
  saldoAtual: number;
  statusValidade: 'REGULAR' | 'CURTA_90D' | 'MES_CORRENTE' | 'VENCIDO';
}

export interface MedicamentoSaldoItemDto {
  produtoId: string;
  nome: string;
  principioAtivo: string;
  formaFarmaceutica: string;
  concentracao: string;
  unidadeMedida: string;
  categoria: string;
  saldoTotal: number;
  statusEstoque: 'REGULAR' | 'BAIXO_ESTOQUE' | 'ZERADO';
  lotes: LoteEstoqueDto[];
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

- **Camada**: D (Testes de Componentes React).
- **Componente**: `apps/frontend/src/features/estoque/components/TabelaSaldosEstoque.tsx`.
- **Props**:
  - `medicamentos: MedicamentoSaldoItemDto[]`;
  - `carregando: boolean`;
  - `onAbrirAjuste: (lote: LoteEstoqueDto, medicamento: MedicamentoSaldoItemDto) => void`;
  - `onAbrirRastreabilidade: (lote: LoteEstoqueDto, medicamento: MedicamentoSaldoItemDto) => void`.

### Compartilhamento Arquitetural com `@farmaubs/shared` e App Mobile (`apps/mobile` - ES-MOB-02)
- **Modelos e DTOs Unificados**: Centralizados em `@farmaubs/shared/src/contracts/estoque/`.
- **Lógica de Agrupamento e Ordenação FEFO**: Utilitários `ordenarLotesPorFEFO` e `calcularStatusValidade` exportados de `@farmaubs/shared`.
- **Padronização Visual**: Cor de alerta laranja de vencimento próximo (`#D97706` / `text-amber-700`) compartilhada entre Web e Mobile.

---

## 5. Cenários de teste em BDD (Gherkin — camada D)

```gherkin
# language: pt
Funcionalidade: Tabela de Saldos e Detalhamento de Lotes (Camada D)

  Cenário: Expansão de linha de medicamento e exibição de badge laranja para lote do mês corrente
    Dado que o medicamento "Losartana Potássica 50mg" possui 2 lotes cadastrados
    E o lote "LT-LOS-01" vence no mês corrente e o lote "LT-LOS-02" vence daqui a 1 ano
    Quando o farmacêutico clicar no botão de expandir da linha da Losartana
    Então a subtabela de lotes deve ser exibida
    E o lote "LT-LOS-01" deve apresentar o badge de validade com a cor laranja
    E o lote "LT-LOS-02" deve apresentar o badge de validade com a cor verde

  Cenário: Acionamento do botão de ajuste rápido na linha do lote
    Dado que a subtabela do lote "LT-LOS-01" está expandida
    Quando o usuário clicar no botão de ação "Ajuste (+/-)" daquele lote
    Então o callback "onAbrirAjuste" deve ser acionado recebendo os dados do lote e do produto
```

---

## 6. Checklist de DoD e aceitação

- [ ] Tabela implementada em React 19 com suporte a expansão e colapso de linhas.
- [ ] Badges de validade implementados com a cor laranja acordada e contraste WCAG 2.1 AA (> 4.5:1).
- [ ] Testes de componentes (Camada D) validando comportamento do accordion, renderização condicional de badges e eventos de clique.
