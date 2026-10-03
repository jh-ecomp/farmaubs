# language: pt
Funcionalidade: Ajustes e Controle de Estoque (RF008, ES-03)

  Como operador ou farmacêutico da farmácia municipal
  Quero registrar ajustes justificados de entrada e saída no estoque dos lotes
  Para manter a acurácia do saldo físico e a rastreabilidade completa das movimentações

  Cenário: Ajuste de entrada por correção de inventário
    Dado que o lote possui saldo atual de 10 unidades
    Quando o usuário registrar um ajuste de entrada de 5 unidades com o motivo "CORRECAO_INVENTARIO"
    Então o saldo do lote deve passar para 15 unidades
    E a movimentação "AJUSTE_ENTRADA" deve ser registrada com sucesso

  Cenário: Ajuste de saída justificado por quebra ou avaria física
    Dado que o lote possui saldo atual de 15 unidades
    Quando o usuário registrar um ajuste de saída de 2 unidades com o motivo "AVARIA_FISICA"
    Então o saldo do lote deve passar para 13 unidades
    E a movimentação "AJUSTE_SAIDA" deve ser registrada com sucesso

  Cenário: Bloqueio de ajuste de saída com quantidade superior ao saldo disponível
    Dado que o lote possui saldo atual de 5 unidades
    Quando o usuário tentar realizar ajuste de saída com quantidade 10
    Então o sistema deve recusar a operação informando saldo insuficiente
    E o saldo do lote deve permanecer inalterado em 5 unidades
