# Progresso — Épico 3: Recebimento de Medicamentos

Última atualização: 01/10/2026

## Resumo Executivo

| Métrica | Valor |
| --- | --- |
| **Total de Histórias Mapeadas** | 12 |
| **Entregues** | 4 (33%) |
| **Em Andamento** | 0 (0%) |
| **Pendentes** | 8 (67%) |

```
Progresso: [███████░░░░░░░░░░░░░] 33% (4/12 concluídas)
```

---

## Histórias do Épico 3

| Código | Camada | Título | Especificação | Status Redação | Status Implementação |
| --- | --- | --- | --- | --- | --- |
| **RE-01** | Backend | Migrations do schema de recebimento (`documentos_entrada`, `recebimento_itens`, `lotes`, `fabricantes` e movimentações) | [re-01-backend-migrations-schema-recebimento.md](./re-01-backend-migrations-schema-recebimento.md) | ✅ Redigida | ✅ Concluída |
| **RE-02** | Backend | API de Catálogo: Busca textual de medicamentos, apresentações e gestão de fabricantes | [re-02-backend-api-catalogo-busca-produtos-fabricantes.md](./re-02-backend-api-catalogo-busca-produtos-fabricantes.md) | ✅ Redigida | ✅ Concluída |
| **RE-03** | Backend | API de Efetivação: Transação atômica de entrada de estoque, criação/incremento de lotes e movimentação de auditoria (RF008, RF024) | [re-03-backend-api-efetivacao-transacao-entrada-estoque.md](./re-03-backend-api-efetivacao-transacao-entrada-estoque.md) | ✅ Redigida | ✅ Concluída |
| **RE-04** | Backend | API de Histórico: Listagem temporal (ontem/hoje padrão, range de datas), filtros, comprovante, estorno e exportação .xlsx (RF008, RF028) | [re-04-backend-api-historico-recebimentos-estorno.md](./re-04-backend-api-historico-recebimentos-estorno.md) | ✅ Redigida | ✅ Concluída |
| **RE-05** | Frontend | Cabeçalho do Recebimento: Formulário do documento fiscal/guia CAF, seleção de origem e validações | [re-05-frontend-formulario-recebimento-cabecalho-guia.md](./re-05-frontend-formulario-recebimento-cabecalho-guia.md) | ✅ Redigida | ⏳ Não iniciada |
| **RE-06** | Frontend | Busca Textual no Catálogo, Fabricante Obrigatório, Lote e Validade com Alertas (RF008, RF024) | [re-06-frontend-busca-textual-medicamentos-fabricante-lote.md](./re-06-frontend-busca-textual-medicamentos-fabricante-lote.md) | ✅ Redigida | ⏳ Não iniciada |
| **RE-07** | Frontend | Efetivação da Entrada: Submissão transacional, feedback visual e atualização dos saldos (RF008, RF024) | [re-07-frontend-confirmacao-entrada-sincronizacao-estoque.md](./re-07-frontend-confirmacao-entrada-sincronizacao-estoque.md) | ✅ Redigida | ⏳ Não iniciada |
| **RE-08** | Frontend | Painel de Histórico de Recebimentos: Visualização ontem/hoje, seletor de range, busca, exportação .xlsx, termo de carga e estorno (RF008, RF028) | [re-08-frontend-tabela-ultimos-recebimentos-termo-estorno.md](./re-08-frontend-tabela-ultimos-recebimentos-termo-estorno.md) | ✅ Redigida | ⏳ Não iniciada |
| **RE-MOB-01** | Mobile | Abertura e Conferência de Guia de Remessa no Celular | [re-mob-01-conferencia-guia-recebimento-mobile.md](./re-mob-01-conferencia-guia-recebimento-mobile.md) | ✅ Redigida | ⏳ Não iniciada |
| **RE-MOB-02** | Mobile | Conferência Física de Medicamentos, Fabricante, Lotes e Validades no Celular | [re-mob-02-conferencia-fisica-lotes-validade-mobile.md](./re-mob-02-conferencia-fisica-lotes-validade-mobile.md) | ✅ Redigida | ⏳ Não iniciada |
| **RE-MOB-03** | Mobile | Confirmação e Efetivação de Entrada de Estoque no Celular | [re-mob-03-confirmacao-entrada-estoque-mobile.md](./re-mob-03-confirmacao-entrada-estoque-mobile.md) | ✅ Redigida | ⏳ Não iniciada |
| **RE-MOB-04** | Mobile | Consulta de Histórico de Conferências e Recebimentos no Celular | [re-mob-04-historico-conferencias-recebimento-mobile.md](./re-mob-04-historico-conferencias-recebimento-mobile.md) | ✅ Redigida | ⏳ Não iniciada |
