# language: pt
Funcionalidade: Conferência de Guia CAF, Catálogo, Alerta de Validade Curta e Efetivação da Entrada (Camada D)

  Como farmacêutico responsável pela UBS
  Quero registrar guias de recebimento da CAF, buscar medicamentos no catálogo, vincular fabricante e lote com aviso de validade curta e efetivar a entrada no estoque
  Para abastecer os lotes físicos da farmácia com conformidade sanitária e acessibilidade WCAG 2.1 AA (RF008, RF024, ADR-032)

  Contexto:
    Dado que as APIs do módulo de recebimento de medicamentos da UBS estão operacionais
    E que o farmacêutico autenticado acessou a tela de recebimentos da UBS

  Cenário: Registro completo de guia CAF com aviso de validade curta (< 180 dias), auditoria WCAG 2.1 AA e efetivação da entrada
    Quando ele preencher a guia "GUIA-CAF-2026/089" com origem "CAF Central - SMS Parnaíba"
    E adicionar o medicamento "Dipirona Sódica" do fabricante "Farmanguinhos" com lote "LT-DIP-99", validade curta em 120 dias e quantidade 200
    Então o alerta visual de validade curta deve ser exibido na lista provisória da guia
    E a tela de recebimento não deve apresentar violações críticas de acessibilidade WCAG 2.1 AA
    Quando ele clicar em "Confirmar Entrada no Estoque" e confirmar em "Confirmar e Abastecer Estoque"
    Então a entrada de recebimento deve ser gravada com sucesso exibindo a notificação de abastecimento
