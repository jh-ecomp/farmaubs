# RE-07: Efetivação da Entrada: Submissão transacional, feedback visual e atualização dos saldos (RF008, RF024)

---

- **Épico**: Recebimento de Medicamentos (RF008, RF024, RF028, NF001, NF002, NF005)
- **Requisitos Funcionais**: RF008 (Registro de Entrada e Abastecimento de Estoque), RF024 (Confirmação Explícita de Validade Curta)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva e Feedback Imediato), NF002 (Design Responsivo), NF005 (Persistência / Prevenção de Perda de Digitação)
- **ADRs Vinculadas**: ADR-011 (React 19 + Vite + Tailwind CSS), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança e Orquestração com Moonrepo)

---

## Contexto & Problema

Na rotina da farmácia, uma única remessa de medicamentos da CAF Central ou compra municipal pode conter de 1 a dezenas de itens diferentes na mesma guia. O farmacêutico precisa conferir visualmente todos os itens adicionados, verificar as quantidades totais e ter a certeza de que a submissão gravará a remessa completa de forma segura no estoque da UBS.

Esta história integra os componentes de cabeçalho (RE-05) e itens de conferência (RE-06) em um fluxo coeso na tela principal de recebimento, fornecendo totalizadores em tempo real, confirmação por modal com resumo da operação, feedback visual via toast e invalidação automática dos caches de estoque da aplicação.

---

## Escopo Técnico & Arquitetural

- **Camada**: D (Testes de Componentes e Fluxo de Páginas / Frontend React).
- **Página / Componente Integrador**: `apps/frontend/src/features/recebimento/pages/RecebimentoPage.tsx`.
- **Gerenciamento de Estado**: Estado local para a lista de itens da remessa em conferência (`itensConferidos`) e mutação com TanStack Query (`useMutation`).
- **Integração Backend**: Consumo da rota `POST /api/v1/recebimento/entradas` (especificada na RE-03).
- **Decisões Arquiteturais**: ADR-011 (React + Vite), ADR-013 (TanStack Query), ADR-032 (Acessibilidade), ADR-034 (Mobile Expo), ADR-035 (Moonrepo).

### Compartilhamento Arquitetural com `@farmaubs/shared` e App Mobile (`apps/mobile` - RE-MOB-03)
- **Contratos Exportados em `packages/shared/src/recebimento/recebimento.types.ts`**:
  - `EfetivarEntradaRequest`: `{ numeroDocumento: string; tipoDocumento: string; fornecedorOrigem: string; dataRecebimento: string; observacoes?: string; itens: ItemRecebimentoRequest[] }`.
  - `ItemRecebimentoRequest`: `{ produtoId: string; fabricanteId: string; numeroLote: string; dataValidade: string; quantidade: number }`.
  - `EntradaResultadoDto`: `{ id: string; numeroRecebimento: string; dataHora: string; totalItens: number; totalUnidades: number }`.
- **Paridade com Mobile**:
  - Tanto o fluxo Web (`RecebimentoPage.tsx`) quanto o Mobile (`apps/mobile` - `RE-MOB-03`) enviam o mesmo payload `EfetivarEntradaRequest`. No Mobile, a confirmação se adapta ao formato de modal/bottom sheet nativo com haptics de confirmação e resumo de remessa.
- **Diretrizes para Ciclos Independentes de Desenvolvimento**:
  - *Cenário A (Mobile já implementou RE-MOB-03)*: O Frontend Web consome diretamente `EfetivarEntradaRequest`, `ItemRecebimentoRequest` e `EntradaResultadoDto` já publicados em `@farmaubs/shared`.
  - *Cenário B (Mobile ainda NÃO implementou RE-MOB-03)*: O Frontend Web publica o payload consolidado de entrada de estoque em `packages/shared/src/recebimento/recebimento.types.ts`, acompanhado de mocks para validação do modal mobile.

---

## Critérios de Aceite (Gherkin BDD)

