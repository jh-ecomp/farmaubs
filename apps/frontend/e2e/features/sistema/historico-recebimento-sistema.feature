# language: pt
Funcionalidade: Histórico de Recebimentos, Termo SUS A4 (@media print), Exportação XLSX e Estorno (Camada D)

  Como farmacêutico responsável pela UBS
  Quero consultar o histórico de guias de recebimento, emitir o Termo de Recebimento de Carga SUS em modo de impressão A4, exportar planilha Excel (.xlsx) e estornar guias com justificativa
  Para manter a rastreabilidade completa das cargas recebidas (RF008, RF028)

  Contexto:
    Dado que as APIs do módulo de recebimento de medicamentos da UBS estão operacionais
    E que o farmacêutico autenticado acessou a aba de histórico de recebimentos filtrada em "Ontem e Hoje"

  Cenário: Emissão do Termo de Recebimento de Carga SUS com emulação de impressão A4 (@media print) e download XLSX
    Quando ele clicar em "Comprovante" na guia "GUIA-CAF-2026/089" e o navegador entrar em modo de impressão ("media: print")
    Então a área oficial "#termoRecebimentoPrintArea" deve estar visível no modo de impressão
    Quando ele voltar ao modo de tela, fechar o modal de comprovante e clicar em "Exportar (.xlsx)" no histórico de recebimentos
    Então o arquivo Excel ".xlsx" de recebimentos deve ser baixado nativamente pelo navegador

  Cenário: Estorno justificado de guia de recebimento com atualização imediata de status
    Quando ele acionar "Estornar" na guia "GUIA-CAF-2026/089"
    E preencher a justificativa de estorno de recebimento "Divergência constatada na conferência física da nota fiscal" e confirmar
    Então a guia "GUIA-CAF-2026/089" deve passar a exibir o status "ESTORNADO"
