# IN-08: Modal de Homologação e Ata Oficial: Resumo de Conciliação, Impressão da Ata com CSS Print e Exportação .xlsx

---

- **Épico**: Inventário Mensal (RF009, RF011, RF013, RF014, RF021, RF028, NF001, NF002, NF003, NF005, NF007, NF008, NF009, NF015)
- **Requisitos Funcionais**: RF013 (Realizar Inventário Mensal), RF021 (Gerar Relatório de Inventário Mensal), RF028 (Ata Oficial de Auditoria e Exportação)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva em Modais Acessíveis), NF002 (Design Responsivo), NF008 (Download e Impressão Rápidos)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-011 (React 19 + Tailwind CSS), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de Usuário

> **Como** farmacêutico responsável pela farmácia da UBS,  
> **quero** abrir o modal de homologação para revisar o resumo das divergências apuradas, confirmar o acerto de estoque definitivo no sistema, visualizar a Ata Oficial de Inventário Mensal formatada para impressão direta no navegador e baixar a planilha completa em formato Excel (.xlsx),  
> **para que** eu possa formalizar a conclusão do inventário físico, colher as assinaturas da gerência da unidade e encaminhar a prestação de contas à CAF de Parnaíba (RF013, RF021, RF028).

---

## 2. Regras de Negócio e Casos de Borda

1. **Modal de Homologação (`ModalHomologacaoInventario.tsx`)**:
   - Exibe sumário executivo antes do fechamento:
     - Total de Itens no Catálogo da UBS;
     - Itens Perfeitamente Conformes;
     - Itens com Divergência Justificada;
     - Saldo Físico Global Apurado.
   - **Condição Bloqueante**: O botão `"Confirmar Homologação e Ajustar Estoque"` permanece desabilitado se houver qualquer item sem contagem física ou com divergência sem justificativa válida.
   - Ao confirmar:
     - Dispara a requisição `POST /api/v1/inventario/ciclos/:id/homologar`;
     - Exibe toast de sucesso confirmando a sincronização dos saldos;
     - Fecha o modal de confirmação e abre automaticamente o modal de visualização e impressão da Ata Oficial.

2. **Modal de Visualização da Ata Oficial (`AtaInventarioImpressaoModal.tsx`)**:
   - Exibe a Ata Oficial gerada pelo backend (`GET /api/v1/inventario/ciclos/:id/ata`), contendo:
     - Cabeçalho institucional: Prefeitura Municipal de Parnaíba / Secretaria Municipal de Saúde / FarmaUBS;
     - Identificação da Unidade Básica de Saúde (Nome e CNES);
     - Número oficial da Ata (ex.: `ATA-INV-2026/004`) e Hash SHA-256 de integridade;
     - Data e hora de emissão;
     - Farmacêutico Responsável Técnico e número de CRF;
     - Tabela das divergências apuradas com motivo e justificativa sanitária;
     - Termo legal de declaração de veracidade das informações;
     - Campos para assinatura física e carimbo do Farmacêutico Responsável e do Gerente da UBS.

3. **Impressão Nativa com Folha de Estilo Limpa (`@media print`)**:
   - Botão `🖨️ Imprimir Ata Oficial`:
     - Aciona `window.print()`;
     - O layout de impressão isola apenas a área `#ataOficialPrintArea`, ocultando barras de navegação, botões e elementos da aplicação;
     - Tipografia limpa em preto e branco, margens de 15mm e quebra de página inteligente sem cortar tabelas.

4. **Botão de Exportação em Planilha Excel (`.xlsx`) (RF021)**:
   - Botão de ação: `📥 Baixar Planilha (.xlsx)`.
   - Dispara o download automático do relatório consolidado através de `GET /api/v1/inventario/ciclos/:id/exportar-xlsx`, permitindo arquivamento digital e manipulação gerencial em planilhas.

---

## 3. Escopo Técnico & Arquitetural

