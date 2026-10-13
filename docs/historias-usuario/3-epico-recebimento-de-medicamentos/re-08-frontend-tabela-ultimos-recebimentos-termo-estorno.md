# RE-08: Painel de Histórico de Recebimentos: Visualização ontem/hoje, seletor de range, busca, exportação .xlsx, termo de carga e estorno

---

- **Épico**: Recebimento de Medicamentos (RF008, RF024, RF028, NF001, NF002, NF007)
- **Requisitos Funcionais**: RF008 (Registro e Histórico de Recebimento), RF028 (Consulta de Histórico, Exportação .xlsx, Log de Auditoria e Estorno)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva com Menos Cliques), NF002 (Design Responsivo), NF007 (Download Rápido de Planilha e Resposta Ágil)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-011 (React 19 + Tailwind CSS), ADR-013 (TanStack Query e Context API), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança e Orquestração com Moonrepo)

---

## 1. História de Usuário

> **Como** farmacêutico responsável ou operador de farmácia da UBS,  
> **quero** um painel dedicado de histórico de recebimentos com filtro temporal pré-configurado exibindo por padrão as entradas de ontem e hoje, seletor de range de datas customizado, campo de busca rápida, botão de exportação direta para planilha Excel (.xlsx), modal para visualização e impressão do Termo de Recebimento de Carga SUS e ação de estorno justificado,  
> **para que** eu possa auditar imediatamente as remessas entregues pela CAF nos últimos plantões, baixar relatórios estruturados para controle administrativo e reverter registros incorretos com segurança e rastreabilidade (RF008, RF028).

---

## 2. Regras de Negócio e Casos de Borda

1. **Filtro Temporal Inicial Padrão: "Ontem e Hoje" (`D-1` e `D0`)**:
   - Ao renderizar a tabela ou painel de recebimentos, o seletor temporal vem pré-selecionado no modo "Ontem e Hoje" (`D-1` e `D0`).
   - Um badge visual ativo no topo da tabela indica a faixa temporal aplicada (ex.: `Período: 30/09/2026 a 01/10/2026`).
   - Isso permite visualizar rapidamente o plantão anterior e o expediente atual com máxima agilidade de resposta.

2. **Seletor de Range Customizado de Datas e Atalhos Rápidos**:
   - Componente de seleção temporal com botões de atalho:
     - Atalho "Hoje"
     - Atalho "Ontem e Hoje" (Padrão inicial)
     - Atalho "Últimos 7 dias"
     - Atalho "Últimos 30 dias"
     - "Período Personalizado" com campos `Data Início` e `Data Fim`.
   - Validação em tempo real: bloqueia `Data Fim < Data Início` com mensagem descritiva acessível.

3. **Filtros Combinados de Pesquisa**:
   - Campo de busca rápida textual por medicamento, princípio ativo, lote ou número da guia fiscal.
   - Dropdown de filtro por fornecedor/origem (CAF Central, DLOG, SESAPI, etc.).
   - Seletor de status: "Todas", "Apenas Concluídas" e "Estornadas".

4. **Botão de Exportação em Planilha Excel (`.xlsx`)**:
   - Botão de ação em destaque: `📥 Exportar (.xlsx)`.
   - Ao ser acionado, o componente envia os parâmetros ativos (`dataInicio`, `dataFim`, `termo`, `fornecedor`, `status`) para a rota `GET /api/v1/recebimento/entradas/exportar-xlsx`.
   - Exibe estado de carregamento com `aria-busy="true"` ("Gerando planilha...") e desabilita cliques múltiplos.
   - O arquivo binário `.xlsx` gerado é baixado automaticamente pelo navegador sem recarregar a página.

5. **Modal do Termo de Recebimento de Carga SUS**:
   - Cada linha possui botão "Visualizar Comprovante" (ícone de documento com `aria-label="Visualizar Termo de Recebimento da Guia [numero]"`).
   - O modal exibe:
     - Dados cadastrais da UBS (Nome, CNES, Município de Parnaíba);
     - Identificação da remessa (Número da Guia/NF, Fornecedor de Origem, Data/Hora da Conferência);
     - Farmacêutico responsável pelo recebimento;
     - Tabela completa de itens: Medicamento, Fabricante, Lote, Validade e Quantidade;
     - Área para assinatura e carimbo do responsável técnico.
   - Botão "Imprimir Comprovante": aciona o diálogo de impressão nativo com estilos específicos `@media print`.

6. **Modal de Estorno Justificado**:
   - Para entradas com status `CONCLUIDO`, disponibiliza ação "Estornar Entrada".
   - Abre modal de alerta sanitário:
     - Exibe aviso sobre a reversão física do estoque da UBS;
     - Campo obrigatório de "Justificativa do Estorno" com contador de caracteres (mínimo de 10 caracteres);
     - Ao confirmar, dispara a mutação de estorno, fecha o modal, atualiza a linha da tabela para o badge `Estornado` e exibe notificação toast de sucesso.
   - Linhas com status `ESTORNADO` exibem badge semântico cinza e mantêm o botão de estorno desabilitado.

---

