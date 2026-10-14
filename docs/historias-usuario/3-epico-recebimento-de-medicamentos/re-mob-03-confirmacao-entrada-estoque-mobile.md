# RE-MOB-03 feat(recebimento): Confirmação de Entrada e Sincronização de Estoque Mobile (RF008, RF024)

---

- **Épico**: Recebimento de Medicamentos (RF008, RF024, NF001, NF002, NF010)
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF008 (Registro de Entrada e Abastecimento de Estoque), RF024 (Confirmação Explícita de Validade Curta)
- **Requisitos Não-Funcionais**: NF001 (Feedback Imediato), NF002 (Ergonomia Mobile), NF010 (Atualização em Tempo Real)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-007 (API REST), ADR-022 (Monorepo), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança Monorepo)

---

## 1. História de usuário

> **Como** farmacêutico responsável pela conferência de remessa na UBS,  
> **quero** revisar o total de caixas e medicamentos conferidos no aplicativo móvel, validar avisos de lotes com validade curta e submeter a transação atômica de entrada de estoque,  
> **para que** os saldos da unidade sejam incrementados imediatamente no banco de dados com protocolo emitido (RF008, RF024).

---

## 2. Regras de negócio e casos de borda

1. **Tela de Revisão da Carga Conferida**:
   - Cabeçalho fixo com Guia e Fornecedor.
   - Lista rolante dos medicamentos com quantidades e lotes.
   - Totalizadores na base: total de medicamentos distintos e soma física total.
   - Ação de exclusão ou edição de quantidade por linha antes de confirmar.
2. **Aviso e Confirmação de Lotes com Validade Curta (< 180 dias)**:
   - Se qualquer item conferido possuir validade < 180 dias, um modal de alerta específico exige confirmação do farmacêutico:
     `⚠️ Constatado lote com validade inferior a 6 meses. Confirma o recebimento sob compromisso de giro prioritário?`
3. **Submissão Transacional com Proteção de Rede**:
   - Bloqueio de cliques múltiplos durante a requisição `POST /api/v1/recebimento/entradas`.
   - Feedback háptico de sucesso e emissão de tela com número do protocolo gerado.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs / Tipagens)

```typescript
export interface ItemRecebimentoRequest {
  produtoId: string;
  fabricanteId: string;
  numeroLote: string;
  dataValidade: string;
  quantidade: number;
}

export interface EfetivarEntradaRequest {
  numeroDocumento: string;
  tipoDocumento: string;
  fornecedorOrigem: string;
  dataRecebimento: string;
  observacoes?: string;
  itens: ItemRecebimentoRequest[];
}

export interface EntradaResultadoDto {
  id: string;
  numeroRecebimento: string;
  dataHora: string;
  totalItens: number;
  totalUnidades: number;
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

- **Camada**: Mobile (`apps/mobile`).
- **Telas e Componentes**:
  - `apps/mobile/src/features/recebimento/screens/RevisaoEntradaScreen.tsx`.
  - `apps/mobile/src/features/recebimento/components/AlertaValidadeCurtaModal.tsx`.
- **Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)**:
  - Contra-parte Web: `RE-07`.
  - Contratos compartilhados em `@farmaubs/shared` (`packages/shared/src/recebimento/recebimento.types.ts`).

---

## 5. Cenários de teste em BDD (Gherkin — camada Mobile)

```gherkin
# language: pt
Funcionalidade: Confirmação e Efetivação de Entrada Mobile (RE-MOB-03 / RF008)

  Cenário: Efetivação de remessa completa com sucesso
    Dado que o farmacêutico conferiu 3 medicamentos totalizando 600 unidades
    Quando tocar em "Confirmar Entrada no Estoque"
    E a API retornar status 201 Created com protocolo "#REC-2026-0044"
    Então o comprovante de recebimento deve ser apresentado
    E os dados locais de conferência devem ser limpos
```

---

## 6. Checklist de DoD e aceitação

- [ ] Revisão consolidada de todos os itens antes do envio para a API.
- [ ] Confirmação mandatória caso haja itens com validade < 180 dias.
- [ ] Submissão segura via endpoint unificado de entrada no estoque.
- [ ] Notificação clara de sucesso com protocolo gerado pelo backend.
- [ ] Recálculo em tempo real ao excluir itens da conferência.
