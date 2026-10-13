# DI-MOB-04 Confirmação de Baixa e Recibo Digital de Dispensação Mobile (RF010)

- **Épico**: Dispensação de Medicamentos
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF010 (Registro de Dispensa e Baixa em Tempo Real)
- **Requisitos Não-Funcionais**: NF001 (Design Nativo), NF002 (Ergonomia), NF010 (Feedback Instantâneo), NF011 (Segurança)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-007 (API REST), ADR-022 (Monorepo), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança Monorepo)

---

## 1. História de Usuário

> **Como** farmacêutico finalizando o atendimento na UBS através do celular ou tablet,  
> **quero** revisar o resumo da dispensação em uma tela de confirmação, disparar a efetivação da baixa no estoque do PostgreSQL e gerar um comprovante/recibo digital legível com opção de compartilhamento,  
> **para que** o estoque da unidade seja atualizado em tempo real e o paciente ou profissional disponha do comprovante do atendimento prestado (RF010).

---

## 2. Regras de Negócio e Casos de Borda Mobile

1. **Tela de Revisão Prévia do Atendimento**:
   - Resumo consolidado antes da efetivação:
     - Identificação do paciente (Nome, CPF e CNS);
     - Lista dos medicamentos, lotes e quantidades prescritas;
     - UBS de atendimento ativa.
   - Botão de ação primário: "Confirmar e Efetivar Baixa".

2. **Efetivação de Baixa com Trava de Duplo Toque**:
   - Ao tocar em "Confirmar", o botão assume estado de carregamento (`<ActivityIndicator>`), desabilitando cliques subsequentes.
   - Envia requisição `POST /api/v1/dispensacoes` com token de sessão seguro no cabeçalho.
   - Resposta com sucesso:
     - Emite feedback tátil de sucesso (vibração háptica positiva).
     - Apresenta a tela de **Comprovante Digital de Dispensação**.

3. **Comprovante Digital e Compartilhamento Nativo**:
   - O comprovante exibe:
     - Número do atendimento gerado pela API (ex.: `#DSP-2026-0042`);
     - Data e hora exatas da operação;
     - Nome da UBS e do farmacêutico responsável;
     - Tabela compacta dos medicamentos entregues com posologia.
   - Botão "Compartilhar Comprovante": aciona a API nativa de compartilhamento (`Share.share`) permitindo enviar o resumo por WhatsApp, e-mail ou salvar em PDF.
   - Botão "Novo Atendimento": reinicia o fluxo de dispensação limpando todos os estados para o próximo paciente.

4. **Tratamento de Falha Concorrente ou Erro de Rede**:
   - Falha 409 (Saldo Insuficiente): exibe alerta explicando qual medicamento/lote teve alteração de saldo, mantendo o formulário aberto para seleção de novo lote.
   - Queda de conexão: exibe mensagem com botão "Tentar Novamente" sem perda dos dados preenchidos.

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

### 3.1 Rotas Consumidas
- `POST /api/v1/dispensacoes`

### 3.2 Tipagens Compartilhadas (`packages/shared/src/dispensacao/dispensacao.types.ts`)

```typescript
export interface DispensacaoResultadoDto {
  id: string;
  numeroAtendimento: string;
  dataHora: string;
  pacienteNome: string;
  totalItens: number;
  itens: {
    medicamentoNome: string;
    numeroLote: string;
    quantidade: number;
    posologia: string;
  }[];
}
```

---

## 3.3 Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: `DI-09` (Tela principal integrando atendimento, métricas e baixa de estoque).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `EfetivarDispensacaoRequest`, `DispensacaoResultadoDto`.
- **Se o Frontend Web já implementou DI-09**:
  - O Mobile utiliza o mesmo DTO de resultado e os mesmos status codes de erro do backend (`201 Created` para sucesso, `409 Conflict` para insuficiência concorrente de estoque).
  - Adapta o layout para exibição de recibo em tela única com suporte ao compartilhamento nativo do Android (`Share.share`).
- **Se o Frontend Web ainda NÃO implementou DI-09**:
  - O desenvolvedor Mobile define os contratos em `packages/shared/src/dispensacao/dispensacao.types.ts`, permitindo que a tela web utilize exatamente os mesmos schemas quando for iniciada.

---

## 4. Critérios de Aceite Detalhados

- [ ] Tela de revisão exibindo dados completos do paciente e lista de medicamentos.
- [ ] Mutação executada com proteção anti-duplo clique e indicador visual de progresso.
- [ ] Apresentação do recibo digital com número de protocolo emitido pelo backend.
- [ ] Integração com recurso nativo de compartilhamento do sistema operacional.
- [ ] Ação de "Novo Atendimento" redefinindo completamente a memória de estados para novo ciclo.

---

## 5. Cenários de Teste (BDD / Gherkin)

```gherkin
# language: pt
Funcionalidade: Confirmação e Recibo de Dispensação Mobile (DI-MOB-04 / RF010)

  Cenário: Efetivação com sucesso e exibição de recibo digital
    Dado que o profissional revisa os itens do atendimento na tela de confirmação
    Quando tocar em "Confirmar e Efetivar Baixa"
    E a API retornar status 201 Created com o protocolo "#DSP-2026-0089"
    Então a tela de comprovante digital deve ser apresentada
    E o botão de compartilhamento deve estar disponível

  Cenário: Compartilhamento do resumo da dispensação via Share API nativa
    Dado que o comprovante digital está visível na tela
    Quando o profissional tocar no botão "Compartilhar Comprovante"
    Então a folha de compartilhamento nativa do aparelho (Android/iOS) deve ser acionada

  Cenário: Reinício do fluxo para próximo paciente
    Dado que a dispensação foi concluída com sucesso
    Quando o profissional tocar em "Novo Atendimento"
    Então a navegação deve retornar à tela de identificação do paciente
    E todos os campos e listas anteriores devem estar vazios
```

---

## 6. Checklist de DoD e Aceitação

- [ ] Tela desenvolvida com componentes nativos React Native.
- [ ] DTO de resultado tipado estritamente a partir de `@farmaubs/shared`.
- [ ] Checagem de tipos sem erros via `moon run mobile:typecheck`.