## 3. Escopo Técnico & Arquitetural

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
  - `ListarRecebimentosQuery`: `{ dataInicio?: string; dataFim?: string; termo?: string; fornecedor?: string; status?: 'TODAS' | 'CONCLUIDAS' | 'ESTORNADAS'; page?: number; limit?: number }`.
  - `ItemHistoricoRecebimentoDto`: `{ id: string; numeroDocumento: string; dataRecebimento: string; fornecedorOrigem: string; totalItens: number; totalUnidades: number; status: 'CONCLUIDO' | 'ESTORNADO'; motivoEstorno?: string }`.
  - `EstornoRecebimentoRequest`: `{ motivoEstorno: string }`.
- **Paridade com Mobile**:
  - A Web implementa a tabela analítica com exportação XLSX e impressão CSS de Termo SUS.
  - O aplicativo nativo (`apps/mobile` - história `RE-MOB-04`) consome os mesmos DTOs e rotas de filtro, renderizando cartões táteis de remessas com pull-to-refresh e visualização rápida do comprovante de entrega na tela do celular.
- **Diretrizes para Ciclos Independentes de Desenvolvimento**:
  - *Cenário A (Mobile já implementou RE-MOB-04)*: O Frontend Web consome diretamente `ListarRecebimentosQuery`, `ItemHistoricoRecebimentoDto` e `EstornoRecebimentoRequest` de `@farmaubs/shared`.
  - *Cenário B (Mobile ainda NÃO implementou RE-MOB-04)*: O Frontend Web publica as tipagens em `packages/shared/src/recebimento/historico-recebimento.types.ts`, assegurando que o app móvel reutilize os mesmos parâmetros de busca e status.

---

## 4. Critérios de Aceite (Gherkin BDD)

### Cenário 1: Visualização padrão inicial com filtro "Ontem e Hoje"
```gherkin
Dado que o farmacêutico acessou a tela de recebimentos
Quando a tabela de histórico for renderizada pela primeira vez
Então o botão de atalho "Ontem e Hoje" deve estar com estado ativo destacado
E o badge de período deve exibir as datas correspondentes a ontem e hoje
E a requisição enviada à API deve conter dataInicio de ontem e dataFim de hoje
E as colunas exibidas devem ser: "Data/Hora", "Documento/Guia", "Fornecedor", "Medicamentos Conferidos", "Qtd. Total", "Status" e "Ações"
```

### Cenário 2: Aplicação de filtro de range personalizado e busca por medicamento
```gherkin
Dado que o farmacêutico deseja consultar remessas de uma semana específica
Quando ele selecionar "Período Personalizado" e definir dataInicio "2026-09-10" e dataFim "2026-09-17"
E digitar "Amoxicilina" no campo de busca textual
Então a tabela deve atualizar os resultados exibindo apenas as entradas correspondentes
E a tabela deve exibir indicador de carregamento durante a consulta
```

### Cenário 3: Exportação do histórico para arquivo Excel (.xlsx)
```gherkin
Dado que a tabela está exibindo o período de 01/09/2026 a 30/09/2026
Quando o farmacêutico clicar no botão "Exportar (.xlsx)"
Então o botão deve apresentar estado de carregamento ("Gerando planilha...")
E o arquivo "recebimentos_ubs_unidade_2026-09-01_2026-09-30.xlsx" deve ser baixado no navegador
E um toast informativo deve confirmar a conclusão do download
```

### Cenário 4: Abertura e impressão do Termo de Recebimento de Carga SUS
```gherkin
Dado que o farmacêutico deseja emitir o termo da guia "GUIA-CAF-2026/089"
Quando ele clicar no botão "Comprovante" na respectiva linha
Então o modal "Termo de Recebimento de Carga SUS" deve ser aberto com foco aprisionado (focus trap)
E deve apresentar o cabeçalho oficial do município de Parnaíba, dados da UBS, itens com lotes e campo para assinatura
E ao clicar em "Imprimir", o comando window.print() deve ser acionado com estilo limpo (@media print)
```

### Cenário 5: Estorno bem-sucedido com justificativa obrigatória
```gherkin
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

## 5. Estilo de Impressão do Comprovante (CSS Print)

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

## 6. Regras de Interface e Acessibilidade (ADR-032)

1. **Acessibilidade dos Modais**: Tanto o modal do Termo de Recebimento quanto o de Estorno utilizam `role="dialog"`, `aria-modal="true"`, foco aprisionado e suporte à tecla `Escape`.
2. **Estado Vazio Confortável**: Se não houver entradas no período selecionado, a tabela exibe mensagem amigável: "Nenhum recebimento encontrado no período selecionado. Altere as datas ou use o formulário acima para registrar uma nova entrada."
3. **Indicadores Visuais de Validade**: Medicamentos recebidos com validade próxima (< 6 meses) recebem badge âmbar com tooltip explicativo para conferência visual imediata.

---

## 7. Definition of Done (DoD)

- [ ] Painel implementado no frontend React com seletor de range de datas e atalho padrão "Ontem e Hoje".
- [ ] Botão de exportação `.xlsx` integrado ao backend com download automático do arquivo.
- [ ] Modal do Termo de Recebimento acessível com formatação para impressão em folha de estilo CSS print.
- [ ] Modal de estorno justificado com validação em tempo real e atualização de estado no TanStack Query.
- [ ] Testes de componentes (Camada D) validando alternância de filtros de data, exportação, abertura de modais e estorno justificado.

