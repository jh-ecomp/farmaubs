# language: pt
Funcionalidade: Jornada E2E Full-Stack de Recebimento de Medicamentos, Termo SUS e Estorno (Camadas C e D)

  Como farmacêutico responsável pela UBS de Parnaíba
  Quero autenticar no sistema, registrar a entrada de uma guia da CAF, conferir o Termo de Recebimento SUS no histórico e exportar a planilha (.xlsx)
  Para validar a integração de ponta a ponta do módulo de Recebimento (RE-05 a RE-09)

  Cenário: Conferência e efetivação de guia CAF full-stack com emissão de Termo SUS e exportação XLSX
    Dado que o servidor de backend está com o estoque inicial da UBS de Parnaíba carregado
    Quando o farmacêutico realiza login com o e-mail "farma.parnaiba@farmaubs.dev" e senha "Farma@123456"
    E navega pelo menu lateral para a bancada de "Recebimento"
    E ele preencher a guia "GUIA-CAF-2026/150" com origem "CAF Central - SMS Parnaíba"
    E adicionar o medicamento "Dipirona Sódica" do fabricante "Farmanguinhos" com lote "LT-DIP-150", validade curta em 120 dias e quantidade 100
    E ele clicar em "Confirmar Entrada no Estoque" e confirmar em "Confirmar e Abastecer Estoque"
    Então a entrada de recebimento deve ser gravada com sucesso exibindo a notificação de abastecimento
    E a guia "GUIA-CAF-2026/150" deve constar na tabela de histórico de recebimentos como "EFETIVADO"
