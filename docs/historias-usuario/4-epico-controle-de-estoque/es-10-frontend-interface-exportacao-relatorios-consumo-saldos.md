# ES-10 feat(estoque): Interface de Relatórios: Seletor de Período, Filtros de Exportação e Download de Planilha Excel (.xlsx)

---

- **Épico**: Controle de Estoque (RF005, RF006, RF007, RF009, RF011, RF018, RF020, RF022, RF023, RF028, NF001, NF002, NF003, NF007, NF009, NF015)
- **Requisitos Funcionais**: RF020 (Gerar Relatório de Perdas por Vencimento), RF028 (Exportação de Dados Tabulares e Auditoria)
- **Requisitos Não-Funcionais**: NF001 (Interface Fluida em Poucos Passos), NF007 (Download Rápido de Arquivo com Feedback Visual)
- **ADRs Vinculadas**: ADR-011 (React 19 + Tailwind CSS), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico responsável ou gerente de farmácia da UBS,  
> **quero** um modal de exportação acessível acionado a partir de um botão em destaque na tela de estoque, permitindo escolher o tipo de relatório desejado (saldos atuais, perdas por vencimento ou movimentações do período), definir o intervalo de datas e baixar diretamente a planilha Excel (.xlsx),  
> **para que** eu possa exportar dados consolidados em conformidade com o modelo exigido pela gerência da UBS e pela CAF para o planejamento do pedido mensal (RF020, RF028).

---

## 2. Regras de negócio e casos de borda

1. **Botão de Ação no Topo da Interface**:
   - Botão secundário estilizado em destaque na barra superior de ações: `📥 Exportar (.xlsx)`.
2. **Seletor de Tipo de Relatório**:
   - `Saldos Atuais`: Relação consolidada do estoque físico em prateleira e detalhamento de lotes;
   - `Perdas por Vencimento e Avarias (RF020)`: Histórico de baixas por validade expirada, quebras e descartes;
   - `Movimentações do Período`: Extrato completo de entradas, saídas e ajustes manuais.
3. **Seletor de Período com Atalhos**:
   - Atalhos: "Mês Atual" (padrão), "Mês Anterior", "Últimos 90 dias" e "Período Personalizado".
   - Validação visual: impede `Data Fim < Data Início`.
4. **Filtro Opcional por Princípio Ativo**:
   - Campo opcional com autocomplete para filtrar dados de um medicamento específico.
5. **Download Seguro do Arquivo Binário**:
   - Dispara requisição blob para `GET /api/v1/estoque/relatorios/exportar-xlsx` com `aria-busy="true"` ("Gerando planilha...") e toast de confirmação.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs / Tipagens)

```typescript
export interface ExportarRelatorioEstoqueQueryDto {
  tipoRelatorio: 'SALDOS_ATUAIS' | 'PERDAS_VENCIMENTO' | 'MOVIMENTACOES_PERIODO';
  dataInicio?: string;
  dataFim?: string;
  principioAtivo?: string;
  categoria?: string;
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

- **Camada**: D (Testes de Componentes React).
- **Componente**: `apps/frontend/src/features/estoque/components/ModalExportarRelatoriosEstoque.tsx`.
- **Hook de Download**: `useExportarRelatorioEstoqueXlsx()`.
- **Props**: `aberto: boolean`, `onFechar: () => void`.

### Compartilhamento Arquitetural com `@farmaubs/shared` e App Mobile
- **Contratos de Exportação**: `ExportarRelatorioEstoqueQueryDto` e enum `TipoRelatorioEstoque` centralizados em `@farmaubs/shared`.
- **Validação de Ranges**: Schema Zod `exportarRelatorioEstoqueSchema` valida datas e tipos.
- **Integração Mobile**: No mobile, utiliza `expo-file-system` e `expo-sharing` para salvar e compartilhar o arquivo.

---

## 5. Cenários de teste em BDD (Gherkin — camada D)

```gherkin
# language: pt
Funcionalidade: Interface de Exportação de Relatórios de Estoque (Camada D)

  Cenário: Exportação bem-sucedida de relatório de perdas por vencimento
    Dado que o modal de exportação de relatórios está aberto
    Quando o farmacêutico selecionar a opção "Perdas por Vencimento e Avarias"
    E selecionar o atalho de período "Mês Anterior"
    E clicar em "Baixar Planilha Excel"
    Então o botão deve apresentar o spinner de carregamento ("Gerando planilha...")
    E o arquivo .xlsx deve ser transferido para a pasta de downloads do navegador
    E uma mensagem toast deve confirmar: "Relatório de perdas exportado com sucesso"
    E o modal deve ser encerrado

  Cenário: Validação de consistência de intervalo de datas personalizado
    Dado que o usuário selecionou "Período Personalizado"
    Quando ele preencher Data Início "2026-09-30" e Data Fim "2026-09-01"
    Então uma mensagem de erro em vermelho deve ser exibida: "A data final não pode ser anterior à data inicial"
    E o botão de download deve permanecer desabilitado
```

---

## 6. Checklist de DoD e aceitação

- [ ] Modal de exportação implementado com React 19, Tailwind CSS e foco aprisionado.
- [ ] Integração com o endpoint backend de streaming de arquivo binário `.xlsx`.
- [ ] Validações de data e tratamento de erros de rede com feedback visual acessível.
- [ ] Testes de componentes (Camada D) validando alternância de tipos de relatório e disparo de download.
