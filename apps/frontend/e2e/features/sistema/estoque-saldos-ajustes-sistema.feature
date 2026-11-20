# language: pt
Funcionalidade: Controle de Estoque, Lotes FEFO com Alerta Laranja e Ajustes Justificados (Camada D)

  Como farmacêutico responsável pela UBS
  Quero monitorar os indicadores de estoque, filtrar por validade no mês corrente, inspecionar lotes em cascata com alerta laranja e registrar ajustes justificados
  Para prevenir vencimentos e rupturas com conformidade sanitária e acessibilidade WCAG 2.1 AA (RF005, RF009, RF011, RF018, RF022, RF023, RF028, ADR-032)

  Contexto:
    Dado que as APIs do módulo de controle de estoque da UBS estão operacionais
    E que o farmacêutico autenticado acessa o painel de Controle de Estoque da UBS

  Cenário: Filtragem por card de validade no mês corrente, expansão de lote com badge laranja e auditoria WCAG 2.1 AA
    Quando ele clicar no cartão "Lotes Vencendo no Mês"
    E expandir a linha do medicamento "Losartana Potássica 50mg" na tabela de saldos
    Então o lote "LT-LOS-01" deve exibir o badge de validade na cor laranja
    E a tela de estoque não deve apresentar violações de contraste ou acessibilidade WCAG 2.1 AA

  Cenário: Bloqueio do motivo Outro com justificativa inferior a 20 caracteres e ajuste rápido de saída por avaria com reflexo na Ficha de Rastreabilidade
    Dado que o farmacêutico expandiu os lotes do medicamento "Losartana Potássica 50mg"
    Quando ele acionar "Ajuste (+/-)" no lote "LT-LOS-01"
    E selecionar o motivo "Outro" e digitar a justificativa curta "ajuste"
    Então o botão "Confirmar Ajuste" deve permanecer desabilitado com aviso de mínimo de 20 caracteres
    Quando ele registrar saída de 2 unidades por "Avaria Física / Quebra" com justificativa válida e confirmar
    Então o saldo do lote "LT-LOS-01" na tabela deve ser atualizado para "48" unidades
    E ao abrir a "Ficha de Rastreabilidade" do lote "LT-LOS-01", o ajuste recém-realizado deve constar no topo da linha do tempo
