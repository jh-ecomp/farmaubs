# DI-10 feat(dispensacao): Painel de Histórico de Dispensas: Visualização ontem/hoje, seletor de range, filtros e exportação .xlsx

---

- **Épico**: Dispensação de Medicamentos (RF012, RF028, NF009, NF010)
- **Requisitos Funcionais**: RF012 (Consulta de Histórico e Exportação), RF028 (Estorno de Atendimento)
- **Requisitos Não-Funcionais**: NF001 (Microinterações Fluídas), NF010 (Download Rápido de Arquivo)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-011 (React 19 + Tailwind CSS), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança e Orquestração com Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico ou gerente da UBS,  
> **quero** um painel dedicado de histórico de dispensações com filtro temporal padrão exibindo as saídas de ontem e hoje, seletor de range de datas personalizado, filtros por paciente, categoria e medicamento, botão de download direto para exportar a listagem em formato Excel (.xlsx) e modal de estorno de atendimento,  
> **para que** eu possa auditar os atendimentos da unidade com rapidez, baixar relatórios em planilha para subsidiar os pedidos mensais e reverter dispensações indevidas (RF012, RF028).

---

## 2. Regras de negócio e casos de borda

1. **Filtro Temporal Inicial Padrão: "Ontem e Hoje"**:
   - Ao carregar a tela de histórico, o seletor temporal vem pré-configurado no modo "Ontem e Hoje" (`D-1` e `D0`).
   - Um badge visual ativo indica o período vigente (ex.: `Ontem e Hoje: 30/09/2026 a 01/10/2026`).
   - Isso permite visualizar rapidamente o plantão anterior e o dia atual com máxima velocidade de resposta.

2. **Seletor de Range Customizado de Datas e Atalhos Rápidos**:
   - Um componente de seleção de datas permite escolher:
     - Atalho "Hoje"
     - Atalho "Ontem e Hoje" (Padrão)
     - Atalho "Últimos 7 dias"
     - Atalho "Últimos 30 dias"
     - "Período Personalizado" com campos `Data Início` e `Data Fim`.
   - Validação visual: impede `Data Fim < Data Início`.

3. **Filtros Combinados de Pesquisa**:
   - **Paciente**: campo de busca rápida por CPF, CNS ou nome.
   - **Medicamento**: campo de busca rápida por nome ou princípio ativo.
   - **Categoria**: dropdown multiseleção ou seletor único com as categorias da REMUME.
   - **Status**: seletor entre "Todas", "Apenas Concluídas" e "Estornadas".

4. **Botão de Exportação em Planilha Excel (`.xlsx`)**:
   - Botão em destaque: `📥 Exportar (.xlsx)`.
   - Ao clicar, o frontend envia os mesmos parâmetros de filtros e datas atualmente selecionados na tabela para o endpoint `/api/v1/dispensacoes/exportar-xlsx`.
   - Exibe feedback de download em andamento ("Gerando planilha...").
   - O arquivo binário é baixado automaticamente pelo navegador sem redirecionamento de tela.

5. **Modal de Estorno de Atendimento**:
   - Cada linha de atendimento com status `concluida` possui um botão ou menu de ação "Estornar Atendimento".
   - Ao clicar, abre-se um modal de confirmação:
     - Exibe os medicamentos e quantidades que retornarão ao estoque da UBS;
     - Campo obrigatório de justificativa / motivo do estorno (mínimo de 10 caracteres);
     - Ao confirmar, dispara `POST /api/v1/dispensacoes/:id/estorno`, exibe toast de confirmação e atualiza a linha da tabela para a tag vermelha `Estornada`.

---

## 3. Contratos de dados e protocolo HTTP

### 3.1 Consumo no Frontend (`historico-dispensacao.service.ts`)
- `GET /api/v1/dispensacoes`: Carregar tabela com paginação e filtros (`ListarDispensacoesQuery`).
- `GET /api/v1/dispensacoes/exportar-xlsx`: Download em stream (`blob`) do arquivo `.xlsx`.
- `POST /api/v1/dispensacoes/:id/estorno`: Estornar atendimento com `{ motivoEstorno: string }`.