- **Camada**: D (Testes de Componentes React).
- **Componentes**:
  - `apps/frontend/src/features/inventario/components/ModalHomologacaoInventario.tsx`;
  - `apps/frontend/src/features/inventario/components/AtaInventarioImpressaoModal.tsx`.
- **Hooks**: `useHomologarInventario()`, `useAtaInventario(cicloId)` e `useExportarInventarioXlsx(cicloId)`.

### Compartilhamento Arquitetural com @farmaubs/shared e App Mobile (apps/mobile - IN-MOB-04)
- **Contratos e DTOs da Ata Oficial**: O DTO de resposta `InventarioAtaOficialDTO`, o schema de homologação `homologarInventarioSchema` e os tipos de totais consolidados são unificados em `@farmaubs/shared/src/contracts/inventario/`.
- **Validação de Prontidão para Homologação**: A regra lógica pura que verifica se todas as divergências foram saneadas e se o ciclo pode ser encerrado é executada por um helper compartilhado em `@farmaubs/shared/src/domain/inventario/homologacao-helpers.ts`.
- **Equivalente Mobile**: A formalização legal (impressão com `@media print`) permanece prioritária no desktop, mas o app mobile (**IN-MOB-04**) permite ao farmacêutico homologar o ciclo no celular, consultar o hash e número da Ata gerada e compartilhar o resumo oficial via API nativa (`expo-sharing`).
- **Diretrizes para Ciclos Independentes de Desenvolvimento**:
  - *Cenário A (Mobile já implementou IN-MOB-04)*: O Frontend Web consome diretamente `InventarioAtaOficialDTO`, `homologarInventarioSchema` e o helper de validação de prontidão de homologação já validados em `@farmaubs/shared`.
  - *Cenário B (Mobile ainda NÃO implementou IN-MOB-04)*: O Frontend Web publica o payload de homologação e DTOs da Ata em `packages/shared/src/contracts/inventario/`, servindo de modelo contratual para a confirmação mobile.

---

## 4. Critérios de Aceite (Gherkin BDD)

### Cenário 1: Confirmação de homologação e abertura automática da Ata Oficial
```gherkin
Dado que todas as contagens e justificativas do ciclo foram preenchidas
Quando o farmacêutico clicar em "Homologar Inventário"
E confirmar no modal de homologação
Então a mutação de homologação deve ser executada com sucesso
E o modal da Ata Oficial deve ser aberto exibindo o número da ata e a tabela de conciliação
E um toast deve confirmar: "Inventário homologado e estoque ajustado com sucesso"
```

### Cenário 2: Acionamento da folha de impressão CSS print
```gherkin
Dado que o modal da Ata Oficial está visível
Quando o usuário clicar no botão "Imprimir Ata Oficial"
Então o comando window.print() deve ser acionado
E apenas o container "#ataOficialPrintArea" deve estar visível para a impressão
E as assinaturas do farmacêutico e do gerente da UBS devem estar posicionadas no rodapé
```

---

## 5. Estilo de Impressão da Ata Oficial (CSS Print)

```css
@media print {
  body * {
    visibility: hidden;
  }
  #ataOficialPrintArea,
  #ataOficialPrintArea * {
    visibility: visible;
  }
  #ataOficialPrintArea {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 15mm;
    background: white;
    color: black;
    font-size: 11pt;
    line-height: 1.4;
  }
  .no-print {
    display: none !important;
  }
}
```

---

## 6. Definition of Done (DoD)

- [ ] Modais desenvolvidos com foco aprisionado, tecla `Escape` e total acessibilidade WCAG 2.1 AA.
- [ ] Folha de estilo de impressão testada com formatação oficial e campos de assinatura do SUS.
- [ ] Botão de exportação `.xlsx` integrado ao backend para download de arquivo binário sem redirecionamento.
- [ ] Testes de componentes (Camada D) validando bloqueios pré-homologação, acionamento do `window.print()` e download da planilha.
