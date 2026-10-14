# ES-09 feat(estoque): Modais Operacionais: Ficha de Rastreabilidade do Lote e Diálogo de Ajuste Rápido (+/-) Justificado

---

- **Épico**: Controle de Estoque (RF005, RF006, RF007, RF009, RF011, RF018, RF020, RF022, RF023, RF028, NF001, NF002, NF003, NF007, NF009, NF015)
- **Requisitos Funcionais**: RF009 (Registrar Ajuste de Estoque - Entrada), RF011 (Registrar Ajuste de Estoque - Saída), RF028 (Rastreabilidade e Log de Auditoria)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva com Modais Acessíveis), NF002 (Design Responsivo), NF009 (RBAC Restrito)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-011 (React 19 + Tailwind CSS), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico responsável ou residente da UBS,  
> **quero** abrir um modal de ajuste rápido para lançar acréscimos (+) ou baixas (-) no saldo de um lote informando motivo sanitário e justificativa obrigatória, e abrir um modal de ficha de rastreabilidade para inspecionar a linha do tempo completa daquele lote,  
> **para que** eu possa sanar discrepâncias físicas de estoque na bancada e fiscalizar o histórico de movimentações sem sair da tela principal (RF009, RF011, RF028).

---

## 2. Regras de negócio e casos de borda

1. **Modal de Ajuste de Estoque (`ModalAjusteEstoque.tsx`)**:
   - Exibe nome do medicamento, apresentação, fabricante, código do lote e saldo atual em destaque.
   - Alternância de operação: `Entrada (+)` em verde ou `Saída (-)` em vermelho.
   - Quantidade inteira positiva (> 0). Em saídas, bloqueia valores superiores ao saldo atual do lote.
   - Motivo sanitário obrigatório:
     - Entrada: `Correção de Inventário`, `Devolução de Paciente`, `Outro`.
     - Saída: `Validade Vencida`, `Avaria Física / Quebra`, `Extravio`, `Recolhimento Sanitário`, `Outro`.
   - Justificativa obrigatória: mínimo de 10 caracteres (ou 20 caracteres caso o motivo seja "Outro").
   - Dispara toast de sucesso e invalida os caches de métricas e saldos no TanStack Query.
2. **Modal de Ficha de Rastreabilidade (`ModalFichaRastreabilidade.tsx`)**:
   - Consome `GET /api/v1/estoque/lotes/:loteId/rastreabilidade`.
   - Exibe linha do tempo cronológica com marcadores visuais para cada tipo de movimentação, com data/hora, quantidade, saldo resultante, usuário responsável e documento de suporte.
3. **Acessibilidade dos Modais (ADR-032)**:
   - `role="dialog"`, `aria-modal="true"`, foco aprisionado (focus trap), fechamento por `Escape` e retorno do foco ao botão disparador.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs / Schemas Zod)

```typescript
import { z } from 'zod';

export const registrarAjusteSchema = z.object({
  tipoOperacao: z.enum(['ENTRADA', 'SAIDA']),
  quantidade: z.number().int().positive('A quantidade deve ser maior que zero'),
  motivo: z.string().min(1, 'Selecione o motivo do ajuste'),
  justificativa: z.string().min(10, 'A justificativa deve conter pelo menos 10 caracteres'),
}).refine(
  (data) => {
    if (data.motivo === 'OUTRO') {
      return data.justificativa.trim().length >= 20;
    }
    return true;
  },
  {
    message: "O motivo 'Outro' exige justificativa detalhada com no mínimo 20 caracteres",
    path: ['justificativa'],
  }
);

export type RegistrarAjusteLoteInputDto = z.infer<typeof registrarAjusteSchema>;
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

- **Camada**: D (Testes de Componentes React).
- **Componentes**:
  - `apps/frontend/src/features/estoque/components/ModalAjusteEstoque.tsx`;
  - `apps/frontend/src/features/estoque/components/ModalFichaRastreabilidade.tsx`.
- **Hooks**: `useRegistrarAjusteEstoque()` e `useRastreabilidadeLote(loteId)`.

### Compartilhamento Arquitetural com `@farmaubs/shared` e App Mobile (`apps/mobile` - ES-MOB-04 e ES-MOB-05)
- **DTOs de Operação e Schema Zod**: `RegistrarAjusteLoteInputDto`, `RastreabilidadeLoteDto` e `registrarAjusteSchema` centralizados em `@farmaubs/shared`.
- **Validação de Justificativa e Saldo**: Regra de mínimo 10 caracteres (ou 20 para "Outro") validada pelo Zod compartilhado.
- **Equivalência Mobile**:
  - Ajuste rápido implementado na tela/modal mobile `AjusteEstoqueScreen` (**ES-MOB-04**).
  - Linha do tempo de rastreabilidade implementada no componente nativo `FichaRastreabilidadeLoteMobile` (**ES-MOB-05**).

---

## 5. Cenários de teste em BDD (Gherkin — camada D)

```gherkin
# language: pt
Funcionalidade: Modais de Ajuste e Ficha de Rastreabilidade (Camada D)

  Cenário: Confirmação de ajuste de saída por avaria com justificativa válida
    Dado que o modal de ajuste está aberto para o lote "LT-01" com saldo de 20 unidades
    Quando o farmacêutico selecionar a operação "Saída (-)"
    E preencher a quantidade "2"
    E selecionar o motivo "Avaria Física / Quebra"
    E preencher a justificativa "Frasco quebrou durante manuseio na bancada"
    E clicar no botão "Confirmar Ajuste"
    Então a mutação deve ser enviada com sucesso
    E o modal deve ser fechado
    E um toast informativo de sucesso deve ser exibido

  Cenário: Bloqueio do botão de confirmação quando a justificativa é insuficiente
    Dado que o modal de ajuste está aberto com motivo "Outro"
    Quando o usuário digitar apenas "ajuste" na justificativa (6 caracteres)
    Então o botão "Confirmar Ajuste" deve permanecer desabilitado
    E deve ser exibido o aviso: "O motivo 'Outro' exige justificativa detalhada com no mínimo 20 caracteres"
```

---

## 6. Checklist de DoD e aceitação

- [ ] Modais desenvolvidos com validação via React Hook Form + Zod.
- [ ] Invalidação automática dos caches de `estoque/metricas` e `estoque/saldos` após mutação.
- [ ] Linha do tempo de rastreabilidade com formatação limpa e clara das movimentações.
- [ ] Testes de componentes (Camada D) validando bloqueio de saldo excedente, focus trap e feedback toast.