### Cenário 1: Inclusão de múltiplos itens e cálculo de totalizadores da carga
```gherkin
Dado que o farmacêutico preencheu o cabeçalho com a guia "GUIA-CAF-2026/104"
E adicionou o primeiro medicamento: 300 comprimidos de "Amoxicilina 500mg" (Lote LT-1)
E adicionou o segundo medicamento: 200 frascos de "Dipirona Gotas 500mg/ml" (Lote LT-2)
Quando a tabela provisória de itens da remessa for atualizada
Então deve exibir exatamente 2 linhas de medicamentos
E o card de resumo deve exibir: "2 medicamentos distintos" e "500 unidades físicas a ingressar"
E o botão "Confirmar Entrada no Estoque" deve ficar ativo com destaque visual verde
```

### Cenário 2: Remoção de item da conferência antes do envio
```gherkin
Dado que um item foi adicionado com quantidade incorreta na lista provisória
Quando o operador clicar no botão "Remover item" (ícone de lixeira) daquela linha
Então o item deve ser imediatamente excluído da lista
E os totalizadores de unidades e itens distintos devem ser recalculados em tempo real
```

### Cenário 3: Confirmação bem-sucedida e sincronização instantânea
```gherkin
Dado que a remessa possui cabeçalho válido e pelo menos 1 medicamento conferido
Quando o farmacêutico clicar em "Confirmar Entrada no Estoque"
E confirmar a operação no modal de resumo da carga
Então uma requisição "POST /api/v1/recebimento/entradas" deve ser enviada
E ao retornar sucesso (201 Created):
  - Um toast verde de notificação deve ser exibido: "Entrada registrada! O estoque da UBS foi abastecido com sucesso."
  - O formulário de entrada deve ser resetado para um novo recebimento
  - O cache de "estoque-atual" e "ultimos-recebimentos" deve ser invalidado automaticamente no TanStack Query
```

### Cenário 4: Tratamento de erro de conexão ou rejeição do backend
```gherkin
Dado que ocorreu uma instabilidade na rede durante o envio da remessa
Quando a API retornar erro de conexão ou erro 500
Então o modal deve permanecer aberto exibindo a mensagem: "Falha ao registrar entrada. Verifique sua conexão e tente novamente."
E os itens da lista de conferência não devem ser perdidos, permitindo nova tentativa de envio
```

---

## Contrato de Estado do Fluxo de Recebimento

```typescript
export interface ItemRemessaConferido {
  tempId: string;
  produtoId: string;
  produtoNome: string;
  fabricanteId: string;
  fabricanteNome: string;
  numeroLote: string;
  dataValidade: string;
  quantidadeRecebida: number;
  observacoes?: string;
}

export interface EstadoConferenciaRecebimento {
  cabecalho: CabecalhoRecebimentoFormData;
  itens: ItemRemessaConferido[];
  isSubmitting: boolean;
}
```

---

## Regras de Interface e Prevenção de Falhas

1. **Prevenção de Duplo Envio (Double-Click)**: O botão de submissão no modal de confirmação entra em estado de `loading` (com spinner acessível) e desabilita cliques repetidos enquanto a promise da mutação estiver pendente.
2. **Confirmação Explícita de Dados Sensíveis**: O modal de confirmação exibe um resumo destacando: número da nota/guia, quantidade total de caixas/frascos e aviso de que os saldos serão imediatamente disponibilizados para dispensação aos pacientes.
3. **Invalidação Transparente de Dados**: Imediatamente após a resposta positiva, o cliente executa:
   ```typescript
   queryClient.invalidateQueries({ queryKey: ['recebimentos-recentes'] });
   queryClient.invalidateQueries({ queryKey: ['estoque-atual'] });
   ```

---

## Definition of Done (DoD)

- [ ] Tela integrada combinando cabeçalho, formulário de item e grid provisória de conferência.
- [ ] Modal de confirmação acessível com suporte a fechamento por `Esc` e foco gerenciado.
- [ ] Testes de fluxo e integração (Camada D) validando adição de múltiplos itens, remoção e envio da mutação com mock do MSW.
