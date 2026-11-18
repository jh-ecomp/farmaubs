# language: pt
Funcionalidade: Painel de Histórico de Dispensações, Exportação XLSX e Estorno (Camada D)

  Como farmacêutico ou gerente da UBS
  Quero auditar os atendimentos de ontem e hoje, baixar relatórios em planilha Excel (.xlsx) e estornar dispensações indevidas
  Para manter a rastreabilidade de saídas e restituir saldos de lotes com justificativa obrigatória (RF012, RF028)

  Contexto:
    Dado que as APIs da bancada de dispensação da UBS estão operacionais
    E que o farmacêutico autenticado acessa a aba de histórico de dispensações

  Cenário: Carga inicial da tabela com filtro padrão de ontem e hoje e exportação XLSX nativa
    Quando a tela de histórico terminar de carregar
    Então o seletor de período deve estar ativo no atalho "Ontem e Hoje"
    E a tabela deve exibir as dispensações ocorridas nesse intervalo
    Quando o farmacêutico clicar no botão "Baixar Planilha"
    Então o arquivo Excel ".xlsx" deve ser baixado nativamente pelo navegador

  Cenário: Acionamento de estorno de atendimento com justificativa obrigatória
    Dado que o farmacêutico clica em "Estornar" para um atendimento com status "Concluída"
    Quando preencher o motivo com "Digitado item incorreto por engano na bancada" e confirmar
    Então o status da linha na tabela deve mudar para "Estornada"
