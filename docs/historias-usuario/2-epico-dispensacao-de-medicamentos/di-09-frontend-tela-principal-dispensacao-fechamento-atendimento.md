# DI-09 feat(dispensacao): Tela Principal de Dispensação: Integração do atendimento, métricas e confirmação de baixa

---

- **Épico**: Dispensação de Medicamentos (RF010, NF009, NF010)
- **Requisitos Funcionais**: RF010 (Registro de Dispensa e Baixa em Tempo Real)
- **Requisitos Não-Funcionais**: NF001 (Microinterações e Design Premium), NF010 (Feedback Visual Instantâneo)
- **ADRs Vinculadas**: ADR-006 (Controle RBAC), ADR-011 (React 19 + Tailwind CSS), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança e Orquestração com Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico operando o módulo de dispensação na UBS,  
> **quero** uma tela principal harmoniosa, intuitiva e dividida em etapas operacionais claras (Identificação Obrigatória do Paciente → Seleção de Medicamentos e Lotes FEFO → Carrinho da Receita → Confirmação e Baixa), com indicadores rápidos de atendimento do dia,  
> **para que** eu realize o fluxo completo de saída de medicamentos em poucos cliques, receba confirmação imediata da baixa de estoque e limpe o formulário para o próximo paciente sem recarregar a página (RF010, NF010).

---

## 2. Regras de negócio e casos de borda

1. **Estrutura Visual da Página Principal (`/dispensacao`)**:
   - **Cabeçalho Operacional Superior**:
     - Título e identificador da UBS ativa de atendimento.
     - Cartões de métricas rápidas do dia:
       - Total de atendimentos realizados hoje;
       - Total de unidades de medicamentos dispensadas hoje;
       - Total de pacientes atendidos no dia.
   - **Layout Central (Duas Colunas em Desktop / Fluxo Sequencial em Mobile)**:
     - **Coluna da Esquerda**: Formulário de identificação do paciente (obrigatório: CNS, CPF, Nome, Data Nasc) e busca textual de medicamentos com seletor de lotes FEFO.
     - **Coluna da Direita**: Carrinho da receita em tempo real com posologias, totalizadores e validação de antimicrobianos.

2. **Fluxo de Confirmação e Finalização do Atendimento**:
   - O botão "Finalizar Atendimento" só é habilitado quando:
     1. O paciente estiver devidamente preenchido com os 4 campos válidos;
     2. Houver pelo menos 1 medicamento no carrinho com quantidade válida;
     3. Se houver antimicrobiano, a receita médica estiver preenchida e válida (<= 10 dias).
   - Ao clicar em "Finalizar Atendimento", abre-se um modal acessível de confirmação exibindo:
     - Resumo do paciente;
     - Lista dos medicamentos, lotes e quantidades;
     - Botão de cancelamento e botão primário com foco automático "Confirmar Baixa de Estoque".

3. **Submissão à API e Feedback Instantâneo**:
   - Dispara requisição `POST /api/v1/dispensacoes` via mutação do TanStack Query (`useMutation`).
   - Durante a requisição: exibe estado de loading no botão ("Processando baixa...").
   - Em caso de sucesso:
     - Notificação toast de sucesso: `✅ Atendimento #XXXX finalizado com sucesso!`;
     - Invalidação de queries no cache do TanStack Query (`queryClient.invalidateQueries({ queryKey: ['estoque-saldos'] })` e `['ultimas-dispensas']`);
     - O formulário é limpo e volta automaticamente para o estado inicial pronto para o próximo paciente.
   - Em caso de erro (ex.: falta concorrente de saldo no lote):
     - Exibe toast com mensagem clara retornada pela API e mantém os dados na tela para que o farmacêutico ajuste o lote sem perder o que já digitou.

---

## 3. Contratos de dados e protocolo HTTP

### 3.1 Consumo no Frontend (`dispensacao.service.ts`)
- `POST /api/v1/dispensacoes`: Submissão do payload `EfetivarDispensacaoRequest`.

