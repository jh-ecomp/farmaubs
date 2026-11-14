# language: pt
Funcionalidade: Consulta de saldos de estoque por medicamento e lote
  Como farmacêutico responsável ou gerente de farmácia da UBS
  Quero consultar os saldos de estoque agrupados por medicamento, com seus lotes
  Para identificar rapidamente o que está disponível e o que está perto de vencer (RF005, RF022)

  Cenário: Paginação por medicamento com lotes agrupados
    Dado que a data de referência dos saldos de estoque é "2026-10-13"
    E a UBS "UBS-A" possui os seguintes lotes ativos por medicamento nos saldos de estoque:
      | medicamento | lote | validade   | saldo |
      | Dipirona    | D1   | 2027-01-15 | 10    |
      | Dipirona    | D2   | 2026-12-01 | 20    |
      | Dipirona    | D3   | 2027-06-30 | 40    |
      | Amoxicilina | A1   | 2027-02-01 | 30    |
      | Amoxicilina | A2   | 2027-05-01 | 15    |
      | Losartana   | S1   | 2027-08-01 | 60    |
      | Omeprazol   | O1   | 2027-09-01 | 25    |
    Quando o farmacêutico consulta os saldos de estoque da UBS "UBS-A" na página 1 com 2 itens por página
    Então a consulta de saldos deve retornar 2 medicamentos de um total de 4 em 2 páginas
    E o medicamento "Amoxicilina" deve listar os lotes de saldos na ordem: "A1, A2"
    E o medicamento "Dipirona" deve listar os lotes de saldos na ordem: "D2, D1, D3"
    E o medicamento "Dipirona" deve ter saldo total de 70 unidades nos saldos de estoque
    E os lotes do medicamento "Dipirona" devem ter os status de validade de saldos: "D2=CURTA_90D, D1=REGULAR, D3=REGULAR"

  Cenário: Segunda página não repete medicamentos da primeira
    Dado que a data de referência dos saldos de estoque é "2026-10-13"
    E a UBS "UBS-A" possui os seguintes lotes ativos por medicamento nos saldos de estoque:
      | medicamento | lote | validade   | saldo |
      | Dipirona    | D1   | 2027-01-15 | 10    |
      | Dipirona    | D2   | 2026-12-01 | 20    |
      | Amoxicilina | A1   | 2027-02-01 | 30    |
      | Losartana   | S1   | 2027-08-01 | 60    |
      | Omeprazol   | O1   | 2027-09-01 | 25    |
    Quando o farmacêutico consulta os saldos de estoque da UBS "UBS-A" na página 2 com 2 itens por página
    Então a consulta de saldos deve retornar 2 medicamentos de um total de 4 em 2 páginas
    E o medicamento "Losartana" deve listar os lotes de saldos na ordem: "S1"
    E o medicamento "Omeprazol" deve listar os lotes de saldos na ordem: "O1"

  Cenário: Filtro de validade do mês corrente
    Dado que a data de referência dos saldos de estoque é "2026-10-13"
    E a UBS "UBS-A" possui os seguintes lotes ativos por medicamento nos saldos de estoque:
      | medicamento | lote | validade   | saldo |
      | Dipirona    | D1   | 2026-10-20 | 10    |
      | Dipirona    | D2   | 2027-03-01 | 20    |
      | Amoxicilina | A1   | 2026-12-01 | 30    |
      | Losartana   | S1   | 2026-10-12 | 60    |
    Quando o farmacêutico consulta os saldos de estoque da UBS "UBS-A" com o filtro de validade "MES_CORRENTE"
    Então a consulta de saldos deve retornar 1 medicamentos de um total de 1 em 1 páginas
    E o medicamento "Dipirona" deve listar os lotes de saldos na ordem: "D1, D2"
    E os lotes do medicamento "Dipirona" devem ter os status de validade de saldos: "D1=MES_CORRENTE, D2=REGULAR"

  Cenário: Isolamento dos saldos entre UBSs
    Dado que a data de referência dos saldos de estoque é "2026-10-13"
    E a UBS "UBS-A" possui os seguintes lotes ativos por medicamento nos saldos de estoque:
      | medicamento | lote | validade   | saldo |
      | Dipirona    | D1   | 2027-01-15 | 10    |
    E a UBS "UBS-B" possui os seguintes lotes ativos por medicamento nos saldos de estoque:
      | medicamento | lote | validade   | saldo |
      | Amoxicilina | B1   | 2027-02-01 | 99    |
    Quando o farmacêutico consulta os saldos de estoque da UBS "UBS-A" na página 1 com 10 itens por página
    Então a consulta de saldos deve retornar 1 medicamentos de um total de 1 em 1 páginas
    E o medicamento "Dipirona" deve listar os lotes de saldos na ordem: "D1"
    E o repositório de saldos deve ter sido consultado apenas para a UBS "UBS-A"