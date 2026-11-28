# language: pt
Funcionalidade: Jornada E2E Full-Stack de Controle de Estoque, Ajuste Justificado e Relatórios XLSX (Camadas C e D)

  Como farmacêutico responsável pela UBS de Parnaíba
  Quero acessar o módulo de Controle de Estoque, filtrar lotes do mês corrente, realizar um ajuste de saída por avaria, conferir a ficha de rastreabilidade e exportar o relatório em Excel (.xlsx)
  Para validar a integração fim a fim entre o Frontend React e o Servidor HTTP de API (ES-06 a ES-10)

  Cenário: Ajuste rápido de saída por avaria com reflexo imediato na Ficha de Rastreabilidade e exportação XLSX
    Dado que o servidor de backend está com o estoque inicial da UBS de Parnaíba carregado
    Quando o farmacêutico realiza login com o e-mail "farma.parnaiba@farmaubs.dev" e senha "Farma@123456"
    E navega pelo menu lateral para o módulo de "Estoque"
    E expandir a linha do medicamento "Losartana Potássica 50mg" na tabela de saldos
    Então o lote "LT-LOS-01" deve exibir o badge de validade na cor laranja
    Quando ele acionar "Ajuste (+/-)" no lote "LT-LOS-01"
    E registrar saída de 2 unidades por "Avaria Física / Quebra" com justificativa válida e confirmar
    Então o saldo do lote "LT-LOS-01" na tabela deve ser atualizado para "48" unidades
    E ao abrir a "Ficha de Rastreabilidade" do lote "LT-LOS-01", o ajuste recém-realizado deve constar no topo da linha do tempo
    Quando ele fechar a ficha de rastreabilidade, abrir o modal "Exportar (.xlsx)", selecionar "Perdas por Vencimento e Avarias" e baixar a planilha
    Então o arquivo Excel ".xlsx" de estoque deve ser baixado nativamente pelo navegador
