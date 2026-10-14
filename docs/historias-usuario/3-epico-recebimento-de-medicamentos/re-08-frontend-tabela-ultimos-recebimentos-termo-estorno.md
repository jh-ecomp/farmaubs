# RE-08 feat(recebimento): Painel de Histórico de Recebimentos: Visualização ontem/hoje, seletor de range, busca, exportação .xlsx, termo de carga e estorno

---

- **Épico**: Recebimento de Medicamentos (RF008, RF024, RF028, NF001, NF002, NF007)
- **Requisitos Funcionais**: RF008 (Registro e Histórico de Recebimento), RF028 (Consulta de Histórico, Exportação .xlsx, Log de Auditoria e Estorno)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva com Menos Cliques), NF002 (Design Responsivo), NF007 (Download Rápido de Planilha e Resposta Ágil)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-011 (React 19 + Tailwind CSS), ADR-013 (TanStack Query e Context API), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança e Orquestração com Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico responsável ou operador de farmácia da UBS,  
> **quero** um painel dedicado de histórico de recebimentos com filtro temporal pré-configurado exibindo por padrão as entradas de ontem e hoje, seletor de range de datas customizado, campo de busca rápida, botão de exportação direta para planilha Excel (.xlsx), modal para visualização e impressão do Termo de Recebimento de Carga SUS e ação de estorno justificado,  
> **para que** eu possa auditar imediatamente as remessas entregues pela CAF nos últimos plantões, baixar relatórios estruturados para controle administrativo e reverter registros incorretos com segurança e rastreabilidade (RF008, RF028).

---

## 2. Regras de negócio e casos de borda

1. **Filtro Temporal Inicial Padrão: "Ontem e Hoje" (`D-1` e `D0`)**:
   - Ao renderizar a tabela ou painel de recebimentos, o seletor temporal vem pré-selecionado no modo "Ontem e Hoje" (`D-1` e `D0`).
   - Um badge visual ativo no topo da tabela indica a faixa temporal aplicada (ex.: `Período: 30/09/2026 a 01/10/2026`).
2. **Seletor de Range Customizado de Datas e Atalhos Rápidos**:
   - Atalhos: "Hoje", "Ontem e Hoje" (Padrão inicial), "Últimos 7 dias", "Últimos 30 dias" e "Período Personalizado".
   - Validação em tempo real: bloqueia `Data Fim < Data Início` com mensagem descritiva acessível.
3. **Filtros Combinados de Pesquisa**:
   - Busca textual por medicamento, princípio ativo, lote ou número da guia fiscal.
   - Filtro por fornecedor/origem e seletor de status ("Todas", "Apenas Concluídas", "Estornadas").
4. **Exportação em Planilha Excel (`.xlsx`)**:
   - Botão de ação: `📥 Exportar (.xlsx)`. Exibe estado de carregamento com `aria-busy="true"` ("Gerando planilha...") e baixa o arquivo binário diretamente.
5. **Modal e Impressão do Termo de Recebimento de Carga SUS**:
   - Exibe dados cadastrais da UBS, guia, farmacêutico e lista de lotes. O botão "Imprimir Comprovante" dispara `window.print()` estilizado para folha física A4 via `@media print`.
6. **Modal de Estorno Justificado**:
   - Habilitado para entradas com status `CONCLUIDO`. Exige justificativa com no mínimo 10 caracteres e alerta sobre a dedução de saldo de estoque.
7. **Acessibilidade e Usabilidade (ADR-032)**:
   - Modais com `role="dialog"`, `aria-modal="true"`, foco aprisionado (focus trap) e suporte à tecla `Escape`.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs / CSS Print)

### Contratos TypeScript (`@farmaubs/shared`)

```typescript
export interface ListarRecebimentosQuery {
  dataInicio?: string;
  dataFim?: string;
  termo?: string;
  fornecedor?: string;
  status?: 'TODAS' | 'CONCLUIDAS' | 'ESTORNADAS';
  page?: number;
  limit?: number;
}

export interface ItemHistoricoRecebimentoDto {
  id: string;
  numeroDocumento: string;
  dataRecebimento: string;
  fornecedorOrigem: string;
  totalItens: number;
  totalUnidades: number;
  status: 'CONCLUIDO' | 'ESTORNADO';
  motivoEstorno?: string;
}

export interface EstornoRecebimentoRequest {
  motivoEstorno: string;
}
```

### Estilo de Impressão do Comprovante (CSS Print)

