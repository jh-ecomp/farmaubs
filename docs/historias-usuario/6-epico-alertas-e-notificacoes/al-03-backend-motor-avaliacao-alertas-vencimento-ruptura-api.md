# AL-03 feat(alertas): Motor de Avaliação e API de Alertas de Vencimento Próximo e Risco de Ruptura

---

- **Épico**: Alertas, Notificações e Parâmetros Operacionais (RF022, RF023, RF027, NF007, NF015)
- **Requisitos Funcionais**: RF022 (Alertar Medicamentos Próximos ao Vencimento), RF023 (Alertar Risco de Ruptura de Estoque)
- **Requisitos Não-Funcionais**: NF003 (Português Brasil), NF007 (Tempo de Resposta < 2s), NF015 (Isolamento Multi-tenant por UBS)
- **ADRs Vinculadas**: ADR-003 / ADR-033 (Clean Architecture Pura), ADR-004 (Comunicação via Portas e Outbox), ADR-010 (Cálculo Determinístico de Demanda e Cobertura), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camadas A, B e C)

---

## 1. História de usuário

> **Como** farmacêutico ou gerente da UBS,  
> **quero** que o sistema avalie continuamente os lotes e saldos da farmácia para detectar medicamentos próximos ao vencimento e itens cuja cobertura em dias esteja abaixo do tempo de entrega da CAF somado ao estoque de segurança, disponibilizando uma API rápida para listar alertas por categoria/severidade, consultar contadores de resumo e marcar alertas como lidos,  
> **para que** eu tenha visibilidade imediata das prioridades sanitárias da unidade e os alertas sejam resolvidos automaticamente assim que o estoque for regularizado (RF022, RF023, ADR-010).

---

## 2. Regras de negócio e casos de borda

1. **Regra Sanitária de Soma de Lotes para Ruptura (RF023)**:
   - Um medicamento dividido em múltiplos lotes na UBS **só entra em alerta de risco de ruptura se a soma dos saldos de todos os seus lotes válidos (não vencidos)** resultar em cobertura inferior ou igual a `cafLeadTimeDays + estoqueSegurancaDias`.
   - Lotes já vencidos (`data_validade < CURRENT_DATE`) **não compõem** o saldo disponível para cálculo de cobertura assistencial.
2. **Fórmula Determinística de Cobertura (ADR-010)**:
   - $\text{CMD} = \frac{\text{Total dispensado nos últimos } N \text{ dias}}{N}$, onde $N = \text{janelaConsumoDias}$ (padrão 90 dias).
   - Se $\text{SaldoConsolidadoValido} = 0$ e o medicamento teve movimentação na UBS (ou possui lote cadastrado), gera alerta `ESTOQUE_ZERADO` com severidade `CRITICO` e cobertura `0 dias`.
   - Se $\text{CMD} > 0$: $\text{CoberturaDias} = \lfloor \frac{\text{SaldoConsolidadoValido}}{\text{CMD}} \rfloor$.
     - Se $\text{CoberturaDias} \le \text{cafLeadTimeDays}$: alerta `RISCO_RUPTURA` com severidade `CRITICO`;
     - Se $\text{cafLeadTimeDays} < \text{CoberturaDias} \le (\text{cafLeadTimeDays} + \text{estoqueSegurancaDias})$: alerta `RISCO_RUPTURA` com severidade `ATENCAO`.
3. **Regra de Avaliação por Lote para Vencimento (RF022)**:
   - Avalia individualmente cada lote com `saldo_atual > 0`:
     - Se $\text{diasParaVencer} \le 0$: tipo `VENCIDO`, severidade `CRITICO`;
     - Se $0 < \text{diasParaVencer} \le 30$: tipo `VENCIMENTO_PROXIMO`, severidade `CRITICO`;
     - Se $30 < \text{diasParaVencer} \le \text{limiarVencimentoDias}$: tipo `VENCIMENTO_PROXIMO`, severidade `ATENCAO`.
4. **Gatilhos de Avaliação e Auto-Resolução**:
   - O motor é acionado:
     1. Sincronamente após mutações de estoque da UBS (efetivação de recebimento, dispensação, ajuste manual, homologação de inventário ou edição de parâmetros operacionais);
     2. Por job diário agendado (meia-noite) para atualizar a passagem do tempo (`dias_para_vencer`) de todas as UBSs ativas.
   - Se a condição que originou um alerta deixar de existir (ex.: novo recebimento elevou a cobertura para 45 dias, ou lote vencido foi baixado para saldo 0), o alerta aberto transiciona automaticamente para `status = 'RESOLVIDO'` com `resolvido_em = NOW()`.
5. **Confirmação de Leitura**:
   - O usuário pode marcar um alerta individual (`PATCH /api/v1/alertas/:id/lido`) ou todos os alertas ativos da UBS (`POST /api/v1/alertas/marcar-todos-lidos`) como `LIDO`, reduzindo o contador de não lidos do sino de notificações sem ocultar o alerta da Central de Alertas enquanto a situação física persistir.

---

## 3. Contratos de dados e Protocolo HTTP (`@farmaubs/shared`)

