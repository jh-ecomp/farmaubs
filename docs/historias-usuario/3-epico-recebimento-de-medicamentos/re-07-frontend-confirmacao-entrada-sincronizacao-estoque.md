# RE-07 feat(recebimento): Efetivação da Entrada: Submissão transacional, feedback visual e atualização dos saldos (RF008, RF024)

---

- **Épico**: Recebimento de Medicamentos (RF008, RF024, RF028, NF001, NF002, NF005)
- **Requisitos Funcionais**: RF008 (Registro de Entrada e Abastecimento de Estoque), RF024 (Confirmação Explícita de Validade Curta)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva e Feedback Imediato), NF002 (Design Responsivo), NF005 (Persistência / Prevenção de Perda de Digitação)
- **ADRs Vinculadas**: ADR-011 (React 19 + Vite + Tailwind CSS), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança e Orquestração com Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico ou operador de farmácia da UBS,  
> **quero** revisar o resumo consolidado dos itens da remessa conferida e submeter a entrada de estoque em lote com feedback visual imediato e invalidação automática dos saldos,  
> **para que** os saldos físicos sejam atualizados no sistema e disponibilizados com segurança para dispensação sem perda de digitação ou inconsistências sob falhas de rede (RF008, RF024).

---

## 2. Regras de negócio e casos de borda

1. **Totalizadores em Tempo Real**:
   - A tela mantém contadores atualizados em tempo real: quantidade de medicamentos distintos conferidos e soma total de unidades físicas a ingressar.
2. **Exigência Mínima de Submissão**:
   - O botão "Confirmar Entrada no Estoque" só é habilitado quando houver um cabeçalho válido (RE-05) e pelo menos 1 medicamento na lista provisória de conferência (RE-06).
3. **Modal de Resumo e Prevenção de Duplo Envio (Double-Click)**:
   - A confirmação final ocorre através de um modal de resumo da remessa. Durante a mutação, o botão entra em estado de `loading` (com spinner acessível) e bloqueia cliques múltiplos.
4. **Resiliência a Falhas de Rede**:
   - Caso a requisição retorne erro de rede ou código 500, os itens conferidos permanecem intactos na lista provisória, evitando qualquer perda de digitação.
5. **Invalidação Automática de Caches**:
   - Em caso de sucesso (201 Created), a aplicação dispara a invalidação dos caches do TanStack Query (`queryClient.invalidateQueries({ queryKey: ['estoque-atual'] })` e `['recebimentos-recentes']`), exibindo notificação toast de confirmação.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs / Tipagens)

### Contratos de Estado Local e Requisição HTTP

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

export interface EfetivarEntradaRequest {
  numeroDocumento: string;
  tipoDocumento: string;
  fornecedorOrigem: string;
  dataRecebimento: string;
  observacoes?: string;
  itens: {
    produtoId: string;
    fabricanteId: string;
    numeroLote: string;
    dataValidade: string;
    quantidadeRecebida: number;
    observacoes?: string;
  }[];
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

- **Camada**: D (Testes de Componentes e Fluxo de Páginas / Frontend React).
- **Página / Componente Integrador**: `apps/frontend/src/features/recebimento/pages/RecebimentoPage.tsx`.
- **Gerenciamento de Estado**: Estado local para a lista de itens da remessa (`itensConferidos`) e mutação com TanStack Query (`useMutation`).
- **Integração Backend**: Consumo da rota `POST /api/v1/recebimento/entradas`.

### Compartilhamento Arquitetural com `@farmaubs/shared` e App Mobile (`apps/mobile` - RE-MOB-03)
- **Contratos Exportados em `packages/shared/src/recebimento/recebimento.types.ts`**:
  - `EfetivarEntradaRequest`, `EntradaResultadoDto`.
- **Paridade com Mobile**:
  - Tanto a Web quanto o Mobile (`apps/mobile` - `RE-MOB-03`) enviam o mesmo payload `EfetivarEntradaRequest`. No Mobile, a confirmação se adapta ao formato de modal/bottom sheet nativo.

---

## 5. Cenários de teste em BDD (Gherkin — camada D)

```gherkin
# language: pt
Funcionalidade: Confirmação e Sincronização de Entrada de Estoque (Camada D)

  Cenário: Inclusão de múltiplos itens e cálculo de totalizadores da carga
    Dado que o farmacêutico preencheu o cabeçalho com a guia "GUIA-CAF-2026/104"
    E adicionou o primeiro medicamento: 300 comprimidos de "Amoxicilina 500mg" (Lote LT-1)
    E adicionou o segundo medicamento: 200 frascos de "Dipirona Gotas 500mg/ml" (Lote LT-2)
    Quando a tabela provisória de itens da remessa for atualizada
    Então deve exibir exatamente 2 linhas de medicamentos
    E o card de resumo deve exibir: "2 medicamentos distintos" e "500 unidades físicas a ingressar"
    E o botão "Confirmar Entrada no Estoque" deve ficar ativo com destaque visual verde

  Cenário: Remoção de item da conferência antes do envio
    Dado que um item foi adicionado com quantidade incorreta na lista provisória
    Quando o operador clicar no botão "Remover item" (ícone de lixeira) daquela linha
    Então o item deve ser imediatamente excluído da lista
    E os totalizadores de unidades e itens distintos devem ser recalculados em tempo real

  Cenário: Confirmação bem-sucedida e sincronização instantânea
    Dado que a remessa possui cabeçalho válido e pelo menos 1 medicamento conferido
    Quando o farmacêutico clicar em "Confirmar Entrada no Estoque"
    E confirmar a operação no modal de resumo da carga
    Então uma requisição "POST /api/v1/recebimento/entradas" deve ser enviada
    E ao retornar sucesso (201 Created):
      - Um toast verde de notificação deve ser exibido: "Entrada registrada! O estoque da UBS foi abastecido com sucesso."
      - O formulário de entrada deve ser resetado para um novo recebimento
      - O cache de "estoque-atual" e "ultimos-recebimentos" deve ser invalidado automaticamente no TanStack Query

  Cenário: Tratamento de erro de conexão ou rejeição do backend
    Dado que ocorreu uma instabilidade na rede durante o envio da remessa
    Quando a API retornar erro de conexão ou erro 500
    Então o modal deve permanecer aberto exibindo a mensagem: "Falha ao registrar entrada. Verifique sua conexão e tente novamente."
    E os itens da lista de conferência não devem ser perdidos, permitindo nova tentativa de envio
```

---

## 6. Checklist de DoD e aceitação

- [ ] Tela integrada combinando cabeçalho, formulário de item e grid provisória de conferência.
- [ ] Modal de confirmação acessível com suporte a fechamento por `Esc` e foco gerenciado.
- [ ] Testes de fluxo e integração (Camada D) validando adição de múltiplos itens, remoção e envio da mutação com mock do MSW.
- [ ] Invalidação dos caches de estoque e histórico no TanStack Query após sucesso.
