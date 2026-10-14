# RE-MOB-02 feat(recebimento): Conferência Física de Medicamentos, Lotes e Validades Mobile (RF008, RF024)

---

- **Épico**: Recebimento de Medicamentos (RF008, RF024, NF001, NF002, NF007)
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF008 (Registro de Medicamento, Fabricante, Lote e Validade), RF024 (Alerta de Validade Curta e Bloqueio de Vencidos)
- **Requisitos Não-Funcionais**: NF001 (Autocomplete Rápido), NF002 (Ergonomia Touch), NF007 (Resposta Ágil)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-007 (API REST), ADR-022 (Monorepo), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança Monorepo)

---

## 1. História de usuário

> **Como** profissional de saúde conferindo caixas na farmácia com dispositivo móvel,  
> **quero** buscar medicamentos por texto rápido, selecionar o fabricante/laboratório, digitar o lote físico e a data de validade com alerta de validade curta (< 180 dias) e bloqueio de vencidos,  
> **para que** eu garanta a rastreabilidade sanitária de cada caixa descarregada sem riscos de inserir medicamentos impróprios para consumo na UBS (RF008, RF024).

---

## 2. Regras de negócio e casos de borda

1. **Busca Textual de Medicamento com Autocomplete**:
   - Campo com debounce de 250ms consumindo `GET /api/v1/catalogo/produtos/busca`. Resultados em lista sobreposta ou bottom sheet para seleção com um toque.
2. **Seleção Obrigatória de Fabricante / Laboratório**:
   - Seletor em lista com os laboratórios cadastrados (EMS, Prati-Donaduzzi, Medley, Fiocruz, etc.) e botão rápido "+ Novo" para inclusão rápida sem perda de digitação.
3. **Digitação de Lote e Data de Validade**:
   - `Lote`: campo alfanumérico em caixa alta automática (`autoCapitalize="characters"`).
   - `Data de Validade`: input com máscara `MM/AAAA` ou `DD/MM/AAAA` e DateTimePicker.
   - Bloqueia data expirada (`❌ Data de validade expirada. Medicamentos vencidos não podem ser recebidos.`).
   - Alerta para validade < 180 dias (`⚠️ Atenção: Validade curta (vence em X dias). Verifique a rotatividade do item.`).
4. **Quantidade e Adição à Lista de Conferência**:
   - Quantidade física com stepper (`+10`, `+50`, `+100`) e botão primário "Adicionar à Remessa" com feedback háptico.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs / Tipagens)

```typescript
export interface ItemConferenciaRecebimentoDto {
  produtoId: string;
  produtoNome: string;
  fabricanteId: string;
  fabricanteNome: string;
  numeroLote: string;
  dataValidade: string;
  quantidade: number;
}

export interface FabricanteDto {
  id: string;
  nome: string;
  ativo: boolean;
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

- **Camada**: Mobile (`apps/mobile`).
- **Telas e Componentes**:
  - `apps/mobile/src/features/recebimento/screens/ConferenciaItensScreen.tsx`.
  - `apps/mobile/src/features/recebimento/components/MedicamentoAutocompleteSheet.tsx`.
- **Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)**:
  - Contra-parte Web: `RE-06`.
  - Contratos compartilhados em `@farmaubs/shared` (`packages/shared/src/recebimento/catalogo-recebimento.types.ts`).
  - Funções puras: `validarDataValidadeFutura(data)` e `classificarValidadeRecebimento(dataValidade)`.

---

## 5. Cenários de teste em BDD (Gherkin — camada Mobile)

```gherkin
# language: pt
Funcionalidade: Conferência Física de Lote e Validade Mobile (RE-MOB-02 / RF008, RF024)

  Cenário: Inclusão válida de medicamento e lote com fabricante
    Dado que o usuário selecionou o medicamento "Dipirona 500mg/ml Gotas"
    Quando selecionar o fabricante "Prati-Donaduzzi"
    E digitar o lote "LOTE-998" com validade futura de 18 meses e quantidade 200
    E tocar em "Adicionar à Remessa"
    Então o item deve ser adicionado à lista de conferência da guia

  Cenário: Bloqueio de lote com validade no passado
    Dado que o usuário informa a data de validade de um mês atrás
    Quando retirar o foco do campo
    Então uma mensagem de erro indicando data expirada deve ser exibida
    E a adição à remessa deve ser impedida
```

---

## 6. Checklist de DoD e aceitação

- [ ] Campo de pesquisa textual fluida sem necessidade de scanner óptico.
- [ ] Associação obrigatória com fabricante/laboratório da carga.
- [ ] Validador bloqueando datas de validade anteriores ao dia atual.
- [ ] Badge de aviso para lotes com validade inferior a 180 dias.
- [ ] Validações de data e contratos consumidos de `@farmaubs/shared`.
- [ ] Testes de tipagem aprovados via `moon run mobile:typecheck`.
