# Progresso — Épico 2: Dispensação de Medicamentos

Última atualização: 28/10/2026

## Resumo Executivo

| Métrica | Valor |
| --- | --- |
| **Total de Histórias Mapeadas** | 15 |
| **Entregues** | 5 (33%) |
| **Em Andamento** | 0 (0%) |
| **Pendentes** | 10 (67%) |

```
Progresso: [███████░░░░░░░░░░░░░] 33% (5/15 concluídas)
```

---

## Histórias do Épico 2

| Código | Camada | Título | Especificação | Status Redação | Status Implementação |
| --- | --- | --- | --- | --- | --- |
| **DI-01** | Backend | Migrations do schema de dispensação (`pacientes`, `dispensacoes`, `dispensacao_itens` e movimentações) | [di-01-backend-migrations-schema-dispensacao.md](./di-01-backend-migrations-schema-dispensacao.md) | ✅ Redigida | ✅ Concluída |
| **DI-02** | Backend | API de Pacientes: Validação obrigatória (CNS, CPF, Nome, Data Nasc), busca e histórico de consumo | [di-02-backend-api-pacientes-cadastro-historico.md](./di-02-backend-api-pacientes-cadastro-historico.md) | ✅ Redigida | ✅ Concluída |
| **DI-03** | Backend | API de Dispensação: Busca textual de medicamentos e algoritmo de sugestão FEFO | [di-03-backend-api-dispensacao-busca-produtos-lotes-fefo.md](./di-03-backend-api-dispensacao-busca-produtos-lotes-fefo.md) | ✅ Redigida | ✅ Concluída |
| **DI-04** | Backend | API de Efetivação: Transação atômica de dispensa, validação de antimicrobianos e baixa de estoque | [di-04-backend-api-efetivacao-transacao-baixa-estoque.md](./di-04-backend-api-efetivacao-transacao-baixa-estoque.md) | ✅ Redigida | ✅ Concluída |
| **DI-05** | Backend | API de Histórico: Listagem temporal (ontem/hoje padrão, range de datas), filtros e exportação .xlsx | [di-05-backend-api-historico-dispensas-filtro-ontem-hoje-exportacao-xlsx.md](./di-05-backend-api-historico-dispensas-filtro-ontem-hoje-exportacao-xlsx.md) | ✅ Redigida | ✅ Concluída |
| **DI-06** | Frontend | Componente de Identificação do Paciente: Formulário obrigatório (CNS, CPF, Nome, Data Nasc) e histórico | [di-06-frontend-identificacao-paciente-formulario-historico.md](./di-06-frontend-identificacao-paciente-formulario-historico.md) | ✅ Redigida | ⏳ Não iniciada |
| **DI-07** | Frontend | Busca Textual de Medicamentos e Seletor de Lotes FEFO com alertas de índice terapêutico | [di-07-frontend-busca-textual-medicamentos-seletor-lotes-fefo.md](./di-07-frontend-busca-textual-medicamentos-seletor-lotes-fefo.md) | ✅ Redigida | ⏳ Não iniciada |
| **DI-08** | Frontend | Carrinho de Dispensação: Múltiplos itens, campos de posologia e validação de receita de antimicrobianos | [di-08-frontend-carrinho-receita-posologia-antimicrobianos.md](./di-08-frontend-carrinho-receita-posologia-antimicrobianos.md) | ✅ Redigida | ⏳ Não iniciada |
| **DI-09** | Frontend | Tela Principal de Dispensação: Integração do atendimento, métricas e confirmação de baixa | [di-09-frontend-tela-principal-dispensacao-fechamento-atendimento.md](./di-09-frontend-tela-principal-dispensacao-fechamento-atendimento.md) | ✅ Redigida | ⏳ Não iniciada |
| **DI-10** | Frontend | Painel de Histórico de Dispensas: Visualização ontem/hoje, seletor de range, filtros e exportação .xlsx | [di-10-frontend-painel-historico-dispensas-filtros-exportacao-xlsx.md](./di-10-frontend-painel-historico-dispensas-filtros-exportacao-xlsx.md) | ✅ Redigida | ⏳ Não iniciada |
| **DI-MOB-01** | Mobile | Identificação do Paciente por Cartão SUS / CPF no App Mobile | [di-mob-01-identificacao-paciente-cartao-sus-mobile.md](./di-mob-01-identificacao-paciente-cartao-sus-mobile.md) | ✅ Redigida | ⏳ Não iniciada |
| **DI-MOB-02** | Mobile | Busca Rápida de Medicamentos e Seletor de Lotes FEFO Mobile | [di-mob-02-busca-medicamentos-seletor-lotes-fefo-mobile.md](./di-mob-02-busca-medicamentos-seletor-lotes-fefo-mobile.md) | ✅ Redigida | ⏳ Não iniciada |
| **DI-MOB-03** | Mobile | Carrinho de Dispensação, Posologia e Validação de Antimicrobianos Mobile | [di-mob-03-carrinho-dispensacao-posologia-mobile.md](./di-mob-03-carrinho-dispensacao-posologia-mobile.md) | ✅ Redigida | ⏳ Não iniciada |
| **DI-MOB-04** | Mobile | Confirmação de Baixa e Recibo Digital de Dispensação Mobile | [di-mob-04-fechamento-dispensacao-recibo-mobile.md](./di-mob-04-fechamento-dispensacao-recibo-mobile.md) | ✅ Redigida | ⏳ Não iniciada |
| **DI-MOB-05** | Mobile | Consulta de Histórico de Dispensações Mobile | [di-mob-05-consulta-historico-dispensas-mobile.md](./di-mob-05-consulta-historico-dispensas-mobile.md) | ✅ Redigida | ⏳ Não iniciada |
