# IN-08 feat(inventario): Modal de Homologação e Ata Oficial: Resumo de Conciliação, Impressão da Ata com CSS Print e Exportação .xlsx

---

- **Épico**: Inventário Mensal (RF009, RF011, RF013, RF014, RF021, RF028, NF001, NF002, NF003, NF005, NF007, NF008, NF009, NF015)
- **Requisitos Funcionais**: RF013 (Realizar Inventário Mensal), RF021 (Gerar Relatório de Inventário Mensal), RF028 (Ata Oficial de Auditoria e Exportação)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva em Modais Acessíveis), NF002 (Design Responsivo), NF008 (Download e Impressão Rápidos)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-011 (React 19 + Tailwind CSS), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico responsável pela farmácia da UBS,  
> **quero** abrir o modal de homologação para revisar o resumo das divergências apuradas, confirmar o acerto de estoque definitivo no sistema, visualizar a Ata Oficial de Inventário Mensal formatada para impressão direta no navegador e baixar a planilha completa em formato Excel (.xlsx),  
> **para que** eu possa formalizar a conclusão do inventário físico, colher as assinaturas da gerência da unidade e encaminhar a prestação de contas à CAF de Parnaíba (RF013, RF021, RF028).

---

## 2. Regras de negócio e casos de borda

1. **Modal de Homologação (`ModalHomologacaoInventario.tsx`)**:
   - Exibe sumário executivo antes do fechamento: Total de Itens, Conformes, Divergências Justificadas e Saldo Físico Global.
   - Condição Bloqueante: O botão `"Confirmar Homologação e Ajustar Estoque"` permanece desabilitado se houver qualquer item sem contagem física ou com divergência sem justificativa válida.
   - Ao confirmar, dispara `POST /api/v1/inventario/ciclos/:id/homologar`, emite toast e abre automaticamente a visualização da Ata Oficial.
2. **Modal de Visualização da Ata Oficial (`AtaInventarioImpressaoModal.tsx`)**:
   - Apresenta: Cabeçalho institucional, Nome e CNES da UBS, Número da Ata (ex: `ATA-INV-2026/004`), Hash SHA-256 de integridade, data/hora, farmacêutico com CRF, tabela de divergências justificadas e campos para assinatura física.
3. **Impressão Nativa com Folha de Estilo Limpa (`@media print`)**:
   - Botão `🖨️ Imprimir Ata Oficial` aciona `window.print()` isolando `#ataOficialPrintArea` em tipografia limpa, preto e branco e margens de 15mm.
4. **Botão de Exportação em Planilha Excel (`.xlsx`) (RF021)**:
   - Botão de ação: `📥 Baixar Planilha (.xlsx)` via `GET /api/v1/inventario/ciclos/:id/exportar-xlsx`.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs / CSS Print)

### Contratos TypeScript (`@farmaubs/shared`)

```typescript
export interface InventarioAtaOficialDTO {
  numeroAta: string;
  dataEmissao: string;
  hashIntegridade: string;
  ubsNome: string;
  ubsCnes: string;
  farmaceuticoNome: string;
  farmaceuticoCrf: string;
  totalItens: number;
  totalConformes: number;
  totalDivergencias: number;
  totalSobras: number;
  totalFaltas: number;
  itensDivergentes: {
    medicamento: string;
    lote: string;
    fabricante: string;
    quantidadeTeorica: number;
    quantidadeFisica: number;
    divergencia: number;
    motivo: string;
    justificativa: string;
  }[];
}
```

### Estilo de Impressão da Ata Oficial (CSS Print)

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

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

- **Camada**: D (Testes de Componentes React).
- **Componentes**:
  - `apps/frontend/src/features/inventario/components/ModalHomologacaoInventario.tsx`;
  - `apps/frontend/src/features/inventario/components/AtaInventarioImpressaoModal.tsx`.
- **Hooks**: `useHomologarInventario()`, `useAtaInventario(cicloId)` e `useExportarInventarioXlsx(cicloId)`.

### Compartilhamento Arquitetural com `@farmaubs/shared` e App Mobile (`apps/mobile` - IN-MOB-04)
- **Contratos e DTOs da Ata Oficial**: `InventarioAtaOficialDTO` e `homologarInventarioSchema` unificados em `@farmaubs/shared`.
- **Validação de Prontidão para Homologação**: Helper puro `verificarProntidaoHomologacao(itens)`.
- **Equivalente Mobile**: O app mobile (**IN-MOB-04**) permite ao farmacêutico homologar o ciclo no celular, consultar hash e número de ata e compartilhar resumo via API nativa (`expo-sharing`).

---

## 5. Cenários de teste em BDD (Gherkin — camada D)

```gherkin
# language: pt
Funcionalidade: Homologação, Impressão da Ata e Exportação XLSX (Camada D)

  Cenário: Confirmação de homologação e abertura automática da Ata Oficial
    Dado que todas as contagens e justificativas do ciclo foram preenchidas
    Quando o farmacêutico clicar em "Homologar Inventário"
    E confirmar no modal de homologação
    Então a mutação de homologação deve ser executada com sucesso
    E o modal da Ata Oficial deve ser aberto exibindo o número da ata e a tabela de conciliação
    E um toast deve confirmar: "Inventário homologado e estoque ajustado com sucesso"

  Cenário: Acionamento da folha de impressão CSS print
    Dado que o modal da Ata Oficial está visível
    Quando o usuário clicar no botão "Imprimir Ata Oficial"
    Então o comando window.print() deve ser acionado
    E apenas o container "#ataOficialPrintArea" deve estar visível para a impressão
    E as assinaturas do farmacêutico e do gerente da UBS devem estar posicionadas no rodapé
```

---

## 6. Checklist de DoD e aceitação

- [ ] Modais desenvolvidos com foco aprisionado, tecla `Escape` e total acessibilidade WCAG 2.1 AA.
- [ ] Folha de estilo de impressão testada com formatação oficial e campos de assinatura do SUS.
- [ ] Botão de exportação `.xlsx` integrado ao backend para download de arquivo binário sem redirecionamento.
- [ ] Testes de componentes (Camada D) validando bloqueios pré-homologação, acionamento do `window.print()` e download da planilha.
