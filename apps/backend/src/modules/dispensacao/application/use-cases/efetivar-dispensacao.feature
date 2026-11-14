# language: pt
Funcionalidade: Efetivação Transacional de Dispensação e Baixa de Estoque (Camada A)

  Cenário: Dispensação de medicamentos comuns com baixa atômica bem-sucedida
    Dado que a UBS possui o lote "LOT-01" de "Paracetamol 500mg" com saldo 50
    E o paciente possui CNS "123456789012345", CPF "12345678909", nome "Carlos Silva" e nascimento "1990-01-01"
    Quando o farmacêutico efetivar a dispensação de 20 comprimidos do lote "LOT-01"
    Então a dispensação deve ser concluída com status "concluida"
    E o saldo restante do lote "LOT-01" deve ser atualizado para 30

  Cenário: Rejeição por receita de antimicrobiano emitida há mais de 10 dias
    Dado que a dispensação contém o medicamento antimicrobiano "Amoxicilina 500mg"
    E a data de emissão da receita médica é de 12 dias atrás
    Quando o farmacêutico tentar efetivar a dispensação
    Então uma exceção ReceitaAntimicrobianoVencidaException deve ser lançada
    E nenhum saldo de estoque deve ser decrementado

  Cenário: Rejeição por saldo insuficiente no lote selecionado
    Dado que o lote selecionado possui saldo atual de 10 unidades
    Quando o farmacêutico submeter uma dispensação de 15 unidades para esse lote
    Então uma exceção SaldoInsuficienteLoteException deve ser lançada
    E a transação deve sofrer rollback imediato

