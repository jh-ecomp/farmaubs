# ES-MOB-04 feat(estoque): Ajuste Rápido Avulso de Estoque no Celular

---

- **Épico**: Controle de Estoque (RF-009, RF-011, RF-028, RNF-001, RNF-006, RNF-009)
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF-009, RF-011, RF-028
- **Requisitos Não-Funcionais**: RNF-001, RNF-006, RNF-009
- **ADRs Vinculadas**: ADR-006, ADR-007, ADR-022, ADR-034, ADR-035
- **História Frontend Irmã**: ES-09 (Modais Operacionais: Diálogo de Ajuste Rápido Justificado)
- **Complexidade Estimada**: Média

---

## 1. História de usuário

> **Como** Farmacêutico Responsável ou Residente em fiscalização na UBS com o celular na mão,  
> **quero** abrir um formulário modal de ajuste rápido para lançar uma entrada avulsa (+) ou baixa sanitária (-) em determinado lote com justificativa obrigatória e motivo regulatório,  
> **para que** eu possa corrigir imediatamente divergências físicas (como frascos quebrados ou lotes vencidos descartados) diretamente da prateleira sem precisar retornar à estação desktop.

---

## 2. Regras de negócio e casos de borda

### 2.1 Fluxo e Controles do Formulário Móvel
- **Abertura do Diálogo / Modal Sheet**:
  - Acionado a partir do botão `Ajuste (+/-)` no lote expandido da lista de saldos (**ES-MOB-02**).
  - Cabeçalho exibe: Nome do medicamento, apresentação, laboratório, lote e saldo atual em destaque.
- **Seletor Segmentado de Operação**:
  - `Entrada (+)` com cor verde.
  - `Saída (-)` com cor vermelha.
- **Campo Quantidade**:
  - Teclado numérico nativo (`keyboardType="number-pad"`).
  - Quantidade deve ser um número inteiro estritamente positivo (> 0).
  - **Bloqueio de Saldo Insuficiente**: Se a operação for `Saída (-)` e a quantidade informada for maior que o saldo atual do lote, o campo exibe mensagem de erro imediata em vermelho e o botão de confirmar permanece desabilitado.
- **Seletor de Motivo Sanitário (Picker / Modal)**:
  - Motivos para Saída: `Validade Vencida`, `Avaria Física / Quebra`, `Extravio`, `Recolhimento Sanitário`, `Outro`.
  - Motivos para Entrada: `Correção de Inventário`, `Devolução de Paciente`, `Outro`.
- **Campo de Justificativa Textual Obrigatória**:
  - Input multiline com contagem de caracteres em tempo real.
  - Regra de validação:
    - Mínimo de 10 caracteres para motivos padrão.
    - Mínimo de 20 caracteres caso o motivo selecionado seja `Outro`.
  - Exibe contador visual (ex: `14/10 mín.`).

### 2.2 Usabilidade Mobile e Proteção de Dados
- Utilização de `KeyboardAvoidingView` com `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` para garantir que o teclado não cubra o campo de justificativa nem o botão de confirmação.
- Botão "Confirmar Ajuste" com estado de loading enquanto a mutação está em trânsito.
- Em caso de sucesso: emissão de vibração háptica de sucesso (`Haptics.notificationAsync(Success)`), fechamento do modal, exibição de toast informativo e invalidação automática dos caches de saldo e métricas.

### 2.3 Critérios de Aceite Detalhados
1. **Identificação do Lote**: O modal deve deixar visível o lote e o saldo em tempo real antes de qualquer alteração.
2. **Alternância Clara de Tipo**: A escolha entre `Entrada` e `Saída` deve alterar dinamicamente a lista de motivos sanitários disponíveis.
3. **Validação de Quantidade em Saídas**: O sistema móvel deve impedir o envio se a saída exceder o saldo existente do lote.
4. **Validação de Justificativa**: A validação Zod compartilhada (`registrarAjusteSchema`) deve bloquear a submissão com justificativas curtas ou vazias.
5. **Atualização Imediata**: Após a confirmação, o saldo exibido na lista mobile deve ser atualizado sem recarregar o app.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs / Tipagens)

```typescript
import {
  RegistrarAjusteLoteInputDto,
  registrarAjusteSchema,
  TipoOperacaoAjuste,
  MotivoAjusteEstoque,
} from '@farmaubs/shared';

export interface UseAjusteEstoqueMobileProps {
  loteId: string;
  saldoAtual: number;
  onSuccess: () => void;
  onCancel: () => void;
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

- **Camada**: Mobile (`apps/mobile`).
- **Componentes**:
  - `ModalAjusteEstoqueMobile` (`apps/mobile/src/screens/estoque/components/`).
- **Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)**:
  - **Contra-parte no Frontend Web**: `ES-09` (Modais de ficha de movimentação do lote e ajuste rápido justificado).
  - **Contratos Compartilhados (`@farmaubs/shared`)**: `RegistrarAjusteLoteInputDto`, `registrarAjusteSchema`, `TipoOperacaoAjuste`, `MotivoAjusteEstoque`.
  - **Se o Frontend Web já implementou ES-09**: O Mobile utiliza exatamente o mesmo schema Zod `registrarAjusteSchema` e a rota `POST /api/v1/estoque/ajustes`.
  - **Se o Frontend Web ainda NÃO implementou ES-09**: O desenvolvedor Mobile define os enums de motivos e schemas em `packages/shared/src/contracts/estoque/`.

---

## 5. Cenários de teste em BDD (Gherkin — camada Mobile)

```gherkin
# language: pt
Funcionalidade: Ajuste Rápido de Estoque no Celular (ES-MOB-04)

  Contexto:
    Dado que o lote "LOTE-2026A" possui saldo de 30 frascos
    E o usuário abre o modal de ajuste rápido para este lote no smartphone

  Cenário: Tentativa de baixa com quantidade superior ao saldo
    Quando o usuário seleciona a operação "Saída (-)"
    E informa a quantidade "35"
    Então o sistema deve exibir a mensagem de erro "Quantidade de saída não pode ser maior que o saldo atual (30)"
    E o botão de confirmação deve permanecer desabilitado

  Cenário: Registro de baixa por quebra com justificativa válida
    Dado que o usuário seleciona a operação "Saída (-)"
    E informa a quantidade "2"
    E seleciona o motivo "Avaria Física / Quebra"
    E preenche a justificativa "Frascos quebrados durante a arrumação da prateleira do setor A"
    Quando toca no botão "Confirmar Ajuste"
    Então a mutação deve ser enviada com sucesso
    E o aplicativo deve emitir um feedback háptico de sucesso
    E o novo saldo de 28 frascos deve ser refletido imediatamente
```

---

## 6. Checklist de DoD e aceitação

- [ ] Componente `ModalAjusteEstoqueMobile` implementado com suporte a teclado móvel.
- [ ] Schema Zod `registrarAjusteSchema` integrado ao formulário (`react-hook-form` + `@hookform/resolvers/zod`).
- [ ] Bloqueio em tempo real de quantidades superiores ao saldo em operações de saída.
- [ ] Mutação com TanStack Query invalidando caches de saldos e métricas.
- [ ] Testes automatizados com React Native Testing Library cobrindo validação de caracteres e bloqueio de saldo.