### 3.1 Tipagens e Funções Puras (`packages/shared/src/alertas/alertas.types.ts`)
```typescript
export type TipoAlertaEstoque =
  | 'VENCIMENTO_PROXIMO'
  | 'VENCIDO'
  | 'RISCO_RUPTURA'
  | 'ESTOQUE_ZERADO';

export type SeveridadeAlertaEstoque = 'ATENCAO' | 'CRITICO';
export type StatusAlertaEstoque = 'ATIVO' | 'LIDO' | 'RESOLVIDO';
export type AbaAlertaFiltro = 'VENCIMENTO' | 'RUPTURA' | 'TODOS';

export interface AlertaEstoqueItemDto {
  id: string;
  ubsId: string;
  produtoId: string;
  produtoNome: string;
  principioAtivo: string;
  apresentacao: string;
  unidadeMedida: string;
  loteId: string | null;
  numeroLote: string | null;
  fabricanteNome: string | null;
  tipoAlerta: TipoAlertaEstoque;
  severidade: SeveridadeAlertaEstoque;
  status: StatusAlertaEstoque;
  titulo: string;
  descricao: string;
  saldoAtual: number;
  consumoMedioDiario: number | null;
  coberturaDias: number | null;
  diasParaVencer: number | null;
  dataValidade: string | null; // YYYY-MM-DD
  lidoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ResumoAlertasUbsDto {
  totalAtivos: number;
  totalNaoLidos: number;
  totalCriticos: number;
  totalAtencao: number;
  porCategoria: {
    vencimentoCritico: number;
    vencimentoAtencao: number;
    rupturaCritica: number;
    rupturaAtencao: number;
  };
}

export interface ListarAlertasQueryDto {
  aba?: AbaAlertaFiltro;
  severidade?: SeveridadeAlertaEstoque;
  apenasNaoLidos?: boolean;
  busca?: string;
  pagina?: number;
  limite?: number;
}
```

### 3.2 Endpoints REST
- **`GET /api/v1/alertas/resumo`** ➔ Retorna `ResumoAlertasUbsDto` para o badge do cabeçalho e cards do Dashboard.
- **`GET /api/v1/alertas`** ➔ Retorna lista paginada de `AlertaEstoqueItemDto` ordenada por severidade (`CRITICO` primeiro) e menor cobertura/validade.
- **`POST /api/v1/alertas/reavaliar`** ➔ Força reavaliação imediata sob demanda da UBS ativa e retorna `ResumoAlertasUbsDto`.
- **`PATCH /api/v1/alertas/:id/lido`** ➔ Marca um alerta como `LIDO`.
- **`POST /api/v1/alertas/marcar-todos-lidos`** ➔ Marca todos os alertas `ATIVO` da UBS como `LIDO`.

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-033)

- **Pacote Compartilhado (`packages/shared/src/alertas/`)**:
  - Funções puras `avaliarSeveridadeVencimento(diasParaVencer, limiarDias)` e `avaliarRiscoRuptura(saldoValido, cmd, leadTimeDias, segurancaDias)` com 100% de cobertura unitária.
- **Domínio e Aplicação (`apps/backend/src/modules/alertas/`)**:
  - `AvaliarAlertasUbsUseCase`: consulta saldos válidos, lotes e dispensações da janela configurada, executa as funções puras de avaliação, faz *upsert* dos alertas vigentes, resolve os normalizados e grava eventos inéditos em `outbox_events`.
  - `ListarAlertasUseCase`, `ObterResumoAlertasUseCase` e `MarcarAlertaLidoUseCase`.

---

## 5. Cenários de teste em BDD (Gherkin — camadas A, B e C)

```gherkin
# language: pt
Funcionalidade: Motor de Avaliação de Alertas de Vencimento e Ruptura (RF022, RF023)

  Contexto:
    Dado que a UBS possui limiar de vencimento de 90 dias, lead time CAF de 15 dias e estoque de segurança de 7 dias (ponto crítico = 22 dias)

  Cenário: Medicamento com dois lotes onde um lote é pequeno mas o saldo consolidado é seguro não gera falso alerta de ruptura
    Dado que o medicamento "Losartana Potássica 50 mg" possui consumo médio diário de 10 comprimidos/dia
    E possui o lote "LT-A" com 35 comprimidos (vence em 40 dias) e o lote "LT-B" com 300 comprimidos (vence em 300 dias)
    Quando o motor de avaliação de alertas for executado na UBS
    Então não deve ser gerado alerta de "RISCO_RUPTURA" pois o saldo consolidado é de 335 comprimidos (33 dias > 22 dias)
    Mas deve ser gerado um alerta "VENCIMENTO_PROXIMO" com severidade "ATENCAO" especificamente para o lote "LT-A"

  Cenário: Geração de alerta crítico de ruptura quando cobertura cai abaixo do lead time da CAF
    Dado que o medicamento "Metformina 850 mg" possui consumo médio diário de 20 comprimidos/dia
    E após uma dispensação seu saldo consolidado válido cai para 200 comprimidos (cobertura de 10 dias)
    Quando o motor de avaliação for executado
    Então deve ser criado um alerta "RISCO_RUPTURA" com severidade "CRITICO" indicando cobertura de 10 dias
    E um evento "ALERTA_CRITICO_DETECTADO" deve ser inserido na tabela "outbox_events"

  Cenário: Auto-resolução de alerta de ruptura após entrada de nova remessa da CAF
    Dado que existe um alerta ativo de "RISCO_RUPTURA" para "Metformina 850 mg"
    Quando for efetivado um recebimento da CAF adicionando 1.000 comprimidos de "Metformina 850 mg" (cobertura sobe para 60 dias)
    Então o alerta anterior deve mudar automaticamente para o status "RESOLVIDO"
```

---

## 6. Checklist de DoD e aceitação

- [ ] Calculadoras puras de cobertura e vencimento implementadas e testadas em `@farmaubs/shared`.
- [ ] `AvaliarAlertasUbsUseCase` integrado via porta com os módulos de Dispensação, Recebimento, Estoque e Inventário.
- [ ] Regra de soma consolidada de lotes válidos respeitada (evitando falsos alertas quando há múltiplos lotes).
- [ ] Auto-resolução testada quando o estoque é reabastecido ou o lote próximo ao vencimento é zerado.
- [ ] Testes nas camadas A, B e C passando sem regressões.