### 3.2 Compartilhamento Arquitetural com `@farmaubs/shared` e App Mobile (`apps/mobile` - DI-MOB-05)
- **Contratos e Tipos Exportados em `packages/shared/src/dispensacao/historico.types.ts`**:
  - `ListarDispensacoesQuery`: Parâmetros de filtro e range temporal compartilhado.
  - `ItemHistoricoDispensacaoDto`: Resumo do atendimento para listagens (`id`, `numeroAtendimento`, `pacienteNome`, `dataHora`, `status`, `itensResumo`).
  - `EstornoDispensacaoRequest`: `{ motivoEstorno: string }`.
- **Paridade com Mobile**:
  - A consulta paginada e os filtros temporais (Ontem/Hoje, 7D, 30D) são reutilizados pelo App Mobile (`apps/mobile` - história `DI-MOB-05`). Na Web, há tabela densa e exportação XLSX; no Mobile, a listagem adota `<FlatList>` com Infinite Scroll e cartões compactos de atendimento com badge de status.
- **Diretrizes para Ciclos Independentes de Desenvolvimento**:
  - *Cenário A (Mobile já implementou DI-MOB-05)*: O Frontend Web aproveita os schemas de `ListarDispensacoesQuery` e `ItemHistoricoDispensacaoDto` consolidados em `@farmaubs/shared`, acrescentando apenas a rota de exportação XLSX.
  - *Cenário B (Mobile ainda NÃO implementou DI-MOB-05)*: O Frontend Web publica as tipagens de paginação e filtros em `packages/shared/src/dispensacao/historico.types.ts`, deixando a rota de listagem e parâmetros de consulta prontos para consumo mobile.

---

## 4. Escopo Técnico da implementação

### Frontend (`apps/frontend/src/`)
- **`pages/Dispensacao/HistoricoDispensacoes.tsx`**:
  - Página ou aba do módulo de dispensação contendo a tabela completa de histórico.
- **`components/dispensacao/FiltrosHistoricoDispensacao.tsx`**:
  - Barra de filtros com atalhos de datas (destacando Ontem e Hoje), busca de paciente, categoria e status.
- **`components/dispensacao/ModalEstornoDispensacao.tsx`**:
  - Diálogo acessível com campo de motivo e confirmação de devolução de lote.
- **`components/dispensacao/BotaoExportarXlsx.tsx`**:
  - Componente de download com gestão de loading e gatilho de download via `URL.createObjectURL(blob)`.
- **Testes da Camada D**:
  - `pages/Dispensacao/HistoricoDispensacoes.spec.tsx`: Validar renderização do filtro padrão "Ontem e Hoje", filtragem por range customizado, disparo do download do `.xlsx` e fluxo do modal de estorno.

---

## 5. Cenários de teste em BDD (Gherkin — camada D)

```gherkin
# language: pt
Funcionalidade: Painel de Histórico de Dispensações e Exportação XLSX (Camada D)

  Cenário: Carga inicial da tabela com filtro padrão de ontem e hoje
    Dado que o farmacêutico acessa a página de histórico de dispensas
    Quando a tela terminar de carregar
    Então o seletor de período deve estar ativo no atalho "Ontem e Hoje"
    E a tabela deve exibir as dispensações ocorridas nesse intervalo

  Cenário: Exportação da consulta filtrada em formato XLSX
    Dado que o usuário filtrou a listagem por uma data específica e pelo medicamento "Losartana"
    Quando clicar no botão "Exportar (.xlsx)"
    Então uma requisição de download de blob deve ser disparada com os filtros correspondentes
    E o arquivo Excel deve ser baixado pelo navegador

  Cenário: Acionamento de estorno com justificativa obrigatória
    Dado que o farmacêutico clica em "Estornar" para um atendimento com status "concluída"
    Quando preencher o motivo com "Digitado item incorreto por engano" e confirmar
    Então a requisição de estorno deve ser enviada
    E o status da linha na tabela deve mudar para "Estornada"
```

---

## 6. Checklist de DoD e aceitação

- [ ] Filtro padrão ativo na carga inicial configurado para "Ontem e Hoje".
- [ ] Seletor flexível permitindo range de datas livre e atalhos rápidos.
- [ ] Exportação funcional em `.xlsx` com download em background sem perda de estado.
- [ ] Modal de estorno com validação de motivo mínimo e atualização reativa da lista.
- [ ] Acessibilidade WCAG 2.1 AA na tabela (cabeçalhos semânticos e tags aria).
- [ ] Testes automatizados da Camada D aprovados.