### 3.2 Compartilhamento Arquitetural com `@farmaubs/shared` e App Mobile (`apps/mobile` - DI-MOB-04)
- **Contratos e Tipos Exportados em `packages/shared/src/dispensacao/dispensacao.types.ts`**:
  - `EfetivarDispensacaoRequest`: `{ pacienteId: string; dataReceita?: string; itens: ItemDispensacaoRequest[]; observacoes?: string }`.
  - `DispensacaoResultadoDto`: `{ id: string; numeroAtendimento: string; dataHora: string; pacienteNome: string; totalItens: number; itens: ItemDispensadoDto[] }`.
  - `MetricasDispensacaoDiaDto`: `{ totalAtendimentosHoje: number; totalMedicamentosHoje: number; totalPacientesHoje: number }`.
- **Paridade com Mobile**:
  - Tanto o Frontend Web (`apps/frontend`) quanto o App Nativo (`apps/mobile` - história `DI-MOB-04`) enviam o mesmo payload `EfetivarDispensacaoRequest` e recebem o mesmo `DispensacaoResultadoDto`. Na Web, o layout é dividido em 2 colunas; no Mobile, o fluxo é sequencial (wizard com abas ou scroll com botão fixo na base).
- **Diretrizes para Ciclos Independentes de Desenvolvimento**:
  - *Cenário A (Mobile já implementou DI-MOB-04)*: O Frontend Web consome diretamente `EfetivarDispensacaoRequest`, `DispensacaoResultadoDto` e o tratamento de conflito de saldo (HTTP 409) já mapeados em `@farmaubs/shared`.
  - *Cenário B (Mobile ainda NÃO implementou DI-MOB-04)*: O Frontend Web estabelece o contrato completo de efetivação e recibo em `packages/shared/src/dispensacao/dispensacao.types.ts`, fornecendo ao time Mobile a estrutura exata do recibo digital para impressão e compartilhamento nativo.

---

## 4. Escopo Técnico da implementação

### Frontend (`apps/frontend/src/`)
- **`pages/Dispensacao/index.tsx`**:
  - View principal orquestrando componentes de paciente, busca, carrinho e métricas.
- **`components/dispensacao/ModalConfirmacaoDispensacao.tsx`**:
  - Modal acessível (foco preso no modal, fechamento com `Escape`).
- **`components/dispensacao/CardsMetricasDispensacao.tsx`**:
  - Cartões de resumo diário da unidade.
- **`routes.tsx`**:
  - Rota protegida `/dispensacao` configurada com `RoleRoute` para `FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE` e `ADMINISTRADOR`.
- **Testes da Camada D**:
  - `pages/Dispensacao/index.spec.tsx`: Testar o fluxo completo de ponta a ponta na UI (preenchimento de paciente -> inclusão de medicamento -> modal de confirmação -> envio com sucesso e limpeza do formulário).

---

## 5. Cenários de teste em BDD (Gherkin — camada D)

```gherkin
# language: pt
Funcionalidade: Fluxo Completo da Tela Principal de Dispensação (Camada D)

  Cenário: Habilitação do botão de finalizar após preenchimento completo
    Dado que o farmacêutico preenche os 4 dados obrigatórios do paciente
    E adiciona 1 medicamento válido com lote FEFO ao carrinho
    Quando todos os critérios estiverem válidos
    Então o botão "Finalizar Atendimento" deve se tornar clicável

  Cenário: Abertura e confirmação do modal de atendimento
    Dado que o farmacêutico clica em "Finalizar Atendimento"
    Quando o modal de confirmação for exibido
    Então os dados do paciente e o resumo dos itens devem ser listados
    E ao clicar em "Confirmar Baixa de Estoque", a requisição de finalização deve ser disparada

  Cenário: Limpeza da tela e notificação de sucesso após gravação
    Dado que a API responde com status 201 Created para a dispensação
    Quando a mutação for concluída com sucesso
    Então uma mensagem de sucesso deve ser exibida
    E os campos de paciente e o carrinho da receita devem ser resetados para novo atendimento
```

---

## 6. Checklist de DoD e aceitação

- [ ] Tela estruturada e responsiva com Tailwind CSS e tokens visuais do FarmaUBS.
- [ ] Métricas diárias de atendimento exibidas no topo da tela.
- [ ] Modal de confirmação acessível com suporte a navegação por teclado e `Escape`.
- [ ] Limpeza automática do formulário após confirmação de sucesso.
- [ ] Invalidação de cache do TanStack Query sincronizando saldos de estoque e lista de dispensas.
- [ ] Testes da Camada D cobrindo o fluxo feliz e tratamento de erros de rede.
