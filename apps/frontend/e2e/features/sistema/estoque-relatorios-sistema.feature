# language: pt
Funcionalidade: Interface de Exportação de Relatórios de Estoque em Planilha Excel (.xlsx) (Camada D)

  Como farmacêutico responsável ou gerente da UBS
  Quero exportar relatórios estruturados de saldos atuais e perdas por vencimento em planilha Excel (.xlsx) com validação de intervalo de datas
  Para instruir o pedido mensal à CAF e prestar contas à coordenação de assistência farmacêutica (RF020, RF028)

  Contexto:
    Dado que as APIs do módulo de controle de estoque da UBS estão operacionais
    E que o farmacêutico autenticado acessa o painel de Controle de Estoque da UBS

  Cenário: Validação de consistência de intervalo de datas personalizado e exportação de relatório de perdas (.xlsx)
    Quando ele abrir o modal "Exportar (.xlsx)"
    E selecionar "Período Personalizado" preenchendo Data Início "2026-09-30" e Data Fim "2026-09-01"
    Então uma mensagem de erro deve informar que a data final não pode ser anterior à data inicial e o botão de download deve ficar desabilitado
    Quando ele selecionar o relatório de "Perdas por Vencimento e Avarias" no atalho "Mês Anterior" e clicar em "Baixar Planilha Excel"
    Então o arquivo Excel ".xlsx" de estoque deve ser baixado nativamente pelo navegador
    E uma notificação de sucesso deve confirmar "Relatório de perdas exportado com sucesso"
