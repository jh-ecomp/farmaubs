# ES-09: Modais Operacionais: Ficha de Rastreabilidade do Lote e Diálogo de Ajuste Rápido (+/-) Justificado

---

- **Épico**: Controle de Estoque (RF005, RF006, RF007, RF009, RF011, RF018, RF020, RF022, RF023, RF028, NF001, NF002, NF003, NF007, NF009, NF015)
- **Requisitos Funcionais**: RF009 (Registrar Ajuste de Estoque - Entrada), RF011 (Registrar Ajuste de Estoque - Saída), RF028 (Rastreabilidade e Log de Auditoria)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva com Modais Acessíveis), NF002 (Design Responsivo), NF009 (RBAC Restrito)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-011 (React 19 + Tailwind CSS), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de Usuário

> **Como** farmacêutico responsável ou residente da UBS,  
> **quero** abrir um modal de ajuste rápido para lançar acréscimos (+) ou baixas (-) no saldo de um lote informando motivo sanitário e justificativa obrigatória, e abrir um modal de ficha de rastreabilidade para inspecionar a linha do tempo completa daquele lote,  
> **para que** eu possa sanar discrepâncias físicas de estoque na bancada e fiscalizar o histórico de movimentações sem sair da tela principal (RF009, RF011, RF028).

---

## 2. Regras de Negócio e Casos de Borda

1. **Modal de Ajuste de Estoque (`ModalAjusteEstoque.tsx`)**:
   - **Cabeçalho Informativo**: Exibe o nome do medicamento, apresentação, fabricante, código do lote e saldo atual em destaque.
   - **Seletor de Tipo de Operação**:
     - Botão de alternância: `Entrada (+)` em verde ou `Saída (-)` em vermelho.
   - **Campo Quantidade**:
     - Input numérico inteiro positivo (> 0).
     - Em caso de saída: validação em tempo real impedindo digitação de quantidade superior ao saldo atual do lote.
   - **Dropdown de Motivo Sanitário**:
     - Opções para Entrada: `Correção de Inventário`, `Devolução de Paciente`, `Outro`.
     - Opções para Saída: `Validade Vencida`, `Avaria Física / Quebra`, `Extravio`, `Recolhimento Sanitário`, `Outro`.
   - **Campo de Justificativa Textual Obrigatória**:
     - Mínimo de 10 caracteres (e mínimo de 20 caracteres caso o motivo seja "Outro", atendendo à recomendação de Bruno Santana na entrevista de 29/09/2026);
     - Contador de caracteres em tempo real e mensagem de aviso com `aria-live`.
   - **Submissão**:
     - Consome `POST /api/v1/estoque/lotes/:loteId/ajustes`;
     - Dispara toast de sucesso e invalida os caches de métricas e saldos no TanStack Query.

2. **Modal de Ficha de Rastreabilidade (`ModalFichaRastreabilidade.tsx`)**:
   - Consome `GET /api/v1/estoque/lotes/:loteId/rastreabilidade`.
   - Exibe linha do tempo cronológica com marcadores visuais (badges/ícones):
     - Ícone verde para `ENTRADA_RECEBIMENTO`;
     - Ícone azul para `SAIDA_DISPENSACAO`;
     - Ícone roxo para `AJUSTE_ENTRADA` / `AJUSTE_SAIDA`;
     - Ícone cinza para estornos.
   - Exibe data/hora formatada, quantidade, saldo resultante, nome do usuário responsável e documento de suporte (Guia CAF, senha ou justificativa).

3. **Acessibilidade dos Modais (ADR-032)**:
   - Uso de `role="dialog"`, `aria-modal="true"`, foco aprisionado (focus trap), tecla `Escape` para fechar e retorno do foco ao botão disparador.

---

## 3. Escopo Técnico & Arquitetural

- **Camada**: D (Testes de Componentes React).
- **Componentes**:
  - `apps/frontend/src/features/estoque/components/ModalAjusteEstoque.tsx`;
  - `apps/frontend/src/features/estoque/components/ModalFichaRastreabilidade.tsx`.
- **Hooks**: `useRegistrarAjusteEstoque()` e `useRastreabilidadeLote(loteId)`.

### Compartilhamento Arquitetural com @farmaubs/shared e App Mobile (apps/mobile - ES-MOB-04 e ES-MOB-05)
- **DTOs de Operação e Schema Zod**: `RegistrarAjusteLoteInputDto`, `RastreabilidadeLoteDto` e o schema `registrarAjusteSchema` estão unificados em `@farmaubs/shared/src/contracts/estoque/`.
- **Validação de Justificativa e Saldo**: A regra que exige no mínimo 10 caracteres (ou 20 caracteres se o motivo for "Outro") e a validação de que uma saída não pode exceder o saldo atual do lote são executadas pelo schema Zod compartilhado no frontend web e no app mobile (evitando round-trips inválidos).
- **Equivalência Mobile**:
  - Ajuste rápido é implementado na tela/modal mobile `AjusteEstoqueScreen` (**ES-MOB-04**).
  - A linha do tempo de rastreabilidade é implementada no componente nativo `FichaRastreabilidadeLoteMobile` (**ES-MOB-05**).
- **Diretrizes para Ciclos Independentes de Desenvolvimento**:
  - *Cenário A (Mobile já implementou ES-MOB-04/ES-MOB-05)*: O Frontend Web consome diretamente `RegistrarAjusteLoteInputDto`, `RastreabilidadeLoteDto` e `registrarAjusteSchema` já validados em `@farmaubs/shared`.
  - *Cenário B (Mobile ainda NÃO implementou)*: O Frontend Web publica as regras de validação de justificativa (mínimo 10 caracteres ou 20 para "Outro") e schemas de DTO em `packages/shared/src/contracts/estoque/`, garantindo que os formulários móveis sigam exatamente os mesmos limites.

---

## 4. Critérios de Aceite (Gherkin BDD)

### Cenário 1: Confirmação de ajuste de saída por avaria com justificativa válida
```gherkin
Dado que o modal de ajuste está aberto para o lote "LT-01" com saldo de 20 unidades
Quando o farmacêutico selecionar a operação "Saída (-)"
E preencher a quantidade "2"
E selecionar o motivo "Avaria Física / Quebra"
E preencher a justificativa "Frasco quebrou durante manuseio na bancada"
E clicar no botão "Confirmar Ajuste"
Então a mutação deve ser enviada com sucesso
E o modal deve ser fechado
E um toast informativo de sucesso deve ser exibido
```

### Cenário 2: Bloqueio do botão de confirmação quando a justificativa é insuficiente
```gherkin
Dado que o modal de ajuste está aberto com motivo "Outro"
Quando o usuário digitar apenas "ajuste" na justificativa (6 caracteres)
Então o botão "Confirmar Ajuste" deve permanecer desabilitado
E deve ser exibido o aviso: "O motivo 'Outro' exige justificativa detalhada com no mínimo 20 caracteres"
```

---

## 5. Definition of Done (DoD)

- [ ] Modais desenvolvidos com validação via React Hook Form + Zod.
- [ ] Invalidação automática dos caches de `estoque/metricas` e `estoque/saldos` após mutação.
- [ ] Linha do tempo de rastreabilidade com formatação limpa e clara das movimentações.
- [ ] Testes de componentes (Camada D) validando bloqueio de saldo excedente, focus trap e feedback toast.
