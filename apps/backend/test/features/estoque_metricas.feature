# language: pt
Funcionalidade: Métricas analíticas do estoque da UBS
  Como farmacêutico responsável ou gerente de farmácia da UBS
  Quero consultar indicadores consolidados do estoque
  Para agir antes do vencimento dos lotes e do risco de ruptura (RF018, RF022, RF023)

  Cenário: Métricas consolidadas do estoque da UBS
    Dado que a data de referência das métricas de estoque é "2026-10-13"
    E a UBS "UBS-A" possui 85 medicamentos ativos e 12450 unidades físicas no estoque de métricas
    E a UBS "UBS-A" possui os seguintes produtos com consumo apurado no estoque de métricas:
      | produto | saldo | dispensado | dias |
      | P01     | 100   | 300        | 30   |
      | P02     | 200   | 300        | 30   |
      | P03     | 0     | 300        | 30   |
      | P04     | 50    | 150        | 30   |
      | P05     | 210   | 300        | 30   |
      | P06     | 500   | 0          | 30   |
    E a UBS "UBS-A" possui os seguintes lotes no estoque de métricas:
      | lote | validade   | saldo |
      | L01  | 2026-10-14 | 10    |
      | L02  | 2026-10-18 | 10    |
      | L03  | 2026-10-22 | 10    |
      | L04  | 2026-10-25 | 10    |
      | L05  | 2026-10-28 | 10    |
      | L06  | 2026-10-31 | 10    |
      | L07  | 2026-11-15 | 10    |
      | L08  | 2026-12-01 | 10    |
      | L09  | 2026-12-15 | 10    |
      | L10  | 2027-01-01 | 10    |
      | L11  | 2027-01-11 | 10    |
      | L12  | 2026-10-12 | 5     |
      | L13  | 2026-09-30 | 8     |
      | L14  | 2027-06-30 | 40    |
    Quando o farmacêutico consulta as métricas de estoque da UBS "UBS-A"
    Então as métricas de estoque devem apresentar:
      | indicador                          | valor |
      | medicamentos ativos                | 85    |
      | unidades físicas                   | 12450 |
      | itens em risco de ruptura          | 4     |
      | lotes que vencem no mês corrente   | 6     |
      | lotes com validade curta de 90 dias | 11    |
      | lotes vencidos                     | 2     |
    E a data do cálculo das métricas de estoque deve ser "2026-10-13T16:00:00.000Z"

  Cenário: Isolamento das métricas entre UBSs
    Dado que a data de referência das métricas de estoque é "2026-10-13"
    E a UBS "UBS-A" possui 85 medicamentos ativos e 12450 unidades físicas no estoque de métricas
    E a UBS "UBS-B" possui 30 medicamentos ativos e 900 unidades físicas no estoque de métricas
    E a UBS "UBS-B" possui os seguintes lotes no estoque de métricas:
      | lote | validade   | saldo |
      | B01  | 2026-10-20 | 10    |
    Quando o farmacêutico consulta as métricas de estoque da UBS "UBS-A"
    Então as métricas de estoque devem apresentar:
      | indicador                          | valor |
      | medicamentos ativos                | 85    |
      | unidades físicas                   | 12450 |
      | lotes que vencem no mês corrente   | 0     |
    E o repositório de métricas deve ter sido consultado apenas para a UBS "UBS-A"

  Esquema do Cenário: Janela de validade curta com 90 dias inclusivo
    Dado que a data de referência das métricas de estoque é "2026-10-13"
    E a UBS "UBS-A" possui os seguintes lotes no estoque de métricas:
      | lote | validade   | saldo |
      | LX   | <validade> | 10    |
    Quando o farmacêutico consulta as métricas de estoque da UBS "UBS-A"
    Então as métricas de estoque devem apresentar:
      | indicador                          | valor    |
      | lotes que vencem no mês corrente   | <mes>    |
      | lotes com validade curta de 90 dias | <curta>  |
      | lotes vencidos                     | <vencido> |

    Exemplos:
      | validade   | mes | curta | vencido | situação                         |
      | 2027-01-11 | 0   | 1     | 0       | exatamente 90 dias entra         |
      | 2027-01-12 | 0   | 0     | 0       | 91 dias fica fora                |
      | 2026-10-31 | 1   | 1     | 0       | mês corrente está dentro dos 90d |
      | 2026-10-12 | 0   | 0     | 1       | vencido não conta nos alertas    |

  Cenário: Lote com saldo zero não entra nos alertas de validade
    Dado que a data de referência das métricas de estoque é "2026-10-13"
    E a UBS "UBS-A" possui os seguintes lotes no estoque de métricas:
      | lote | validade   | saldo |
      | LZ1  | 2026-10-20 | 0     |
      | LZ2  | 2026-10-05 | 0     |
    Quando o farmacêutico consulta as métricas de estoque da UBS "UBS-A"
    Então as métricas de estoque devem apresentar:
      | indicador                          | valor |
      | lotes que vencem no mês corrente   | 0     |
      | lotes com validade curta de 90 dias | 0     |
      | lotes vencidos                     | 0     |

  Esquema do Cenário: Classificação de risco de ruptura pela cobertura
    Dado que a data de referência das métricas de estoque é "2026-10-13"
    E a UBS "UBS-A" possui os seguintes produtos com consumo apurado no estoque de métricas:
      | produto | saldo   | dispensado   | dias   |
      | PX      | <saldo> | <dispensado> | <dias> |
    Quando o farmacêutico consulta as métricas de estoque da UBS "UBS-A"
    Então as métricas de estoque devem apresentar:
      | indicador                 | valor   |
      | itens em risco de ruptura | <risco> |

    Exemplos:
      | saldo | dispensado | dias | risco | situação                                |
      | 200   | 300        | 30   | 1     | cobertura igual a 20 dias é risco       |
      | 210   | 300        | 30   | 0     | cobertura de 21 dias não é risco        |
      | 0     | 300        | 30   | 1     | saldo zero é risco                      |
      | 500   | 0          | 30   | 0     | consumo zero com saldo positivo         |
      | 500   | 0          | 0    | 0     | sem dias apurados não lança erro        |