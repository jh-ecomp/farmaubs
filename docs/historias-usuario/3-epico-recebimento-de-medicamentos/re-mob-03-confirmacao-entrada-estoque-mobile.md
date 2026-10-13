# RE-MOB-03 Confirmação de Entrada e Sincronização de Estoque Mobile (RF008, RF024)

- **Épico**: Recebimento de Medicamentos
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF008 (Registro de Entrada e Abastecimento de Estoque), RF024 (Confirmação Explícita de Validade Curta)
- **Requisitos Não-Funcionais**: NF001 (Feedback Imediato), NF002 (Ergonomia Mobile), NF010 (Atualização em Tempo Real)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-007 (API REST), ADR-022 (Monorepo), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança Monorepo)

---

## 1. História de Usuário

> **Como** farmacêutico responsável pela conferência de remessa na UBS,  
> **quero** revisar o total de caixas e medicamentos conferidos no aplicativo móvel, validar avisos de lotes com validade curta e submeter a transação atômica de entrada de estoque,  
> **para que** os saldos da unidade sejam incrementados imediatamente no banco de dados com protocolo emitido (RF008).

---

## 2. Regras de Negócio e Casos de Borda Mobile

1. **Tela de Revisão da Carga Conferida**:
   - Cabeçalho fixo com Guia e Fornecedor.
   - Lista rolante dos medicamentos com quantidades e lotes.
   - Totalizadores na base: total de medicamentos distintos (ex.: "4 medicamentos") e soma física total (ex.: "1.200 unidades").
   - Ação de exclusão ou edição de quantidade por linha antes de confirmar.

2. **Aviso e Confirmação de Lotes com Validade Curta (< 180 dias)**:
   - Se qualquer item conferido possuir validade < 180 dias, um modal de alerta específico exige confirmação do farmacêutico responsável:
     `⚠️ Constatado lote com validade inferior a 6 meses. Confirma o recebimento sob compromisso de giro prioritário?`

3. **Submissão Transacional com Proteção de Rede**:
   - Toque em "Confirmar Entrada no Estoque":
     - Botão bloqueado com indicador de carregamento.
     - Dispara `POST /api/v1/recebimento/entradas` com payload `EfetivarEntradaRequest`.
   - Sucesso:
     - Feedback háptico de sucesso.
     - Emissão de tela com o número do protocolo de recebimento (ex.: `#REC-2026-0033`).
     - Botão de compartilhamento do termo e botão de retorno ao início.

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

### 3.1 Rotas Consumidas
- `POST /api/v1/recebimento/entradas`

### 3.2 Tipagens Compartilhadas (`packages/shared/src/recebimento/recebimento.types.ts`)

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

## 3.3 Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: `RE-07` (Efetivação da entrada: envio da carga e atualização imediata do estoque).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `EfetivarEntradaRequest`, `ItemRecebimentoRequest`, `EntradaResultadoDto`.
- **Se o Frontend Web já implementou RE-07**:
  - O Mobile utiliza o mesmo payload consolidado `EfetivarEntradaRequest` e a rota `POST /api/v1/recebimento/entradas`, garantindo transacionalidade idêntica.
- **Se o Frontend Web ainda NÃO implementou RE-07**:
  - O desenvolvedor Mobile define os contratos em `packages/shared/src/recebimento/recebimento.types.ts`, acompanhados de tipagens de erro e mocks para que a tela web utilize exatamente a mesma carga de dados.

---

## 4. Critérios de Aceite Detalhados

- [ ] Revisão consolidada de todos os itens antes do envio para a API.
- [ ] Confirmação mandatória caso haja itens com validade < 180 dias.
- [ ] Submissão segura via endpoint unificado de entrada no estoque.
- [ ] Notificação clara de sucesso com protocolo gerado pelo backend.
- [ ] Recálculo em tempo real ao excluir itens da conferência.

---

## 5. Cenários de Teste (BDD / Gherkin)

```gherkin
# language: pt
Funcionalidade: Confirmação e Efetivação de Entrada Mobile (RE-MOB-03 / RF008)

  Cenário: Efetivação de remessa completa com sucesso
    Dado que o farmacêutico conferiu 3 medicamentos totalizando 600 unidades
    Quando tocar em "Confirmar Entrada no Estoque"
    E a API retornar status 201 Created com protocolo "#REC-2026-0044"
    Então o comprovante de recebimento deve ser apresentado
    E os saldos de estoque devem ser atualizados

  Cenário: Exigência de confirmação para lote de validade curta
    Dado que a remessa contém um lote com vencimento em 90 dias
    Quando o farmacêutico clicar em confirmar entrada
    Então um diálogo de consentimento de validade curta deve ser exibido
    E a submissão só deve ocorrer após o aceite explícito
```

---

## 6. Checklist de DoD e Aceitação

- [ ] Interface mobile em React Native sem travamentos.
- [ ] Tipos sincronizados a partir de `@farmaubs/shared`.
- [ ] Tipagem verificada via `moon run mobile:typecheck`.
