# Progresso do Épico 3: Recebimento de Medicamentos

Este arquivo acompanha o status de especificação e implementação das histórias de usuário (US) do **Épico 3: Recebimento de Medicamentos**, abrangendo **Backend**, **Frontend Web** (`apps/frontend`), **Mobile** (`apps/mobile`) e contratos em `@farmaubs/shared`.

> **Diretriz Web ↔ Mobile**: O desenvolvimento entre Web e Mobile ocorre em ciclos independentes. A primeira frente a implementar uma história de usuário deve criar ou validar os tipos e funções utilitárias correspondentes em `@farmaubs/shared`, permitindo que a outra frente os reutilize diretamente.

---

## Resumo Geral
- **Total de Histórias Planejadas**: 12 (4 Backend, 4 Frontend Web, 4 Mobile)
- **Histórias Especificadas (`.md`)**: 12 / 12 (100%)
- **Histórias Implementadas**: 8 / 12 (67%)

---

## Matriz de Rastreabilidade e Status

| ID | Camada | Título da História | Requisitos / ADRs | Especificação | Implementação | Contra-parte / Shared |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **RE-01** | Backend | Migrações do schema de recebimento (`documentos_entrada`, `itens_entrada`, `lotes`, `movimentacoes_estoque`) | RF008, RF009, RF024, ADR-005 | [re-01-migrations-schema-recebimento-lotes.md](./re-01-migrations-schema-recebimento-lotes.md) | ✅ Concluída | `@farmaubs/shared/recebimento` |
| **RE-02** | Backend | API de Catálogo: busca textual de produtos, apresentações e fabricantes ativos | RF006, RF007, RF008, NF002 | [re-02-api-catalogo-produtos-fabricantes.md](./re-02-api-catalogo-produtos-fabricantes.md) | ✅ Concluída | `@farmaubs/shared/recebimento` |
| **RE-03** | Backend | API de Efetivação: transação de entrada de estoque, criação/atualização de lotes e trava de validade | RF008, RF009, RF024, ADR-015 | [re-03-api-efetivacao-entrada-estoque-lotes.md](./re-03-api-efetivacao-entrada-estoque-lotes.md) | ✅ Concluída | `@farmaubs/shared/recebimento` |
| **RE-04** | Backend | API de Histórico: filtro padrão (ontem/hoje), intervalo customizado, comprovante, estorno e `.xlsx` | RF008, RF028, NF010, ADR-015 | [re-04-api-historico-recebimentos-comprovante-estorno.md](./re-04-api-historico-recebimentos-comprovante-estorno.md) | ✅ Concluída | `@farmaubs/shared/recebimento` |
| **RE-05** | Frontend Web | Cabeçalho do recebimento: formulário de guia CAF/nota fiscal, fornecedor e data | RF008, NF001, ADR-030 | [re-05-frontend-formulario-recebimento-cabecalho-guia.md](./re-05-frontend-formulario-recebimento-cabecalho-guia.md) | ✅ Concluída | Par: **RE-MOB-01** |
| **RE-06** | Frontend Web | Busca textual no catálogo, seleção obrigatória de fabricante, lote e avisos de validade | RF007, RF008, RF009, RF024 | [re-06-frontend-busca-textual-medicamentos-fabricante-lote.md](./re-06-frontend-busca-textual-medicamentos-fabricante-lote.md) | ✅ Concluída | Par: **RE-MOB-02** |
| **RE-07** | Frontend Web | Efetivação da entrada: envio da carga, atualização de estoque e feedback visual | RF008, NF002, ADR-015 | [re-07-frontend-confirmacao-entrada-sincronizacao-estoque.md](./re-07-frontend-confirmacao-entrada-sincronizacao-estoque.md) | ✅ Concluída | Par: **RE-MOB-03** |
| **RE-08** | Frontend Web | Painel de histórico: visualização padrão (ontem/hoje), filtro por período, `.xlsx`, termo e estorno | RF008, RF028, NF010, ADR-030 | [re-08-frontend-tabela-ultimos-recebimentos-termo-estorno.md](./re-08-frontend-tabela-ultimos-recebimentos-termo-estorno.md) | ✅ Concluída | Par: **RE-MOB-04** |
| **RE-MOB-01** | Mobile | Conferência rápida de guia de recebimento CAF na doca de entrega | RF008, NF001, ADR-034 | [re-mob-01-conferencia-rapida-guia-recebimento-caf.md](./re-mob-01-conferencia-rapida-guia-recebimento-caf.md) | ⏳ Pendente | Par: **RE-05** |
| **RE-MOB-02** | Mobile | Conferência física de lotes e aviso de validade no celular | RF008, RF009, RF024, ADR-034 | [re-mob-02-conferencia-fisica-lotes-aviso-validade-celular.md](./re-mob-02-conferencia-fisica-lotes-aviso-validade-celular.md) | ⏳ Pendente | Par: **RE-06** |
| **RE-MOB-03** | Mobile | Confirmação de entrada de estoque e recibo digital mobile | RF008, ADR-015, ADR-034 | [re-mob-03-confirmacao-entrada-estoque-recibo-digital-mobile.md](./re-mob-03-confirmacao-entrada-estoque-recibo-digital-mobile.md) | ⏳ Pendente | Par: **RE-07** |
| **RE-MOB-04** | Mobile | Histórico de conferências de recebimento e consulta de guias no celular | RF008, RF028, ADR-034 | [re-mob-04-historico-conferencias-recebimento-consulta-guias.md](./re-mob-04-historico-conferencias-recebimento-consulta-guias.md) | ⏳ Pendente | Par: **RE-08** |

---

## Contratos Compartilhados (`@farmaubs/shared`)
Para garantir desacoplamento e independência entre Web e Mobile neste épico, o módulo `packages/shared/src/recebimento/` contém:
1. `recebimento.types.ts`: DTOs de guia/documento de entrada, itens recebidos, fornecedores institucionais padrão e payload de estorno.
2. `catalogo.types.ts`: DTOs de medicamentos do catálogo, apresentações e fabricantes ativos.
3. `validade-helpers.ts`: Funções puras para validação de lote vencido (bloqueio na entrada) e alerta de validade curta (< 180 dias).
4. `historico.types.ts`: Contratos de paginação, filtros temporais (`ONTEM`, `HOJE`, `CUSTOMIZADO`), Termo de Recebimento SUS e estorno.
