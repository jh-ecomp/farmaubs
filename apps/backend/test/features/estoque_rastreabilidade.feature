# language: pt
Funcionalidade: Rastreabilidade de lote com linha do tempo de movimentações
  Como farmacêutico responsável da UBS
  Quero consultar o histórico cronológico de movimentações de um lote
  Para auditar entradas, saídas, estornos e ajustes e conferir a cadeia de saldos (RF028)

  Cenário: Linha do tempo em ordem cronológica com saldo inicial derivado
    Dado que o lote "L1" da UBS "UBS-A" tem saldo atual de 7 unidades para a rastreabilidade
    E o lote "L1" possui as seguintes movimentações de rastreabilidade:
      | id | dataHora             | tipoBanco           | operacao | saldoAnterior | saldoResultante |
      | m1 | 2026-11-01T10:00:00Z | ENTRADA_RECEBIMENTO | +        | 0             | 10              |
      | m2 | 2026-11-02T10:00:00Z | SAIDA_DISPENSACAO   | -        | 10            | 7               |
    Quando o farmacêutico consulta a rastreabilidade do lote "L1" nas UBSs "UBS-A"
    Então a rastreabilidade deve listar as movimentações na ordem: "m1, m2"
    E o saldo inicial de rastreabilidade deve ser 10 unidades
    E o saldo atual de rastreabilidade deve ser 7 unidades

  Cenário: Eventos no mesmo instante seguem a cadeia de saldos
    Dado que o lote "L1" da UBS "UBS-A" tem saldo atual de 5 unidades para a rastreabilidade
    E o lote "L1" possui as seguintes movimentações de rastreabilidade:
      | id | dataHora             | tipoBanco           | operacao | saldoAnterior | saldoResultante |
      | m3 | 2026-11-01T10:00:00Z | SAIDA_DISPENSACAO   | -        | 10            | 5               |
      | m1 | 2026-11-01T10:00:00Z | ENTRADA_RECEBIMENTO | +        | 0             | 10              |
    Quando o farmacêutico consulta a rastreabilidade do lote "L1" nas UBSs "UBS-A"
    Então a rastreabilidade deve listar as movimentações na ordem: "m1, m3"

  Cenário: Lote sem movimentações retorna histórico vazio
    Dado que o lote "L1" da UBS "UBS-A" tem saldo atual de 12 unidades para a rastreabilidade
    E o lote "L1" não possui movimentações de rastreabilidade
    Quando o farmacêutico consulta a rastreabilidade do lote "L1" nas UBSs "UBS-A"
    Então a rastreabilidade deve listar 0 movimentações
    E o saldo inicial de rastreabilidade deve ser 12 unidades

  Cenário: Lote de outra UBS não é encontrado
    Dado que o lote "L9" pertence à UBS "UBS-B" para a rastreabilidade
    Quando o farmacêutico consulta a rastreabilidade do lote "L9" nas UBSs "UBS-A"
    Então a consulta de rastreabilidade deve falhar com lote não encontrado

  Cenário: Cadeia de saldos inconsistente não bloqueia a consulta
    Dado que o lote "L1" da UBS "UBS-A" tem saldo atual de 99 unidades para a rastreabilidade
    E o lote "L1" possui as seguintes movimentações de rastreabilidade:
      | id | dataHora             | tipoBanco           | operacao | saldoAnterior | saldoResultante |
      | m1 | 2026-11-01T10:00:00Z | ENTRADA_RECEBIMENTO | +        | 0             | 10              |
    Quando o farmacêutico consulta a rastreabilidade do lote "L1" nas UBSs "UBS-A"
    Então a rastreabilidade deve listar as movimentações na ordem: "m1"
    E deve ser registrado um aviso de cadeia de saldos inconsistente para o lote "L1"

  Esquema do Cenário: Tradução do tipo gravado para o tipo exposto
    Dado que o lote "L1" da UBS "UBS-A" tem saldo atual de 1 unidades para a rastreabilidade
    E o lote "L1" possui a movimentação de rastreabilidade do tipo "<tipoBanco>" com operação "<operacao>"
    Quando o farmacêutico consulta a rastreabilidade do lote "L1" nas UBSs "UBS-A"
    Então a movimentação "m1" deve ter o tipo de movimentação "<tipoExposto>"

    Exemplos:
      | tipoBanco                   | operacao | tipoExposto         |
      | ENTRADA_RECEBIMENTO         | +        | ENTRADA_RECEBIMENTO |
      | ESTORNO_RECEBIMENTO         | -        | ESTORNO_ENTRADA     |
      | SAIDA_DISPENSACAO           | -        | SAIDA_DISPENSACAO   |
      | ENTRADA_ESTORNO_DISPENSACAO | +        | ESTORNO_DISPENSACAO |
      | AJUSTE_ENTRADA              | +        | AJUSTE_ENTRADA      |
      | AJUSTE_SAIDA                | -        | AJUSTE_SAIDA        |