```css
@media print {
  body * {
    visibility: hidden;
  }
  #termoRecebimentoPrintArea,
  #termoRecebimentoPrintArea * {
    visibility: visible;
  }
  #termoRecebimentoPrintArea {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 15mm;
    background: white;
    color: black;
    font-size: 11pt;
  }
  .no-print {
    display: none !important;
  }
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

- **Camada**: D (Testes de Componentes / Frontend React).
- **Componente Principal**: `apps/frontend/src/features/recebimento/components/HistoricoRecebimentosPainel.tsx`.
- **Subcomponentes**:
  - `RecebimentosFiltrosBar.tsx`: Seletor de datas, atalhos rápidos e input de busca com debounce.
  - `RecebimentosTabela.tsx`: Tabela responsiva com badges de status, alerta de validade curta e ações.
  - `TermoRecebimentoModal.tsx`: Visualização e folha de estilo para impressão CSS print.
  - `EstornoEntradaModal.tsx`: Confirmação acessível com validação de justificativa.
- **Hooks & Integrações**:
  - `useHistoricoRecebimentos(query)`: Consulta com cache e invalidação TanStack Query.
  - `useExportarRecebimentosXlsx()`: Função para download blob de arquivo `.xlsx`.
  - `useEstornarRecebimento()`: Mutação com feedback visual e toast.

### Compartilhamento Arquitetural com `@farmaubs/shared` e App Mobile (`apps/mobile` - RE-MOB-04)
- **Contratos Exportados em `packages/shared/src/recebimento/historico-recebimento.types.ts`**:
  - `ListarRecebimentosQuery`, `ItemHistoricoRecebimentoDto`, `EstornoRecebimentoRequest`.
- **Paridade com Mobile**:
  - A Web implementa a tabela analítica com exportação XLSX e impressão CSS de Termo SUS. O app móvel consome os mesmos DTOs para renderização tátil.

---

## 5. Cenários de teste em BDD (Gherkin — camada D)

```gherkin
# language: pt
Funcionalidade: Painel de Histórico de Recebimentos e Estorno (Camada D)

  Cenário: Visualização padrão inicial com filtro "Ontem e Hoje"
    Dado que o farmacêutico acessou a tela de recebimentos
    Quando a tabela de histórico for renderizada pela primeira vez
    Então o botão de atalho "Ontem e Hoje" deve estar com estado ativo destacado
    E o badge de período deve exibir as datas correspondentes a ontem e hoje
    E a requisição enviada à API deve conter dataInicio de ontem e dataFim de hoje
    E as colunas exibidas devem ser: "Data/Hora", "Documento/Guia", "Fornecedor", "Medicamentos Conferidos", "Qtd. Total", "Status" e "Ações"

  Cenário: Aplicação de filtro de range personalizado e busca por medicamento
    Dado que o farmacêutico deseja consultar remessas de uma semana específica
    Quando ele selecionar "Período Personalizado" e definir dataInicio "2026-09-10" e dataFim "2026-09-17"
    E digitar "Amoxicilina" no campo de busca textual
    Então a tabela deve atualizar os resultados exibindo apenas as entradas correspondentes
    E a tabela deve exibir indicador de carregamento durante a consulta

  Cenário: Exportação do histórico para arquivo Excel (.xlsx)
    Dado que a tabela está exibindo o período de 01/09/2026 a 30/09/2026
    Quando o farmacêutico clicar no botão "Exportar (.xlsx)"
    Então o botão deve apresentar estado de carregamento ("Gerando planilha...")
    E o arquivo "recebimentos_ubs_unidade_2026-09-01_2026-09-30.xlsx" deve ser baixado no navegador
    E um toast informativo deve confirmar a conclusão do download

  Cenário: Abertura e impressão do Termo de Recebimento de Carga SUS
    Dado que o farmacêutico deseja emitir o termo da guia "GUIA-CAF-2026/089"
    Quando ele clicar no botão "Comprovante" na respectiva linha
    Então o modal "Termo de Recebimento de Carga SUS" deve ser aberto com foco aprisionado (focus trap)
    E deve apresentar o cabeçalho oficial do município de Parnaíba, dados da UBS, itens com lotes e campo para assinatura
    E ao clicar em "Imprimir", o comando window.print() deve ser acionado com estilo limpo (@media print)

  Cenário: Estorno bem-sucedido com justificativa obrigatória
    Dado que o farmacêutico selecionou estornar uma entrada registrada indevidamente
    Quando ele clicar no botão "Estornar"
    Então o modal de estorno deve ser aberto alertando sobre a dedução de saldo
    E o botão "Confirmar Estorno" deve permanecer desabilitado enquanto a justificativa tiver menos de 10 caracteres
    Quando ele digitar "Erro de conferência do lote pelo recebedor da bancada" e confirmar
    Então a requisição deve ser enviada com sucesso
    E a linha na tabela deve passar para o status "ESTORNADO" com badge cinza
    E uma notificação toast de confirmação deve ser exibida
```

---

## 6. Checklist de DoD e aceitação

- [ ] Painel implementado no frontend React com seletor de range de datas e atalho padrão "Ontem e Hoje".
- [ ] Botão de exportação `.xlsx` integrado ao backend com download automático do arquivo.
- [ ] Modal do Termo de Recebimento acessível com formatação para impressão em folha de estilo CSS print.
- [ ] Modal de estorno justificado com validação em tempo real e atualização de estado no TanStack Query.
- [ ] Testes de componentes (Camada D) validando alternância de filtros de data, exportação, abertura de modais e estorno justificado.
